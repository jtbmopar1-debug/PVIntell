import { describe, expect, it } from "vitest";
import type { Project } from "../domain/models";
import { createStructuredProposalDraft, structuredProposalDesignFacts } from "./structured-proposal-draft";

function arronLikeProject(): Project {
  const arrays: Project["pvArrays"] = [
    { id: "garage", name: "Garage 6", panelCount: 6, panelWatts: 460, strings: 1, panelsPerString: 6, manufacturer: "Trina Solar", panelModel: "TSM-460", maximumPowerVoltageV: 45.4, maximumPowerCurrentA: 10.14, openCircuitVoltageV: 53.8, shortCircuitCurrentA: 10.81, cableLengthM: 20, specifications: {}, confidence: "estimated" as const },
    { id: "long", name: "Long Roof 15", panelCount: 15, panelWatts: 475, strings: 1, manufacturer: "Risen", panelModel: "RSM-475", cableLengthM: 20, specifications: {}, confidence: "estimated" as const },
    { id: "short", name: "Short Roof 14", panelCount: 14, panelWatts: 475, strings: 1, panelsPerString: 14, manufacturer: "Risen", panelModel: "RSM-475", cableLengthM: 20, specifications: {}, confidence: "estimated" as const },
    { id: "ground", name: "Ground Mount", panelCount: 18, panelWatts: 625, strings: 1, panelsPerString: 18, manufacturer: "LONGi", panelModel: "LR8", cableLengthM: 150, cableSizeMm2: 10, specifications: {}, confidence: "estimated" as const },
    { id: "placeholder", name: "Proposed solar array", panelWatts: 460, specifications: { "Proposal source": "Wattson design" }, confidence: "estimated" as const },
  ];
  const components: Project["components"] = [
    { id: "inverter", kind: "inverter" as const, name: "Inverter", manufacturer: "Sigen Energy", model: "SigenStor EC 25.0 TP AU", quantity: 1, status: "estimated" as const, specs: { "Inverter type": "hybrid", "Rated power": "16.7 kW", "MPPT count": "4", "MPPT minimum voltage": "160 V", "MPPT maximum voltage": "1000 V", "Maximum PV input current": "16 A", "Battery voltage minimum": "600 V", "Battery voltage maximum": "900 V" } },
    { id: "battery", kind: "battery" as const, name: "Battery storage", manufacturer: "SigenStor", model: "BAT 8.0", quantity: 5, status: "estimated" as const, specs: { "Battery type": "lifepo4", "Nominal energy": "8.06 kWh", "Rated capacity": "10.75 Ah", "Nominal battery voltage": "750 V" }, notes: "5 modules = 40.3 kWh gross / 39.0 kWh usable" },
    { id: "generator", kind: "generator" as const, name: "Generator", manufacturer: "Honda", quantity: 1, status: "estimated" as const, specs: {} },
    { id: "fake-inverter", kind: "inverter" as const, name: "Inverter 1", quantity: 1, status: "estimated" as const, specs: { "Proposal source": "Wattson design", "Rated power": "16.7 kW" } },
  ];
  const connections: Project["connections"] = arrays.slice(0, 4).map((array) => ({ id: `pv-${array.id}`, projectId: "project", sourceRef: `pv:${array.id}`, targetRef: "component:inverter", name: "PV DC", connectionType: "dc" as const, circuitRole: "pv_dc" as const, cableLength: String(array.cableLengthM), cableSize: array.cableSizeMm2 ? String(array.cableSizeMm2) : undefined, confidence: "confirmed" as const }));
  connections.push({ id: "battery-link", projectId: "project", sourceRef: "component:battery", targetRef: "component:inverter", name: "Battery DC", connectionType: "dc", circuitRole: "battery_dc", cableLength: "3", cableSize: undefined, confidence: "confirmed" });
  return {
    id: "project", siteId: "site", schematicOrigin: "structured_proposal_intake", name: "Candidate system", description: "", projectType: "hybrid", phase: "design", location: "Town", goal: "", priorities: [], systemVoltage: 0, autonomyDays: 2, peakSunHours: 0,
    loads: [], assumptions: [], components, connections, schematicPositions: [], overviewCardOrder: [], pvArrays: arrays, installationSteps: [], commissioning: [],
  };
}

describe("structured proposal schematic", () => {
  it("preserves every user-entered item while excluding generated placeholders", () => {
    const project = arronLikeProject();
    const draft = createStructuredProposalDraft(project, {}, true)!;
    const arrayNodes = draft.nodes?.filter((node) => node.id.startsWith("solar-pv-")) ?? [];
    expect(arrayNodes.map((node) => node.label)).toEqual(["Garage 6", "Long Roof 15", "Short Roof 14", "Ground Mount"]);
    expect(draft.nodes).toContainEqual(expect.objectContaining({ id: "inverter", recordRef: "component:inverter" }));
    expect(draft.nodes).toContainEqual(expect.objectContaining({ id: "battery", recordRef: "component:battery" }));
    expect(draft.nodes?.some((node) => node.recordRef === "component:fake-inverter")).toBe(false);
    expect(draft.connections?.filter((connection) => connection.kind === "solar-dc").map((connection) => connection.lengthM)).toEqual([20, 20, 20, 150]);
  });

  it("keeps incomplete equipment visible and marks the missing validation", () => {
    const draft = createStructuredProposalDraft(arronLikeProject(), {}, true)!;
    expect(draft.nodes?.find((node) => node.label === "Long Roof 15")?.detail).toContain("complete string layout still needs confirmation");
    expect(draft.nodes?.find((node) => node.id === "battery")?.detail).toContain("Initial voltage-range check passed");
    expect(draft.connections?.find((connection) => connection.lengthM === 20)?.configured).toBe(false);
  });

  it("derives planning facts without replacing the selected inverter", () => {
    const facts = structuredProposalDesignFacts(arronLikeProject())!;
    expect(facts.panelCount).toBe(53);
    expect(facts.pvArrayPlan?.arrays).toHaveLength(4);
    expect(facts.inverterKw).toBe(16.7);
    expect(facts.inverterPlan).toBeUndefined();
    expect(facts.batteryQuantity).toBe(5);
    expect(facts.batteryUsableKwh).toBe(39);
    expect(facts.generatorIncluded).toBe(true);
  });
});
