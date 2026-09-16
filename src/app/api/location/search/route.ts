import { createClient } from "@/lib/supabase/server";
import tzLookup from "tz-lookup";

type OpenMeteoResult = { name: string; admin1?: string; admin2?: string; country?: string; country_code?: string; latitude: number; longitude: number; timezone?: string };
type NominatimResult = { place_id: number; lat: string; lon: string; name?: string; display_name: string; addresstype?: string; type?: string; address?: { state?: string; region?: string; province?: string; country?: string; country_code?: string } };
type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string; housenumber?: string; street?: string; locality?: string; district?: string;
    city?: string; county?: string; state?: string; postcode?: string; country?: string; countrycode?: string;
  };
};

function timezoneFor(latitude: number, longitude: number, fallback = "UTC") {
  try { return tzLookup(latitude, longitude); } catch { return fallback; }
}

function uniqueParts(parts: Array<string | undefined>) {
  return parts.filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const jurisdictionScope = params.get("scope") === "jurisdiction";
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
          label: isCountry ? country : uniqueParts([region, country]).join(", "),
          level: isCountry ? "Country jurisdiction" : "State / province jurisdiction",
          countryCode: result.address?.country_code?.toUpperCase(),
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          timezone: "UTC",
        };
      }).filter((result, index, all) => result.label && all.findIndex((candidate) => candidate.label === result.label) === index);
      return Response.json({ results });
    }
    const [profile, fallbackSite] = await Promise.all([
      supabase.from("profiles").select("home_location").eq("id", claims.data.claims.sub).maybeSingle(),
      supabase.from("sites").select("location,latitude,longitude").eq("owner_id", claims.data.claims.sub).eq("location_confirmed", true).not("latitude", "is", null).not("longitude", "is", null).limit(1).maybeSingle(),
    ]);
    let accountCountry: string | undefined;
    let homeLatitude: number | undefined;
    let homeLongitude: number | undefined;
    const accountLocation = profile.data?.home_location?.trim();
    if (accountLocation) {
      const accountLocationResponse = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(accountLocation)}&limit=1&lang=en`, { next: { revalidate: 604_800 } });
      if (accountLocationResponse.ok) {
        const accountLocationBody = await accountLocationResponse.json() as { features?: PhotonFeature[] };
        const homeMatch = accountLocationBody.features?.[0];
        accountCountry = homeMatch?.properties?.countrycode?.toUpperCase();
        const [longitude, latitude] = homeMatch?.geometry?.coordinates ?? [Number.NaN, Number.NaN];
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) { homeLatitude = latitude; homeLongitude = longitude; }
      }
    }
    if ((homeLatitude == null || homeLongitude == null) && fallbackSite.data?.latitude != null && fallbackSite.data.longitude != null) {
      homeLatitude = Number(fallbackSite.data.latitude); homeLongitude = Number(fallbackSite.data.longitude);
    }
    if (!accountCountry && fallbackSite.data?.latitude != null && fallbackSite.data.longitude != null) {
      const siteCountryResponse = await fetch(`https://photon.komoot.io/reverse?lat=${Number(fallbackSite.data.latitude)}&lon=${Number(fallbackSite.data.longitude)}&limit=1&lang=en`, { next: { revalidate: 604_800 } });
      if (siteCountryResponse.ok) {
        const siteCountryBody = await siteCountryResponse.json() as { features?: PhotonFeature[] };
        accountCountry = siteCountryBody.features?.[0]?.properties?.countrycode?.toUpperCase();
      }
    }
    const preferredCountry = accountCountry;

    // Photon supports type-ahead place and address search. Public Nominatim is
    // retained above only for deliberate jurisdiction lookup, not autocomplete.
    const locationBias = homeLatitude != null && homeLongitude != null ? `&lat=${homeLatitude}&lon=${homeLongitude}&zoom=9&location_bias_scale=0.15` : "";
    const globalUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=en${locationBias}`;
    const countryUrl = preferredCountry ? `${globalUrl}&countrycode=${encodeURIComponent(preferredCountry)}` : undefined;
    const [countryResponse, globalResponse] = await Promise.all([
      countryUrl ? fetch(countryUrl, { next: { revalidate: 86_400 } }) : Promise.resolve(undefined),
      fetch(globalUrl, { next: { revalidate: 86_400 } }),
    ]);
    if (globalResponse.ok || countryResponse?.ok) {
      const countryBody = countryResponse?.ok ? await countryResponse.json() as { features?: PhotonFeature[] } : undefined;
      const globalBody = globalResponse.ok ? await globalResponse.json() as { features?: PhotonFeature[] } : undefined;
      const results = [...(countryBody?.features ?? []), ...(globalBody?.features ?? [])].map((feature) => {
        const properties = feature.properties ?? {};
        const [longitude, latitude] = feature.geometry?.coordinates ?? [Number.NaN, Number.NaN];
        const addressName = uniqueParts([properties.housenumber, properties.street]).join(" ");
        const name = addressName || properties.name || properties.city || properties.locality || properties.state || properties.country || "Location";
        const label = uniqueParts([addressName || properties.name, properties.locality, properties.district, properties.city, properties.county, properties.state, properties.postcode, properties.country]).join(", ");
        return { name, label, latitude, longitude, timezone: timezoneFor(latitude, longitude), countryCode: properties.countrycode?.toUpperCase() };
      }).filter((result, index, all) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude) && result.label && all.findIndex((candidate) => candidate.label === result.label) === index)
        .sort((left, right) => Number(right.countryCode === preferredCountry) - Number(left.countryCode === preferredCountry))
        .slice(0, 8);
      if (results.length) return Response.json({ results });
    }

    // Open-Meteo remains a broad-locality fallback if address search is unavailable.
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error("Location service unavailable");
    const body = await response.json() as { results?: OpenMeteoResult[] };
    const results = (body.results ?? []).map((result) => ({
      name: result.name,
      label: uniqueParts([result.name, result.admin2, result.admin1, result.country]).join(", "),
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone || timezoneFor(result.latitude, result.longitude),
      countryCode: result.country_code?.toUpperCase(),
    })).sort((left, right) => Number(right.countryCode === preferredCountry) - Number(left.countryCode === preferredCountry));
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Location search is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
}
