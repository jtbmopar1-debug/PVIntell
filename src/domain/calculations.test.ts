import { describe, expect, it } from "vitest";
import { calculateLoads, sizeBattery, sizeInverter, sizeSolar } from "./calculations";
import type { Load } from "./models";

const loads: Load[] = [
  { id:"fridge", name:"Fridge", watts:100, quantity:1, hoursPerDay:10, surgeWatts:600, currentType:"AC", confidence:"confirmed", simultaneous:true },
  { id:"pump", name:"Pump", watts:1000, quantity:1, hoursPerDay:2, surgeWatts:3000, currentType:"AC", confidence:"confirmed", simultaneous:true },
  { id:"kettle", name:"Kettle", watts:2000, quantity:1, hoursPerDay:.25, surgeWatts:2000, currentType:"AC", confidence:"confirmed", simultaneous:false },
];

describe("load calculator",()=>{it("calculates energy, simultaneous load and largest surge",()=>{expect(calculateLoads(loads)).toEqual({dailyWh:3500,dailyKWh:3.5,connectedWatts:3100,simultaneousWatts:1100,surgeWatts:3100})})});
describe("solar sizing",()=>{it("rounds up to whole panels",()=>{const result=sizeSolar({dailyWh:5000,peakSunHours:5,systemEfficiency:.8,designMargin:1,panelWatts:450});expect(result.panelCount).toBe(3);expect(result.suggestedWatts).toBe(1350);expect(result.expectedDailyWh).toBe(5400)})});
describe("battery sizing",()=>{it("accounts for autonomy, DoD and efficiency",()=>{const result=sizeBattery({dailyWh:5000,autonomyDays:2,systemVoltage:48,depthOfDischarge:.8,efficiency:1,designMargin:1});expect(result.usableKWh).toBe(10);expect(result.nominalKWh).toBe(12.5);expect(result.ampHours).toBe(261)})});
describe("inverter sizing",()=>{it("adds continuous headroom and preserves surge requirement",()=>{const result=sizeInverter(calculateLoads(loads));expect(result.recommendedWatts).toBe(3000);expect(result.minimumSurgeWatts).toBe(3500)})});
