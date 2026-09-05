import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseVaultCredentialService } from "@/monitoring/credential-service";
import { discoverDessCollectors } from "@/monitoring/dess-monitor";

const inputSchema = z.object({ siteId: z.uuid(), systemId: z.uuid(), provider: z.literal("dess_monitor"), username: z.string().trim().min(1).max(200), password: z.string().min(1).max(500) });
export async function POST(request: Request) {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter your DESSMonitor username and password" }, { status: 400 });
  const scope = await db.from("projects").select("id").eq("id", parsed.data.systemId).eq("site_id", parsed.data.siteId).eq("owner_id", ownerId).maybeSingle();
  if (scope.error || !scope.data) return Response.json({ error: "System not found" }, { status: 404 });
  try {
    const collectors = await discoverDessCollectors({ username: parsed.data.username, password: parsed.data.password });
    if (!collectors.length) return Response.json({ error: "Sign-in worked, but no DESSMonitor logger was found on this account" }, { status: 422 });
    const created = await db.from("monitoring_connections").insert({ owner_id: ownerId, site_id: parsed.data.siteId, project_id: parsed.data.systemId, provider: parsed.data.provider, display_name: "DESSMonitor", provider_account_ref: parsed.data.username, status: "connected", capabilities: ["current", "history", "alerts"], last_attempt_at: new Date().toISOString(), last_success_at: new Date().toISOString() }).select("id").single();
    if (created.error) throw new Error("Could not create the monitoring connection");
    const admin = createAdminClient();
    const credentialService = new SupabaseVaultCredentialService(admin);
    try { await credentialService.store({ ownerId, siteId: parsed.data.siteId, systemId: parsed.data.systemId, connectionId: created.data.id }, { username: parsed.data.username, password: parsed.data.password }); }
    catch (error) { await db.from("monitoring_connections").delete().eq("id", created.data.id); throw error; }
    const deviceRows = collectors.map((collector) => ({ connection_id: created.data.id, owner_id: ownerId, site_id: parsed.data.siteId, project_id: parsed.data.systemId, provider_device_id: collector.providerDeviceId, device_type: "data_logger", display_name: collector.displayName, status: collector.status === "1" ? "online" : "unknown" }));
    const devices = await admin.from("monitoring_devices").insert(deviceRows);
    if (devices.error) {
      await credentialService.delete({ ownerId, siteId: parsed.data.siteId, systemId: parsed.data.systemId, connectionId: created.data.id });
      await db.from("monitoring_connections").delete().eq("id", created.data.id);
      throw new Error("Connected, but device discovery could not be saved");
    }
    return Response.json({ ok: true, connectionId: created.data.id, devices: collectors.map(({ providerDeviceId, displayName, method, status }) => ({ providerDeviceId, displayName, method, status })) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "DESSMonitor connection failed" }, { status: 400 }); }
}
