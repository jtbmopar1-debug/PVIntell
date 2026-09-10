import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseVaultCredentialService } from "@/monitoring/credential-service";
import { authenticateDeye, fetchDeyeStationLatest, listDeyeStationDevices, listDeyeStations, type DeyeTokenCredential } from "@/monitoring/deye-cloud";

const scope = z.object({ siteId: z.uuid(), systemId: z.uuid() });
const login = z.object({ email: z.email(), password: z.string().min(1).max(300), region: z.enum(["eu", "us"]) });
const discoverInput = scope.extend({ action: z.literal("discover") }).extend(login.shape);
const connectInput = scope.extend({ action: z.literal("connect"), stationId: z.string().min(1).max(100) }).extend(login.shape);
const syncInput = scope.extend({ action: z.literal("sync") });
const input = z.discriminatedUnion("action", [discoverInput, connectInput, syncInput]);

function readingRow(reading: Awaited<ReturnType<typeof fetchDeyeStationLatest>>, values: { connectionId: string; ownerId: string; siteId: string; systemId: string }) {
  return {
    connection_id: values.connectionId, owner_id: values.ownerId, site_id: values.siteId, project_id: values.systemId,
    measured_at: reading.measuredAt, received_at: new Date().toISOString(),
    pv_power_w: reading.pvPowerW ?? null, load_power_w: reading.loadPowerW ?? null,
    battery_power_w: reading.batteryPowerW ?? null, battery_voltage_v: reading.batteryVoltageV ?? null,
    battery_current_a: reading.batteryCurrentA ?? null, battery_soc_percent: reading.batterySocPercent ?? null,
    grid_power_w: reading.gridPowerW ?? null, inverter_state: reading.inverterState ?? null,
    generated_energy_today_wh: reading.generatedEnergyTodayWh ?? null, consumed_energy_today_wh: reading.consumedEnergyTodayWh ?? null,
  };
}

async function saveReading(admin: ReturnType<typeof createAdminClient>, row: ReturnType<typeof readingRow>) {
  const [sample, latest] = await Promise.all([
    admin.from("monitoring_samples").upsert(row, { onConflict: "connection_id,measured_at" }),
    admin.from("monitoring_latest_readings").upsert(row, { onConflict: "project_id" }),
  ]);
  if (sample.error || latest.error) throw new Error("DeyeCloud telemetry could not be saved");
}

export async function POST(request: Request) {
  const userDb = await createClient(); const claims = await userDb.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid DeyeCloud connection request" }, { status: 400 });
  const values = parsed.data;
  const owned = await userDb.from("projects").select("id").eq("id", values.systemId).eq("site_id", values.siteId).eq("owner_id", ownerId).maybeSingle();
  if (owned.error || !owned.data) return Response.json({ error: "System not found" }, { status: 404 });

  if (values.action === "discover") {
    try {
      const token = await authenticateDeye(values);
      const stations = await listDeyeStations(token);
      return Response.json({ stations });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "DeyeCloud sign-in failed" }, { status: 502 });
    }
  }

  const admin = createAdminClient(); const vault = new SupabaseVaultCredentialService(admin); const now = new Date().toISOString();
  if (values.action === "connect") {
    let pendingConnectionId: string | undefined;
    try {
      const token = await authenticateDeye(values);
      const stations = await listDeyeStations(token);
      const station = stations.find((item) => item.id === values.stationId);
      if (!station) return Response.json({ error: "That DeyeCloud station is no longer available to this account" }, { status: 409 });
      const assigned = await admin.from("monitoring_connections").select("id,site_id,project_id").eq("owner_id", ownerId).eq("provider", "deye_cloud").eq("provider_account_ref", station.id).limit(1).maybeSingle();
      if (assigned.error) throw new Error("Could not inspect the DeyeCloud station assignment");
      if (assigned.data && (assigned.data.site_id !== values.siteId || assigned.data.project_id !== values.systemId)) return Response.json({ error: `${station.name} is already assigned to another PVIntell system` }, { status: 409 });

      const inactive = await admin.from("monitoring_connections").update({ is_active: false }).eq("owner_id", ownerId).eq("project_id", values.systemId).eq("is_active", true);
      if (inactive.error) throw new Error("Could not switch the active monitoring connection");
      let connection = await admin.from("monitoring_connections").select("id").eq("owner_id", ownerId).eq("site_id", values.siteId).eq("project_id", values.systemId).eq("provider", "deye_cloud").eq("provider_account_ref", station.id).maybeSingle();
      if (connection.error) throw new Error("Could not inspect the DeyeCloud connection");
      if (!connection.data) connection = await admin.from("monitoring_connections").insert({ owner_id: ownerId, site_id: values.siteId, project_id: values.systemId, provider: "deye_cloud", display_name: station.name, provider_account_ref: station.id, status: "connecting", is_active: true, capabilities: ["current", "history", "solar", "battery", "grid"], last_attempt_at: now }).select("id").single();
      else {
        const updated = await admin.from("monitoring_connections").update({ display_name: station.name, status: "connecting", status_message: null, is_active: true, last_attempt_at: now }).eq("id", connection.data.id);
        if (updated.error) throw new Error("Could not update the DeyeCloud connection");
      }
      if (connection.error || !connection.data) throw new Error("Could not create the DeyeCloud connection");
      pendingConnectionId = connection.data.id;

      const credential: DeyeTokenCredential = { ...token, stationId: station.id };
      const credentialScope = { ownerId, siteId: values.siteId, systemId: values.systemId, connectionId: connection.data.id };
      await vault.store(credentialScope, credential);
      const [devices, reading] = await Promise.all([listDeyeStationDevices(credential), fetchDeyeStationLatest(credential)]);
      const deviceRows = (devices.length ? devices : [{ providerDeviceId: station.id, deviceType: "station", displayName: station.name, capabilities: ["current"] }]).map((device) => ({ connection_id: connection.data!.id, owner_id: ownerId, site_id: values.siteId, project_id: values.systemId, provider_device_id: device.providerDeviceId, device_type: device.deviceType, display_name: device.displayName, status: "online", last_seen_at: reading.measuredAt }));
      const deviceSave = await admin.from("monitoring_devices").upsert(deviceRows, { onConflict: "connection_id,provider_device_id" });
      if (deviceSave.error) throw new Error("DeyeCloud devices could not be saved");
      await saveReading(admin, readingRow(reading, { connectionId: connection.data.id, ownerId, siteId: values.siteId, systemId: values.systemId }));
      const connected = await admin.from("monitoring_connections").update({ status: "connected", status_message: null, last_success_at: now, last_attempt_at: now }).eq("id", connection.data.id);
      if (connected.error) throw new Error("DeyeCloud connected, but its status could not be saved");
      return Response.json({ ok: true, connectionId: connection.data.id, station: { id: station.id, name: station.name } });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 240) : "DeyeCloud connection failed";
      if (pendingConnectionId) await admin.from("monitoring_connections").update({ status: "error", status_message: message, last_attempt_at: now, last_failure_at: now }).eq("id", pendingConnectionId);
      return Response.json({ error: message }, { status: 502 });
    }
  }

  const connection = await admin.from("monitoring_connections").select("id").eq("owner_id", ownerId).eq("site_id", values.siteId).eq("project_id", values.systemId).eq("provider", "deye_cloud").eq("is_active", true).limit(1).maybeSingle();
  if (connection.error) return Response.json({ error: "Could not inspect the DeyeCloud connection" }, { status: 500 });
  if (!connection.data) return Response.json({ skipped: true });
  const connectionId = connection.data.id;
  const sync = await admin.from("monitoring_sync_attempts").insert({ connection_id: connectionId, owner_id: ownerId, site_id: values.siteId, project_id: values.systemId, status: "running", started_at: now }).select("id").single();
  try {
    const credential = await vault.resolve({ ownerId, siteId: values.siteId, systemId: values.systemId, connectionId }) as DeyeTokenCredential;
    if (credential.expiresAt && new Date(credential.expiresAt).getTime() <= Date.now()) throw new Error("DeyeCloud authorization expired. Reconnect this station.");
    const reading = await fetchDeyeStationLatest(credential);
    await saveReading(admin, readingRow(reading, { connectionId, ownerId, siteId: values.siteId, systemId: values.systemId }));
    await Promise.all([
      admin.from("monitoring_connections").update({ status: "connected", status_message: null, last_attempt_at: now, last_success_at: now }).eq("id", connectionId),
      sync.data ? admin.from("monitoring_sync_attempts").update({ status: "success", finished_at: new Date().toISOString(), samples_written: 1 }).eq("id", sync.data.id) : Promise.resolve(),
    ]);
    return Response.json({ ok: true, measuredAt: reading.measuredAt });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : "DeyeCloud sync failed";
    await Promise.all([
      admin.from("monitoring_connections").update({ status: /expired|authorization/i.test(message) ? "setup_required" : "degraded", status_message: message, last_attempt_at: now, last_failure_at: now }).eq("id", connectionId),
      sync.data ? admin.from("monitoring_sync_attempts").update({ status: "failed", finished_at: new Date().toISOString(), error_code: "DEYE_SYNC", error_message: message }).eq("id", sync.data.id) : Promise.resolve(),
    ]);
    return Response.json({ error: message }, { status: 502 });
  }
}
