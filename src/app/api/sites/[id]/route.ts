import { z } from "zod";
import tzLookup from "tz-lookup";
import { createClient } from "@/lib/supabase/server";

const locationSchema = z.object({
  location: z.string().trim().min(1).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().min(1).max(100),
  locationSource: z.enum(["manual", "device", "search"]),
});
const nameSchema = z.object({ name: z.string().trim().min(1).max(120) });
const updateSchema = z.union([locationSchema, nameSchema]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter valid Site details." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const input = parsed.data;
  if ("name" in input) {
    const updated = await supabase.from("sites").update({ name: input.name }).eq("id", id).eq("owner_id", userId).select("id").single();
    if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
    return Response.json({ ok: true });
  }
  let timezone = input.timezone;
  try { timezone = tzLookup(input.latitude, input.longitude); } catch { /* Retain the supplied IANA timezone if lookup fails. */ }
  const updated = await supabase.from("sites").update({ location: input.location, latitude: input.latitude, longitude: input.longitude, timezone, location_source: input.locationSource, location_confirmed: true }).eq("id", id).select("id,timezone").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  return Response.json({ ok: true, timezone: updated.data.timezone });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await supabase.rpc("delete_site_workspace", { target_site_id: id });
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
  const outcome = removed.data as { deleted?: boolean } | null;
  if (!outcome?.deleted) return Response.json({ error: "Site not found." }, { status: 404 });
  return Response.json({ deleted: true });
}
