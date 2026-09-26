import { z } from "zod";
import tzLookup from "tz-lookup";
import { createClient } from "@/lib/supabase/server";

const siteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().min(1).max(100),
  locationSource: z.enum(["manual", "device", "search"]),
});

export async function POST(request: Request) {
  const parsed = siteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Name the Site and choose its location." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  let timezone = parsed.data.timezone;
  try { timezone = tzLookup(parsed.data.latitude, parsed.data.longitude); } catch { /* Retain the supplied timezone if lookup fails. */ }
  const created = await supabase.from("sites").insert({
    owner_id: userId,
    name: parsed.data.name,
    location: parsed.data.location,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    timezone,
    location_source: parsed.data.locationSource,
    location_confirmed: true,
  }).select("id").single();
  if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
  return Response.json({ id: created.data.id }, { status: 201 });
}
