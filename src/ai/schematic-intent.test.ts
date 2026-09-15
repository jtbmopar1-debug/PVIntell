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

  it("retains a fully specified commissioned-system topology", () => {
    const plan = requestedSchematicPlan("Build me a schematic, 10 × 590w bifacials in 2 strings of 5, 6 mm² PV cable. (PV1 and PV2) PV3 is 6 × 450w bifacial panels - 4 mm² PV cable. all 3 come down to a fusebox with 3 × 32A MCB, and then to the Deye 10kW Single-Phase 3 MPPT Hybrid Inverter SUN-10K-SG02LP1-AU. the AC from inverter goes on 16 mm² AC cable to a 63A MCB and then to the house switch board. I have 3 × Micromall 48v 210Ah lifepo4 batteries that are run through pos and neg busbars, the busbar battery connections are protected with MRBF fuses each and 1 MRBF for the POS busbar 4awg cable to the inverter. I also have a 8.5kw inverted generator connected through a 63 A Wi-Fi MCB. monitoring is managed by a Junctek KM140F coulometer");
    expect(plan.arrays).toEqual([
      expect.objectContaining({ name: "PV1", panelCount: 5, panelWatts: 590, panelType: "bifacial", cableSizeMm2: 6 }),
      expect.objectContaining({ name: "PV2", panelCount: 5, panelWatts: 590, panelType: "bifacial", cableSizeMm2: 6 }),
      expect.objectContaining({ name: "PV3", panelCount: 6, panelWatts: 450, panelType: "bifacial", cableSizeMm2: 4 }),
    ]);
    expect(plan.components.map((component) => component.key)).toEqual(expect.arrayContaining([
      "inverter", "combiner", "battery-1", "battery-2", "battery-3", "battery-fuse-1", "battery-fuse-2", "battery-fuse-3", "main-battery-fuse", "positive-busbar", "negative-busbar", "inverter-ac-mcb", "house-switchboard", "generator", "generator-mcb", "battery-monitor",
    ]));
    expect(plan.components.find((component) => component.key === "inverter")).toMatchObject({
      displayName: "Deye 10 kW hybrid inverter SUN-10K-SG02LP1-AU",
      specifications: { "Rated power": "10000 W", Phase: "Single-phase", "MPPT count": "3", Model: "SUN-10K-SG02LP1-AU" },
    });
    expect(plan.components.find((component) => component.key === "battery-fuse-1")?.specifications).toMatchObject({
      "Rated current": "100 A provisional",
      "Fuse class / family": "MRBF",
    });
    expect(plan.components.find((component) => component.key === "main-battery-fuse")?.specifications).toMatchObject({
      "Rated current": expect.stringContaining("300 A"),
      "Cable / terminal capacity": expect.stringContaining("4/0 AWG"),
    });
    expect(plan.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: "pv-1", targetKey: "combiner", cableSizeMm2: 6 }),
      expect.objectContaining({ sourceKey: "pv-3", targetKey: "combiner", cableSizeMm2: 4 }),
      expect.objectContaining({ sourceKey: "inverter", targetKey: "inverter-ac-mcb", connectionType: "ac", cableSizeMm2: 16 }),
      expect.objectContaining({ sourceKey: "generator-mcb", targetKey: "inverter", connectionType: "ac" }),
      expect.objectContaining({ sourceKey: "combiner", targetKey: "inverter", name: "PV1 fusebox output", cableSizeMm2: 6 }),
      expect.objectContaining({ sourceKey: "combiner", targetKey: "inverter", name: "PV2 fusebox output", cableSizeMm2: 6 }),
      expect.objectContaining({ sourceKey: "combiner", targetKey: "inverter", name: "PV3 fusebox output", cableSizeMm2: 4 }),
    ]));
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
