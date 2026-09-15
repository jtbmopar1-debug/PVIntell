import { describe, expect, it } from "vitest";
import type { ComponentSpec, SystemConnection } from "@/domain/models";
import {
  COMPONENT_REGULATORY_LIBRARY,
  compactRegulatoryTopicsForComponents,
  regulatoryJurisdictionKey,
  resolveComponentRegulatoryBundle,
} from "./component-regulatory-library";

const component = (overrides: Partial<ComponentSpec> = {}): ComponentSpec => ({
  id: "component-1",
  kind: "protection",
  name: "Battery fuse",
  quantity: 1,
  status: "confirmed",
  specs: {},
  ...overrides,
});

describe("component regulatory library", () => {
  it("defines canonical topics for every supported equipment kind", () => {
    const kinds: ComponentSpec["kind"][] = ["panel", "pv_string", "battery", "inverter", "charger", "generator", "protection", "isolator", "cable", "connector", "combiner", "meter", "monitoring", "load", "other"];
    for (const kind of kinds) {
      expect(COMPONENT_REGULATORY_LIBRARY[kind].topics.length).toBeGreaterThan(3);
      expect(COMPONENT_REGULATORY_LIBRARY[kind].manufacturerRequirements.length).toBeGreaterThan(1);
    }
  });

  it("does not select a jurisdiction from an unconfirmed location", () => {
    const bundle = resolveComponentRegulatoryBundle({
      component: component(),
      siteLocation: "Auckland, New Zealand",
      siteLocationConfirmed: false,
    });
    expect(bundle.jurisdiction).toEqual({ confirmed: false });
    expect(bundle.contextNote).toContain("will not select a country's rules");
  });

  it("reports missing component facts and related connected equipment", () => {
    const battery = component({ id: "battery-1", kind: "battery", name: "48 V battery" });
    const fuse = component({ location: "Battery cabinet", specs: { "Rated current": "250 A" } });
    const connections: SystemConnection[] = [{
      id: "connection-1",
      projectId: "system-1",
      sourceRef: battery.id,
      targetRef: fuse.id,
      name: "Battery positive",
      connectionType: "dc",
      polarity: "positive",
      confidence: "confirmed",
    }];
    const bundle = resolveComponentRegulatoryBundle({
      component: fuse,
      siteLocation: "Berlin, Germany",
      siteLocationConfirmed: true,
      relatedComponents: [battery, fuse],
      connections,
    });
    expect(bundle.jurisdiction).toEqual({ confirmed: true, label: "Berlin, Germany" });
    expect(bundle.appliesHere.flatMap((item) => item.relatedEquipment)).toContain("48 V battery");
    expect(bundle.appliesHere.find((item) => item.id === "protection-device-class")?.missingFacts).toContain("rated operational voltage");
  });

  it("deduplicates the prompt catalog by equipment kind", () => {
    const compact = compactRegulatoryTopicsForComponents([
      component(),
      component({ id: "component-2", name: "PV fuse" }),
      component({ id: "component-3", kind: "inverter", name: "Inverter" }),
    ]);
    expect(compact.map((item) => item.componentKind)).toEqual(["protection", "inverter"]);
  });

  it("normalizes a Site location into a stable private cache key", () => {
    expect(regulatoryJurisdictionKey("  Berlin,   GERMANY ")).toBe("berlin germany");
  });
});
