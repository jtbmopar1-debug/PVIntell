import type { TelemetrySnapshot } from "./types";

export interface DeviceInfo {
  id: string;
  manufacturer: string;
  model: string;
  firmware: string;
}

export interface DeviceDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getDeviceInfo(): Promise<DeviceInfo>;
  readTelemetry(): Promise<TelemetrySnapshot>;
  readFaults(): Promise<string[]>;
  getCapabilities(): Promise<string[]>;
}

