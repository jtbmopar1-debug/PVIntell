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
  let connection = await admin.from("monitoring_connections").select("id").eq("owner_id", ownerId).eq("site_id", parsed.data.siteId).eq("project_id", parsed.data.systemId).eq("provider", "junctek_local").eq("provider_account_ref", parsed.data.deviceId).maybeSingle();
  if (connection.error) return Response.json({ error: "Could not inspect local monitoring connection" }, { status: 500 });
  if (!connection.data) connection = await admin.from("monitoring_connections").insert({ owner_id: ownerId, site_id: parsed.data.siteId, project_id: parsed.data.systemId, provider: "junctek_local", display_name: parsed.data.displayName, provider_account_ref: parsed.data.deviceId, status: "connected", capabilities: ["current", "battery"], last_attempt_at: now, last_success_at: now }).select("id").single();
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
  await admin.from("monitoring_connections").update({ status: "connected", last_attempt_at: now, last_success_at: now, status_message: null }).eq("id", connectionId);
  return Response.json({ ok: true, measuredAt: r.measuredAt });
}
