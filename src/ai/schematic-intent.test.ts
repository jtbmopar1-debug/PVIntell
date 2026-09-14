import { describe, expect, it } from "vitest";
import { conceptualPvArrays, explicitInverterMention, explicitPanelWattage, inverterClassFromEvidence, nextNumberedName, requestedSchematicComponents, requestedSchematicPlan, requestsSchematicCreation } from "./schematic-intent";

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
    expect(conceptualPvArrays("8x630w panels in a 4P2S arrangement")).toEqual({ arrayCount: 2, panelsPerArray: 4, totalPanels: 8 });
    expect(explicitPanelWattage("8x630w panels in a 4P2S arrangement")).toBe(630);
  });

  it("builds the exact requested acceptance-test schematic plan", () => {
    const plan = requestedSchematicPlan("i need a schematic pls - 8x630w panels in a 4p2s (dont worry about ratings) connected to a combiner box and isolators, then to the 8kw hybrid inverter, and a fused 100ah 48v lifeop4 battery via busbar.");
    expect(plan.pv).toEqual({ arrayCount: 2, panelsPerArray: 4, totalPanels: 8, panelWatts: 630 });
    expect(plan.components.map((component) => [component.key, component.displayName])).toEqual([
      ["inverter", "8 kW hybrid inverter"],
      ["battery", "48 V 100 Ah LiFePO4 battery"],
      ["combiner", "PV combiner box"],
      ["isolator-1", "PV DC isolator 1"],
      ["isolator-2", "PV DC isolator 2"],
      ["battery-fuse", "Battery fuse"],
      ["positive-busbar", "Positive busbar"],
      ["negative-busbar", "Negative busbar"],
    ]);
    expect(plan.components.find((component) => component.key === "inverter")?.specifications).toMatchObject({ "Equipment class": "hybrid inverter", "Rated power": "8000 W" });
    expect(plan.components.find((component) => component.key === "battery")?.specifications).toEqual({ Chemistry: "LiFePO4", "Nominal voltage": "48 V", Capacity: "100 Ah" });
    expect(plan.connections).toEqual(expect.arrayContaining([
      { sourceKey: "pv-1", targetKey: "isolator-1", name: "PV1 DC", polarity: "pair" },
      { sourceKey: "pv-2", targetKey: "isolator-2", name: "PV2 DC", polarity: "pair" },
      { sourceKey: "isolator-1", targetKey: "combiner", name: "PV1 isolated DC", polarity: "pair" },
      { sourceKey: "isolator-2", targetKey: "combiner", name: "PV2 isolated DC", polarity: "pair" },
      { sourceKey: "combiner", targetKey: "inverter", name: "Combined PV DC", polarity: "pair" },
      { sourceKey: "battery", targetKey: "battery-fuse", name: "Battery positive", polarity: "positive" },
      { sourceKey: "battery-fuse", targetKey: "positive-busbar", name: "Fused battery positive", polarity: "positive" },
      { sourceKey: "battery", targetKey: "negative-busbar", name: "Battery negative", polarity: "negative" },
      { sourceKey: "positive-busbar", targetKey: "inverter", name: "Positive busbar to inverter", polarity: "positive" },
      { sourceKey: "negative-busbar", targetKey: "inverter", name: "Negative busbar to inverter", polarity: "negative" },
    ]));
  });

  it("creates the requested matrix and component quantities for the shortcut", () => {
    expect(conceptualPvArrays("build a schematic with an inverter, 3 batteryes and 6x4 panels arrays")).toEqual({ arrayCount: 6, panelsPerArray: 4, totalPanels: 24 });
    expect(requestedSchematicComponents("build a schematic with an inverter, 3 batteryes and 6x4 panels arrays")).toEqual([
      { type: "inverter", displayName: "Inverter", quantity: 1 },
      { type: "battery", displayName: "Battery", quantity: 3 },
    ]);
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
