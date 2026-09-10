import { describe, expect, it } from "vitest";
import { recommendedPanelOrientation } from "./panel-orientation";

describe("proposal mounting recommendation", () => {
  it.each([[-36.85, 0, 36.9], [51.5, 180, 51.5], [0, 180, 0]])(
    "uses the Site latitude %s in either hemisphere, including the equator",
    (latitude, azimuthDegrees, tiltDegrees) => {
      expect(recommendedPanelOrientation({}, latitude)).toEqual({ azimuthDegrees, tiltDegrees });
    },
  );
  it("preserves north-facing and flat recorded angles", () => {
    expect(recommendedPanelOrientation({ azimuthDegrees: 0, tiltDegrees: 0 }, 51)).toEqual({ azimuthDegrees: 0, tiltDegrees: 0 });
    expect(recommendedPanelOrientation({ azimuthDegrees: 270, tiltDegrees: 18 }, -37)).toEqual({ azimuthDegrees: 270, tiltDegrees: 18 });
  });
  it.each([undefined, null, "", NaN, 91])("does not invent a location from %s", (latitude) => {
    expect(recommendedPanelOrientation({}, latitude)).toEqual({ azimuthDegrees: undefined, tiltDegrees: undefined });
  });
});
