import type { SystemFinding, TelemetrySnapshot } from "@/telemetry/types";

export interface DiagnosticContext {
  current: TelemetrySnapshot;
  inverterRatedWatts: number;
  lowBatteryVoltage: number;
  isDaylight: boolean;
}

export function evaluateDiagnostics(context: DiagnosticContext): SystemFinding[] {
  const { current } = context;
  const findings: SystemFinding[] = [];
  const load = Number(current["load.power"] ?? 0);
  const voltage = Number(current["battery.voltage"] ?? 0);
  const pv = Number(current["pv.power"] ?? 0);
  const cellDelta = Number(current["battery.cellDelta"] ?? 0);

  if (load > context.inverterRatedWatts) findings.push({
    id: "overload", severity: "critical", title: "Inverter overload risk",
    explanation: `The ${load} W load is above the inverter's ${context.inverterRatedWatts} W rating.`,
    nextStep: "Switch off a large load and verify the inverter has returned to normal.",
  });
  if (voltage > 0 && voltage < context.lowBatteryVoltage) findings.push({
    id: "low-battery", severity: "warning", title: "Battery voltage is low",
    explanation: `${voltage.toFixed(1)} V is below the configured ${context.lowBatteryVoltage.toFixed(1)} V threshold.`,
    nextStep: "Reduce non-essential loads and confirm a charging source is available.",
  });
  if (context.isDaylight && pv < 50) findings.push({
    id: "zero-pv", severity: "warning", title: "Unexpectedly low solar output",
    explanation: "The array is reporting almost no power during daylight hours.",
    nextStep: "Check weather, PV isolators, inverter state, and any active PV fault code—in that order.",
  });
  if (cellDelta > 0.05) findings.push({
    id: "cell-imbalance", severity: "warning", title: "Possible cell imbalance",
    explanation: `Cell spread is ${(cellDelta * 1000).toFixed(0)} mV, above the 50 mV attention threshold.`,
    nextStep: "Observe the spread near full charge and consult the battery maker before changing BMS settings.",
  });
  if (!findings.length) findings.push({
    id: "healthy", severity: "info", title: "System operating normally",
    explanation: "No diagnostic rule currently needs your attention.",
    nextStep: "Keep monitoring; Wattson will call out meaningful changes.",
  });
  return findings;
}
