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

export class MockInverterDriver implements DeviceDriver {
  async connect() {}
  async disconnect() {}
  async getDeviceInfo() {
    return { id: "inv-1", manufacturer: "SunForge", model: "HX-8K", firmware: "3.4.2" };
  }
  async readTelemetry(): Promise<TelemetrySnapshot> {
    return {
      timestamp: new Date().toISOString(), source: "mock-inverter",
      "pv.power": 3820, "pv.voltage": 318, "pv.current": 12.1,
      "load.power": 1240, "inverter.outputPower": 1240,
      "inverter.temperature": 42, "inverter.frequency": 50,
      "inverter.state": "running", "system.faultCode": null,
    };
  }
  async readFaults() { return []; }
  async getCapabilities() { return ["pv", "load", "inverter", "faults"]; }
}

export class MockBMSDriver implements DeviceDriver {
  async connect() {}
  async disconnect() {}
  async getDeviceInfo() {
    return { id: "bms-1", manufacturer: "VoltKeep", model: "BMS-16S", firmware: "1.8.6" };
  }
  async readTelemetry(): Promise<TelemetrySnapshot> {
    return {
      timestamp: new Date().toISOString(), source: "mock-bms",
      "battery.soc": 78, "battery.voltage": 52.7, "battery.current": 47.2,
      "battery.power": 2487, "battery.temperature": 26,
      "battery.cellHighVoltage": 3.301, "battery.cellLowVoltage": 3.286,
      "battery.cellDelta": 0.015,
    };
  }
  async readFaults() { return []; }
  async getCapabilities() { return ["battery", "cells", "temperature"]; }
}
