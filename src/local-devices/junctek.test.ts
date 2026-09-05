import { describe, expect, it } from "vitest";
import { decodeJunctekFrame, junctekMetrics } from "@/local-devices/junctek";

describe("Junctek local adapter", () => {
  it("decodes packed BCD parameters and ignores the checksum", () => {
    expect(decodeJunctekFrame(Uint8Array.from([0xbb, 0x48, 0x52, 0xc0, 0x01, 0x25, 0xc1, 0x24, 0xee]))).toEqual({ 0xc0: 4852, 0xc1: 125 });
  });
  it("normalizes battery values without inventing absent fields", () => {
    const result = junctekMetrics({ 0xc0: 4852, 0xc1: 125, 0xd1: 1, 0xd8: 6065 });
    expect(result).toMatchObject({ batteryVoltageV: 48.52, batteryCurrentA: 1.25, batteryPowerW: 60.65 });
    expect(result).not.toHaveProperty("batterySocPercent");
  });
  it("calculates SOC only when capacity and remaining Ah are supplied", () => {
    expect(junctekMetrics({ 0xb0: 1000, 0xd2: 50000 })?.batterySocPercent).toBe(50);
  });
});
