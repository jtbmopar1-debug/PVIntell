import { describe, expect, it } from "vitest";
import { discoveryProjectType, evPlanningPowerBand, evVehicleSizeOptions, hasReliableMeasuredEnergyUse, sequentialDiscoveryStageProgress, visibleDiscoveryQuestions, type DiscoveryQuestion } from "./new-system";

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
    const newSystemQuestions = visibleDiscoveryQuestions({ existing_system_status: "none" });
    expect(newSystemQuestions[0]).toMatchObject({
      id: "existing_system_status",
      options: [
        expect.objectContaining({ value: "installed" }),
        expect.objectContaining({ value: "none" }),
      ],
    });
    expect(newSystemQuestions[0].options).toHaveLength(2);
    expect(newSystemQuestions[1]).toMatchObject({
      id: "existing_proposal_status",
      options: [
        expect.objectContaining({ value: "yes" }),
        expect.objectContaining({ value: "no" }),
      ],
    });

    const installedSystemQuestions = visibleDiscoveryQuestions({ existing_system_status: "installed" });
    expect(installedSystemQuestions[1]).toMatchObject({
      id: "installed_system_knowledge",
      options: [
        expect.objectContaining({ value: "know_well" }),
        expect.objectContaining({ value: "know_main" }),
        expect.objectContaining({ value: "know_little" }),
        expect.objectContaining({ value: "know_nothing" }),
      ],
    });
    expect(installedSystemQuestions[1].options).toHaveLength(4);
    expect(installedSystemQuestions.map((question) => question.id)).not.toContain("existing_proposal_status");
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

  it("only offers a chest freezer when it was selected as a day-to-day load", () => {
    const questions = visibleDiscoveryQuestions({
      utility_relationship: "grid_connected",
      target_grid_role: "normal_supply",
      primary_outcome: ["backup"],
      building_type: ["detached_house"],
      everyday_needs: ["fridge_freezer", "chest_freezer"],
      backup_preference: "most_home",
    });
    const highPower = questions.find((question) => question.id === "heavy_loads");
    expect(highPower?.options?.map((option) => option.value)).toEqual(["refrigeration", "chest_freezer", "none"]);
  });

  it("adds selected high-power follow-up questions to Needs for an ordinary grid-connected system", () => {
    const questions = visibleDiscoveryQuestions({
      utility_relationship: "grid_connected",
      target_grid_role: "normal_supply",
      primary_outcome: ["cost"],
      building_type: ["detached_house"],
      everyday_needs: ["lighting", "general_outlets", "fridge_freezer", "compressor"],
      heavy_loads: ["compressor", "refrigeration"],
    });
    const everydayIndex = questions.findIndex((question) => question.id === "everyday_needs");
    const highPowerIndex = questions.findIndex((question) => question.id === "heavy_loads");
    const ratingsIndex = questions.findIndex((question) => question.id === "household_motor_ratings");
    const generatorIndex = questions.findIndex((question) => question.id === "generator_requirement");
    const designIndex = questions.findIndex((question) => question.stage === "design");

    expect(ratingsIndex).toBe(everydayIndex + 1);
    expect(highPowerIndex).toBe(ratingsIndex + 1);
    expect(questions[highPowerIndex]).toMatchObject({ stage: "needs" });
    expect(questions[highPowerIndex].options?.map((option) => option.value)).toEqual(["compressor", "refrigeration", "none"]);
    expect(questions[ratingsIndex]).toMatchObject({ stage: "needs" });
    expect(generatorIndex).toBeGreaterThan(ratingsIndex);
    expect(ratingsIndex).toBeLessThan(designIndex);
    expect(highPowerIndex).toBeLessThan(designIndex);
  });

  it("does not invent unselected equipment in the overlap question", () => {
    const overlap = visibleDiscoveryQuestions({
      everyday_needs: ["lighting", "general_outlets", "fridge_freezer", "compressor"],
      cooking_energy: ["electric_oven", "air_fryer", "microwave"],
      water_heating_energy: ["electric_resistive"],
      pool_heating_method: ["heat_pump"],
      building_type: ["shed_workshop"],
    }).find((question) => question.id === "heavy_loads");

    expect(overlap?.options?.map((option) => option.value)).toEqual(["compressor", "refrigeration", "none"]);
    expect(overlap?.options?.map((option) => option.label)).toEqual([
      "Compressor, motor or welder",
      "Fridge or upright freezer",
      "None of these overlap",
    ]);
  });

  it("keeps EV out of generic appliance ratings and overlap choices", () => {
    const questions = visibleDiscoveryQuestions({ everyday_needs: ["fridge_freezer", "ev"] });
    const overlap = questions.find((question) => question.id === "heavy_loads");

    expect(overlap).toBeUndefined();
  });

  it("condenses the current-EV branch to two Needs pages before Design", () => {
    const questions = visibleDiscoveryQuestions({ everyday_needs: ["ev"] });
    const evQuestions = questions.filter((question) => question.id.startsWith("ev_"));
    const futureIndex = questions.findIndex((question) => question.id === "future_changes");

    expect(evQuestions.map((question) => question.id)).toEqual(["ev_status", "ev_travel_profile"]);
    expect(evQuestions.every((question) => question.stage === "needs")).toBe(true);
    expect(Math.max(...evQuestions.map((question) => questions.indexOf(question)))).toBeLessThan(futureIndex);
  });

  it("skips overlap for one heat pump while retaining its equipment-rating question", () => {
    const questions = visibleDiscoveryQuestions({
      utility_relationship: "grid_connected",
      target_grid_role: "normal_supply",
      everyday_needs: ["cooling"],
    });
    const overlap = questions.find((question) => question.id === "heavy_loads");
    const rating = questions.find((question) => question.id === "household_motor_ratings");

    expect(overlap).toBeUndefined();
    expect(rating).toMatchObject({ stage: "needs" });
    expect(questions.indexOf(rating!)).toBeLessThan(questions.findIndex((question) => question.stage === "design"));
  });

  it("shows overlap only when at least two eligible day-to-day loads are selected", () => {
    const oneLoad = visibleDiscoveryQuestions({ everyday_needs: ["fridge_freezer"] });
    const twoLoads = visibleDiscoveryQuestions({ everyday_needs: ["fridge_freezer", "water_pump"] });

    expect(oneLoad.some((question) => question.id === "heavy_loads")).toBe(false);
    expect(twoLoads.find((question) => question.id === "heavy_loads")?.options?.map((option) => option.value)).toEqual([
      "water_pump",
      "refrigeration",
      "none",
    ]);
  });

  it("shows the equipment-rating page directly from day-to-day high-power selections", () => {
    const questions = visibleDiscoveryQuestions({
      everyday_needs: ["water_pump", "tools", "compressor"],
    });
    const everydayIndex = questions.findIndex((question) => question.id === "everyday_needs");
    const ratingsIndex = questions.findIndex((question) => question.id === "household_motor_ratings");
    const overlapIndex = questions.findIndex((question) => question.id === "heavy_loads");

    expect(ratingsIndex).toBe(everydayIndex + 1);
    expect(overlapIndex).toBe(ratingsIndex + 1);
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

  it("offers future space heating or cooling separately from water and pool heating", () => {
    const futureChanges = visibleDiscoveryQuestions({}).find((question) => question.id === "future_changes");
    expect(futureChanges?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "heat_pump_ac", label: "Heat pump or air conditioning" }),
      expect.objectContaining({ value: "electric_hot_water" }),
      expect.objectContaining({ value: "heated_pool" }),
    ]));
  });

  it("uses existing inverter and controller capture as a fallback before battery discovery", () => {
    const withoutEquipment = visibleDiscoveryQuestions({ existing_power_equipment_status: "no" }).map((question) => question.id);
    expect(withoutEquipment).toContain("existing_power_equipment_status");
    expect(withoutEquipment).not.toContain("existing_power_equipment");

    const withEquipment = visibleDiscoveryQuestions({ utility_relationship: "off_grid", existing_power_equipment_status: "yes" }).map((question) => question.id);
    expect(withEquipment.indexOf("existing_power_equipment_status")).toBeLessThan(withEquipment.indexOf("existing_power_equipment"));
    expect(withEquipment.indexOf("existing_power_equipment")).toBeLessThan(withEquipment.indexOf("battery_requirement"));
  });

  it("uses simple EV size selections instead of technical vehicle inputs", () => {
    expect(evVehicleSizeOptions.map((option) => option.value)).toEqual(["small", "medium", "large"]);
  });

  it("derives the EV capacity from vehicle size, daily driving and charging habit", () => {
    expect(evPlanningPowerBand({ ev_vehicle_size: "small", ev_travel_profile: "short", ev_charging_window: ["overnight"] })).toBe("up_to_3_6_kw");
    expect(evPlanningPowerBand({ ev_vehicle_size: "large", ev_travel_profile: "long", ev_charging_window: ["daytime"] })).toBe("3_7_to_7_4_kw");
    expect(evPlanningPowerBand({ ev_travel_profile: "short", ev_charging_window: ["overnight"] })).toBeUndefined();
  });

  it("collects normal EV driving as a firm distance-band selection", () => {
    const question = visibleDiscoveryQuestions({ everyday_needs: ["ev"] }).find((item) => item.id === "ev_travel_profile");
    expect(question).toMatchObject({ type: "choice" });
    expect(question?.options?.map((option) => option.value)).toEqual([
      "short",
      "average",
      "long",
    ]);
  });
});
