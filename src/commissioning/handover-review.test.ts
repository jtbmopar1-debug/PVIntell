import { describe, expect, it } from "vitest";
import { concerningHandoverAnswers, handoverModuleIds, handoverReviewAllowsCompletion, handoverScreeningQuestions, missingHandoverEvidence, parseHandoverReview } from "./handover-review";

describe("handover reviews", () => {
  it("accepts the four screening answers without forcing free-text evidence", () => {
    expect(missingHandoverEvidence({ observations: "", readings: "", documents: "", issues: "", screeningAnswers: { operatedAsExpected: "yes", alarmsOrTrips: "no", physicalWarningSigns: "no", readingsMatch: "yes" } })).toEqual([]);
  });

  it("identifies adverse and uncertain answers without flagging expected answers", () => {
    expect(concerningHandoverAnswers({ operatedAsExpected: "yes", alarmsOrTrips: "no", physicalWarningSigns: "no", readingsMatch: "yes" })).toEqual([]);
    expect(concerningHandoverAnswers({ operatedAsExpected: "no", alarmsOrTrips: "yes", physicalWarningSigns: "not_sure", readingsMatch: "no" })).toEqual([
      "operatedAsExpected",
      "alarmsOrTrips",
      "physicalWarningSigns",
      "readingsMatch",
    ]);
  });

  it("provides four directional, module-specific checks for every handover module", () => {
    for (const moduleId of handoverModuleIds) {
      expect(handoverScreeningQuestions[moduleId]).toHaveLength(4);
      expect(handoverScreeningQuestions[moduleId].map((question) => question.key)).toEqual([
        "operatedAsExpected",
        "alarmsOrTrips",
        "physicalWarningSigns",
        "readingsMatch",
      ]);
      expect(handoverScreeningQuestions[moduleId].every((question) => question.check.length > 40)).toBe(true);
    }
    expect(handoverScreeningQuestions["pv-dc"][0].check).toContain("polarity");
    expect(handoverScreeningQuestions.battery[2].check).toContain("swelling");
  });

  it("requires every quick screening answer", () => {
    expect(missingHandoverEvidence({ observations: "Started normally", readings: "230 V", documents: "", issues: "", screeningAnswers: { operatedAsExpected: "yes" } })).toEqual([
      "screening:alarmsOrTrips",
      "screening:physicalWarningSigns",
      "screening:readingsMatch",
    ]);
  });

  it("parses a fenced Wattson review", () => {
    expect(parseHandoverReview('```json\n{"status":"needs_attention","summary":"Check one value.","findings":[{"severity":"warning","title":"Voltage","guidance":"Confirm the recorded unit."}]}\n```')).toEqual({
      status: "needs_attention",
      summary: "Check one value.",
      findings: [{ severity: "warning", title: "Voltage", guidance: "Confirm the recorded unit." }],
    });
  });

  it("allows ordinary warnings but blocks missing or critical evidence", () => {
    expect(handoverReviewAllowsCompletion("ready")).toBe(true);
    expect(handoverReviewAllowsCompletion("needs_attention")).toBe(true);
    expect(handoverReviewAllowsCompletion("insufficient_information")).toBe(false);
    expect(handoverReviewAllowsCompletion("critical_issue")).toBe(false);
  });
});
