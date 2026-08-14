import { describe, expect, it } from "vitest";
import { parseEquipmentLabelResponse } from "./equipment-label";

describe("equipment label parsing", () => {
  it("accepts a structured nameplate result", () => {
    const result = parseEquipmentLabelResponse({ output_text: JSON.stringify({
      equipmentType: "inverter", manufacturer: "Example Solar", model: "INV-5K", serialNumber: "ABC123",
      ratedVoltage: "230 V", ratedCurrent: "21.7 A", ratedPower: "5 kW", capacity: "", phase: "Single phase",
      frequency: "50 Hz", ingressRating: "IP65", certifications: ["AS/NZS 4777.2"],
      otherSpecifications: [{ label: "MPPT range", value: "120–450 V DC" }], confidence: "high",
      unreadableFields: [], warnings: [],
    }) });
    expect(result.model).toBe("INV-5K");
    expect(result.otherSpecifications[0].value).toBe("120–450 V DC");
  });

  it("rejects prose instead of structured output", () => {
    expect(() => parseEquipmentLabelResponse({ output_text: "Probably a 5 kW inverter" })).toThrow(/unreadable label result/i);
  });

  it("keeps explicit PV panel nameplate values", () => {
    const result = parseEquipmentLabelResponse({ output_text: JSON.stringify({
      equipmentType: "panel", manufacturer: "Ulica Solar", model: "UL-580", serialNumber: "", ratedVoltage: "", ratedCurrent: "", ratedPower: "580 W", capacity: "",
      panelType: "bifacial", maximumPowerVoltage: "29.61 V", maximumPowerCurrent: "15.20 A", openCircuitVoltage: "35.14 V", shortCircuitCurrent: "16.10 A", maximumSystemVoltage: "DC 1500 V", nominalOperatingCellTemperature: "43Â±2Â°C", maximumSeriesFuseRating: "30 A", powerTolerance: "0~+5 W", moduleEfficiency: "22.4%", temperatureCoefficientPmax: "", temperatureCoefficientVoc: "", temperatureCoefficientIsc: "", dimensions: "", weight: "",
      phase: "", frequency: "", ingressRating: "", certifications: [], otherSpecifications: [], confidence: "high", unreadableFields: [], warnings: [],
    }) });
    expect(result.maximumPowerVoltage).toBe("29.61 V");
    expect(result.shortCircuitCurrent).toBe("16.10 A");
    expect(result.panelType).toBe("bifacial");
  });
});
