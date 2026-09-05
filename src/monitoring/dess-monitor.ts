import "server-only";
import { createHash } from "node:crypto";

export type DessCredentials = { username: string; password: string };
export type DessCollector = { providerDeviceId: string; displayName: string; method?: string; status?: string };
const endpoint = "https://api.dessmonitor.com/public/";
const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");
const common = "&source=1&_app_client_=web&_app_id_=com.pvintell.app&_app_version_=1.0";

async function call(params: URLSearchParams) {
  const response = await fetch(`${endpoint}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("DESSMonitor could not be reached");
  const body = await response.json() as { err?: number; desc?: string; dat?: unknown };
  if (body.err !== 0) throw new Error(body.desc || "DESSMonitor rejected the request");
  return body.dat;
}

export async function authenticateDess(credentials: DessCredentials) {
  const companyKey = process.env.DESSMONITOR_COMPANY_KEY?.trim();
  if (!companyKey) throw new Error("DESSMonitor is not enabled by the PVIntell administrator yet");
  const salt = Date.now().toString();
  const action = `&action=authSource&usr=${encodeURIComponent(credentials.username)}&company-key=${encodeURIComponent(companyKey)}${common}`;
  const dat = await call(new URLSearchParams(`${`sign=${sha1(salt + sha1(credentials.password) + action)}&salt=${salt}`}${action}`)) as { secret?: string; token?: string; expire?: number };
  if (!dat?.secret || !dat?.token) throw new Error("DESSMonitor sign-in did not return an access token");
  return { secret: dat.secret, token: dat.token, expire: dat.expire };
}

export async function discoverDessCollectors(credentials: DessCredentials): Promise<DessCollector[]> {
  const auth = await authenticateDess(credentials); const salt = Date.now().toString();
  const action = `&action=webQueryCollectorsEs&page=0&pagesize=50${common}`;
  const dat = await call(new URLSearchParams(`${`sign=${sha1(salt + auth.secret + auth.token + action)}&salt=${salt}&token=${auth.token}`}${action}`)) as { collector?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  const rows = Array.isArray(dat) ? dat : Array.isArray(dat?.collector) ? dat.collector : [];
  return rows.flatMap((row) => { const id = row.pn ?? row.sn; if (typeof id !== "string") return []; return [{ providerDeviceId: id, displayName: typeof row.alias === "string" && row.alias ? row.alias : `DESSMonitor logger ${id}`, method: typeof row.method === "string" ? row.method : undefined, status: String(row.status ?? "unknown") }]; });
}
