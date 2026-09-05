import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const input = z.object({
  siteId: z.uuid(), systemId: z.uuid(), adapter: z.literal("junctek"), deviceId: z.string().min(1).max(300), displayName: z.string().min(1).max(200),
  reading: z.object({ measuredAt: z.iso.datetime(), batteryPowerW: z.number().finite().optional(), batteryVoltageV: z.number().finite().optional(), batteryCurrentA: z.number().finite().optional(), batterySocPercent: z.number().min(0).max(100).optional() }).refine((row) => Object.keys(row).some((key) => key !== "measuredAt"), "No measurements supplied"),
});
export async function POST(request: Request) {
  const userDb = await createClient(); const claims = await userDb.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Invalid local-device reading" }, { status: 400 });
  const scope = await userDb.from("projects").select("id").eq("id", parsed.data.systemId).eq("site_id", parsed.data.siteId).eq("owner_id", ownerId).maybeSingle();
  if (scope.error || !scope.data) return Response.json({ error: "System not found" }, { status: 404 });
  const admin = createAdminClient(); const now = new Date().toISOString();
  const assigned = await admin.from("monitoring_connections").select("id,site_id,project_id").eq("owner_id", ownerId).eq("provider", "junctek_local").eq("provider_account_ref", parsed.data.deviceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (assigned.error) return Response.json({ error: "Could not inspect the Bluetooth device assignment" }, { status: 500 });
  if (assigned.data && (assigned.data.site_id !== parsed.data.siteId || assigned.data.project_id !== parsed.data.systemId)) return Response.json({ error: `${parsed.data.displayName} is assigned to another system. Reassign or forget it in Settings → Connections.` }, { status: 409 });
  let connection = await admin.from("monitoring_connections").select("id").eq("owner_id", ownerId).eq("site_id", parsed.data.siteId).eq("project_id", parsed.data.systemId).eq("provider", "junctek_local").eq("provider_account_ref", parsed.data.deviceId).maybeSingle();
  if (connection.error) return Response.json({ error: "Could not inspect local monitoring connection" }, { status: 500 });
  await admin.from("monitoring_connections").update({ is_active: false }).eq("owner_id", ownerId).eq("project_id", parsed.data.systemId).eq("is_active", true);
  if (!connection.data) connection = await admin.from("monitoring_connections").insert({ owner_id: ownerId, site_id: parsed.data.siteId, project_id: parsed.data.systemId, provider: "junctek_local", display_name: parsed.data.displayName, provider_account_ref: parsed.data.deviceId, status: "connected", is_active: true, capabilities: ["current", "battery"], last_attempt_at: now, last_success_at: now }).select("id").single();
  if (connection.error || !connection.data) return Response.json({ error: "Could not create local monitoring connection" }, { status: 500 });
  const connectionId = connection.data.id; const r = parsed.data.reading;
  const row = { connection_id: connectionId, owner_id: ownerId, site_id: parsed.data.siteId, project_id: parsed.data.systemId, measured_at: r.measuredAt, received_at: now, battery_power_w: r.batteryPowerW ?? null, battery_voltage_v: r.batteryVoltageV ?? null, battery_current_a: r.batteryCurrentA ?? null, battery_soc_percent: r.batterySocPercent ?? null };
  const [device, sample, latest] = await Promise.all([
    admin.from("monitoring_devices").upsert({ connection_id: connectionId, owner_id: ownerId, site_id: parsed.data.siteId, project_id: parsed.data.systemId, provider_device_id: parsed.data.deviceId, device_type: "battery_monitor", display_name: parsed.data.displayName, status: "online", last_seen_at: now }, { onConflict: "connection_id,provider_device_id" }),
    admin.from("monitoring_samples").upsert(row, { onConflict: "connection_id,measured_at" }),
    admin.from("monitoring_latest_readings").upsert(row, { onConflict: "project_id" }),
  ]);
  const failure = device.error ?? sample.error ?? latest.error;
  if (failure) return Response.json({ error: "The local reading could not be saved" }, { status: 500 });
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const expired = await admin.from("monitoring_samples").delete().eq("connection_id", connectionId).lt("measured_at", cutoff);
  if (expired.error) return Response.json({ error: "The local reading was saved, but expired history could not be removed" }, { status: 500 });
  await admin.from("monitoring_connections").update({ status: "connected", is_active: true, last_attempt_at: now, last_success_at: now, status_message: null }).eq("id", connectionId);
  return Response.json({ ok: true, measuredAt: r.measuredAt });
}
