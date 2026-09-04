import { z } from "zod";
import { createClient as createSupabaseAdmin, type SupabaseClient } from "@supabase/supabase-js";
import tzLookup from "tz-lookup";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ siteId: z.uuid() });
const regionCellDegrees = 0.02;
const forecastDays = 5;
const cacheVersion = "five-day-v1";
const cellCoordinate = (coordinate: number) => Number((Math.round(coordinate / regionCellDegrees) * regionCellDegrees).toFixed(4));
const localDate = (timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-NZ", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
function localMidnightUtc(timezone: string, dayOffset = 0) {
  const nowParts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(nowParts.find((part) => part.type === type)?.value ?? 0);
  const localCalendarDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + dayOffset));
  const target = Date.UTC(localCalendarDate.getUTCFullYear(), localCalendarDate.getUTCMonth(), localCalendarDate.getUTCDate());
  let candidate = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const candidateParts = new Intl.DateTimeFormat("en-NZ", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const candidateValue = (type: Intl.DateTimeFormatPartTypes) => Number(candidateParts.find((part) => part.type === type)?.value ?? 0);
    const represented = Date.UTC(candidateValue("year"), candidateValue("month") - 1, candidateValue("day"), candidateValue("hour"), candidateValue("minute"), candidateValue("second"));
    candidate -= represented - target;
  }
  return new Date(candidate);
}
function cacheClient(): SupabaseClient | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(); const key = process.env.NEXT_SECRET_SUPABASE_SERVICE_KEY?.trim();
  return url && key ? createSupabaseAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : undefined;
}
const value = (entry: unknown) => {
  if (typeof entry === "number") return entry;
  if (!entry || typeof entry !== "object") return null;
  const values = Object.values(entry as Record<string, unknown>);
  const preferred = (entry as Record<string, unknown>).sg;
  const candidate = typeof preferred === "number" ? preferred : values.find((item) => typeof item === "number");
  return typeof candidate === "number" ? candidate : null;
};

export async function GET(request: Request) {
  const url = new URL(request.url); const parsed = querySchema.safeParse({ siteId: url.searchParams.get("siteId") });
  if (!parsed.success) return Response.json({ error: "Invalid site." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const site = await supabase.from("sites").select("latitude,longitude,timezone,location").eq("id", parsed.data.siteId).maybeSingle();
  if (site.error || !site.data) return Response.json({ error: "Site not found." }, { status: 404 });
  if (typeof site.data.latitude !== "number" || typeof site.data.longitude !== "number") return Response.json({ error: "Set the site's coordinates to load solar weather.", code: "LOCATION_REQUIRED" }, { status: 409 });
  let timezone = typeof site.data.timezone === "string" && site.data.timezone ? site.data.timezone : "UTC";
  try { timezone = tzLookup(site.data.latitude, site.data.longitude); } catch { /* Use the stored timezone when lookup is unavailable. */ }
  if (timezone !== site.data.timezone) await supabase.from("sites").update({ timezone }).eq("id", parsed.data.siteId);
  const latitude = cellCoordinate(site.data.latitude); const longitude = cellCoordinate(site.data.longitude);
  const locationKey = `${latitude.toFixed(4)}:${longitude.toFixed(4)}:${timezone}:${cacheVersion}`; const dateKey = localDate(timezone); const admin = cacheClient(); let ownsCacheClaim = false;
  if (admin) {
    const cached = await admin.from("weather_forecast_cache").select("payload,fetched_at").eq("location_key", locationKey).eq("local_date", dateKey).maybeSingle();
    if (!cached.error && cached.data?.payload) return Response.json({ ...(cached.data.payload as Record<string, unknown>), cache: { source: "shared-region", localDate: dateKey, fetchedAt: cached.data.fetched_at } });
    const claim = await admin.from("weather_forecast_cache").insert({ location_key: locationKey, local_date: dateKey, timezone, latitude, longitude }).select("location_key").maybeSingle();
    ownsCacheClaim = !claim.error && Boolean(claim.data);
    if (claim.error?.code === "23505") {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const completed = await admin.from("weather_forecast_cache").select("payload,fetched_at").eq("location_key", locationKey).eq("local_date", dateKey).maybeSingle();
        if (completed.data?.payload) return Response.json({ ...(completed.data.payload as Record<string, unknown>), cache: { source: "shared-region", localDate: dateKey, fetchedAt: completed.data.fetched_at } });
      }
    }
  }
  const apiKey = process.env.STORMGLASS_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "STORMGLASS_API_KEY is not configured." }, { status: 503 });
  const startDate = localMidnightUtc(timezone); const endDate = localMidnightUtc(timezone, forecastDays);
  const common = `lat=${latitude}&lng=${longitude}&start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}&source=sg`;
  const requests = [
    `https://api.stormglass.io/v2/weather/point?${common}&params=airTemperature,cloudCover,precipitation,windSpeed`,
    `https://api.stormglass.io/v2/solar/point?${common}&params=solarDownwardRadiationFlux,uvIndex`,
  ];
  try {
    const responses = await Promise.all(requests.map((endpoint) => fetch(endpoint, { headers: { Authorization: apiKey }, cache: "no-store" })));
    if (responses.some((response) => !response.ok)) {
      const failed = responses.find((response) => !response.ok); return Response.json({ error: `Stormglass returned ${failed?.status ?? "an error"}.` }, { status: 502 });
    }
    const [weather, solar] = await Promise.all(responses.map((response) => response.json())) as Array<{ hours?: Array<Record<string, unknown>> }>;
    const byTime = new Map<string, Record<string, unknown>>();
    for (const hour of weather.hours ?? []) byTime.set(String(hour.time), { time: hour.time, temperature: value(hour.airTemperature), cloudCover: value(hour.cloudCover), precipitation: value(hour.precipitation), windSpeed: value(hour.windSpeed) });
    for (const hour of solar.hours ?? []) byTime.set(String(hour.time), { ...(byTime.get(String(hour.time)) ?? { time: hour.time }), irradiance: value(hour.solarDownwardRadiationFlux), uvIndex: value(hour.uvIndex) });
    const payload = { site: { location: site.data.location, timezone }, hours: [...byTime.values()].sort((a, b) => String(a.time).localeCompare(String(b.time))), fetchedAt: new Date().toISOString() };
    if (admin) await admin.from("weather_forecast_cache").upsert({ location_key: locationKey, local_date: dateKey, timezone, latitude, longitude, payload, fetched_at: payload.fetchedAt }, { onConflict: "location_key,local_date" });
    return Response.json({ ...payload, cache: { source: "stormglass", localDate: dateKey } });
  } catch (problem) {
    if (admin && ownsCacheClaim) await admin.from("weather_forecast_cache").delete().eq("location_key", locationKey).eq("local_date", dateKey).is("payload", null);
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not reach Stormglass." }, { status: 502 });
  }
}
