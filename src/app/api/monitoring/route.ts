import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadMonitoringSnapshot, MonitoringScopeNotFoundError } from "@/monitoring/repository";
const schema = z.object({ siteId: z.uuid(), systemId: z.uuid() });
export async function GET(request: Request) {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url); const parsed = schema.safeParse({ siteId: url.searchParams.get("siteId"), systemId: url.searchParams.get("systemId") });
  if (!parsed.success) return Response.json({ error: "A valid site and system are required" }, { status: 400 });
  try { return Response.json(await loadMonitoringSnapshot(db, ownerId, parsed.data.siteId, parsed.data.systemId), { headers: { "cache-control": "private, no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof MonitoringScopeNotFoundError ? "System not found" : "Monitoring data is unavailable" }, { status: error instanceof MonitoringScopeNotFoundError ? 404 : 503 }); }
}
