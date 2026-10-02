import { describe, expect, it } from "vitest";
import { discoveryClarifications } from "./clarifications";

describe("discoveryClarifications", () => {
  it("gently flags different EV timing intentions without blocking them", () => {
    expect(discoveryClarifications({ ev_charging_window: ["overnight"], ev_charging_priority: ["solar_surplus"], battery_requirement: "none" }))
      .toContainEqual(expect.objectContaining({ id: "overnight-solar-without-storage" }));
  });

  it("flags a potentially different surface-pitch description", () => {
    expect(discoveryClarifications({ orientation_and_pitch: '[{"slope":"flat"}]', structure_condition: "Roof: metal, 5_15, good" }))
      .toContainEqual(expect.objectContaining({ id: "surface-pitch-description" }));
  });

  it("does not treat ordinary answers as problems", () => {
    expect(discoveryClarifications({ ev_charging_window: ["daytime"], ev_charging_priority: ["solar_surplus"], battery_requirement: "none" })).toEqual([]);
  });
});
