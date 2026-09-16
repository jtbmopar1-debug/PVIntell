import { describe, expect, it } from "vitest";
import { balancedPanelAllocation, buildPvArrayPlan, resizeUserPvArrayPlan, setPvArrayPanelCount, splitPvArrayPlan } from "./pv-array-plan";

describe("PV array proposal hierarchy", () => {
  it("changes only the selected mounting array quantity", () => {
    const plan = buildPvArrayPlan({ panelCount: 35, surfaces: [
      { id: "garage", name: "Garage", capacity: 10 },
      { id: "house-long", name: "House long roof", capacity: 15 },
      { id: "house-right", name: "House right roof", capacity: 14 },
    ] });
    const changed = setPvArrayPanelCount(plan, 1, 15);

    expect(changed.arrays.map((array) => array.name)).toEqual(plan.arrays.map((array) => array.name));
    expect(changed.arrays[0].allocatedPanelCount).toBe(plan.arrays[0].allocatedPanelCount);
    expect(changed.arrays[1].allocatedPanelCount).toBe(15);
    expect(changed.arrays[2].allocatedPanelCount).toBe(plan.arrays[2].allocatedPanelCount);
    expect(changed.configurationSource).toBe("user");
  });

  it("allocates the exact proposed panel count across multiple mounting surfaces", () => {
    const plan = buildPvArrayPlan({
      panelCount: 35,
      surfaces: [
        { id: "main-roof", name: "Main roof", capacity: 22, direction: "east" },
        { id: "west-roof", name: "Panel area 2", capacity: 22, direction: "west" },
      ],
    });
    expect(plan.status).toBe("topology_unresolved");
    expect(plan.arrays).toHaveLength(2);
    expect(plan.arrays.map((array) => array.allocatedPanelCount)).toEqual([18, 17]);
    expect(plan.arrays.reduce((total, array) => total + (array.allocatedPanelCount ?? 0), 0)).toBe(35);
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

  it("splits a selected ten-panel array into two retained five-panel arrays", () => {
    const plan = buildPvArrayPlan({ panelCount: 10, surfaces: [{ id: "main-roof", name: "Main roof", capacity: 10 }] });
    const split = splitPvArrayPlan(plan, 0, 2);

    expect(split).toMatchObject({
      status: "topology_unresolved",
      configurationSource: "user",
      arrays: [
        { id: "main-roof-part-1", name: "Main roof 1", allocatedPanelCount: 5 },
        { id: "main-roof-part-2", name: "Main roof 2", allocatedPanelCount: 5 },
      ],
    });
    expect(split.arrays.reduce((total, array) => total + (array.allocatedPanelCount ?? 0), 0)).toBe(10);
    expect(split.arrays.every((array) => array.topology.strings.length === 0)).toBe(true);
  });

  it("balances a non-divisible array split without losing panels", () => {
    expect(balancedPanelAllocation(10, 3)).toEqual([4, 3, 3]);
  });

  it("retains a user-selected split when the total panel quantity changes", () => {
    const original = buildPvArrayPlan({ panelCount: 10, surfaces: [{ id: "main-roof", name: "Main roof" }] });
    const split = splitPvArrayPlan(original, 0, 2);
    const resized = resizeUserPvArrayPlan(split, 12);

    expect(resized.configurationSource).toBe("user");
    expect(resized.arrays.map((array) => array.allocatedPanelCount)).toEqual([6, 6]);
    expect(resized.arrays.map((array) => array.name)).toEqual(["Main roof 1", "Main roof 2"]);
  });
});
