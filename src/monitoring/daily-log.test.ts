import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dailyLogSummary, dailyLogWattsonContext, dailyObservationSchema, emptyObservation, logDateSchema, type DailyLogEntry } from "./daily-log";
import { DailyEntryForm, DailyLogHistory } from "@/components/daily-monitor";
import { mapDailyLog } from "./daily-log-repository";

const row = (date: string, actualKwh: number | null, forecastKwh?: number): DailyLogEntry => ({ ...emptyObservation, date, actualKwh, timezone: "Pacific/Auckland", forecast: forecastKwh === undefined ? null : { kwh: forecastKwh, source: "manual", capturedAt: "2026-09-09T00:00:00Z" }, updatedAt: "2026-09-10T00:00:00Z" });
describe("daily monitoring data", () => {
  it("automatically displays a read-only forecast and only a did-run generator checkbox", () => {
    const html = renderToStaticMarkup(createElement(DailyEntryForm, { systemId: "fixture", date: "2026-09-10", today: "2026-09-10", forecast: { kwh: 12, source: "pvintell", capturedAt: "2026-09-10T00:00:00Z" }, weatherStatus: "", onSave: () => undefined, onDirty: () => undefined }));
    expect(html).toContain('aria-label="Forecast solar production"');
    expect(html).toContain("12 kWh</output>");
    expect(html).toContain("Automatically loaded");
    expect(html).toContain("Ran generator this day");
    expect(html).not.toContain("Record no generator run");
    expect(html).not.toContain("Connect Junctek");
    expect(html).not.toContain('value="12"');
    expect(html).toContain("Grid import / input");
    expect(html).toContain("Grid export");
    expect(html.indexOf("Grid use")).toBeGreaterThan(html.indexOf("Ran generator this day"));
    expect(html).toContain("Leave blank if off-grid or unknown");
  });
  it("loads older entries without inventing grid readings", () => {
    const observations = Object.fromEntries(Object.entries(emptyObservation).filter(([key]) => !key.startsWith("grid")));
    const entry = mapDailyLog({ observations, log_date: "2026-09-09", timezone: "Pacific/Auckland", forecast: null, updated_at: "2026-09-10T00:00:00Z" });
    expect(entry).toMatchObject({ gridImportKwh: null, gridExportKwh: null });
    expect(dailyLogSummary([entry])).toMatchObject({ gridImportDays: 0, gridExportDays: 0 });
  });
  it("keeps grid totals and known zeros separate from solar comparisons", () => {
    const entries = [{ ...row("2026-09-08", 8, 10), gridImportKwh: 0, gridExportKwh: 2.5 }, { ...row("2026-09-09", null), gridImportKwh: 3.25 }];
    const summary = dailyLogSummary(entries);
    expect(summary).toMatchObject({ actualKwh: 8, pairedDays: 1, gridImportKwh: 3.25, gridImportDays: 2, gridExportKwh: 2.5, gridExportDays: 1 });
    expect(summary.differencePercent).toBeCloseTo(-20);
    const context = dailyLogWattsonContext(entries);
    expect(context.scope).toContain("Do not add grid export to actual solar production");
    expect(context.recentDays[0].gridImportKwh).toBe(0);
    const html = renderToStaticMarkup(createElement(DailyLogHistory, { entries, onEdit: () => undefined }));
    expect(html).toContain('value="grid"');
    expect(html).toContain("Grid import kWh");
    expect(html).toContain("Grid export kWh");
    expect(html).toContain("<td>0</td><td>2.5</td>");
    expect(html).toContain("<td>3.25</td><td>—</td>");
  });
  it("keeps the saved forecast when a refreshed weather forecast differs", () => {
    const html = renderToStaticMarkup(createElement(DailyEntryForm, { systemId: "fixture", date: "2026-09-10", today: "2026-09-10", existing: row("2026-09-10", 4, 6), forecast: { kwh: 12, source: "pvintell", capturedAt: "2026-09-10T00:00:00Z" }, weatherStatus: "", onSave: () => undefined, onDirty: () => undefined }));
    expect(html).toContain("6 kWh</output>");
    expect(html).not.toContain("12 kWh");
  });
  it("keeps zero production and zero SOC as readings, not blanks", () => {
    expect(dailyObservationSchema.parse({ ...emptyObservation, actualKwh: 0, socEnd: 0 })).toMatchObject({ actualKwh: 0, socEnd: 0 });
    expect(dailyLogSummary([row("2026-09-08", 0, 8), row("2026-09-09", null, 9)])).toMatchObject({ actualDays: 1, pairedDays: 1, differencePercent: -100 });
  });
  it("compares only the dates with both actual and forecast values", () => {
    const summary = dailyLogSummary([row("2026-09-07", 100), row("2026-09-08", 8, 10), row("2026-09-09", null, 20)]);
    expect(summary).toMatchObject({ actualKwh: 108, actualPairedKwh: 8, forecastPairedKwh: 10, pairedDays: 1 });
    expect(summary.differencePercent).toBeCloseTo(-20);
  });
  it("does not divide by a zero forecast", () => {
    expect(dailyLogSummary([row("2026-09-09", 2, 0)]).differencePercent).toBeNull();
  });
  it("retains unknown generator duration and supports a falling SOC during a run", () => {
    expect(dailyObservationSchema.parse({ ...emptyObservation, generatorRan: true, generatorStartSoc: 70, generatorEndSoc: 60 }).generatorEndSoc).toBe(60);
    expect(dailyLogSummary([{ ...row("2026-09-08", 2), generatorRan: true }])).toMatchObject({ generatorDays: 1, generatorRuntimeKnownDays: 0, generatorMinutes: 0 });
  });
  it.each([
    { socEnd: 101 }, { actualKwh: -1 }, { socMin: 90, socMax: 20 },
    { socMin: 20, socMax: 80, socEnd: 10 }, { generatorRan: false, generatorMinutes: 60 },
    { generatorRan: true, generatorMinutes: 1441 },
    { gridImportKwh: -1 }, { gridExportKwh: -1 }, { gridImportKwh: Infinity }, { gridExportKwh: 1000001 },
  ])("rejects invalid observations %j", (value) => {
    expect(dailyObservationSchema.safeParse({ ...emptyObservation, ...value }).success).toBe(false);
  });
  it("validates leap days and impossible calendar dates", () => {
    expect(logDateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(logDateSchema.safeParse("2026-02-29").success).toBe(false);
    expect(logDateSchema.safeParse("2026-04-31").success).toBe(false);
  });
  it("clearly separates user observations from telemetry in Wattson's context", () => {
    const context = dailyLogWattsonContext([row("2026-09-09", 4, 6)]);
    expect(context.source).toContain("not live telemetry");
    expect(context.scope).toContain("not instructions");
    expect(context.scope).toContain("Do not automatically change");
  });
  it("renders an accessible chart and a table with missing readings preserved", () => {
    const html = renderToStaticMarkup(createElement(DailyLogHistory, { entries: [row("2026-09-08", 0, 4), row("2026-09-09", null, 5)], onEdit: () => undefined }));
    expect(html).toContain('role="img"');
    expect(html).toContain("Table view");
    expect(html).toContain("2026-09-08");
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).toContain("—");
  });
});
