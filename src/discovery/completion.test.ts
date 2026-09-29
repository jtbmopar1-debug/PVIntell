import { describe, expect, it } from "vitest";
import { discoveryQuestionComplete } from "./completion";
import { visibleDiscoveryQuestions, type DiscoveryAnswers } from "./new-system";

describe("discovery completion", () => {
  const siteQuestion = visibleDiscoveryQuestions({}).find((question) => question.id === "site_name")!;

  it("accepts the coordinates from a selected town without requiring an exact pin", () => {
    const partial: DiscoveryAnswers = { site_name: "Home", system_name: "House solar", site_id: "site-1" };
    expect(discoveryQuestionComplete(siteQuestion, partial, { combinedInitialSetup: true })).toBe(false);
    expect(discoveryQuestionComplete(siteQuestion, { ...partial, site_location: "Otaki, New Zealand", site_latitude: -40.758, site_longitude: 175.15 }, { combinedInitialSetup: true })).toBe(true);
  });

  it("treats unresolved answers as incomplete", () => {
    const utilityQuestion = visibleDiscoveryQuestions({ existing_system_status: "none", existing_proposal_status: "no" }).find((question) => question.id === "utility_relationship")!;
    expect(discoveryQuestionComplete(utilityQuestion, { utility_relationship: "unknown" }, { combinedInitialSetup: true })).toBe(false);
  });
});
