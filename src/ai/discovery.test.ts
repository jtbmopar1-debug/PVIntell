import { describe, expect, it } from "vitest";
import { confirmedPrimaryOutcome, confirmedUtilityRelationship, discoveryGuidance, nextRequiredDiscoveryQuestion, userExpressesUncertainty, userIsAskingDiscoveryQuestion, workspaceProjectType } from "./discovery";

const utilityQuestion = [{
  role: "assistant",
  content: "Is this house already connected to public electricity, or would solar need to supply all of its power without the grid?",
}];

describe("Wattson discovery interpretation", () => {
  it.each(["yes", "it has power already", "its already connected", "we have mains power"])(
    "recognises an ordinary grid-connected answer: %s",
    (answer) => expect(confirmedUtilityRelationship(utilityQuestion, answer)).toBe("grid_connected"),
  );

  it.each(["no", "there is no mains", "we are off-grid", "not connected to the grid"])(
    "recognises an ordinary off-grid answer: %s",
    (answer) => expect(confirmedUtilityRelationship(utilityQuestion, answer)).toBe("off_grid"),
  );

  it("does not infer a utility relationship from the initial solar request", () => {
    expect(confirmedUtilityRelationship([], "I want to put solar on my house")).toBeNull();
  });

  it("retains an ordinary connection answer after Wattson moves to the goal question", () => {
    const conversation = [
      ...utilityQuestion,
      { role: "user", content: "its connected already" },
      { role: "assistant", content: "What matters most: lower bills, outage backup, independence, or a combination?" },
    ];
    expect(confirmedUtilityRelationship(conversation, "combination")).toBe("grid_connected");
  });

  it("keeps bill reduction separate from bill reduction plus backup", () => {
    expect(confirmedPrimaryOutcome([], "I mainly want to lower my power bill")).toBe("Reduce imported electricity and power costs");
    expect(confirmedPrimaryOutcome([], "I want lower bills and backup in a blackout")).toBe("Reduce electricity use/cost and improve resilience");
  });

  it("derives workspace mode only from confirmed utility and outcome answers", () => {
    expect(workspaceProjectType("off_grid", null)).toBe("off-grid");
    expect(workspaceProjectType("grid_connected", "Reduce imported electricity and power costs")).toBe("grid-tied");
    expect(workspaceProjectType("grid_connected", "Keep essential loads running during outages")).toBe("hybrid");
  });

  it("keeps architecture behind the basic energy and site discovery gate", () => {
    const settings = { designDiscovery: {
      utility_relationship: { value: "Connected to public electricity" },
      primary_outcome: { value: "Reduce imported electricity and power costs" },
    } };
    expect(nextRequiredDiscoveryQuestion(settings)?.[0]).toBe("current_energy_use");
    const pending = [
      "current_energy_use", "cooking_energy", "water_heating_energy", "space_heating_energy",
      "heavy_or_surge_loads", "building_type", "property_authority",
      "proposed_panel_location", "usable_solar_space", "shading", "structure_condition",
      "expected_expansion", "delivery_approach",
    ].map((key) => ({ name: "record_design_discovery", arguments: { key, value: "confirmed" } }));
    expect(nextRequiredDiscoveryQuestion(settings, pending)).toBeNull();
  });

  it("teaches the backup choice before asking for essential loads", () => {
    const settings = { designDiscovery: {
      utility_relationship: { value: "Connected to public electricity" },
      primary_outcome: { value: "Reduce electricity use/cost and improve resilience" },
      current_energy_use: { value: "800 kWh per month" },
    } };
    expect(nextRequiredDiscoveryQuestion(settings)?.[0]).toBe("backup_preference");
    expect(nextRequiredDiscoveryQuestion(settings)?.[1]).toContain("fridge, lights and internet");
  });

  it("does not treat a confused response as confirmed discovery", () => {
    expect(userExpressesUncertainty("none? I don't understand")).toBe(true);
    expect(userExpressesUncertainty("I don't know")).toBe(true);
    expect(userExpressesUncertainty("essentials only")).toBe(false);
    expect(discoveryGuidance("backup_preference")).toContain("Outage backup means");
    expect(userIsAskingDiscoveryQuestion("what is a surge load?")).toBe(true);
    expect(userIsAskingDiscoveryQuestion("essentials only")).toBe(false);
  });
});
