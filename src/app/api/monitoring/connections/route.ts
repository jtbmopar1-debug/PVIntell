import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseVaultCredentialService } from "@/monitoring/credential-service";
import { discoverDessCollectors } from "@/monitoring/dess-monitor";

const inputSchema = z.object({ siteId: z.uuid(), systemId: z.uuid(), provider: z.literal("dess_monitor"), username: z.string().trim().min(1).max(200), password: z.string().min(1).max(500) });
const disconnectSchema = z.object({ siteId: z.uuid(), systemId: z.uuid(), connectionId: z.uuid() });
const activateSchema = disconnectSchema.extend({ action: z.literal("activate") });

export async function GET() {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [connections, sites, systems] = await Promise.all([
    db.from("monitoring_connections").select("id,site_id,project_id,provider,display_name,provider_account_ref,status,is_active,last_success_at,created_at").eq("owner_id", ownerId).order("created_at"),
    db.from("sites").select("id,name").eq("owner_id", ownerId).order("name"),
    db.from("projects").select("id,site_id,name").eq("owner_id", ownerId).order("name"),
  ]);
  const failure = connections.error ?? sites.error ?? systems.error;
  if (failure) return Response.json({ error: "Could not load monitoring connections" }, { status: 500 });
  return Response.json({ connections: connections.data ?? [], sites: sites.data ?? [], systems: systems.data ?? [] });
}
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
    await db.from("monitoring_connections").update({ is_active: false }).eq("owner_id", ownerId).eq("project_id", parsed.data.systemId).eq("is_active", true);
    const created = await db.from("monitoring_connections").insert({ owner_id: ownerId, site_id: parsed.data.siteId, project_id: parsed.data.systemId, provider: parsed.data.provider, display_name: "DESSMonitor", provider_account_ref: parsed.data.username, status: "connected", is_active: true, capabilities: ["current", "history", "alerts"], last_attempt_at: new Date().toISOString(), last_success_at: new Date().toISOString() }).select("id").single();
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

export async function PATCH(request: Request) {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = activateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid monitoring connection" }, { status: 400 });
  const target = await db.from("monitoring_connections").select("id").eq("id", parsed.data.connectionId).eq("owner_id", ownerId).eq("site_id", parsed.data.siteId).eq("project_id", parsed.data.systemId).maybeSingle();
  if (target.error || !target.data) return Response.json({ error: "Monitoring connection not found" }, { status: 404 });
  const inactive = await db.from("monitoring_connections").update({ is_active: false }).eq("owner_id", ownerId).eq("project_id", parsed.data.systemId).eq("is_active", true);
  if (inactive.error) return Response.json({ error: "Could not switch monitoring connections" }, { status: 500 });
  const active = await db.from("monitoring_connections").update({ is_active: true }).eq("id", parsed.data.connectionId).eq("owner_id", ownerId);
  if (active.error) return Response.json({ error: "Could not activate monitoring connection" }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = disconnectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid monitoring connection" }, { status: 400 });
  const deleted = await db.from("monitoring_connections").delete()
    .eq("id", parsed.data.connectionId).eq("owner_id", ownerId).eq("site_id", parsed.data.siteId).eq("project_id", parsed.data.systemId)
    .select("id").maybeSingle();
  if (deleted.error) return Response.json({ error: "Could not disconnect monitoring" }, { status: 500 });
  if (!deleted.data) return Response.json({ error: "Monitoring connection not found" }, { status: 404 });
  return Response.json({ ok: true });
}
