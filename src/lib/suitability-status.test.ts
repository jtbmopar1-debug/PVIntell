import { describe, expect, it } from "vitest";
import { hasUnresolvedSuitabilityIssue } from "./suitability-status";

describe("persisted suitability status", () => {
  it("recognises unsafe, incompatible and insufficient records", () => {
    expect(hasUnresolvedSuitabilityIssue("Cable compatibility warning: below minimum")).toBe(true);
    expect(hasUnresolvedSuitabilityIssue("This inverter is not large enough")).toBe(true);
    expect(hasUnresolvedSuitabilityIssue({ status: "unsafe — do not use" })).toBe(true);
  });

  it("does not turn a recorded pass into a failure", () => {
    expect(hasUnresolvedSuitabilityIssue("Compatibility checks passed")).toBe(false);
    expect(hasUnresolvedSuitabilityIssue("Compatibility warnings acknowledged")).toBe(false);
    expect(hasUnresolvedSuitabilityIssue("Compatibility review pending; exact model unverified")).toBe(false);
    expect(hasUnresolvedSuitabilityIssue("Confirmed from the selected equipment manual")).toBe(false);
  });
});
