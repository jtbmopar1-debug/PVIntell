import { describe, expect, it } from "vitest";
import { inverterArrangementAdvice } from "./inverter-arrangement";

describe("inverter arrangement advice", () => {
  it("keeps a New Zealand residential-scale proposal at or below 10 kW", () => {
    expect(inverterArrangementAdvice({ requiredKw: 10, timezone: "Pacific/Auckland", connectionType: "ac_single" }))
      .toMatchObject({ jurisdiction: "nz", selectionStatus: "candidate_selected", unitRatingsKw: [10], preferredPhase: "single" });
  });

  it("does not present 14 kW as one oversized single-phase residential inverter", () => {
    const advice = inverterArrangementAdvice({ requiredKw: 14, siteLocation: "Auckland, New Zealand", connectionType: "ac_single" });
    expect(advice).toMatchObject({ jurisdiction: "nz", unitRatingsKw: [8, 8], preferredPhase: "three" });
    expect(advice?.message).toContain("cap the base option at 10 kW");
    expect(advice?.message).toContain("splitting it across two units does not avoid that threshold");
  });

  it("selects two standard 8 kW units for a 15 kW requirement", () => {
    expect(inverterArrangementAdvice({ requiredKw: 15, timezone: "Pacific/Auckland", connectionType: "ac_single" }))
      .toMatchObject({ jurisdiction: "nz", unitRatingsKw: [8, 8], preferredPhase: "three" });
  });

  it("selects three capped 10 kW units for a 25 kW requirement", () => {
    expect(inverterArrangementAdvice({ requiredKw: 25, siteLocation: "Unknown", connectionType: "ac_three" }))
      .toMatchObject({ jurisdiction: "local_review", unitRatingsKw: [25], preferredPhase: "three" });
  });

  it("does not apply New Zealand limits to an unknown market", () => {
    const advice = inverterArrangementAdvice({ requiredKw: 14, siteLocation: "Unknown", connectionType: "ac_single" });
    expect(advice).toMatchObject({ jurisdiction: "local_review", selectionStatus: "candidate_selected_pending_local_approval", unitRatingsKw: [14], preferredPhase: "three" });
    expect(advice?.message).toContain("Site's country");
  });

  it("allows a larger provisional inverter outside a verified jurisdiction profile", () => {
    const advice = inverterArrangementAdvice({ requiredKw: 30, siteLocation: "Berlin, Germany", connectionType: "ac_three" });
    expect(advice).toMatchObject({ unitRatingsKw: [30], selectionStatus: "candidate_selected_pending_local_approval" });
    expect(advice?.message).toContain("one suitable larger inverter");
  });

  it("does not apply New Zealand grid thresholds to an off-grid system", () => {
    const advice = inverterArrangementAdvice({ requiredKw: 30, siteLocation: "Auckland, New Zealand", projectType: "off-grid", connectionType: "ac_single" });
    expect(advice).toMatchObject({ jurisdiction: "nz", unitRatingsKw: [30], preferredPhase: "single" });
    expect(advice?.message).toContain("Public-grid generation and export thresholds do not apply");
  });
});
