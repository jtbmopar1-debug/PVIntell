import type { MonitoringReading } from "@/monitoring/types";

export interface LocalDeviceSession {
  deviceId: string;
  displayName: string;
  disconnect(): void;
}

export interface LocalDeviceAdapter {
  id: string;
  label: string;
  supported(): boolean;
  connect(onReading: (reading: MonitoringReading) => void): Promise<LocalDeviceSession>;
}
