import { describe, expect, it } from "vitest";
import { decodeJunctekFrame, junctekMetrics, parseJunctekKmLive, parseJunctekR50, parseJunctekR51Capacity } from "@/local-devices/junctek";

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
  it("decodes KM-F R50 measured values", () => {
    expect(parseJunctekR50(":r50=1,123,4852,125,7421,2749,437,298,113,0,0,1,69,100,230208,112418,"))
      .toMatchObject({ batteryVoltageV: 48.52, batteryCurrentA: 1.25, batteryPowerW: 60.65 });
  });
  it("combines R51 configured capacity with R50 remaining capacity for SOC", () => {
    const settings = ":r51=1,69,2000,1000,2000,3000,20000,120,1000,120,90,101,0,0,1,100,0,10000,1000,20,20,80,0,4321,2,";
    const capacityAh = parseJunctekR51Capacity(settings);
    expect(capacityAh).toBe(100);
    expect(parseJunctekR50(":r50=1,123,4852,125,74210,2749,437,298,113,0,0,0,69,100,230208,112418,", capacityAh))
      .toMatchObject({ batteryCurrentA: -1.25, batterySocPercent: 74.2 });
  });
  it("decodes the KM-F live Bluetooth record", () => {
    expect(parseJunctekKmLive(":A=5549,1520,0,20308,617375,6300,30,150500,6667,\r\n"))
      .toMatchObject({ batteryVoltageV: 55.49, batteryCurrentA: -1.52, batteryPowerW: -84.34, batterySocPercent: 98 });
  });
  it("uses a positive current and power for KM-F charge records", () => {
    expect(parseJunctekKmLive(":A=5470,4880,1,20308,617375,6300,30,150500,6667,\r\n"))
      .toMatchObject({ batteryCurrentA: 4.88, batteryPowerW: 266.94 });
  });
});
