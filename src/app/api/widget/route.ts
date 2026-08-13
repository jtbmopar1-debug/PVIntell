import { demoTelemetry } from "@/data/demo-project";

export const dynamic = "force-static";
export function GET() {
  const batteryPower = Number(demoTelemetry["battery.power"] ?? 0);
  return Response.json({
    pvPower: demoTelemetry["pv.power"],
    loadPower: demoTelemetry["load.power"],
    batterySoc: demoTelemetry["battery.soc"],
    batteryPower: Math.abs(batteryPower),
    batteryDirection: batteryPower >= 0 ? "charging" : "discharging",
    systemStatus: demoTelemetry["system.faultCode"] ? "fault" : "normal",
    timestamp: demoTelemetry.timestamp,
  });
}
