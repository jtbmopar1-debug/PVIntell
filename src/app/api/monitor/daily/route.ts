import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dailyObservationSchema, forecastSnapshotSchema, logDateSchema } from "@/monitoring/daily-log";
import { mapDailyLog } from "@/monitoring/daily-log-repository";
import { localDateKey } from "@/weather/forecast";

const scopeSchema = z.object({ systemId: z.uuid() });
const writeSchema = scopeSchema.extend({ date: logDateSchema, observations: dailyObservationSchema, forecast: forecastSnapshotSchema.nullable(), expectedUpdatedAt: z.string().nullable() });
const querySchema = scopeSchema.extend({ from: logDateSchema, to: logDateSchema }).refine((query) => query.from <= query.to && Date.parse(query.to) - Date.parse(query.from) <= 370 * 86400000, "Choose a date range of up to one year plus the forecast window");

async function context(systemId: string): Promise<{ error: Response } | { db: Awaited<ReturnType<typeof createClient>>; ownerId: string; siteId: string; timezone: string }> {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const project = await db.from("projects").select("id,site_id").eq("id", systemId).eq("owner_id", ownerId).maybeSingle();
  if (project.error) return { error: Response.json({ error: "Could not load system" }, { status: 503 }) };
  if (!project.data) return { error: Response.json({ error: "System not found" }, { status: 404 }) };
  const site = await db.from("sites").select("timezone").eq("id", project.data.site_id).eq("owner_id", ownerId).single();
  if (site.error) return { error: Response.json({ error: "Could not load Site timezone" }, { status: 503 }) };
  const timezone = site.data.timezone || "UTC";
  return { db, ownerId, siteId: project.data.site_id, timezone };
}
const unavailable = () => Response.json({ error: "Daily log storage is unavailable. Check that the daily-monitor database migration has been applied." }, { status: 503 });
const conflict = () => Response.json({ error: "This day changed in another session. Reload the saved entry before editing again." }, { status: 409 });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "A system and valid date range are required" }, { status: 400 });
  const ctx = await context(parsed.data.systemId); if ("error" in ctx) return ctx.error;
  const result = await ctx.db.from("monitor_daily_entries").select("log_date,timezone,observations,forecast,updated_at").eq("owner_id", ctx.ownerId).eq("project_id", parsed.data.systemId).eq("site_id", ctx.siteId).gte("log_date", parsed.data.from).lte("log_date", parsed.data.to).order("log_date");
  if (result.error) return unavailable();
  return Response.json({ entries: (result.data ?? []).map(mapDailyLog) }, { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid daily entry" }, { status: 400 });
  const input = parsed.data;
  if (!input.forecast && !input.observations.notes && Object.entries(input.observations).every(([key, value]) => key === "notes" || value === null))
    return Response.json({ error: "Add a reading, forecast or note before saving" }, { status: 400 });
  const ctx = await context(input.systemId); if ("error" in ctx) return ctx.error;
  const today = localDateKey(new Date(), ctx.timezone);
  if (input.date > today && Object.entries(input.observations).some(([key, value]) => key !== "notes" && value !== null))
    return Response.json({ error: "Future days can hold a forecast, but not actual readings yet" }, { status: 400 });
  const current = await ctx.db.from("monitor_daily_entries").select("id,updated_at,forecast,timezone").eq("owner_id", ctx.ownerId).eq("project_id", input.systemId).eq("log_date", input.date).maybeSingle();
  if (current.error) return unavailable();
  if ((current.data?.updated_at ?? null) !== input.expectedUpdatedAt) return conflict();
  // Once logged, a forecast is a historical snapshot; observation edits cannot rewrite it.
  const forecast = current.data?.forecast ?? (input.forecast ? { ...input.forecast, capturedAt: new Date().toISOString() } : null);
  const row = { owner_id: ctx.ownerId, site_id: ctx.siteId, project_id: input.systemId, log_date: input.date, timezone: current.data?.timezone ?? ctx.timezone, observations: input.observations, forecast, updated_at: new Date().toISOString() };
  const result = current.data
    ? await ctx.db.from("monitor_daily_entries").update(row).eq("id", current.data.id).eq("owner_id", ctx.ownerId).eq("updated_at", input.expectedUpdatedAt).select("log_date,timezone,observations,forecast,updated_at").maybeSingle()
    : await ctx.db.from("monitor_daily_entries").insert(row).select("log_date,timezone,observations,forecast,updated_at").single();
  if (result.error?.code === "23505" || !result.error && !result.data) return conflict();
  if (result.error || !result.data) return unavailable();
  return Response.json({ entry: mapDailyLog(result.data) });
}
