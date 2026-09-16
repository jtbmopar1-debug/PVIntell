import { describe, expect, it } from "vitest";
import { classifyWattsonRequest, visibleGeminiMessage, WATTSON_FOLLOWUP_POLICY, WATTSON_REGULATION_POLICY, wattsonAudienceInstruction } from "./gemini";

describe("Gemini visible response parsing", () => {
  it("uses model-output text when the top-level output is blank", () => {
    expect(visibleGeminiMessage({
      output_text: "   ",
      steps: [{ type: "model_output", content: [{ type: "text", text: "The MRBF sizes remain provisional." }] }],
    })).toBe("The MRBF sizes remain provisional.");
  });

  it("trims the top-level visible response", () => {
    expect(visibleGeminiMessage({ output_text: "  Confirm the battery fault current first.  " }))
      .toBe("Confirm the battery fault current first.");
  });
});

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

  it.each([
    "How big should that fuse be?",
    "What type of battery enclosure should I install?",
    "Where is this inverter allowed to be mounted?",
    "What clearance is required around the switchboard?",
  ])("checks current jurisdiction rules for a component selection or installation question: %s", (message) => {
    expect(classifyWattsonRequest(message, "Berlin, Germany")).toEqual({
      regulatory: true,
      technical: true,
      search: true,
      locationKnown: true,
    });
  });

  it("does not silently select regulations when the Site jurisdiction is unconfirmed", () => {
    expect(classifyWattsonRequest("How big should that fuse be?", "Location not set")).toEqual({
      regulatory: false,
      technical: true,
      search: false,
      locationKnown: false,
    });
  });

  it("does not force a regulations search for a generic component definition", () => {
    expect(classifyWattsonRequest("What is a fuse?", "Berlin, Germany")).toEqual({
      regulatory: false,
      technical: true,
      search: false,
      locationKnown: true,
    });
  });

  it("reuses fresh component-library guidance for an ordinary component decision", () => {
    expect(classifyWattsonRequest("How big should that fuse be?", "Berlin, Germany", false, true)).toEqual({
      regulatory: true,
      technical: true,
      search: false,
      locationKnown: true,
    });
  });

  it("still refreshes cached guidance when the user asks for the current position", () => {
    expect(classifyWattsonRequest("What is the current required fuse type?", "Berlin, Germany", false, true).search).toBe(true);
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

describe("Wattson follow-up policy", () => {
  it("ends a complete bounded answer instead of manufacturing engagement", () => {
    expect(WATTSON_FOLLOWUP_POLICY).toContain("do not append a question merely to continue engagement");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("clearly stated assumptions, conditions or a provisional range");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("give that answer and stop");
  });

  it("retains questions that are actually required", () => {
    expect(WATTSON_FOLLOWUP_POLICY).toContain("prevents a reliable answer");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("immediate credible safety concern");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("complete the exact action the user requested");
  });

  it("uses supplied specifications to finish the active technical question", () => {
    expect(WATTSON_FOLLOWUP_POLICY).toContain("apply that evidence to the same question and answer it");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("unless the user explicitly asks to save or update a record");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("Use unidentified specifications as candidate evidence only");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("never associate them with an application record");
  });

  it("permits only a concise offer to expand materially applicable regulations", () => {
    expect(WATTSON_FOLLOWUP_POLICY).toContain("one optional exception");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("complete applicable regulation details");
    expect(WATTSON_FOLLOWUP_POLICY).toContain("never combine that offer with another question");
  });
});

describe("Wattson regulation presentation", () => {
  it("researches the full requirement but keeps the first component answer compact", () => {
    expect(WATTSON_REGULATION_POLICY).toContain("research the complete current requirements");
    expect(WATTSON_REGULATION_POLICY).toContain("keep the visible answer concise");
    expect(WATTSON_REGULATION_POLICY).toContain("Offer to show the complete applicable regulation details");
  });

  it("does not provide a partial rule when details are requested", () => {
    expect(WATTSON_REGULATION_POLICY).toContain("mounting and permitted location");
    expect(WATTSON_REGULATION_POLICY).toContain("clearances and access");
    expect(WATTSON_REGULATION_POLICY).toContain("never quote one attractive limit while omitting another condition");
  });

  it("uses the canonical topic library and a fresh jurisdiction overlay before searching again", () => {
    expect(WATTSON_REGULATION_POLICY).toContain("single canonical list");
    expect(WATTSON_REGULATION_POLICY).toContain("Use that fresh overlay instead of searching again");
    expect(WATTSON_REGULATION_POLICY).toContain("topic checklist is not itself a legal rule");
  });
});
