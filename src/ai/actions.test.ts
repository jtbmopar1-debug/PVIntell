import { describe, expect, it } from "vitest";
import { PROPOSAL_ENGINE_VERSION, generatorPlanningTargets, reconcileStoredProposal, refreshProposalAfterSizingInput, validatePreliminarySizing } from "./actions";

const settings = {
  peakSunHours: 4.2,
  designDiscovery: {
    current_energy_use: { value: "900 kWh/month" },
    backup_preference: { value: "most_home" },
    backup_duration: { value: "multiple_days" },
    generator_requirement: { value: "include" },
    generator_outage_role: { value: "battery_recharge, automatic_low_reserve" },
    household_motor_ratings: { value: JSON.stringify({
      heat_pump: { quantity: 2, runningKw: .8, simultaneous: true },
      compressor: { quantity: 1, runningKw: 3, simultaneous: true },
    }) },
  },
};

const required = {
  design_basis: "Recorded monthly energy, outage goal, loads and generator role.",
  starting_stage: "Proposed hybrid system.",
  expansion_path: "Retain a compatible expansion path.",
  next_validation: "Validate against time-series production and demand.",
  panel_type: "monofacial" as const,
  fit_status: "unverified" as const,
};

describe("preliminary proposal sizing boundary", () => {
  it("sizes generator running class separately from the recorded motor-start requirement", () => {
    expect(generatorPlanningTargets({
      included: true,
      purchaseStatus: "not_purchased",
      roles: "high_power_loads, backup_circuits",
      inverterKw: 4,
      continuousLoadKw: 3,
      startupPeakKw: 9,
    })).toMatchObject({
      continuousKw: 8.5,
      motorStartKw: 9,
      assignedHighPowerLoads: true,
    });
  });

  it("does not add a proposal-specific extra generator class after the calculated requirement", () => {
    expect(generatorPlanningTargets({
      included: true,
      purchaseStatus: "not_purchased",
      roles: "high_power_loads",
      continuousLoadKw: 1.8,
      startupPeakKw: 5.4,
    }).continuousKw).toBe(5);
  });

  it("replaces AI candidates with sizing derived from 900 kWh/month", () => {
    const result = validatePreliminarySizing({
      ...required,
      pv_kw: 8.8,
      representative_panel_watts: 440,
      panel_count: 20,
      pv_strings: 2,
      panels_per_string: 10,
      inverter_kw: 10,
      battery_usable_kwh: 18,
    }, settings, "hybrid");

    expect(result).toMatchObject({
      pvKw: 9.24,
      panelCount: 21,
      pvStrings: undefined,
      panelsPerString: undefined,
      inverterKw: 8,
      batteryUsableKwh: 17.8,
    });
    expect(result.sizing.dailyEnergyKwh).toBeCloseTo(900 / 30.4);
    expect(result.withheld).toEqual(expect.arrayContaining([
      "AI-provided PV size", "AI-provided panel count", "AI-provided inverter rating",
      "AI-provided battery capacity", "PV string layout pending selected equipment limits",
    ]));
  });

  it("replaces the observed 48-panel, 18.5 kW, 1,800 kWh over-computation", () => {
    const result = validatePreliminarySizing({
      ...required,
      pv_kw: 21.12,
      representative_panel_watts: 440,
      panel_count: 48,
      pv_strings: 4,
      panels_per_string: 12,
      inverter_kw: 18.5,
      battery_usable_kwh: 1800,
    }, settings, "hybrid");

    expect(result).toMatchObject({ pvKw: 9.24, panelCount: 21, inverterKw: 8, batteryUsableKwh: 17.8 });
    expect(result.withheld).toEqual(expect.arrayContaining([
      "AI-provided PV size", "AI-provided panel count", "AI-provided inverter rating", "AI-provided battery capacity",
    ]));
  });

  it("does not turn a multi-day outage into battery-only energy when no recharge model supports it", () => {
    const withoutGeneratorCharging = {
      ...settings,
      designDiscovery: {
        ...settings.designDiscovery,
        generator_outage_role: { value: "high_power_loads" },
      },
    };
    const result = validatePreliminarySizing({ ...required, battery_usable_kwh: 90 }, withoutGeneratorCharging, "hybrid");
    expect(result.batteryUsableKwh).toBeUndefined();
    expect(result.withheld).toContain("AI-provided battery capacity");
  });

  it("recalculates a Wattson proposal and clears its stale schematic after discovery changes", () => {
    const changed = structuredClone(settings) as Record<string, unknown>;
    changed.designCalculator = {
      updatedBy: "wattson", panelWatts: 440, targetPvKw: 21.12, panelCount: 48,
      inverterKw: 18.5, batteryUsableKwh: 1800, pvStrings: 4, panelsPerString: 12,
      fitStatus: "verified", proposedChecklist: { solar: true }, proposedAsBuiltDraft: { flow: ["a", "b"] },
    };

    refreshProposalAfterSizingInput(changed, "hybrid");

    expect(changed.designCalculator).toMatchObject({
      updatedBy: "wattson", sizingMethod: "deterministic-v1", targetPvKw: 9.24,
      panelCount: 21, inverterKw: 8, batteryUsableKwh: 17.8, fitStatus: "unverified",
    });
    expect(changed.designCalculator).not.toHaveProperty("pvStrings");
    expect(changed.designCalculator).not.toHaveProperty("proposedAsBuiltDraft");
    expect(changed.designCalculator).not.toHaveProperty("proposedChecklist");
  });

  it("flags a user-adjusted proposal after discovery changes without overwriting it", () => {
    const changed = structuredClone(settings) as Record<string, unknown>;
    changed.designCalculator = { updatedBy: "user", panelWatts: 440, panelCount: 16, batteryUsableKwh: 12, proposedAsBuiltDraft: { flow: ["a", "b"] } };

    refreshProposalAfterSizingInput(changed, "hybrid");

    expect(changed.designCalculator).toMatchObject({ updatedBy: "user", panelCount: 16, batteryUsableKwh: 12, sizingMethod: "user-adjusted" });
    expect(changed.designCalculator).not.toHaveProperty("proposedAsBuiltDraft");
    expect((changed.designCalculator as { sizingWarnings: string[] }).sizingWarnings[0]).toMatch(/Discovery changed/);
  });

  it("automatically upgrades a stale Wattson proposal through the current engine", () => {
    const stale = structuredClone(settings) as Record<string, unknown>;
    stale.designCalculator = {
      updatedBy: "wattson", panelWatts: 440, panelCount: 48, inverterKw: 18.5,
      pvStrings: 3, panelsPerString: 8, proposedAsBuiltDraft: { flow: ["old", "draft"] },
    };

    expect(reconcileStoredProposal(stale, "hybrid", { location: "Auckland, New Zealand", timezone: "Pacific/Auckland" })).toBe(true);
    expect(stale.designCalculator).toMatchObject({
      proposalEngineVersion: PROPOSAL_ENGINE_VERSION,
      updatedBy: "wattson",
      panelCount: 21,
      inverterPlan: { jurisdiction: "nz", selectionStatus: "candidate_selected", unitRatingsKw: [8] },
      pvArrayPlan: { status: "surface_allocation_required" },
    });
    expect(stale.designCalculator).not.toHaveProperty("pvStrings");
    expect(stale.designCalculator).not.toHaveProperty("panelsPerString");
    expect(stale.designCalculator).not.toHaveProperty("proposedAsBuiltDraft");
  });

  it("does not repeatedly rewrite a current proposal", () => {
    const current = structuredClone(settings) as Record<string, unknown>;
    current.designCalculator = { updatedBy: "wattson", proposalEngineVersion: PROPOSAL_ENGINE_VERSION };
    expect(reconcileStoredProposal(current, "hybrid", { location: "Auckland", timezone: "Pacific/Auckland" })).toBe(false);
  });

  it("reconciles a proposal already stamped by the incomplete version 2 repair", () => {
    const versionThree = structuredClone(settings) as Record<string, unknown>;
    versionThree.designCalculator = {
      updatedBy: "user",
      proposalEngineVersion: 3,
      panelCount: 35,
      panelWatts: 460,
      inverterKw: 15,
      proposedAsBuiltDraft: { flow: ["stale-v2-draft"] },
    };

    expect(reconcileStoredProposal(versionThree, "hybrid", { location: "Auckland, New Zealand", timezone: "Pacific/Auckland" })).toBe(true);
    expect(versionThree.designCalculator).toMatchObject({
      proposalEngineVersion: PROPOSAL_ENGINE_VERSION,
      inverterPlan: { unitRatingsKw: [8, 8] },
      pvArrayPlan: { status: "surface_allocation_required" },
    });
    expect(versionThree.designCalculator).not.toHaveProperty("proposedAsBuiltDraft");
  });

  it("versions but preserves a stale user-adjusted topology", () => {
    const adjusted = structuredClone(settings) as Record<string, unknown>;
    adjusted.designCalculator = { updatedBy: "user", panelCount: 16, panelWatts: 460, inverterKw: 14, pvStrings: 2, panelsPerString: 8 };
    expect(reconcileStoredProposal(adjusted, "hybrid", { location: "Auckland", timezone: "Pacific/Auckland" })).toBe(true);
    expect(adjusted.designCalculator).toMatchObject({
      proposalEngineVersion: PROPOSAL_ENGINE_VERSION,
      panelCount: 16,
      pvStrings: 2,
      panelsPerString: 8,
      inverterPlan: { unitRatingsKw: [8, 8] },
      pvArrayPlan: { status: "surface_allocation_required", arrays: [{ topology: { strings: [{ panelsInSeries: 8 }, { panelsInSeries: 8 }] } }] },
    });
  });

  it("removes an inconsistent user-saved legacy topology", () => {
    const adjusted = structuredClone(settings) as Record<string, unknown>;
    adjusted.designCalculator = {
      updatedBy: "user", panelCount: 16, panelWatts: 460, inverterKw: 14,
      pvStrings: 3, panelsPerString: 8, proposedAsBuiltDraft: { flow: ["bad"] },
    };
    expect(reconcileStoredProposal(adjusted, "hybrid", { location: "Auckland", timezone: "Pacific/Auckland" })).toBe(true);
    expect(adjusted.designCalculator).not.toHaveProperty("pvStrings");
    expect(adjusted.designCalculator).not.toHaveProperty("panelsPerString");
    expect(adjusted.designCalculator).not.toHaveProperty("proposedAsBuiltDraft");
    expect(adjusted.designCalculator).toMatchObject({ inverterPlan: { unitRatingsKw: [8, 8] } });
  });
});
