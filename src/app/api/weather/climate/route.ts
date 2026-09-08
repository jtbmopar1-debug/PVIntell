import { createClient as createSupabaseAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});
const monthKeys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const cacheVersion = "nasa-power-climatology-v1";
const cellCoordinate = (coordinate: number) => Number((Math.round(coordinate / 0.5) * 0.5).toFixed(1));

type PowerResponse = { properties?: { parameter?: Record<string, Record<string, number | undefined> | undefined> } };
type ClimateMonth = { month: number; meanC: number | null; minC: number | null; maxC: number | null; solarKwhM2Day: number | null };

function cacheClient(): SupabaseClient | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_SECRET_SUPABASE_SERVICE_KEY?.trim();
  return url && key ? createSupabaseAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : undefined;
}

function powerValue(parameter: Record<string, number | undefined> | undefined, month: string) {
  const value = parameter?.[month];
  return typeof value === "number" && value > -900 ? value : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ latitude: url.searchParams.get("latitude"), longitude: url.searchParams.get("longitude") });
  if (!parsed.success) return Response.json({ error: "Choose a valid region first." }, { status: 400 });

  const latitude = cellCoordinate(parsed.data.latitude);
  const longitude = cellCoordinate(parsed.data.longitude);
  const endYear = new Date().getUTCFullYear() - 1;
  const startYear = Math.max(2001, endYear - 19);
  const admin = cacheClient();
  if (admin) {
    const cached = await admin.from("climate_region_cache").select("period_start,period_end,months,fetched_at")
      .eq("latitude", latitude).eq("longitude", longitude).eq("dataset_version", cacheVersion).maybeSingle();
    if (!cached.error && cached.data?.months) {
      return Response.json({ period: `${cached.data.period_start}-${cached.data.period_end}`, months: cached.data.months, source: "NASA POWER", cache: { source: "database", fetchedAt: cached.data.fetched_at } });
    }
  }

  const endpoint = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
  endpoint.search = new URLSearchParams({
    parameters: "T2M,T2M_MIN,T2M_MAX,ALLSKY_SFC_SW_DWN", community: "SB",
    longitude: String(longitude), latitude: String(latitude), start: String(startYear), end: String(endYear), format: "JSON",
  }).toString();

  try {
    const response = await fetch(endpoint, { next: { revalidate: 2_592_000 } });
    if (!response.ok) throw new Error(`NASA POWER returned ${response.status}.`);
    const body = await response.json() as PowerResponse;
    const parameters = body.properties?.parameter;
    const months: ClimateMonth[] = monthKeys.map((key, index) => ({
      month: index + 1,
      meanC: powerValue(parameters?.T2M, key), minC: powerValue(parameters?.T2M_MIN, key),
      maxC: powerValue(parameters?.T2M_MAX, key), solarKwhM2Day: powerValue(parameters?.ALLSKY_SFC_SW_DWN, key),
    }));
    if (months.every((month) => month.meanC === null)) throw new Error("NASA POWER returned no climate values.");
    const period = `${startYear}-${endYear}`;
    if (admin) {
      await admin.from("climate_region_cache").upsert(
        { latitude, longitude, dataset_version: cacheVersion, period_start: startYear, period_end: endYear, months, fetched_at: new Date().toISOString() },
        { onConflict: "latitude,longitude,dataset_version" },
      );
    }
    return Response.json({ period, months, source: "NASA POWER", cache: { source: "NASA POWER" } });
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Regional climate averages are temporarily unavailable." }, { status: 503 });
  }
}
