import { z } from "zod";
import tzLookup from "tz-lookup";
import { createClient } from "@/lib/supabase/server";

const locationSchema = z.object({
  location: z.string().trim().min(1).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().min(1).max(100),
  locationSource: z.enum(["manual", "device"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = locationSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter a valid site location and coordinates." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const input = parsed.data;
  let timezone = input.timezone;
  try { timezone = tzLookup(input.latitude, input.longitude); } catch { /* Retain the supplied IANA timezone if lookup fails. */ }
  const updated = await supabase.from("sites").update({ location: input.location, latitude: input.latitude, longitude: input.longitude, timezone, location_source: input.locationSource, location_confirmed: true }).eq("id", id).select("id,timezone").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  return Response.json({ ok: true, timezone: updated.data.timezone });
}
