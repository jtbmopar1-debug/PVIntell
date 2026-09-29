import { describe, expect, it } from "vitest";
import { proposalInstallationReadiness } from "./proposal-installation-readiness";

const settings = {
  designCalculator: {
    proposedChecklist: { "proposed-schematic": true },
    proposedAsBuiltDraft: {
      nodes: [
        { id: "solar-pv-1", label: "Roof array", recordRef: "pv:array-1", reviewed: true },
        { id: "inverter", label: "Inverter", recordRef: "component:inverter-1", reviewed: true },
      ],
      connections: [
        { from: "solar-pv-1", to: "inverter", label: "PV input", kind: "solar-dc", configured: true },
      ],
    },
  },
};

describe("proposalInstallationReadiness", () => {
  it("accepts a fully persisted accepted topology", () => {
    expect(proposalInstallationReadiness(settings, {
      componentIds: ["inverter-1"],
      pvArrayIds: ["array-1"],
      connections: [{ sourceRef: "component:inverter-1", targetRef: "pv:array-1", connectionType: "dc" }],
    })).toEqual({ ready: true, blockers: [] });
  });

  it("blocks handover when an accepted proposal connection was never persisted", () => {
    const result = proposalInstallationReadiness(settings, {
      componentIds: ["inverter-1"],
      pvArrayIds: ["array-1"],
      connections: [],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("PV input is missing from the saved system");
  });

  it("blocks unconfigured and disconnected proposal records", () => {
    const result = proposalInstallationReadiness({
      designCalculator: {
        proposedChecklist: { "proposed-schematic": true },
        proposedAsBuiltDraft: {
          nodes: [
            { id: "array", label: "Array", recordRef: "pv:array-1", reviewed: true },
            { id: "inverter", label: "Inverter", recordRef: "component:inverter-1", reviewed: true },
            { id: "battery", label: "Battery", recordRef: "component:battery-1", reviewed: true },
          ],
          connections: [{ from: "array", to: "inverter", label: "PV input", kind: "solar-dc" }],
        },
      },
    }, {
      componentIds: ["inverter-1", "battery-1"],
      pvArrayIds: ["array-1"],
      connections: [],
    });
    expect(result.blockers).toContain("PV input has not been configured");
    expect(result.blockers).toContain("Battery is disconnected");
  });
});
