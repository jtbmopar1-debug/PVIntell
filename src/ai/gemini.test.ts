import { describe, expect, it } from "vitest";
import { classifyWattsonRequest, wattsonAudienceInstruction } from "./gemini";

describe("classifyWattsonRequest", () => {
  it("keeps ordinary discovery on the economical model without search", () => {
    expect(classifyWattsonRequest("I want to run a fridge and some lights", "Whangārei, New Zealand")).toEqual({
      regulatory: false,
      technical: false,
      search: false,
      locationKnown: true,
    });
  });

  it("routes local compliance questions to the technical model and search", () => {
    expect(classifyWattsonRequest("What electrical regulations and inspection are required?", "Whangārei, New Zealand")).toEqual({
      regulatory: true,
      technical: true,
      search: true,
      locationKnown: true,
    });
  });

  it.each([
    "Are two 15 kVA inverters legal?",
    "Is this inverter arrangement allowed?",
    "Would this installation be compliant?",
    "Is this system approved for grid connection?",
  ])("routes plain-language legality questions through site-specific research: %s", (message) => {
    expect(classifyWattsonRequest(message, "Berlin, Germany")).toEqual({
      regulatory: true,
      technical: true,
      search: true,
      locationKnown: true,
    });
  });

  it("does not apply one country's rules when a legality question has no usable location", () => {
    expect(classifyWattsonRequest("Are two 15 kVA inverters legal?", "Location not set")).toEqual({
      regulatory: true,
      technical: true,
      search: false,
      locationKnown: false,
    });
  });

  it("does not search for local rules until the location is known", () => {
    expect(classifyWattsonRequest("What electrical regulations apply here?", "Location not set")).toEqual({
      regulatory: true,
      technical: true,
      search: false,
      locationKnown: false,
    });
  });

  it("researches technical questions when the component has a saved manufacturer source", () => {
    expect(classifyWattsonRequest("What does fault code E04 mean?", "Location not set", true)).toEqual({
      regulatory: false,
      technical: true,
      search: true,
      locationKnown: false,
    });
  });

  it("does not browse for an ordinary question merely because a component has a manual", () => {
    expect(classifyWattsonRequest("What did I call this component?", "Location not set", true)).toEqual({
      regulatory: false,
      technical: false,
      search: false,
      locationKnown: false,
    });
  });
});

describe("Wattson audience level", () => {
  it("uses a layperson style when onboarding says the user is new", () => {
    expect(wattsonAudienceInstruction({ userAssessment: { experience: "new", electricalConfidence: "learn" } }))
      .toContain("LAYPERSON");
  });

  it("uses technical language for a professional", () => {
    expect(wattsonAudienceInstruction({ userAssessment: { experience: "professional", electricalConfidence: "qualified" } }))
      .toContain("PROFESSIONAL");
  });
});
