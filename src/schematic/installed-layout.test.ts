import { describe, expect, it } from "vitest";
import type { ComponentSpec, SystemConnection } from "@/domain/models";
import { collapseLegacyGeneratorRoute, isVisibleInstalledAccessory, removeCoveredInferredLinks } from "./installed-layout";

describe("installed schematic layout", () => {
  it("shows positive and negative busbars even though they are connector records", () => {
    expect(isVisibleInstalledAccessory({ kind: "connector", name: "Positive busbar", specs: {} })).toBe(true);
    expect(isVisibleInstalledAccessory({ kind: "connector", name: "Negative bus bar", specs: {} })).toBe(true);
  });

  it("keeps loose cable records off the equipment canvas", () => {
    expect(isVisibleInstalledAccessory({ kind: "cable", name: "Battery cable", specs: {} })).toBe(false);
  });

  it("removes inferred shortcuts when an explicit route starts from that equipment", () => {
    const inferred = [
      { id: "old-pv-shortcut", sourceId: "pv:1", targetId: "component:inverter" },
      { id: "old-battery-shortcut", sourceId: "component:battery", targetId: "component:inverter" },
      { id: "unrelated", sourceId: "component:generator", targetId: "component:inverter" },
    ];
    const explicit = [
      { sourceId: "pv:1", targetId: "component:isolator" },
      { sourceId: "component:battery", targetId: "component:fuse" },
    ];

    expect(removeCoveredInferredLinks(inferred, explicit).map((connection) => connection.id)).toEqual(["unrelated"]);
  });

  it("collapses the legacy generator placeholder into one provisional route", () => {
    const component = (id: string, kind: ComponentSpec["kind"], name: string, specs: ComponentSpec["specs"] = {}): ComponentSpec => ({ id, kind, name, quantity: 1, status: "estimated", specs });
    const connection = (id: string, sourceRef: string, targetRef: string): SystemConnection => ({ id, projectId: "project", sourceRef, targetRef, name: id, connectionType: "ac", confidence: "estimated" });
    const normalized = collapseLegacyGeneratorRoute([
      component("generator", "generator", "Generator"),
      component("route", "generator", "Generator connection route to confirm", { "Proposal source": "Wattson design", "Proposal node id": "generator-changeover" }),
      component("inverter", "inverter", "Hybrid inverter"),
    ], [
      connection("generator-supply", "component:generator", "component:route"),
      connection("protected-input", "component:route", "component:inverter"),
    ]);

    expect(normalized.components.map((item) => item.id)).toEqual(["generator", "inverter"]);
    expect(normalized.connections).toEqual([expect.objectContaining({
      sourceRef: "component:generator",
      targetRef: "component:inverter",
      name: "Generator connection method to confirm",
      notes: expect.stringContaining("[provisional-generator-interface]"),
    })]);
  });
});
