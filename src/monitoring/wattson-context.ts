import type { MonitoringSnapshot } from "@/monitoring/types";
import { presentMetrics } from "@/monitoring/normalize";

/** Only measured, non-secret monitoring facts cross the Wattson boundary. */
export function buildMonitoringWattsonContext(snapshot: MonitoringSnapshot) {
  return {
    siteId: snapshot.siteId,
    systemId: snapshot.systemId,
    connection: snapshot.connection ? { provider: snapshot.connection.provider, status: snapshot.connection.status, lastSuccessAt: snapshot.connection.lastSuccessAt } : undefined,
    latest: snapshot.latest ? { measuredAt: snapshot.latest.measuredAt, measurementKind: "measured", metrics: presentMetrics(snapshot.latest) } : undefined,
    recentTrend: snapshot.samples.slice(-24).map((sample) => ({ measuredAt: sample.measuredAt, metrics: presentMetrics(sample) })),
    activeAlerts: snapshot.alerts.map(({ severity, title, message, occurredAt }) => ({ severity, title, message, occurredAt })),
    devices: snapshot.devices.map(({ deviceType, displayName, status, lastSeenAt, mappedComponentId, mappedPvArrayId }) => ({ deviceType, displayName, status, lastSeenAt, mappedComponentId, mappedPvArrayId })),
  };
}
