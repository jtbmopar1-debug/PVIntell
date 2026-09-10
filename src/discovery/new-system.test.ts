import { describe, expect, it } from "vitest";
import { discoveryProjectType, visibleDiscoveryQuestions } from "./new-system";

describe("new-system discovery", () => {
  it("makes no public electricity authoritative when producing system topology", () => {
    expect(discoveryProjectType({
      utility_relationship: "off_grid",
      primary_outcome: ["off_grid_supply"],
      battery_requirement: "none",
      generator_requirement: "include",
    })).toBe("off-grid");
  });

  it("offers a chest freezer as a separate simultaneous compressor load", () => {
    const questions = visibleDiscoveryQuestions({
      utility_relationship: "grid_connected",
      target_grid_role: "normal_supply",
      primary_outcome: ["backup"],
      building_type: ["detached_house"],
      everyday_needs: ["fridge_freezer"],
      backup_preference: "most_home",
    });
    const highPower = questions.find((question) => question.id === "heavy_loads");
    expect(highPower?.options?.map((option) => option.value)).toEqual(expect.arrayContaining(["refrigeration", "chest_freezer"]));
  });

  it("collects seasonal shade detail only when shade is recorded", () => {
    const panelAreas = JSON.stringify([
      { id: "main-roof", name: "Main roof", lengthM: 8, widthM: 6 },
      { id: "shed", name: "Workshop roof", lengthM: 5, widthM: 4 },
    ]);
    const clearIds = visibleDiscoveryQuestions({ panel_location: ["main_roof"], shading: "little", panel_area_dimensions: panelAreas }).map((question) => question.id);
    const shaded = visibleDiscoveryQuestions({ panel_location: ["main_roof"], shading: "some", panel_area_dimensions: panelAreas });
    const shadedIds = shaded.map((question) => question.id);

    expect(clearIds).not.toContain("shade_seasonality");
    expect(shadedIds).toEqual(expect.arrayContaining(["shade_affected_areas", "shade_time_windows", "shade_seasonality", "shade_extent"]));
    expect(shaded.find((question) => question.id === "shade_affected_areas")?.options?.map((option) => option.label)).toEqual(["Main roof", "Workshop roof", "Not sure which area"]);
  });

  it("supports a battery-free off-grid solar and generator plan", () => {
    const answers = {
      utility_relationship: "off_grid",
      building_type: ["shed_workshop"],
      panel_location: ["roof"],
      battery_requirement: "none",
      generator_requirement: "include",
    };
    const questions = visibleDiscoveryQuestions(answers);
    const ids = questions.map((question) => question.id);
    const generatorRole = questions.find((question) => question.id === "generator_outage_role");

    expect(ids).toContain("battery_requirement");
    expect(ids).not.toContain("dc_system_voltage");
    expect(generatorRole?.title).toBe("What should the generator do when extra power is needed?");
    expect(generatorRole?.options?.map((option) => option.value)).toEqual(["high_power_loads", "backup_circuits"]);
  });

  it("raises battery-free standalone compatibility in the inverter question", () => {
    const architecture = visibleDiscoveryQuestions({
      utility_relationship: "off_grid",
      panel_location: ["roof"],
      battery_requirement: "none",
      generator_requirement: "include",
    }).find((question) => question.id === "architecture_preference");

    expect(architecture?.noviceHelp).toContain("Note: some hybrid and off-grid inverters require a battery");
    expect(architecture?.technicalHelp).toContain("battery-free operating support");
    expect(architecture?.options?.find((option) => option.value === "combined")?.description).toBe("A central solar inverter with battery-ready or integrated battery-control capability; it can still be assessed when no battery is included now.");
  });

  it("establishes off-grid battery intent before asking what the generator should do", () => {
    const undecided = visibleDiscoveryQuestions({
      utility_relationship: "off_grid",
      building_type: ["shed_workshop"],
      panel_location: ["roof"],
      generator_requirement: "include",
    });
    const batteryIndex = undecided.findIndex((question) => question.id === "battery_requirement");

    expect(batteryIndex).toBeGreaterThan(-1);
    expect(undecided.some((question) => question.id === "generator_outage_role")).toBe(false);

    const decided = visibleDiscoveryQuestions({
      utility_relationship: "off_grid",
      building_type: ["shed_workshop"],
      panel_location: ["roof"],
      battery_requirement: "none",
      generator_requirement: "include",
    });
    expect(decided.findIndex((question) => question.id === "generator_outage_role")).toBeGreaterThan(batteryIndex);
  });

  it("does not turn a possible future addition into a current high-power load", () => {
    const questions = visibleDiscoveryQuestions({
      utility_relationship: "grid_connected",
      target_grid_role: "normal_supply",
      primary_outcome: ["cost"],
      building_type: ["cabin_mobile"],
      everyday_needs: ["lighting"],
      future_changes: ["ev", "electric_hot_water", "water_pump"],
    });

    expect(questions.some((question) => question.id === "heavy_loads")).toBe(false);
    expect(questions.some((question) => question.id === "ev_status")).toBe(false);
  });
});
