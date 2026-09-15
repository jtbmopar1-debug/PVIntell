import { describe, expect, it } from "vitest";
import { isVisibleInstalledAccessory, removeCoveredInferredLinks } from "./installed-layout";

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
});
