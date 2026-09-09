import { describe, expect, it } from "vitest";
import { selectPeakSunHours } from "@/weather/solar-resource";

describe("Site solar resource selection", () => {
  const monthly = [6, 5.5, 5, 4, 3, 2.5, 2.7, 3.2, 4, 4.8, 5.5, 6.2];

  it("uses a day-weighted annual resource for a grid-connected energy target", () => {
    expect(selectPeakSunHours(monthly, false)).toBeCloseTo(4.36, 2);
  });

  it("uses the weakest month for a standalone supply", () => {
    expect(selectPeakSunHours(monthly, true)).toBe(2.5);
  });

  it("refuses an incomplete climatology", () => {
    expect(selectPeakSunHours(monthly.slice(0, 11), false)).toBeUndefined();
  });
});
