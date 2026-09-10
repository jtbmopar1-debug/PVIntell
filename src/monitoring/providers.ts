import type { MonitoringProvider } from "@/monitoring/types";

export const providerCatalog: Record<MonitoringProvider, { label: string; enabled: boolean; reason: string }> = {
  dess_monitor: { label: "DESSMonitor / SmartESS", enabled: false, reason: "Sign in with the same account used by the DESSMonitor or SmartESS app." },
  victron_vrm: { label: "Victron VRM", enabled: false, reason: "Secure Vault storage is ready; the provider connector is not implemented yet." },
  solarman: { label: "Solarman-compatible", enabled: false, reason: "Secure Vault storage is ready; documented provider API access is still required." },
  junctek_local: { label: "Junctek local", enabled: true, reason: "Connect directly to a nearby KG-F, KH-F, KL-F or KM-F monitor." },
  pvintell_gateway: { label: "PVIntell Gateway", enabled: false, reason: "Reserved for the future local LAN, Modbus, MQTT, Wi-Fi and Bluetooth gateway." },
};
