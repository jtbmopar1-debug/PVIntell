export const telemetryKeys = [
  "battery.soc", "battery.voltage", "battery.current", "battery.power",
  "battery.temperature", "battery.cellHighVoltage", "battery.cellLowVoltage",
  "battery.cellDelta", "pv.power", "pv.voltage", "pv.current", "pv.energyToday",
  "load.power", "load.energyToday", "grid.power", "generator.power",
  "inverter.outputPower", "inverter.temperature", "inverter.frequency",
  "inverter.state", "system.faultCode", "system.warningCode",
] as const;

export type TelemetryKey = (typeof telemetryKeys)[number];
export type TelemetryValue = number | string | null;
export type TelemetrySnapshot = Partial<Record<TelemetryKey, TelemetryValue>> & {
  timestamp: string;
  source: string;
};

export interface SystemFinding {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  explanation: string;
  nextStep: string;
}
