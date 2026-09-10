import { describe, expect, it } from "vitest";
import { generatorFromDiscovery } from "./proposal-inputs";

describe("recorded generator inputs", () => {
  it("does not invent a kVA power factor", () => {
    const result = generatorFromDiscovery({ generator_requirement: "include", generator_details: JSON.stringify({ purchaseStatus: "have_details", ratingUnit: "kVA", continuousRating: 10, surgeRating: 12 }) });
    expect(result.continuousKw).toBeUndefined();
    expect(result.surgeKw).toBeUndefined();
    expect(result.warnings).toContainEqual(expect.stringContaining("no fixed kVA-to-kW conversion"));
  });
  it("uses a recorded rated power factor", () => {
    const result = generatorFromDiscovery({ generator_requirement: "include", generator_details: { purchaseStatus: "have_details", ratingUnit: "kVA", continuousRating: 10, powerFactor: .8 } });
    expect(result.continuousKw).toBe(8);
  });
  it.each(["none", "provision", "planned_provision"])("does not size equipment for %s", (requirement) => {
    const result = generatorFromDiscovery({ generator_requirement: requirement, generator_outage_role: "high_power_loads", generator_details: { continuousRating: 20, connectionMethod: "inverter_input" } });
    expect(result).toMatchObject({ included: false, outageRole: "", continuousKw: undefined, connectionMethod: undefined });
  });
});
