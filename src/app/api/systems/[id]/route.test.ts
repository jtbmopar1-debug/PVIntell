import { describe, expect, it } from "vitest";
import { requiredHandoverModules } from "./route";

describe("requiredHandoverModules", () => {
  it("derives every module represented by the accepted design", () => {
    expect(requiredHandoverModules({
      designCalculator: {
        proposedChecklist: { "proposed-schematic": true },
        proposedAsBuiltDraft: {
          nodes: [
            { id: "solar-pv-1", label: "Roof array", reviewed: true },
            { id: "battery", label: "Battery and BMS", reviewed: true },
            { id: "inverter", label: "Hybrid inverter", reviewed: true },
            { id: "switchboard", label: "Building power board", reviewed: true },
            { id: "generator", label: "Generator", reviewed: true },
            { id: "safety-earth", label: "Safety earth", reviewed: true },
          ],
          connections: [
            { kind: "solar-dc", configured: true },
            { kind: "ac", configured: true },
            { kind: "earth", configured: true },
          ],
        },
      },
    })).toEqual(["pv-array", "pv-dc", "battery", "inverter", "ac", "generator", "earthing"]);
  });

  it("ignores unreviewed nodes and unconfigured connections", () => {
    expect(requiredHandoverModules({
      designCalculator: {
        proposedChecklist: { "proposed-schematic": true },
        proposedAsBuiltDraft: {
          nodes: [{ id: "solar-pv-1", label: "Array", reviewed: false }],
          connections: [{ kind: "solar-dc", configured: false }],
        },
      },
    })).toEqual([]);
  });
});
