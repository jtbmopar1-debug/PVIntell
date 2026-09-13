import { describe, expect, it } from "vitest";
import { conceptualPvArrays, explicitInverterMention, explicitPanelWattage, inverterClassFromEvidence, nextNumberedName, requestsSchematicCreation } from "./schematic-intent";

describe("requestsSchematicCreation", () => {
  it.each([
    "Can you build a schematic please?",
    "Draw the wiring diagram",
    "Give me a link to the schematic",
    "I need a schematic pls - 8x630w panels in a 4P2S",
  ])("recognises an explicit creation request: %s", (message) => {
    expect(requestsSchematicCreation(message)).toBe(true);
  });

  it("recognises a direct correction without requiring another question", () => {
    expect(requestsSchematicCreation("You haven't built one!", "Here is the schematic you requested.")).toBe(true);
  });

  it("does not turn an informational mention into a write", () => {
    expect(requestsSchematicCreation("What is a schematic?")).toBe(false);
  });
});

describe("conceptual schematic extraction", () => {
  it("turns 4S2P into two separately drawn four-panel strings", () => {
    expect(conceptualPvArrays("8 solar panels arranged 4S2P")).toEqual({ arrayCount: 2, panelsPerArray: 4, totalPanels: 8 });
  });

  it("understands compact panel counts and parallel-first notation", () => {
    expect(conceptualPvArrays("8x630w panels in a 4P2S arrangement")).toEqual({ arrayCount: 4, panelsPerArray: 2, totalPanels: 8 });
    expect(explicitPanelWattage("8x630w panels in a 4P2S arrangement")).toBe(630);
  });

  it("prefers the inverter explicitly identified by the user", () => {
    expect(explicitInverterMention("The inverter is a MrPow 5400w")).toEqual({ manufacturer: "MrPow", ratedPowerW: 5400 });
  });

  it.each([["48 V hybrid inverter", "hybrid inverter"], ["two microinverters", "microinverter"], ["a string inverter", "string inverter"]])("classifies inverter architecture from supplied evidence", (evidence, expected) => {
    expect(inverterClassFromEvidence(evidence)).toBe(expected);
  });
});

describe("nextNumberedName", () => {
  it("selects the first unused editable default", () => {
    expect(nextNumberedName("Site", ["Site1", "Farm", "site2"])).toBe("Site3");
    expect(nextNumberedName("System", ["Main", "System1"])).toBe("System2");
  });
});
