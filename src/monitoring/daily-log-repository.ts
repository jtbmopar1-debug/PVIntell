import type { SupabaseClient } from "@supabase/supabase-js";
import { dailyLogWattsonContext, dailyObservationSchema, forecastSnapshotSchema, type DailyLogEntry } from "./daily-log";

export function mapDailyLog(row: Record<string, unknown>): DailyLogEntry {
  return { ...dailyObservationSchema.parse(row.observations), date: String(row.log_date), timezone: String(row.timezone), forecast: row.forecast ? forecastSnapshotSchema.parse(row.forecast) : null, updatedAt: String(row.updated_at) };
}

export async function loadDailyLogContext(db: SupabaseClient, ownerId: string, scope: { systemId?: string; siteId?: string }) {
  let query = db.from("monitor_daily_entries").select("project_id,log_date,timezone,observations,forecast,updated_at").eq("owner_id", ownerId).order("log_date", { ascending: false }).limit(366);
  if (scope.systemId) query = query.eq("project_id", scope.systemId);
  if (scope.siteId) query = query.eq("site_id", scope.siteId);
  const result = await query;
  if (result.error) return { status: "Daily log unavailable; no readings inferred" };
  const groups = new Map<string, DailyLogEntry[]>();
  for (const row of result.data ?? []) {
    const entries = groups.get(row.project_id) ?? [];
    entries.push(mapDailyLog(row)); groups.set(row.project_id, entries);
  }
  return { systems: [...groups].map(([systemId, entries]) => ({ systemId, ...dailyLogWattsonContext(entries.reverse()) })), coverage: "Up to the most recent 366 records in this scope; each system kept separate" };
}
