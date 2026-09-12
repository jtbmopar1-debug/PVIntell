import { describe, expect, it } from "vitest";
import { inverterArrangementAdvice } from "./inverter-arrangement";

describe("inverter arrangement advice", () => {
  it("keeps a New Zealand residential-scale proposal at or below 10 kW", () => {
    expect(inverterArrangementAdvice({ requiredKw: 10, timezone: "Pacific/Auckland", connectionType: "ac_single" }))
      .toMatchObject({ jurisdiction: "nz", unitRatingsKw: [10], preferredPhase: "single" });
  });

  it("does not present 14 kW as one oversized single-phase residential inverter", () => {
    const advice = inverterArrangementAdvice({ requiredKw: 14, siteLocation: "Auckland, New Zealand", connectionType: "ac_single" });
    expect(advice).toMatchObject({ jurisdiction: "nz", unitRatingsKw: [7, 7], preferredPhase: "three" });
    expect(advice?.message).toContain("cap the base option at 10 kW");
    expect(advice?.message).toContain("splitting it across two units does not avoid that threshold");
  });

  it("does not apply New Zealand limits to an unknown market", () => {
    const advice = inverterArrangementAdvice({ requiredKw: 14, siteLocation: "Unknown", connectionType: "ac_single" });
    expect(advice).toMatchObject({ jurisdiction: "local_review", unitRatingsKw: [14], preferredPhase: "single" });
    expect(advice?.message).toContain("country's small-generation threshold");
  });
});
