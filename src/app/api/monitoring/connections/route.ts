import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const disconnectSchema = z.object({ siteId: z.uuid(), systemId: z.uuid(), connectionId: z.uuid() });
const activateSchema = disconnectSchema.extend({ action: z.literal("activate") });

export async function GET() {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [connections, sites, systems] = await Promise.all([
    db.from("monitoring_connections").select("id,site_id,project_id,provider,display_name,provider_account_ref,status,is_active,last_success_at,created_at").eq("owner_id", ownerId).eq("provider", "junctek_local").order("created_at"),
    db.from("sites").select("id,name").eq("owner_id", ownerId).order("name"),
    db.from("projects").select("id,site_id,name").eq("owner_id", ownerId).order("name"),
  ]);
  const failure = connections.error ?? sites.error ?? systems.error;
  if (failure) return Response.json({ error: "Could not load monitoring connections" }, { status: 500 });
  return Response.json({ connections: connections.data ?? [], sites: sites.data ?? [], systems: systems.data ?? [] });
}
export async function POST() {
  const db = await createClient(); const claims = await db.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ error: "Only Junctek connections are currently available. Use Connect Junctek in the selected system." }, { status: 403 });
}

export async function PATCH(request: Request) {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = activateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid monitoring connection" }, { status: 400 });
  const target = await db.from("monitoring_connections").select("id").eq("id", parsed.data.connectionId).eq("owner_id", ownerId).eq("site_id", parsed.data.siteId).eq("project_id", parsed.data.systemId).eq("provider", "junctek_local").maybeSingle();
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
