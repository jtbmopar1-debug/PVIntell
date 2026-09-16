import { describe, expect, it } from "vitest";
import { reconcileDiscoveryDependencies } from "./dependencies";
import { visibleDiscoveryQuestions } from "./new-system";

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

  it("removes inherited-system knowledge when no system is installed", () => {
    const result = reconcileDiscoveryDependencies({
      existing_system_status: "none",
      installed_system_knowledge: "unknown",
    });
    expect(result.installed_system_knowledge).toBeUndefined();
  });

  it("removes existing power-equipment details when the fallback answer changes to no", () => {
    const result = reconcileDiscoveryDependencies({
      existing_power_equipment_status: "no",
      existing_power_equipment: JSON.stringify([{ name: "Main inverter" }]),
      architecture_preference: "existing",
    });
    expect(result.existing_power_equipment).toBeUndefined();
    expect(result.architecture_preference).toBeUndefined();
  });

  it("selects the existing-inverter arrangement when existing power equipment is included", () => {
    const result = reconcileDiscoveryDependencies({
      existing_power_equipment_status: "yes",
    });

    expect(result.architecture_preference).toBe("existing");
  });

  it("clears the removed compare-arrangements answer from saved discovery", () => {
    const result = reconcileDiscoveryDependencies({ architecture_preference: "compare" });

    expect(result.architecture_preference).toBeUndefined();
  });

  it("makes existing panels exclusive of proposed panel types", () => {
    const result = reconcileDiscoveryDependencies({
      panel_construction_interest: ["existing", "rigid_framed", "bifacial", "flexible_lightweight"],
    });
    expect(result.panel_construction_interest).toEqual(["existing"]);
  });

  it("removes the complete EV branch as soon as EV is removed from current needs", () => {
    const result = reconcileDiscoveryDependencies({
      utility_relationship: "off_grid",
      everyday_needs: ["lighting", "water_pump"],
      heavy_loads: ["ev", "water_pump"],
      ev_status: "vehicle_planned",
      ev_vehicle_details: ["vehicle_identity"],
      ev_travel_profile: "20_to_50",
      ev_charging_window: ["overnight"],
      ev_charging_priority: ["solar_surplus"],
      ev_available_supply: "no_supply",
      ev_bidirectional_goal: "no",
    }, {
      utility_relationship: "off_grid",
      everyday_needs: ["lighting", "water_pump", "ev"],
      heavy_loads: ["ev", "water_pump"],
    });

    expect(result.heavy_loads).toBeUndefined();
    expect(result.ev_status).toBeUndefined();
    expect(result.ev_vehicle_details).toBeUndefined();
    expect(result.ev_travel_profile).toBeUndefined();
    expect(result.ev_charging_window).toBeUndefined();
    expect(result.ev_charging_priority).toBeUndefined();
    expect(result.ev_available_supply).toBeUndefined();
    expect(result.ev_bidirectional_goal).toBeUndefined();
    expect(visibleDiscoveryQuestions(result).some((question) => question.id.startsWith("ev_"))).toBe(false);
  });

  it("removes overlap choices that are no longer selected day-to-day loads", () => {
    const result = reconcileDiscoveryDependencies({
      everyday_needs: ["lighting", "fridge_freezer", "compressor"],
      heavy_loads: ["compressor", "refrigeration", "chest_freezer", "electric_water", "electric_oven", "air_fryer", "microwave"],
    });

    expect(result.heavy_loads).toEqual(["compressor", "refrigeration"]);
  });

  it("keeps equipment ratings tied to day-to-day selections rather than overlap selections", () => {
    const result = reconcileDiscoveryDependencies({
      everyday_needs: ["water_pump", "tools"],
      heavy_loads: ["water_pump"],
      household_motor_ratings: JSON.stringify({
        water_pump: { quantity: 1, runningKw: 1 },
        saw_tools: { quantity: 1, runningKw: 2 },
        compressor: { quantity: 1, runningKw: 3 },
      }),
    });

    expect(JSON.parse(String(result.household_motor_ratings))).toEqual({
      water_pump: { quantity: 1, runningKw: 1 },
      saw_tools: { quantity: 1, runningKw: 2 },
    });
  });
});
