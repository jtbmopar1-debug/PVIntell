import { describe, expect, it } from "vitest";
import { discoveryProjectType, hasReliableMeasuredEnergyUse, sequentialDiscoveryStageProgress, visibleDiscoveryQuestions, type DiscoveryQuestion } from "./new-system";

describe("new-system discovery", () => {
  const stagedQuestions: DiscoveryQuestion[] = [
    { id: "goal", stage: "discovery", title: "Goal", noviceHelp: "", type: "text" },
    { id: "location", stage: "site", title: "Location", noviceHelp: "", type: "text" },
    { id: "loads", stage: "needs", title: "Loads", noviceHelp: "", type: "text" },
    { id: "preference", stage: "design", title: "Preference", noviceHelp: "", type: "text" },
  ];

  it("unlocks discovery modules only after every preceding module is complete", () => {
    expect(sequentialDiscoveryStageProgress(stagedQuestions, new Set()).map(({ id, unlocked, complete }) => ({ id, unlocked, complete }))).toEqual([
      { id: "discovery", unlocked: true, complete: false },
      { id: "site", unlocked: false, complete: false },
      { id: "needs", unlocked: false, complete: false },
      { id: "design", unlocked: false, complete: false },
    ]);

    expect(sequentialDiscoveryStageProgress(stagedQuestions, new Set(["goal", "location"])).map(({ id, unlocked, complete }) => ({ id, unlocked, complete }))).toEqual([
      { id: "discovery", unlocked: true, complete: true },
      { id: "site", unlocked: true, complete: true },
      { id: "needs", unlocked: true, complete: false },
      { id: "design", unlocked: false, complete: false },
    ]);
  });

  it("does not unlock a later module just because that module already contains answers", () => {
    const progress = sequentialDiscoveryStageProgress(stagedQuestions, new Set(["loads", "preference"]));
    expect(progress.find((stage) => stage.id === "needs")?.unlocked).toBe(false);
    expect(progress.find((stage) => stage.id === "design")?.unlocked).toBe(false);
  });

  it("starts the first available filtered module without requiring hidden modules", () => {
    const siteOnly = stagedQuestions.filter((question) => question.stage === "site");
    expect(sequentialDiscoveryStageProgress(siteOnly, new Set())[1]).toMatchObject({ id: "site", available: true, unlocked: true });
  });

  it("gates proposal discovery on whether a system is already installed", () => {
    const questions = visibleDiscoveryQuestions({});
    expect(questions[0]).toMatchObject({
      id: "existing_system_status",
      options: [
        expect.objectContaining({ value: "none" }),
        expect.objectContaining({ value: "installed" }),
        expect.objectContaining({ value: "partly_installed" }),
        expect.objectContaining({ value: "installed_change_planned" }),
      ],
    });
  });

  it("uses floor area only as a fallback when reliable measured energy is unavailable", () => {
    const residential = { utility_relationship: "grid_connected", building_type: ["detached_house"] };
    expect(hasReliableMeasuredEnergyUse({ ...residential, current_energy_use: 430 })).toBe(true);
    expect(visibleDiscoveryQuestions({ ...residential, current_energy_use: 430 }).map((question) => question.id)).not.toContain("served_floor_area");
    expect(visibleDiscoveryQuestions(residential).map((question) => question.id)).toContain("served_floor_area");
    expect(visibleDiscoveryQuestions({ utility_relationship: "off_grid", building_type: ["detached_house"], off_grid_daily_energy_use: 12 }).map((question) => question.id)).not.toContain("served_floor_area");
  });

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
