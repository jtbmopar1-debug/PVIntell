import type { ChatMessage, Project } from "@/domain/models";
import type { TelemetrySnapshot } from "@/telemetry/types";

export const demoProject: Project = {
  id: "project-harbour-view",
  name: "Harbour View Off-grid Home",
  description: "A resilient family home system with generator backup and room to expand.",
  projectType: "off-grid",
  phase: "design",
  location: "Whangārei, New Zealand",
  goal: "Power a small off-grid home reliably, including a water pump and ordinary household appliances.",
  priorities: ["Reliability", "Low generator use", "Simple operation"],
  systemVoltage: 48,
  autonomyDays: 2,
  peakSunHours: 4.2,
  loads: [
    { id: "load-fridge", name: "Fridge / freezer", watts: 140, quantity: 1, hoursPerDay: 10, surgeWatts: 700, currentType: "AC", confidence: "estimated", simultaneous: true },
    { id: "load-lights", name: "LED lighting", watts: 12, quantity: 10, hoursPerDay: 5, surgeWatts: 12, currentType: "AC", confidence: "estimated", simultaneous: true },
    { id: "load-pump", name: "Water pump", watts: 1800, quantity: 1, hoursPerDay: 1.2, surgeWatts: 4500, currentType: "AC", confidence: "confirmed", simultaneous: true },
    { id: "load-tv", name: "TV", watts: 110, quantity: 1, hoursPerDay: 4, surgeWatts: 110, currentType: "AC", confidence: "estimated", simultaneous: true },
    { id: "load-microwave", name: "Microwave", watts: 1500, quantity: 1, hoursPerDay: 0.3, surgeWatts: 1800, currentType: "AC", confidence: "confirmed", simultaneous: false },
    { id: "load-office", name: "Laptop & internet", watts: 120, quantity: 1, hoursPerDay: 8, surgeWatts: 120, currentType: "AC", confidence: "estimated", simultaneous: true },
    { id: "load-washer", name: "Washing machine", watts: 500, quantity: 1, hoursPerDay: 0.8, surgeWatts: 900, currentType: "AC", confidence: "estimated", simultaneous: false },
  ],
  assumptions: [
    { id: "assumption-sun", label: "Useful sun", value: "4.2 peak-sun hours/day", reason: "Conservative annual design value for the demo location.", confidence: "estimated" },
    { id: "assumption-fridge", label: "Fridge usage", value: "1.4 kWh/day", reason: "Typical modern household fridge/freezer until its label is photographed.", confidence: "estimated" },
    { id: "assumption-autonomy", label: "Poor-weather reserve", value: "2 days", reason: "Chosen to reduce generator use without excessive battery cost.", confidence: "confirmed" },
  ],
  components: [
    { id: "component-pv", kind: "panel", name: "450 W mono PV panels", manufacturer: "Demo Solar", model: "DS450-N", quantity: 12, location: "North-facing roof", status: "estimated", specs: { totalWp: 5400, strings: "2 × 6", voc: 41.2, vmp: 34.5 } },
    { id: "component-battery", kind: "battery", name: "51.2 V LiFePO₄ battery", manufacturer: "VoltKeep", model: "VK-512100", quantity: 4, location: "Utility room", status: "confirmed", specs: { eachKWh: 5.12, totalKWh: 20.48, usableKWh: 16.4 } },
    { id: "component-inverter", kind: "inverter", name: "8 kW hybrid inverter", manufacturer: "SunForge", model: "HX-8K", quantity: 1, location: "Utility room", status: "confirmed", specs: { continuousW: 8000, surgeW: 16000, mpptRange: "120–430 V" } },
    { id: "component-generator", kind: "generator", name: "Backup generator", manufacturer: "DemoPower", model: "DG-7", quantity: 1, location: "External generator bay", status: "confirmed", specs: { ratedW: 6500, fuel: "petrol" } },
  ],
  installationSteps: [
    { id: "planning", title: "Planning & approvals", description: "Confirm equipment locations, cable routes, ventilation, access, and local approvals.", safetyLevel: "user", expectedResult: "A documented layout reviewed by the installer.", complete: true },
    { id: "battery", title: "Battery installation", description: "Mount batteries as specified and verify isolation before interconnection.", safetyLevel: "high-current-dc", expectedResult: "A secure, isolated bank ready for licensed inspection.", complete: true },
    { id: "protection", title: "DC protection", description: "Install manufacturer-specified fusing, isolation, and over-current protection.", safetyLevel: "high-current-dc", expectedResult: "Protected conductors with documented ratings.", complete: false },
    { id: "inverter", title: "Inverter installation", description: "Mount the inverter with required clearances and route segregated cabling.", safetyLevel: "licensed", expectedResult: "Equipment ready for connection and inspection.", complete: false },
    { id: "pv", title: "PV installation", description: "Install the array, earthing, DC cabling, labels, and isolation to the approved design.", safetyLevel: "licensed", expectedResult: "Array electrically isolated and ready for pre-power tests.", complete: false },
    { id: "ac", title: "AC wiring", description: "Complete regulated AC connections and protection.", safetyLevel: "licensed", expectedResult: "Certificate and test results recorded.", complete: false },
    { id: "comms", title: "Communications", description: "Connect inverter, battery BMS, and monitoring communications.", safetyLevel: "low-voltage", expectedResult: "All devices visible with stable communication.", complete: false },
    { id: "config", title: "Configuration", description: "Apply battery-approved charge limits and operating priorities.", safetyLevel: "low-voltage", expectedResult: "Settings match the approved commissioning sheet.", complete: false },
    { id: "checks", title: "Pre-power checks", description: "Verify polarity, torque records, insulation tests, and protective devices.", safetyLevel: "licensed", expectedResult: "Signed pre-energisation checklist.", complete: false },
    { id: "commission", title: "Commissioning", description: "Energise in the approved sequence and record operating measurements.", safetyLevel: "licensed", expectedResult: "System operating normally with baseline readings.", complete: false },
  ],
  commissioning: [
    { id: "battery-voltage", label: "Battery voltage", value: "52.7 V", expected: "50–54.4 V before startup", recordedAt: "2026-08-13T21:35:00.000Z", result: "pass" },
    { id: "bms-comms", label: "BMS communications", value: "Connected", expected: "Stable CAN connection", recordedAt: "2026-08-13T21:39:00.000Z", result: "pass" },
    { id: "pv-open-circuit", label: "PV string open-circuit", value: "246 / 247 V", expected: "230–255 V", recordedAt: "2026-08-13T22:02:00.000Z", result: "pass" },
  ],
};

export const demoTelemetry: TelemetrySnapshot = {
  timestamp: "2026-08-14T02:42:00.000Z", source: "mock-composite",
  "battery.soc": 78, "battery.voltage": 52.7, "battery.current": 47.2,
  "battery.power": 2487, "battery.temperature": 26, "battery.cellDelta": 0.015,
  "pv.power": 3820, "pv.voltage": 318, "pv.current": 12.1, "pv.energyToday": 14.8,
  "load.power": 1240, "load.energyToday": 7.1, "grid.power": 0,
  "generator.power": 0, "inverter.outputPower": 1240,
  "inverter.temperature": 42, "inverter.frequency": 50,
  "inverter.state": "running", "system.faultCode": null, "system.warningCode": null,
};

export const initialConversation: ChatMessage[] = [
  { id: "hello", role: "assistant", createdAt: "2026-08-14T02:40:00.000Z", content: "Hi, I’m Wattson. Tell me what you want your power system to do. You don’t need to know any technical terms—I’ll work those out with you." },
];
