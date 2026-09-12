import { describe, expect, it } from "vitest";
import { classifyWattsonRequest } from "./gemini";

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
});
