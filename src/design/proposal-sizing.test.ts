import { describe, expect, it } from "vitest";
import { deriveProposalSizing, normalizedDailyEnergy } from "./proposal-sizing";

const wholeHomeDiscovery = {
  current_energy_use: { value: "900 kWh/month" },
  backup_preference: { value: "most_home" },
  backup_duration: { value: "multiple_days" },
  generator_outage_role: { value: "battery_recharge, automatic_low_reserve" },
  household_motor_ratings: { value: JSON.stringify({
    heat_pump: { quantity: 2, runningKw: .8, startingKw: 1.2, simultaneous: true },
    compressor: { quantity: 1, runningKw: 3, startingKw: 6, simultaneous: true },
  }) },
};

describe("deterministic proposal sizing", () => {
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
    expect(result).toMatchObject({ pvKw: 4, panelCount: 8, batteryUsableKwh: 10, batteryOnlyDays: 1, inverterKw: 3.5 });
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
