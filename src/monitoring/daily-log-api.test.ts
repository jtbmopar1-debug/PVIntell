import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/monitor/daily/route";
import { emptyObservation } from "./daily-log";

const auth = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => auth.client }));
const systemId = "e3b1409d-9aa1-4ce5-858e-bf3e2c8797ea";
const siteId = "e3b1409d-9aa1-4ce5-858e-bf3e2c8797eb";
type Row = Record<string, unknown>;
function store(authorized = true) {
  const rows: Row[] = []; const writes: string[] = [];
  auth.client = {
    auth: { getClaims: async () => ({ data: { claims: authorized ? { sub: "owner" } : {} } }) },
    from(table: string) {
      const filters: Array<[string, unknown]> = []; let mutation: Row | undefined; let operation = "read";
      const run = (single: boolean) => {
        const matches = (row: Row) => filters.every(([key, value]) => row[key] === value);
        if (table === "projects") return { data: matches({ id: systemId, owner_id: "owner", site_id: siteId }) ? { id: systemId, site_id: siteId } : null, error: null };
        if (table === "sites") return { data: { timezone: "Pacific/Auckland" }, error: null };
        if (table !== "monitor_daily_entries") throw new Error(`Unexpected table ${table}`);
        let result = rows.filter(matches);
        if (mutation) {
          writes.push(table);
          if (operation === "insert") {
            if (rows.some((row) => row.project_id === mutation!.project_id && row.log_date === mutation!.log_date)) return { data: null, error: { code: "23505" } };
            result = [{ id: "day", ...structuredClone(mutation) }]; rows.push(...result);
          } else for (const row of result) Object.assign(row, structuredClone(mutation));
        }
        return { data: structuredClone(single ? result[0] ?? null : result), error: null };
      };
      const query = {
        select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        gte: () => query, lte: () => query, order: () => query,
        insert: (value: Row) => { mutation = value; operation = "insert"; return query; },
        update: (value: Row) => { mutation = value; operation = "update"; return query; },
        maybeSingle: async () => run(true), single: async () => run(true),
        then: (resolve: (value: ReturnType<typeof run>) => unknown) => Promise.resolve(run(false)).then(resolve),
      }; return query;
    },
  };
  return { rows, writes };
}
const payload = () => ({ systemId, date: "2026-09-09", observations: { ...emptyObservation, actualKwh: 0 }, forecast: { kwh: 6, source: "manual", capturedAt: "2026-09-08T00:00:00Z" }, expectedUpdatedAt: null });
const request = (body: unknown) => new Request("http://localhost/api/monitor/daily", { method: "PUT", body: JSON.stringify(body) });
beforeEach(() => { store(); });
describe("daily log API ownership and persistence", () => {
  it("requires authentication", async () => { store(false); expect((await PUT(request(payload()))).status).toBe(401); });
  it("rejects a system outside the owned scope", async () => { expect((await PUT(request({ ...payload(), systemId: siteId }))).status).toBe(404); });
  it("stores a zero reading and returns it on reload without touching proposal settings", async () => {
    const db = store(); const saved = await PUT(request(payload()));
    expect(saved.status).toBe(200);
    expect(db.writes).toEqual(["monitor_daily_entries"]);
    const loaded = await GET(new Request(`http://localhost/api/monitor/daily?systemId=${systemId}&from=2025-09-11&to=2026-09-14`));
    expect(loaded.status).toBe(200);
    expect((await loaded.json()).entries[0]).toMatchObject({ actualKwh: 0, timezone: "Pacific/Auckland", forecast: { kwh: 6 } });
  });
  it("freezes a saved forecast while allowing actual observations to be edited", async () => {
    await PUT(request(payload()));
    const read = await GET(new Request(`http://localhost/api/monitor/daily?systemId=${systemId}&from=2026-09-01&to=2026-09-10`));
    const existing = (await read.json()).entries[0];
    const updated = await PUT(request({ ...payload(), expectedUpdatedAt: existing.updatedAt, observations: { ...emptyObservation, actualKwh: 8 }, forecast: { ...payload().forecast, kwh: 100 } }));
    expect(updated.status).toBe(200);
    expect((await updated.json()).entry).toMatchObject({ actualKwh: 8, forecast: { kwh: 6, capturedAt: existing.forecast.capturedAt } });
  });
  it("saves grid-only days, reloads zeros and edits without changing the forecast", async () => {
    const db = store();
    const saved = await PUT(request({ ...payload(), observations: { ...emptyObservation, gridImportKwh: 0, gridExportKwh: 2.5 } }));
    expect(saved.status).toBe(200);
    const existing = (await saved.json()).entry;
    const updated = await PUT(request({ ...payload(), expectedUpdatedAt: existing.updatedAt, observations: { ...emptyObservation, gridImportKwh: 3.25, gridExportKwh: 0 }, forecast: { ...payload().forecast, kwh: 99 } }));
    expect(updated.status).toBe(200);
    const loaded = await GET(new Request(`http://localhost/api/monitor/daily?systemId=${systemId}&from=2026-09-01&to=2026-09-10`));
    expect((await loaded.json()).entries[0]).toMatchObject({ actualKwh: null, gridImportKwh: 3.25, gridExportKwh: 0, generatorRan: null, forecast: { kwh: 6 } });
    expect(db.writes).toEqual(["monitor_daily_entries", "monitor_daily_entries"]);
  });
  it("accepts a grid reading without solar, generator or forecast data", async () => {
    expect((await PUT(request({ ...payload(), forecast: null, observations: { ...emptyObservation, gridImportKwh: 0 } }))).status).toBe(200);
  });
  it.each(["gridImportKwh", "gridExportKwh"])("rejects future and negative %s readings", async (field) => {
    expect((await PUT(request({ ...payload(), date: "2099-01-01", observations: { ...emptyObservation, [field]: 0 } }))).status).toBe(400);
    expect((await PUT(request({ ...payload(), observations: { ...emptyObservation, [field]: -1 } }))).status).toBe(400);
  });
  it("does not silently overwrite an existing day from a stale tab", async () => {
    await PUT(request(payload()));
    expect((await PUT(request(payload()))).status).toBe(409);
  });
  it("rejects future actual readings but allows a future forecast", async () => {
    expect((await PUT(request({ ...payload(), date: "2099-01-01" }))).status).toBe(400);
    expect((await PUT(request({ ...payload(), date: "2099-01-01", observations: emptyObservation }))).status).toBe(200);
  });
  it("rejects invalid values and empty entries", async () => {
    expect((await PUT(request({ ...payload(), observations: { ...emptyObservation, socEnd: 101 } }))).status).toBe(400);
    expect((await PUT(request({ ...payload(), forecast: null, observations: emptyObservation }))).status).toBe(400);
  });
});
