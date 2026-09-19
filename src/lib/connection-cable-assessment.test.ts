import { describe, expect, it } from "vitest";
import { assessCableAgainstEndpoints, cableAreaMm2 } from "./connection-cable-assessment";

describe("connection cable compatibility", () => {
  it("distinguishes 0 AWG from 4/0 AWG", () => {
    expect(cableAreaMm2("0 AWG")).toBe(53.5);
    expect(cableAreaMm2("0G battery cable")).toBe(53.5);
    expect(cableAreaMm2("0 gauge tinned copper cable")).toBe(53.5);
    expect(cableAreaMm2("4/0 AWG")).toBe(107.2);
    expect(cableAreaMm2("4/0 AWG flexible battery cable")).toBe(107.2);
  });

  it("accepts common metric conductor-area shorthand", () => {
    expect(cableAreaMm2("4mm")).toBe(4);
    expect(cableAreaMm2("4 mm")).toBe(4);
    expect(cableAreaMm2("4 mm2 PV cable")).toBe(4);
    expect(cableAreaMm2("4 mm² PV cable")).toBe(4);
  });

  it("flags a recorded cable below an endpoint requirement", () => {
    expect(assessCableAgainstEndpoints("0 AWG", [{ display_name: "10 kW inverter", specifications: { "Minimum battery cable": "95 mm²" } }])).toContain("below the 95 mm² minimum");
  });

  it("uses the exact-model requirement for older inverter records", () => {
    expect(assessCableAgainstEndpoints("0G battery cable", [{ display_name: "Deye hybrid inverter SUN-10K-SG02LP1-AU", specifications: {} }])).toContain("below the 95 mm² minimum");
  });

  it("does not apply a battery-port cable minimum to a PV input circuit", () => {
    expect(assessCableAgainstEndpoints(
      "6 mm2 PV cable",
      [{ display_name: "Deye hybrid inverter SUN-10K-SG02LP1-AU", specifications: {} }],
      "pv_dc",
    )).toBeUndefined();
  });
});
