import { describe, expect, it } from "vitest";
import { normalizeProviderAlert, normalizeReading, presentMetrics } from "@/monitoring/normalize";
import { monitoringViewState, type MonitoringSnapshot } from "@/monitoring/types";
import { buildMonitoringWattsonContext } from "@/monitoring/wattson-context";

const empty: MonitoringSnapshot = { siteId: "site", systemId: "system", devices: [], samples: [], alerts: [] };
describe("monitoring normalization and states", () => {
  it("does not turn missing metrics into zero", () => expect(presentMetrics(normalizeReading({ measuredAt: "2026-09-05T00:00:00Z", pvPowerW: 0 }))).toEqual({ measuredAt: "2026-09-05T00:00:00.000Z", pvPowerW: 0 }));
  it("recognises empty, partial, current, stale, and failed states", () => {
    expect(monitoringViewState(empty)).toBe("empty");
    const connected = { ...empty, connection: { id: "c", provider: "victron_vrm" as const, displayName: "VRM", status: "connected" as const, capabilities: [] } };
    expect(monitoringViewState(connected)).toBe("partial");
    expect(monitoringViewState({ ...connected, latest: { measuredAt: "2026-09-05T00:00:00Z", pvPowerW: 1 } }, new Date("2026-09-05T00:01:00Z"))).toBe("partial");
    expect(monitoringViewState({ ...connected, latest: { measuredAt: "2026-09-05T00:00:00Z", pvPowerW: 1, loadPowerW: 2, inverterState: "on" } }, new Date("2026-09-05T00:01:00Z"))).toBe("current");
    expect(monitoringViewState({ ...connected, latest: { measuredAt: "2026-09-05T00:00:00Z", pvPowerW: 1 } }, new Date("2026-09-05T01:00:00Z"))).toBe("stale");
    expect(monitoringViewState({ ...connected, lastSync: { status: "failed", startedAt: "2026-09-05T00:00:00Z", samplesWritten: 0 } })).toBe("error");
  });
  it("normalizes provider alerts safely", () => expect(normalizeProviderAlert({ severity: "unknown", title: " Fault " }).severity).toBe("info"));
  it("only supplies sanitized fields to Wattson", () => {
    const context = buildMonitoringWattsonContext({ ...empty, connection: { id: "secret-row", provider: "solarman", displayName: "private", status: "connected", capabilities: [], lastSuccessAt: "2026-09-05T00:00:00Z" }, latest: { measuredAt: "2026-09-05T00:00:00Z", pvPowerW: 400 } });
    expect(JSON.stringify(context)).not.toContain("secret-row");
    expect(JSON.stringify(context)).not.toContain("private");
    expect(context.latest?.measurementKind).toBe("measured");
  });
});
