import { describe, expect, it } from "vitest";
import { suggestPvDcStringCable } from "./pv-dc-cable-sizing";

describe("PV DC string cable sizing", () => {
  it("refuses to treat an unknown string layout as one panel", () => {
    const result = suggestPvDcStringCable({ panelVmpV: 33, panelImpA: 13.64, panelIscA: 14.4, lengthM: 15 });

    expect(result.cableSizeMm2).toBeUndefined();
    expect(result.protectionAmps).toBeUndefined();
    expect(result.warning).toContain("Complete the PV string layout");
  });

  it("uses series-string Vmp and operating current for voltage drop", () => {
    const result = suggestPvDcStringCable({ panelsPerString: 10, panelVmpV: 33, panelImpA: 13.64, panelIscA: 14.4, lengthM: 15 });

    expect(result).toMatchObject({
      cableSizeMm2: 4,
      operatingVoltageV: 330,
      operatingCurrentA: 13.64,
      designCurrentA: 18,
      protectionAmps: undefined,
    });
    expect(result.voltageDropPercent).toBeCloseTo(.54, 2);
  });

  it("does not invent a PV fuse or breaker by applying 125 percent twice", () => {
    const result = suggestPvDcStringCable({ panelsPerString: 10, panelVmpV: 33, panelImpA: 13.64, panelIscA: 14.4, lengthM: 15 });

    expect(result.protectionAmps).toBeUndefined();
    expect(result.notes).toContain("not selected automatically");
  });
});
