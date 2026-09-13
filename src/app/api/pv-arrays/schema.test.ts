import { describe, expect, it } from "vitest";
import { pvArrayRows, pvArraySchema } from "./schema";

describe("bulk PV array records", () => {
  it("creates separate named arrays with the same panel layout", () => {
    const input = pvArraySchema.parse({
      projectId: "00000000-0000-4000-8000-000000000001",
      name: "Solar Panel PV Module",
      arrayCount: 3,
      panelCount: 6,
      panelWatts: 450,
      strings: 1,
      panelsPerString: 6,
      specifications: { "Wiring arrangement": "series" },
    });
    const rows = pvArrayRows(input);
    expect(rows.map((row) => row.name)).toEqual(["Solar Panel PV Module 1", "Solar Panel PV Module 2", "Solar Panel PV Module 3"]);
    expect(rows.every((row) => row.panel_count === 6 && row.panel_watts === 450)).toBe(true);
  });
});
