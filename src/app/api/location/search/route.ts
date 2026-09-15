import { createClient } from "@/lib/supabase/server";

type OpenMeteoResult = { name: string; admin1?: string; admin2?: string; country?: string; latitude: number; longitude: number; timezone?: string };
type NominatimResult = { place_id: number; lat: string; lon: string; name?: string; display_name: string; addresstype?: string; type?: string; address?: { state?: string; region?: string; province?: string; country?: string; country_code?: string } };

export async function GET(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const jurisdictionScope = new URL(request.url).searchParams.get("scope") === "jurisdiction";
  if (query.length < 2 || query.length > 200) return Response.json({ error: "Enter at least two characters." }, { status: 400 });
  try {
    if (jurisdictionScope) {
      const base = "https://nominatim.openstreetmap.org/search";
      const common = `q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=8&accept-language=en&email=pvintell1%40gmail.com`;
      const response = await fetch(`${base}?${common}`, { headers: { "user-agent": "PVIntell regulatory jurisdiction search (pvintell1@gmail.com)" }, next: { revalidate: 86_400 } });
      if (!response.ok) throw new Error("Jurisdiction service unavailable");
      const rows = await response.json() as NominatimResult[];
      const results = rows.map((result) => {
        const region = result.address?.state || result.address?.province || result.address?.region;
        const country = result.address?.country || result.name || result.display_name;
        const isCountry = (result.addresstype || result.type) === "country" || !region;
        return {
          name: isCountry ? country : region,
          label: isCountry ? country : [region, country].filter((part, index, all) => part && all.indexOf(part) === index).join(", "),
          level: isCountry ? "Country jurisdiction" : "State / province jurisdiction",
          countryCode: result.address?.country_code?.toUpperCase(),
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          timezone: "UTC",
        };
      }).filter((result, index, all) => result.label && all.findIndex((candidate) => candidate.label === result.label) === index);
      return Response.json({ results });
    }
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error("Location service unavailable");
    const body = await response.json() as { results?: OpenMeteoResult[] };
    const mappedResults = (body.results ?? []).map((result) => ({
      name: result.name,
      label: jurisdictionScope
        ? [result.admin1 || result.name, result.country].filter((part, index, all) => part && all.indexOf(part) === index).join(", ")
        : [result.name, result.admin2, result.admin1, result.country].filter((part, index, all) => part && all.indexOf(part) === index).join(", "),
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone || "UTC",
    }));
    const results = jurisdictionScope
      ? mappedResults.filter((result, index, all) => all.findIndex((candidate) => candidate.label === result.label) === index)
      : mappedResults;
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Location search is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
}
