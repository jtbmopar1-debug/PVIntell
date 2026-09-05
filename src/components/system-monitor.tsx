"use client";
import { Activity, AlertTriangle, Battery, CircleGauge, RefreshCw, Sun, Unplug, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project, Site } from "@/domain/models";
import { providerCatalog } from "@/monitoring/providers";
import { monitoringViewState, type MonitoringSnapshot } from "@/monitoring/types";
import { junctekAdapter } from "@/local-devices/junctek";
import type { LocalDeviceSession } from "@/local-devices/types";

const statusNames = { empty: "Not connected", current: "Live", partial: "Partial data", stale: "Data delayed", error: "Connection issue" };
const reading = (number: number | undefined, unit: string) => number == null ? "Not reported" : `${Math.round(number).toLocaleString()} ${unit}`;

export function SystemMonitor({ project, site }: { project: Project; site: Site }) {
  const [data, setData] = useState<MonitoringSnapshot>(); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false); const [showConnect, setShowConnect] = useState(false);
  const [localStatus, setLocalStatus] = useState(""); const localSession = useRef<LocalDeviceSession | null>(null); const lastLocalUpload = useRef(0);
  const refresh = useCallback(async () => { setBusy(true); setError(""); try { const response = await fetch(`/api/monitoring?siteId=${site.id}&systemId=${project.id}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); } catch (issue) { setError(issue instanceof Error ? issue.message : "Monitoring data is unavailable"); } finally { setBusy(false); } }, [project.id, site.id]);
  useEffect(() => {
    // The state changes happen after the external fetch settles.
    const request = fetch(`/api/monitoring?siteId=${site.id}&systemId=${project.id}`, { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); })
      .catch((issue) => setError(issue instanceof Error ? issue.message : "Monitoring data is unavailable"))
      .finally(() => setBusy(false));
    return () => { void request; };
  }, [project.id, site.id]);
  useEffect(() => () => localSession.current?.disconnect(), []);
  const latest = data?.latest; const state = data ? monitoringViewState(data) : "empty";
  const battery = latest && [latest.batteryPowerW, latest.batteryVoltageV, latest.batteryCurrentA, latest.batterySocPercent].some((item) => item != null);
  async function connectDess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setConnecting(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/monitoring/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId: site.id, systemId: project.id, provider: "dess_monitor", username: form.get("username"), password: form.get("password") }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      event.currentTarget.reset(); setShowConnect(false); await refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "DESSMonitor connection failed"); }
    finally { setConnecting(false); }
  }
  async function uploadLocalReading(session: LocalDeviceSession, localReading: MonitoringSnapshot["latest"]) {
    if (!localReading || Date.now() - lastLocalUpload.current < 15_000) return; lastLocalUpload.current = Date.now();
    const response = await fetch("/api/monitoring/local-readings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId: site.id, systemId: project.id, adapter: "junctek", deviceId: session.deviceId, displayName: session.displayName, reading: localReading }) });
    if (!response.ok) { const body = await response.json(); throw new Error(body.error || "Could not save the Junctek reading"); }
    setLocalStatus(`Connected to ${session.displayName}`); await refresh();
  }
  async function connectJunctek() {
    setConnecting(true); setError(""); setLocalStatus("Choose your KMF device…");
    try {
      let pending: MonitoringSnapshot["latest"];
      const session = await junctekAdapter.connect((localReading) => { const active = localSession.current; if (active) void uploadLocalReading(active, localReading).catch((issue) => setError(issue instanceof Error ? issue.message : "Could not save the Junctek reading")); else pending = localReading; });
      localSession.current = session; setLocalStatus(`Connected to ${session.displayName}; waiting for its first reading…`);
      if (pending) void uploadLocalReading(session, pending).catch((issue) => setError(issue instanceof Error ? issue.message : "Could not save the Junctek reading"));
    } catch (issue) { setLocalStatus(""); setError(issue instanceof Error ? issue.message : "Could not connect to the Junctek monitor"); }
    finally { setConnecting(false); }
  }
  return <div className="animate-rise space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">System monitoring</div><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.045em]">{project.name}</h1><p className="mt-2 text-xs text-muted">Readings for this system only at {site.name}.</p></div><button onClick={() => void refresh()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[11px] font-bold text-brand disabled:opacity-50"><RefreshCw size={14} className={busy ? "animate-spin" : ""}/>Refresh</button></div>
    {error ? <Notice icon={AlertTriangle} title="Monitoring unavailable" detail={error}/> : null}
    {!error && busy && !data ? <div className="card p-5 text-xs text-muted">Loading monitoring status…</div> : null}
    {!error && data ? <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Tile label="Status" text={statusNames[state]} icon={Activity}/><Tile label="Provider" text={data.connection ? providerCatalog[data.connection.provider].label : "Not configured"} icon={CircleGauge}/><Tile label="Last reading" text={latest ? new Date(latest.measuredAt).toLocaleString() : "Not reported"} icon={RefreshCw}/><Tile label="Active alerts" text={String(data.alerts.length)} icon={AlertTriangle}/></div>
    {!data.connection ? <><section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Unplug size={17}/></span><div><h2 className="text-sm font-extrabold">Connect this system</h2><p className="mt-1 max-w-xl text-xs leading-5 text-muted">Choose the service or nearby monitor you already use. PVIntell handles the technical setup.</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => void connectJunctek()} disabled={connecting} className="h-10 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand disabled:opacity-50">Connect Junctek</button><button onClick={() => setShowConnect((open) => !open)} className="h-10 rounded-xl bg-brand px-4 text-xs font-bold text-white">{showConnect ? "Cancel" : "Connect DESSMonitor"}</button></div></div>{localStatus ? <p className="mt-4 rounded-xl bg-[#eef7f2] p-3 text-xs text-[#246548]">{localStatus}</p> : null}
      {showConnect ? <form onSubmit={connectDess} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2"><label className="text-xs font-bold">DESSMonitor username<input name="username" autoComplete="username" required className="field" placeholder="Email or account name"/></label><label className="text-xs font-bold">DESSMonitor password<input name="password" type="password" autoComplete="current-password" required className="field" placeholder="Your DESSMonitor password"/></label><div className="sm:col-span-2"><p className="mb-3 text-[10px] leading-4 text-muted">Your password is sent directly to the PVIntell server, encrypted in Supabase Vault and never returned to this browser.</p><button disabled={connecting} className="h-10 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:opacity-50">{connecting ? "Signing in and finding your system…" : "Connect and test"}</button></div></form> : null}</section><div className="grid gap-2 sm:grid-cols-2">{Object.entries(providerCatalog).filter(([id]) => !["dess_monitor", "junctek_local"].includes(id)).map(([id, p]) => <div key={id} className="card p-3"><strong className="text-xs">{p.label}</strong><p className="mt-1 text-[10px] leading-4 text-muted">{p.reason}</p></div>)}</div></> : !latest ? <Notice icon={CircleGauge} title="Connected, awaiting readings" detail="Your account and logger were found. PVIntell is ready for the first scheduled data sync."/> : <>
      <section><div className="eyebrow">Current readings</div><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><Tile label="Solar production" text={reading(latest.pvPowerW, "W")} icon={Sun}/><Tile label="Site load" text={reading(latest.loadPowerW, "W")} icon={Zap}/>{battery ? <Tile label="Battery" text={reading(latest.batterySocPercent, "%")} icon={Battery}/> : null}{latest.gridPowerW != null ? <Tile label="Grid flow" text={reading(latest.gridPowerW, "W")} icon={Activity}/> : null}</div></section>
      {data.samples.length ? <section className="card p-4"><div className="eyebrow">Recent history</div><div className="mt-3 max-h-52 overflow-auto">{data.samples.slice(-24).reverse().map((sample) => <div key={sample.measuredAt} className="grid grid-cols-3 gap-2 border-b border-line py-2 text-[10px]"><span>{new Date(sample.measuredAt).toLocaleString()}</span><span>Solar: {reading(sample.pvPowerW, "W")}</span><span>Load: {reading(sample.loadPowerW, "W")}</span></div>)}</div></section> : null}
      {data.alerts.length ? <section><div className="eyebrow">Alerts</div><div className="mt-3 space-y-2">{data.alerts.map((alert) => <div key={alert.id} className="card flex gap-3 p-4"><AlertTriangle size={16}/><div><strong className="text-xs">{alert.title}</strong>{alert.message ? <p className="mt-1 text-[10px] text-muted">{alert.message}</p> : null}</div></div>)}</div></section> : null}
      {data.devices.length ? <section className="card p-4"><div className="eyebrow">Connected devices</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{data.devices.map((device) => <div key={device.id} className="rounded-xl bg-[#f4f7fa] p-3 text-xs"><strong>{device.displayName}</strong><span className="float-right capitalize text-muted">{device.status}</span><p className="mt-1 text-[10px] text-muted">{device.deviceType}</p></div>)}</div></section> : null}</>}
    </> : null}
  </div>;
}
function Tile({ label, text, icon: Icon }: { label: string; text: string; icon: typeof Activity }) { return <div className="card min-w-0 p-3"><div className="flex justify-between gap-2"><span className="eyebrow">{label}</span><Icon size={15} className="text-brand"/></div><div className="mt-2 truncate text-sm font-extrabold">{text}</div></div>; }
function Notice({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) { return <section className="card flex items-start gap-3 p-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Icon size={17}/></span><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{detail}</p></div></section>; }
