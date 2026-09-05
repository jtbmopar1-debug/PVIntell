import type { MonitoringAlert, MonitoringMetrics, MonitoringProvider } from "@/monitoring/types";

export interface ProviderDevice {
  providerDeviceId: string;
  deviceType: string;
  displayName: string;
  capabilities: string[];
}

export interface ProviderReading extends MonitoringMetrics {
  providerDeviceId?: string;
  measuredAt: string;
}

export interface ConnectionHealth {
  ok: boolean;
  message?: string;
  checkedAt: string;
}

/** Implementations run server-side. `credential` must never be serialized or logged. */
export interface MonitoringConnector<TCredential = unknown> {
  readonly provider: MonitoringProvider;
  validateConnection(credential: TCredential): Promise<ConnectionHealth>;
  discoverDevices(credential: TCredential): Promise<ProviderDevice[]>;
  fetchCurrent(credential: TCredential, devices: ProviderDevice[]): Promise<ProviderReading[]>;
  fetchHistory?(credential: TCredential, devices: ProviderDevice[], from: Date, to: Date): Promise<ProviderReading[]>;
  normalizeAlarms(alarms: unknown[]): MonitoringAlert[];
  health(credential: TCredential): Promise<ConnectionHealth>;
}

export interface MonitoringCredentialResolver {
  /** Resolve through the server credential service; connectors never query Vault. */
  resolve(scope: MonitoringCredentialScope): Promise<unknown>;
}

export interface MonitoringCredentialScope {
  ownerId: string;
  siteId: string;
  systemId: string;
  connectionId: string;
}
