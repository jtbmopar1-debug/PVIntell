import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonitoringReading, MonitoringSnapshot } from "@/monitoring/types";

const readingColumns = "measured_at,pv_power_w,load_power_w,battery_power_w,battery_voltage_v,battery_current_a,battery_soc_percent,grid_power_w,inverter_state,generated_energy_today_wh,consumed_energy_today_wh";
function mapReading(row: Record<string, unknown> | null): MonitoringReading | undefined {
  if (!row) return undefined;
  const out: MonitoringReading = { measuredAt: String(row.measured_at) };
  const fields = { pvPowerW: "pv_power_w", loadPowerW: "load_power_w", batteryPowerW: "battery_power_w", batteryVoltageV: "battery_voltage_v", batteryCurrentA: "battery_current_a", batterySocPercent: "battery_soc_percent", gridPowerW: "grid_power_w", generatedEnergyTodayWh: "generated_energy_today_wh", consumedEnergyTodayWh: "consumed_energy_today_wh" } as const;
  for (const [to, from] of Object.entries(fields)) if (typeof row[from] === "number") (out as unknown as Record<string, unknown>)[to] = row[from];
  if (typeof row.inverter_state === "string" && row.inverter_state) out.inverterState = row.inverter_state;
  return out;
}
export class MonitoringScopeNotFoundError extends Error {}
export async function loadMonitoringSnapshot(db: SupabaseClient, ownerId: string, siteId: string, systemId: string): Promise<MonitoringSnapshot> {
  const scope = await db.from("projects").select("id").eq("id", systemId).eq("site_id", siteId).eq("owner_id", ownerId).maybeSingle();
  if (scope.error) throw scope.error;
  if (!scope.data) throw new MonitoringScopeNotFoundError();
  const found = await db.from("monitoring_connections").select("id,provider,display_name,status,status_message,capabilities,last_attempt_at,last_success_at,last_failure_at").eq("owner_id", ownerId).eq("site_id", siteId).eq("project_id", systemId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (found.error) throw found.error;
  const base: MonitoringSnapshot = { siteId, systemId, devices: [], samples: [], alerts: [] };
  const c = found.data;
  if (!c) return base;
  const match = { owner_id: ownerId, site_id: siteId, project_id: systemId, connection_id: c.id };
  const [devices, latest, samples, alerts, sync] = await Promise.all([
    db.from("monitoring_devices").select("id,provider_device_id,device_type,display_name,mapped_component_id,mapped_pv_array_id,status,last_seen_at").match(match).order("display_name"),
    db.from("monitoring_latest_readings").select(readingColumns).match(match).maybeSingle(),
    db.from("monitoring_samples").select(readingColumns).match(match).order("measured_at", { ascending: false }).limit(96),
    db.from("monitoring_alerts").select("id,code,severity,title,message,status,occurred_at").match(match).neq("status", "resolved").order("occurred_at", { ascending: false }).limit(20),
    db.from("monitoring_sync_attempts").select("status,started_at,finished_at,samples_written,error_code,error_message").match(match).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const failure = devices.error ?? latest.error ?? samples.error ?? alerts.error ?? sync.error;
  if (failure) throw failure;
  return { ...base,
    connection: { id: c.id, provider: c.provider, displayName: c.display_name, status: c.status, statusMessage: c.status_message ?? undefined, capabilities: c.capabilities ?? [], lastAttemptAt: c.last_attempt_at ?? undefined, lastSuccessAt: c.last_success_at ?? undefined, lastFailureAt: c.last_failure_at ?? undefined },
    latest: mapReading(latest.data as Record<string, unknown> | null), samples: (samples.data ?? []).map((x) => mapReading(x as Record<string, unknown>)!).reverse(),
    devices: (devices.data ?? []).map((x) => ({ id: x.id, providerDeviceId: x.provider_device_id, deviceType: x.device_type, displayName: x.display_name, mappedComponentId: x.mapped_component_id ?? undefined, mappedPvArrayId: x.mapped_pv_array_id ?? undefined, status: x.status, lastSeenAt: x.last_seen_at ?? undefined })),
    alerts: (alerts.data ?? []).map((x) => ({ id: x.id, code: x.code ?? undefined, severity: x.severity, title: x.title, message: x.message ?? undefined, status: x.status, occurredAt: x.occurred_at })),
    lastSync: sync.data ? { status: sync.data.status, startedAt: sync.data.started_at, finishedAt: sync.data.finished_at ?? undefined, samplesWritten: sync.data.samples_written, errorCode: sync.data.error_code ?? undefined, errorMessage: sync.data.error_message ?? undefined } : undefined,
  };
}
