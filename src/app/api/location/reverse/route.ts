import tzLookup from "tz-lookup";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("latitude")); const longitude = Number(params.get("longitude"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return Response.json({ error: "Invalid location coordinates." }, { status: 400 });
  try {
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`, { cache: "no-store" });
    if (!response.ok) throw new Error("Reverse location service unavailable");
    const body = await response.json() as { locality?: string; city?: string; principalSubdivision?: string; countryName?: string };
    const label = [body.locality || body.city, body.principalSubdivision, body.countryName].filter((part, index, all) => part && all.indexOf(part) === index).join(", ");
    if (!label) throw new Error("Region not found");
    let timezone = "UTC"; try { timezone = tzLookup(latitude, longitude); } catch { /* The worldwide selector remains editable. */ }
    return Response.json({ label, timezone });
  } catch {
    return Response.json({ error: "Your coordinates were received, but the broad region could not be identified. Search for it by name instead." }, { status: 503 });
  }
}
