import { describe, expect, it } from "vitest";
import { legacyPanelWatts, reconfiguredProposedDesign, requestedPvTopology } from "./pv-topology-editor";

describe("PV topology edit request", () => {
  it.each(["Change to 2 arrays of 5 please", "Charge to 2 arrays of 5 please", "reconfigure the arrays into 4 arrays of 3 panels"])("parses %s", (message) => {
    expect(requestedPvTopology(message)).toEqual(message.includes("4 arrays") ? { arrayCount: 4, panelsPerArray: 3 } : { arrayCount: 2, panelsPerArray: 5 });
  });
  it("does not infer an incomplete topology", () => expect(requestedPvTopology("split the panels differently")).toBeNull());
});

describe("proposed schematic topology", () => {
  it("rebuilds its PV branch without removing the rest of the proposal", () => {
    const result = reconfiguredProposedDesign({ designCalculator: {
      panelWatts: 580,
      pvArrayPlan: { arrays: [{ id: "old", allocatedPanelCount: 10 }] },
      existingPanelGroup: { name: "Existing panels", availableCount: 10, proposedUseCount: 5, supplementaryCount: 5, supplementaryTargetPvKw: 2.9 },
      proposedAsBuiltDraft: {
        nodes: [{ id: "solar", label: "Solar", detail: "old" }, { id: "inverter", label: "Inverter", detail: "keep" }],
        connections: [{ from: "solar", to: "inverter", label: "old", kind: "solar-dc" }],
      },
    } }, { arrayCount: 2, panelsPerArray: 5 }) as { designCalculator: Record<string, unknown> };
    const calculator = result.designCalculator;
    const draft = calculator.proposedAsBuiltDraft as {
      nodes: Array<{ id: string }>;
      connections: Array<{ from: string; to: string }>;
    };
    expect(calculator).toMatchObject({ panelCount: 10, pvStrings: 2, panelsPerString: 5, targetPvKw: 5.8 });
    expect(calculator).not.toHaveProperty("pvArrayPlan");
    expect(calculator.existingPanelGroup).toMatchObject({ proposedUseCount: 10 });
    expect(calculator.existingPanelGroup).not.toHaveProperty("supplementaryTargetPvKw");
    expect(draft.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(["inverter", "solar-pv-1", "solar-pv-2", "solar-safety-1", "solar-safety-2", "pv-combiner"]));
    expect(draft.connections).toContainEqual(expect.objectContaining({ from: "pv-combiner", to: "inverter" }));
  });

  it("inherits module wattage from the original schematic card", () => {
    const result = reconfiguredProposedDesign({ designCalculator: {
      proposedAsBuiltDraft: {
        nodes: [{ id: "solar", label: "10 panel array", detail: "10 × 455 W mono modules" }, { id: "inverter", label: "Inverter", detail: "keep" }],
        connections: [{ from: "solar", to: "inverter", label: "old", kind: "solar-dc" }],
      },
    } }, { arrayCount: 2, panelsPerArray: 5 }) as { designCalculator: Record<string, unknown> };
    expect(result.designCalculator).toMatchObject({ panelWatts: 455, panelCount: 10, targetPvKw: 4.55 });
    const draft = result.designCalculator.proposedAsBuiltDraft as { nodes: Array<{ id: string; detail: string }> };
    expect(draft.nodes.find((node) => node.id === "solar-pv-1")?.detail).toContain("5 × 455 W");
    expect(draft.nodes.find((node) => node.id === "solar-pv-2")?.detail).toContain("5 × 455 W");
  });

  it("recovers module wattage from recorded array capacity", () => {
    const result = reconfiguredProposedDesign({ designCalculator: {
      panelCount: 10,
      targetPvKw: 5.8,
      proposedAsBuiltDraft: {
        nodes: [{ id: "solar", label: "Solar panels", detail: "10 panels" }, { id: "inverter", label: "Inverter", detail: "keep" }],
        connections: [{ from: "solar", to: "inverter", label: "old", kind: "solar-dc" }],
      },
    } }, { arrayCount: 2, panelsPerArray: 5 }) as { designCalculator: Record<string, unknown> };
    expect(result.designCalculator).toMatchObject({ panelWatts: 580, targetPvKw: 5.8 });
  });
});

describe("legacy PV component conversion", () => {
  it("uses an explicit panel wattage field", () => {
    expect(legacyPanelWatts({ specifications: { "Panel wattage": "450 W" } })).toBe(450);
  });

  it("can recover the rating from a legacy component name", () => {
    expect(legacyPanelWatts({ display_name: "10 x 580 W bifacial panels" })).toBe(580);
  });

  it("does not invent a rating when none was recorded", () => {
    expect(legacyPanelWatts({ display_name: "Main roof panels" })).toBeUndefined();
  });
});
