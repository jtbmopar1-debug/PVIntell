import type { ProviderReading } from "@/monitoring/connector";
import type { MonitoringAlert, MonitoringMetrics } from "@/monitoring/types";

const numericKeys = ["pvPowerW", "loadPowerW", "batteryPowerW", "batteryVoltageV", "batteryCurrentA", "batterySocPercent", "gridPowerW", "generatedEnergyTodayWh", "consumedEnergyTodayWh"] as const;

export function normalizeReading(input: { measuredAt: string } & Partial<Record<(typeof numericKeys)[number], unknown>> & { inverterState?: unknown }): ProviderReading {
  const output: ProviderReading = { measuredAt: new Date(input.measuredAt).toISOString() };
  for (const key of numericKeys) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) output[key] = key === "batterySocPercent" ? Math.min(100, Math.max(0, value)) : value;
  }
  if (typeof input.inverterState === "string" && input.inverterState.trim()) output.inverterState = input.inverterState.trim().slice(0, 120);
  return output;
}

export function normalizeProviderAlert(input: { id?: unknown; code?: unknown; severity?: unknown; title?: unknown; message?: unknown; occurredAt?: unknown }): Omit<MonitoringAlert, "id"> & { providerAlertId?: string } {
  const severity = input.severity === "critical" || input.severity === "warning" ? input.severity : "info";
  return {
    providerAlertId: typeof input.id === "string" ? input.id.slice(0, 200) : undefined,
    code: typeof input.code === "string" ? input.code.slice(0, 120) : undefined,
    severity,
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 200) : "Provider alert",
    message: typeof input.message === "string" ? input.message.trim().slice(0, 1000) : undefined,
    status: "active",
    occurredAt: typeof input.occurredAt === "string" && !Number.isNaN(Date.parse(input.occurredAt)) ? new Date(input.occurredAt).toISOString() : new Date(0).toISOString(),
  };
}

export function presentMetrics(metrics: MonitoringMetrics) {
  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => value !== undefined && value !== null));
}
