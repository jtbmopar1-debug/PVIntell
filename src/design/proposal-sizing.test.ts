import { describe, expect, it } from "vitest";
import { deriveProposalSizing, nextCommonInverterRatingKw, normalizedDailyEnergy, solarFirstPowerAlternative, supplementaryArrayPlan } from "./proposal-sizing";

const wholeHomeDiscovery = {
  current_energy_use: { value: "900 kWh/month" },
  backup_preference: { value: "most_home" },
  backup_duration: { value: "multiple_days" },
  generator_requirement: { value: "include" },
  generator_outage_role: { value: "battery_recharge, automatic_low_reserve" },
  household_motor_ratings: { value: JSON.stringify({
    heat_pump: { quantity: 2, runningKw: .8, startingKw: 1.2, simultaneous: true },
    compressor: { quantity: 1, runningKw: 3, startingKw: 6, simultaneous: true },
  }) },
};

describe("deterministic proposal sizing", () => {
  it("does not turn a negative energy answer positive or lose a leading decimal", () => {
    expect(normalizedDailyEnergy({ off_grid_daily_energy_use: "-6 kWh/day" })).toBeUndefined();
    expect(normalizedDailyEnergy({ off_grid_daily_energy_use: ".5 kWh/day" })?.dailyKwh).toBe(.5);
  });

  it("does not count a zero-quantity load", () => {
    const result = deriveProposalSizing({ mode: "off-grid", discovery: { household_motor_ratings: JSON.stringify({ compressor: { quantity: 0, runningKw: 3, startingKw: 9, runtimeMinutesPerDay: 60 } }) } });
    expect(result.simultaneousLoadKw ?? 0).toBe(0);
    expect(result.startupPeakKw ?? 0).toBe(0);
    expect(result.scheduledLoadEnergyKwh ?? 0).toBe(0);
  });

  it("uses kVA for power screening but not as measured workday kWh", () => {
    const result = deriveProposalSizing({ mode: "off-grid", discovery: { household_motor_ratings: JSON.stringify({ welder: { inputKva: 5, quantity: 1, runtimeMinutesPerDay: 60 } }) } });
    expect(result.simultaneousLoadKw).toBe(5);
    expect(result.scheduledLoadEnergyKwh ?? 0).toBe(0);
    expect(result.warnings).toContainEqual(expect.stringContaining("Real kW/power factor"));
  });

  it("uses typical input for energy and peak input for running capacity", () => {
    const result = deriveProposalSizing({ mode: "off-grid", discovery: { household_motor_ratings: JSON.stringify({ heat_pump: { runningKw: 1, peakRunningKw: 2, startingKw: 3, runtimeMinutesPerDay: 120 } }) } });
    expect(result.simultaneousLoadKw).toBe(2);
    expect(result.scheduledLoadEnergyKwh).toBe(2);
  });

  it("does not mistake the house heat pump for an already-counted pool heater", () => {
    const result = deriveProposalSizing({ mode: "off-grid", discovery: { pool_heater_electrical_kw: 2, pool_heating_method: "heat_pump", household_motor_ratings: JSON.stringify({ heat_pump: { runningKw: 1, simultaneous: true } }) } });
    expect(result.simultaneousLoadKw).toBe(3);
  });

  it("does not count the pool heater twice or retain removed pool equipment", () => {
    const discovery = { pool_heater_electrical_kw: 2, pool_heating_method: "heat_pump", pool_equipment: "none", pool_equipment_ratings: JSON.stringify({ heat_pump: { runningKw: 2, simultaneous: true }, filtration_pump: { runningKw: 8, simultaneous: true } }) };
    expect(deriveProposalSizing({ mode: "off-grid", discovery }).simultaneousLoadKw).toBe(2);
    expect(deriveProposalSizing({ mode: "off-grid", discovery: { ...discovery, pool_heating_method: "none" } }).simultaneousLoadKw ?? 0).toBe(0);
  });

  it("does not let an excluded generator's stale recharge role reduce storage", () => {
    const result = deriveProposalSizing({ mode: "hybrid", discovery: { ...wholeHomeDiscovery, generator_requirement: "none" } });
    expect(result.batteryUsableKwh).toBeUndefined();
    expect(result.warnings).toContainEqual(expect.stringContaining("chronological PV, load and generator dispatch"));
  });

  it("calculates a solar-first expansion path for an existing array that cannot cover a motor start", () => {
    expect(solarFirstPowerAlternative({ panelCount: 8, panelWatts: 580, inverterKw: 4, startupPeakKw: 5.4 })).toEqual({
      inverterKw: 6,
      targetPvKw: 7.54,
      totalPanelCount: 13,
      additionalPanelCount: 5,
    });
  });

  it("calculates missing capacity independently of the planning module used for the second array", () => {
    expect(supplementaryArrayPlan({ targetPvKw: 7.2, existingPanelCount: 8, existingPanelWatts: 580 })).toMatchObject({
      existingPvKw: 4.64,
      requiredCapacityKw: 2.56,
      planningCount: undefined,
      totalPlannedPvKw: 7.2,
    });
    expect(supplementaryArrayPlan({ targetPvKw: 7.2, existingPanelCount: 8, existingPanelWatts: 580, planningModuleWatts: 450 })).toMatchObject({
      requiredCapacityKw: 2.56,
      planningCount: 6,
      plannedCapacityKw: 2.7,
      totalPlannedPvKw: 7.34,
    });
  });

  it("moves calculated minimums up to a common inverter class", () => {
    expect(nextCommonInverterRatingKw(7.5)).toBe(8);
    expect(nextCommonInverterRatingKw(8)).toBe(8);
    expect(nextCommonInverterRatingKw(8.01)).toBe(10);
  });

  it("normalizes monthly energy once and derives internally consistent values", () => {
    const result = deriveProposalSizing({
      mode: "hybrid",
      peakSunHours: 4.2,
      discovery: wholeHomeDiscovery,
      representativePanelWatts: 440,
    });

    expect(result.dailyEnergyKwh).toBeCloseTo(900 / 30.4);
    expect(result).toMatchObject({
      method: "deterministic-v1",
      dailyEnergySource: "current_energy_use",
      pvKw: 9.24,
      panelCount: 21,
      panelWatts: 440,
      inverterKw: 8,
      simultaneousLoadKw: 4.6,
      startupPeakKw: 7.6,
      batteryUsableKwh: 17.8,
      batteryOnlyDays: .6,
    });
    expect(result.pvKw).toBe(result.panelCount! * result.panelWatts! / 1000);
  });

  it("preserves explicit day, week, month and annual units", () => {
    expect(normalizedDailyEnergy({ off_grid_daily_energy_use: { value: "12 kWh/day" } })?.dailyKwh).toBe(12);
    expect(normalizedDailyEnergy({ current_energy_use: { value: "84 kWh/week" } })?.dailyKwh).toBe(12);
    expect(normalizedDailyEnergy({ current_energy_use: { value: "3650 kWh/year" } })?.dailyKwh).toBe(10);
    expect(normalizedDailyEnergy({ current_energy_use: { value: "304 kWh/month" } })?.dailyKwh).toBe(10);
  });

  it("does not turn power nameplates or missing consumption into daily energy", () => {
    expect(normalizedDailyEnergy({ current_energy_use: { value: "18.5 kW inverter" } })).toBeUndefined();
    const result = deriveProposalSizing({ mode: "hybrid", peakSunHours: 4.2, discovery: {}, representativePanelWatts: 440 });
    expect(result.pvKw).toBeUndefined();
    expect(result.panelCount).toBeUndefined();
    expect(result.batteryUsableKwh).toBeUndefined();
  });

  it("does not invent a fixed loss percentage for seasonal shade", () => {
    const result = deriveProposalSizing({
      mode: "grid-tied",
      peakSunHours: 4.2,
      representativePanelWatts: 460,
      discovery: {
        current_energy_use: { value: "304 kWh/month" },
        shading: { value: "some" },
        shade_time_windows: { value: "morning, afternoon" },
        shade_seasonality: { value: "winter" },
        shade_extent: { value: "under_quarter" },
      },
    });

    expect(result.panelCount).toBe(7);
    expect(result.warnings).toContain("Some local shade is recorded (morning, afternoon; winter; under quarter). No numerical shade loss has been applied; production remains unverified until the affected mounting areas are assessed by time of day and season.");
  });

  it("does not invent battery storage for an explicitly battery-free off-grid plan", () => {
    const result = deriveProposalSizing({
      mode: "off-grid",
      peakSunHours: 4,
      representativePanelWatts: 460,
      discovery: {
        off_grid_daily_energy_use: { value: "12 kWh/day" },
        battery_requirement: { value: "none" },
        generator_requirement: { value: "include" },
        generator_outage_role: { value: "high_power_loads, backup_circuits" },
      },
    });

    expect(result.pvKw).toBeDefined();
    expect(result.inverterKw).toBeDefined();
    expect(result.batteryUsableKwh).toBeUndefined();
    expect(result.batterySizingBasis).toBeUndefined();
  });

  it("uses named intermittent workshop tools for surge and workday-energy evidence", () => {
    const result = deriveProposalSizing({
      mode: "off-grid",
      peakSunHours: 4,
      representativePanelWatts: 460,
      discovery: {
        off_grid_daily_energy_use: { value: "10 kWh/day" },
        battery_requirement: { value: "none" },
        heavy_loads: { value: ["saw_tools"] },
        household_motor_ratings: { value: JSON.stringify({
          saw_tools: { name: "Drop saw", quantity: 1, runningKw: 1.8, startingKw: 5.4, runtimeMinutesPerDay: 1, simultaneous: true },
          saw_tools__2: { name: "Table saw", baseType: "saw_tools", quantity: 1, runningKw: 2, startingKw: 6, runtimeMinutesPerDay: 2, simultaneous: true },
          compressor: { quantity: 1, runningKw: 20, startingKw: 60, runtimeMinutesPerDay: 60, simultaneous: true },
        }) },
      },
    });

    expect(result.simultaneousLoadKw).toBe(3.8);
    expect(result.startupPeakKw).toBe(7.8);
    expect(result.assumptions).toEqual(expect.arrayContaining([
      expect.stringContaining("runtimes imply about 0.1 kWh per workday"),
    ]));
  });

  it("keeps a non-overlapping motor's own running and startup demand in the load envelope", () => {
    const result = deriveProposalSizing({
      mode: "off-grid",
      peakSunHours: 2,
      representativePanelWatts: 580,
      discovery: {
        off_grid_daily_energy_use: { value: "6 kWh/day" },
        generator_requirement: { value: "include" },
        generator_outage_role: { value: "high_power_loads" },
        heavy_loads: { value: "compressor, saw_tools" },
        household_motor_ratings: { value: JSON.stringify({
          compressor: { quantity: 1, runningKw: 3, startingKw: 9, runtimeMinutesPerDay: 30, simultaneous: false },
          saw_tools: { quantity: 1, runningKw: 1.8, startingKw: 5.4, runtimeMinutesPerDay: 10, simultaneous: false },
          saw_tools__2: { name: "Dust extractor", baseType: "saw_tools", quantity: 1, runningKw: .8, startingKw: 2.4, runtimeMinutesPerDay: 60, simultaneous: true },
        }) },
      },
    });
    expect(result.simultaneousLoadKw).toBe(3);
    expect(result.startupPeakKw).toBe(9);
    expect(result.startupLoadName).toBe("compressor");
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("do not assume PV and generator ratings add together")]));
  });

  it("excludes a stale motor rating after the guided high-power selection removes it", () => {
    const result = deriveProposalSizing({
      mode: "off-grid",
      peakSunHours: 2,
      representativePanelWatts: 580,
      discovery: {
        off_grid_daily_energy_use: { value: "6 kWh/day" },
        heavy_or_surge_loads: { value: "saw_tools" },
        household_motor_ratings: { value: JSON.stringify({
          compressor: { quantity: 1, runningKw: 3, startingKw: 9, simultaneous: false },
          saw_tools: { name: "Drop saw", quantity: 1, runningKw: 1.8, startingKw: 5.4, simultaneous: false },
        }) },
      },
    });

    expect(result.simultaneousLoadKw).toBe(1.8);
    expect(result.startupPeakKw).toBe(5.4);
    expect(result.startupLoadName).toBe("Drop saw");
  });

  it("uses a visible essentials allowance when a circuit energy profile is unavailable", () => {
    const result = deriveProposalSizing({
      mode: "hybrid",
      peakSunHours: 4.2,
      representativePanelWatts: 440,
      discovery: { ...wholeHomeDiscovery, backup_preference: { value: "essentials_only" }, backup_duration: { value: "overnight" } },
    });
    expect(result.batteryUsableKwh).toBe(5.9);
    expect(result.inverterKw).toBe(8);
    expect(result.warnings).toContain("Essentials-only storage uses a 40% daily-energy planning allowance; replace it with the backed-up circuit energy profile.");
  });

  it("uses a visible energy-shifting allowance for a grid-connected storage request", () => {
    const result = deriveProposalSizing({
      mode: "hybrid",
      peakSunHours: 4.2,
      representativePanelWatts: 460,
      discovery: {
        current_energy_use: { value: "900 kWh/month" },
        battery_requirement: { value: "include" },
      },
    });
    expect(result.pvKw).toBeDefined();
    expect(result.inverterKw).toBeDefined();
    expect(result.batteryUsableKwh).toBe(11.8);
    expect(result.warnings).toContain("Grid-connected storage uses a 40% daily-energy shifting allowance; replace it with interval load and tariff objectives.");
  });

  it("does not multiply battery capacity by a multi-day resilience target", () => {
    const result = deriveProposalSizing({
      mode: "hybrid",
      peakSunHours: 4.2,
      representativePanelWatts: 440,
      discovery: { ...wholeHomeDiscovery, generator_outage_role: { value: "high_power_loads" } },
    });
    expect(result.batteryUsableKwh).toBeUndefined();
    expect(result.warnings).toContain("Battery size withheld for the multi-day target: a chronological PV, load and generator dispatch simulation is required rather than multiplying daily energy or inventing a one-day buffer.");
  });

  it("uses the Site solar curve when estimating a grid-connected backup day", () => {
    const result = deriveProposalSizing({
      mode: "hybrid",
      peakSunHours: 4.41,
      representativePanelWatts: 460,
      solarResource: {
        source: "NASA POWER ALLSKY_SFC_SW_DWN",
        basis: "annual_weighted_average",
        period: "2006-2025",
        monthlyPeakSunHours: [6.8129, 6.0029, 4.8833, 3.4767, 2.5506, 2.0614, 2.2353, 2.9927, 4.0859, 5.2617, 6.1387, 6.47],
      },
      discovery: {
        current_energy_use: { value: "800 kWh/month" },
        backup_preference: { value: "most_home" },
        backup_duration: { value: "one_day" },
        target_grid_role: { value: "normal_supply" },
      },
    });
    expect(result).toMatchObject({
      panelCount: 17,
      pvKw: 7.82,
      batteryUsableKwh: 14.5,
      batterySizingBasis: "solar_assisted_typical_winter",
      assumedNonSolarLoadKwh: 14.5,
      weakestMonthPvKwh: 12.9,
    });
  });

  it("recalculates dependent evidence from a user-selected panel count", () => {
    const result = deriveProposalSizing({
      mode: "hybrid",
      peakSunHours: 4.41,
      representativePanelWatts: 460,
      selectedPanelCount: 18,
      solarResource: {
        source: "NASA POWER ALLSKY_SFC_SW_DWN",
        basis: "annual_weighted_average",
        monthlyPeakSunHours: [6.8129, 6.0029, 4.8833, 3.4767, 2.5506, 2.0614, 2.2353, 2.9927, 4.0859, 5.2617, 6.1387, 6.47],
      },
      discovery: {
        current_energy_use: { value: "800 kWh/month" },
        backup_preference: { value: "most_home" },
        backup_duration: { value: "one_day" },
      },
    });
    expect(result).toMatchObject({
      energyTargetPanelCount: 17,
      panelCount: 18,
      pvKw: 8.28,
      weakestMonthPvKwh: 13.7,
      inverterKw: 8,
    });
  });

  it("applies the explicit off-grid recovery margin", () => {
    const result = deriveProposalSizing({
      mode: "off_grid",
      peakSunHours: 4,
      representativePanelWatts: 500,
      discovery: {
        off_grid_daily_energy_use: { value: "10 kWh/day" },
        backup_duration: { value: "one_day" },
        household_motor_ratings: { value: JSON.stringify({ pump: { runningKw: 1, startingKw: 3, simultaneous: true } }) },
      },
    });
    expect(result).toMatchObject({ pvKw: 4, panelCount: 8, batteryUsableKwh: 10, batteryOnlyDays: 1, inverterKw: 4 });
  });

  it("caps the annual-energy target at the recorded usable panel-area capacity", () => {
    const result = deriveProposalSizing({
      mode: "hybrid",
      peakSunHours: 4.2,
      representativePanelWatts: 460,
      representativePanelLengthMm: 1762,
      representativePanelWidthMm: 1134,
      discovery: {
        current_energy_use: { value: "900 kWh/month" },
        panel_area_dimensions: { value: JSON.stringify([{ id: "roof", lengthM: 6, widthM: 7 }]) },
        panel_area_constraints: { value: JSON.stringify([{ id: "none", areaId: "", kind: "none", lengthM: "", widthM: "" }]) },
      },
    });
    expect(result).toMatchObject({
      energyTargetPanelCount: 20,
      planningPanelCapacity: 18,
      panelCount: 18,
      pvKw: 8.28,
      fitLimited: true,
    });
  });
});
