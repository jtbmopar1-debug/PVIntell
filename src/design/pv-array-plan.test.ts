import { describe, expect, it } from "vitest";
import { buildPvArrayPlan } from "./pv-array-plan";

describe("PV array proposal hierarchy", () => {
  it("keeps multiple mounting surfaces as separate arrays pending allocation", () => {
    const plan = buildPvArrayPlan({
      panelCount: 35,
      surfaces: [
        { id: "main-roof", name: "Main roof", capacity: 22, direction: "east" },
        { id: "west-roof", name: "Panel area 2", capacity: 22, direction: "west" },
      ],
    });
    expect(plan.status).toBe("surface_allocation_required");
    expect(plan.arrays).toHaveLength(2);
    expect(plan.arrays.every((array) => array.topology.kind === "series_parallel")).toBe(true);
    expect(plan.arrays.every((array) => array.topology.strings.length === 0)).toBe(true);
    expect(plan.arrays.every((array) => array.topology.combinerRequirement === "pending")).toBe(true);
  });

  it("represents one array without inventing its series length or parallel grouping", () => {
    const plan = buildPvArrayPlan({ panelCount: 16, surfaces: [{ id: "ground", name: "Ground mount", capacity: 20 }] });
    expect(plan).toMatchObject({
      status: "topology_unresolved",
      arrays: [{ id: "ground", allocatedPanelCount: 16, topology: { kind: "series_parallel", status: "pending_surface_allocation_and_equipment", strings: [], combinerRequirement: "pending" } }],
    });
  });
});
