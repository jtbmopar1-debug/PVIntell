import { describe, expect, it } from "vitest";
import { visibleDiscoveryQuestions } from "./new-system";
import { nextVisibleQuestionId, previousVisibleQuestionId, proposalIntakeDiscoveryHrefs, routesToInstalledSystemCapture } from "./navigation";

describe("discovery navigation", () => {
  it("moves forward and back by visible question id", () => {
    const questions = visibleDiscoveryQuestions({ existing_system_status: "none", existing_proposal_status: "no" });
    expect(nextVisibleQuestionId(questions, "existing_proposal_status")).toBe("system_name");
    expect(previousVisibleQuestionId(questions, "system_name")).toBe("existing_proposal_status");
  });

  it("keeps Site as the beginning of Discovery", () => {
    const questions = visibleDiscoveryQuestions({});
    expect(questions[0]?.id).toBe("site_name");
    expect(previousVisibleQuestionId(questions, "site_name")).toBeUndefined();
  });

  it("routes every installed-system knowledge level to System Capture", () => {
    expect(routesToInstalledSystemCapture("know_well")).toBe(true);
    expect(routesToInstalledSystemCapture("know_main")).toBe(true);
    expect(routesToInstalledSystemCapture("know_little")).toBe(true);
    expect(routesToInstalledSystemCapture("know_nothing")).toBe(true);
    expect(routesToInstalledSystemCapture(undefined)).toBe(false);
  });

  it("gives the yellow intake distinct one-step and beginning links", () => {
    expect(proposalIntakeDiscoveryHrefs("system-1")).toEqual({
      previousQuestionHref: "/discovery/new-system?edit=system-1&question=existing_proposal_status",
      discoveryBeginningHref: "/discovery/new-system?edit=system-1&question=site_name",
    });
    expect(proposalIntakeDiscoveryHrefs(undefined, "draft-1")).toEqual({
      previousQuestionHref: "/discovery/new-system?draft=draft-1&question=existing_proposal_status",
      discoveryBeginningHref: "/discovery/new-system?draft=draft-1&question=site_name",
    });
  });
});
