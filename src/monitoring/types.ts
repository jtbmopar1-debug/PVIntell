export const monitoringProviders = ["dess_monitor", "victron_vrm", "solarman", "deye_cloud", "junctek_local", "pvintell_gateway"] as const;
export type MonitoringProvider = (typeof monitoringProviders)[number];
export type MonitoringConnectionStatus = "setup_required" | "connecting" | "connected" | "degraded" | "error" | "disabled";

export interface MonitoringMetrics {
  pvPowerW?: number;
  loadPowerW?: number;
  batteryPowerW?: number;
  batteryVoltageV?: number;
  batteryCurrentA?: number;
  batterySocPercent?: number;
  gridPowerW?: number;
  inverterState?: string;
  generatedEnergyTodayWh?: number;
  consumedEnergyTodayWh?: number;
}

export interface MonitoringReading extends MonitoringMetrics {
  measuredAt: string;
}

export interface MonitoringConnectionSummary {
  id: string;
  provider: MonitoringProvider;
  displayName: string;
  status: MonitoringConnectionStatus;
  statusMessage?: string;
  capabilities: string[];
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
}

export interface MonitoringDeviceSummary {
  id: string;
  providerDeviceId: string;
  deviceType: string;
  displayName: string;
  mappedComponentId?: string;
  mappedPvArrayId?: string;
  status: "online" | "offline" | "unknown" | "error";
  lastSeenAt?: string;
}

export interface MonitoringAlert {
  id: string;
  code?: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message?: string;
  status: "active" | "acknowledged" | "resolved";
  occurredAt: string;
}

export interface MonitoringSyncSummary {
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt?: string;
  samplesWritten: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface MonitoringSnapshot {
  siteId: string;
  systemId: string;
  connection?: MonitoringConnectionSummary;
  devices: MonitoringDeviceSummary[];
  latest?: MonitoringReading;
  samples: MonitoringReading[];
  alerts: MonitoringAlert[];
  lastSync?: MonitoringSyncSummary;
}

export type MonitoringViewState = "empty" | "current" | "partial" | "stale" | "error";

export function monitoringViewState(snapshot: MonitoringSnapshot, now = new Date(), staleAfterMs = 15 * 60_000): MonitoringViewState {
  if (!snapshot.connection) return "empty";
  if (snapshot.connection.status === "error" || snapshot.lastSync?.status === "failed") return "error";
  if (!snapshot.latest) return snapshot.connection.status === "connected" ? "partial" : "empty";
  const age = now.getTime() - new Date(snapshot.latest.measuredAt).getTime();
  if (!Number.isFinite(age) || age > staleAfterMs) return "stale";
  return reportedMetricCount(snapshot.latest) >= 3 ? "current" : "partial";
}

export function reportedMetricCount(reading: MonitoringReading) {
  return Object.entries(reading).filter(([key, value]) => key !== "measuredAt" && value !== undefined && value !== null && value !== "").length;
}

export function scopeMatches(expected: { ownerId: string; siteId: string; systemId: string }, actual: { ownerId: string; siteId: string; systemId: string }) {
  return expected.ownerId === actual.ownerId && expected.siteId === actual.siteId && expected.systemId === actual.systemId;
}
