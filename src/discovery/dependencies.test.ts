import { describe, expect, it } from "vitest";
import { reconcileDiscoveryDependencies } from "./dependencies";

describe("reconcileDiscoveryDependencies", () => {
  it("remaps a single changed surface while dropping ground-specific construction facts", () => {
    const result = reconcileDiscoveryDependencies({
      panel_location: ["main_roof"],
      panel_area_dimensions: JSON.stringify([{ id: "ground-0", name: "Roof", lengthM: "10", widthM: "3" }]),
      orientation_and_pitch: JSON.stringify([{ id: "ground-0", name: "Roof", direction: "north_east", slope: "low" }]),
      structure_condition: JSON.stringify([{ id: "ground-0", name: "Ground area", material: "grass", age: "not_applicable", condition: "firm_dry" }]),
    });
    expect(JSON.parse(String(result.panel_area_dimensions))).toEqual([{ id: "main_roof-0", name: "Roof", lengthM: "10", widthM: "3" }]);
    expect(JSON.parse(String(result.orientation_and_pitch))[0]).toMatchObject({ id: "main_roof-0", direction: "north_east", slope: "low" });
    expect(result.structure_condition).toBeUndefined();
  });

  it("clears ambiguous dependent answers when several selected surfaces change", () => {
    const result = reconcileDiscoveryDependencies({ panel_location: ["main_roof", "other_roof"], panel_area_dimensions: "[]", orientation_and_pitch: "[]" }, { panel_location: ["ground"] });
    expect(result.panel_area_dimensions).toBeUndefined();
    expect(result.orientation_and_pitch).toBeUndefined();
  });

  it("globally removes answers from dynamic branches that are no longer visible", () => {
    const result = reconcileDiscoveryDependencies({
      panel_location: ["main_roof"],
      shading: "little",
      shade_time_windows: ["morning"],
      battery_requirement: "none",
      battery_chemistry: "lifepo4",
    });
    expect(result.shade_time_windows).toBeUndefined();
    expect(result.battery_chemistry).toBeUndefined();
  });
});
