import { describe, expect, it } from "vitest";
import { dashboardSolarArraysBySystem } from "./dashboard-forecast";

describe("dashboardSolarArraysBySystem", () => {
  it("keeps arrays from systems at the same Site separate", () => {
    const arrays = dashboardSolarArraysBySystem(["default-system", "other-system"], [
      { project_id: "default-system", panel_watts: 400, panel_count: 10, orientation_degrees: 0, tilt_degrees: 25 },
      { project_id: "other-system", panel_watts: 500, panel_count: 20, orientation_degrees: 180, tilt_degrees: 15 },
    ]);

    expect(arrays["default-system"]).toEqual([{ capacityKw: 4, azimuthDegrees: 0, tiltDegrees: 25 }]);
    expect(arrays["other-system"]).toEqual([{ capacityKw: 10, azimuthDegrees: 180, tiltDegrees: 15 }]);
  });

  it("excludes invalid or empty array capacities", () => {
    const arrays = dashboardSolarArraysBySystem(["default-system"], [
      { project_id: "default-system", panel_watts: null, panel_count: 8, orientation_degrees: null, tilt_degrees: null },
      { project_id: "default-system", panel_watts: 450, panel_count: 0, orientation_degrees: null, tilt_degrees: null },
    ]);

    expect(arrays["default-system"]).toEqual([]);
  });
});
