import "server-only";

import { createHash } from "node:crypto";
import type { MonitoringConnector, ProviderDevice, ProviderReading } from "@/monitoring/connector";

export type DeyeRegion = "eu" | "us";
export type DeyeLogin = { email: string; password: string; region: DeyeRegion };
export type DeyeTokenCredential = {
  region: DeyeRegion;
  stationId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};
export type DeyeStation = { id: string; name: string; address?: string; timezone?: string; status?: string };

const baseUrls: Record<DeyeRegion, string> = {
  eu: "https://eu1-developer.deyecloud.com/v1.0",
  us: "https://us1-developer.deyecloud.com/v1.0",
};

type DeyeResponse = { success?: boolean; code?: string | number; msg?: string; [key: string]: unknown };

function providerMessage(body: DeyeResponse, fallback: string) {
  return typeof body.msg === "string" && body.msg.trim() ? body.msg.trim().slice(0, 240) : fallback;
}

async function post(region: DeyeRegion, path: string, body: Record<string, unknown>, accessToken?: string): Promise<DeyeResponse> {
  const response = await fetch(`${baseUrls[region]}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken.replace(/^bearer\s+/i, "")}` } : {}) },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => ({})) as DeyeResponse;
  if (!response.ok || result.success === false || (result.code != null && String(result.code) !== "1000000")) {
    const error = new Error(providerMessage(result, response.status === 401 ? "DeyeCloud authorization expired" : "DeyeCloud rejected the request"));
    Object.assign(error, { status: response.status, providerCode: result.code });
    throw error;
  }
  return result;
}

export async function authenticateDeye(login: DeyeLogin): Promise<DeyeTokenCredential> {
  const appId = process.env.DEYECLOUD_APP_ID?.trim();
  const appSecret = process.env.DEYECLOUD_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("DeyeCloud application credentials are not configured");
  const result = await post(login.region, `/account/token?appId=${encodeURIComponent(appId)}`, {
    appSecret,
    companyId: 0,
    email: login.email.trim(),
    password: createHash("sha256").update(login.password).digest("hex"),
  });
  const accessToken = typeof result.accessToken === "string" ? result.accessToken.replace(/^bearer\s+/i, "") : "";
  if (!accessToken) throw new Error("DeyeCloud did not return an access token");
  const seconds = Number(result.expiresIn);
  return {
    region: login.region,
    stationId: "",
    accessToken,
    refreshToken: typeof result.refreshToken === "string" ? result.refreshToken.replace(/^bearer\s+/i, "") : undefined,
    expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : undefined,
  };
}

function tokenCredential(value: unknown): DeyeTokenCredential {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Stored DeyeCloud authorization is invalid");
  const item = value as Record<string, unknown>;
  if ((item.region !== "eu" && item.region !== "us") || typeof item.stationId !== "string" || typeof item.accessToken !== "string") throw new Error("Stored DeyeCloud authorization is invalid");
  return item as DeyeTokenCredential;
}

export async function listDeyeStations(credential: Pick<DeyeTokenCredential, "region" | "accessToken">): Promise<DeyeStation[]> {
  const rows: unknown[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await post(credential.region, "/station/list", { page, size: 50 }, credential.accessToken);
    const batch = Array.isArray(result.stationList) ? result.stationList : [];
    rows.push(...batch);
    const total = Number(result.total);
    if (!batch.length || Number.isFinite(total) && rows.length >= total || batch.length < 50) break;
  }
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if ((typeof row.id !== "string" && typeof row.id !== "number") || typeof row.name !== "string") return [];
    return [{ id: String(row.id), name: row.name, address: typeof row.locationAddress === "string" ? row.locationAddress : undefined, timezone: typeof row.regionTimezone === "string" ? row.regionTimezone : undefined, status: typeof row.connectionStatus === "string" ? row.connectionStatus : undefined }];
  });
}

export async function listDeyeStationDevices(credentialValue: DeyeTokenCredential): Promise<ProviderDevice[]> {
  const credential = tokenCredential(credentialValue);
  const stationId = Number(credential.stationId);
  const rows: unknown[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await post(credential.region, "/station/device", { page, size: 50, stationIds: [Number.isFinite(stationId) ? stationId : credential.stationId] }, credential.accessToken);
    const batch = Array.isArray(result.deviceListItems) ? result.deviceListItems : [];
    rows.push(...batch);
    const total = Number(result.total);
    if (!batch.length || Number.isFinite(total) && rows.length >= total || batch.length < 50) break;
  }
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (typeof row.deviceSn !== "string" && typeof row.deviceSn !== "number") return [];
    const deviceType = typeof row.deviceType === "string" ? row.deviceType : "DEVICE";
    return [{ providerDeviceId: String(row.deviceSn), deviceType: deviceType.toLowerCase(), displayName: `Deye ${deviceType.toLowerCase()} ${String(row.deviceSn)}`, capabilities: ["current", "history"] }];
  });
}

function finite(value: unknown) {
  if (value == null || value === "" || typeof value === "boolean") return undefined;
  const number = Number(value); return Number.isFinite(number) ? number : undefined;
}
function measuredAt(value: unknown) {
  if (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value)) {
    const raw = Number(value); const date = new Date(raw < 10_000_000_000 ? raw * 1000 : raw);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return new Date().toISOString();
}

export function normalizeDeyeStationLatest(result: DeyeResponse, stationId: string): ProviderReading {
  const charge = finite(result.chargePower); const discharge = finite(result.dischargePower);
  const purchase = finite(result.purchasePower); const exportPower = finite(result.wirePower);
  return {
    providerDeviceId: stationId,
    measuredAt: measuredAt(result.lastUpdateTime),
    pvPowerW: finite(result.generationPower),
    loadPowerW: finite(result.consumptionPower),
    batteryPowerW: charge != null || discharge != null ? (charge ?? 0) - (discharge ?? 0) : finite(result.batteryPower),
    batterySocPercent: finite(result.batterySOC),
    gridPowerW: purchase != null || exportPower != null ? (purchase ?? 0) - (exportPower ?? 0) : finite(result.gridPower),
    inverterState: "DeyeCloud",
  };
}

export async function fetchDeyeStationLatest(credentialValue: DeyeTokenCredential): Promise<ProviderReading> {
  const credential = tokenCredential(credentialValue);
  const stationId = Number(credential.stationId);
  const result = await post(credential.region, "/station/latest", { stationId: Number.isFinite(stationId) ? stationId : credential.stationId }, credential.accessToken);
  return normalizeDeyeStationLatest(result, credential.stationId);
}

export const deyeCloudConnector: MonitoringConnector<DeyeTokenCredential> = {
  provider: "deye_cloud",
  async validateConnection(credential) { try { await fetchDeyeStationLatest(credential); return { ok: true, checkedAt: new Date().toISOString() }; } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "DeyeCloud connection failed", checkedAt: new Date().toISOString() }; } },
  discoverDevices: listDeyeStationDevices,
  async fetchCurrent(credential) { return [await fetchDeyeStationLatest(credential)]; },
  normalizeAlarms: () => [],
  async health(credential) { return this.validateConnection(credential); },
};
