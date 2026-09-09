"use client";
import { Activity, AlertTriangle, Battery, CircleGauge, RefreshCw, Sun, Unplug, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Project, Site } from "@/domain/models";
import { providerCatalog } from "@/monitoring/providers";
import { monitoringViewState, type MonitoringSnapshot } from "@/monitoring/types";
import { useLocalMonitoring } from "@/components/local-monitoring-provider";

const statusNames = { empty: "Not connected", current: "Live", partial: "Partial data", stale: "Data delayed", error: "Connection issue" };
const reading = (number: number | undefined, unit: string) => number == null ? "Not reported" : `${Math.round(number).toLocaleString()} ${unit}`;
const preciseReading = (number: number | undefined, unit: string) => number == null ? "Not reported" : `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;

export function SystemMonitor({ project, site }: { project: Project; site: Site }) {
  const [data, setData] = useState<MonitoringSnapshot>(); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false); const [showConnect, setShowConnect] = useState(false);
  const localMonitoring = useLocalMonitoring();
  const localForThisSystem = localMonitoring.scope?.siteId === site.id && localMonitoring.scope.systemId === project.id;
  const localConnected = localForThisSystem && localMonitoring.status === "connected";
  const refresh = useCallback(async () => { setBusy(true); setError(""); try { const response = await fetch(`/api/monitoring?siteId=${site.id}&systemId=${project.id}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); } catch (issue) { setError(issue instanceof Error ? issue.message : "Monitoring data is unavailable"); } finally { setBusy(false); } }, [project.id, site.id]);
  useEffect(() => {
    // The state changes happen after the external fetch settles.
    const request = fetch(`/api/monitoring?siteId=${site.id}&systemId=${project.id}`, { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); })
      .catch((issue) => setError(issue instanceof Error ? issue.message : "Monitoring data is unavailable"))
      .finally(() => setBusy(false));
    return () => { void request; };
  }, [project.id, site.id]);
  useEffect(() => {
    if (!localForThisSystem || !localMonitoring.lastSavedAt) return;
    const frame = window.requestAnimationFrame(() => void refresh());
    return () => window.cancelAnimationFrame(frame);
  }, [localForThisSystem, localMonitoring.lastSavedAt, refresh]);
  const latest = localForThisSystem && localMonitoring.lastReading ? localMonitoring.lastReading : data?.latest; const state = localConnected ? "current" : data ? monitoringViewState(data) : "empty";
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
  async function connectJunctek() {
    setConnecting(true); setError("");
    try {
      await localMonitoring.connectJunctek({ siteId: site.id, systemId: project.id });
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not connect to the Junctek monitor"); }
    finally { setConnecting(false); }
  }
  async function disconnectMonitoring() {
    const connection = data?.connection; if (localForThisSystem) localMonitoring.disconnect();
    if (!connection) return;
    setConnecting(true); setError("");
    try {
      const response = await fetch("/api/monitoring/connections", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId: site.id, systemId: project.id, connectionId: connection.id }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not disconnect monitoring");
      setData(undefined); await refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not disconnect monitoring"); }
    finally { setConnecting(false); }
  }
  return <div className="animate-rise space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">System monitoring</div><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.045em]">{project.name}</h1><p className="mt-2 text-xs text-muted">Readings for this system only at {site.name}.</p>{localConnected || data?.connection ? <button type="button" onClick={() => void disconnectMonitoring()} disabled={connecting} className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[11px] font-bold text-brand disabled:opacity-50"><Unplug size={14}/>{connecting ? "Disconnecting…" : "Disconnect monitoring"}</button> : null}</div><button onClick={() => void refresh()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[11px] font-bold text-brand disabled:opacity-50"><RefreshCw size={14} className={busy ? "animate-spin" : ""}/>Refresh</button></div>
    {error ? <Notice icon={AlertTriangle} title="Monitoring unavailable" detail={error}/> : null}
    {!error && busy && !data ? <div className="card p-5 text-xs text-muted">Loading monitoring status…</div> : null}
    {!error && data ? <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Tile label="Status" text={statusNames[state]} icon={Activity}/><Tile label="Provider" text={data.connection ? providerCatalog[data.connection.provider].label : "Not configured"} icon={CircleGauge}/><Tile label="Last reading" text={latest ? new Date(latest.measuredAt).toLocaleString() : "Not reported"} icon={RefreshCw}/><Tile label="Active alerts" text={String(data.alerts.length)} icon={AlertTriangle}/></div>
    {!data.connection ? <><section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Unplug size={17}/></span><div><h2 className="text-sm font-extrabold">Connect this system</h2><p className="mt-1 max-w-xl text-xs leading-5 text-muted">Choose the service or nearby monitor you already use. PVIntell handles the technical setup.</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => void connectJunctek()} disabled={connecting || localConnected} className="h-10 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand disabled:opacity-50">Connect Junctek</button><button onClick={() => setShowConnect((open) => !open)} className="h-10 rounded-xl bg-brand px-4 text-xs font-bold text-white">{showConnect ? "Cancel" : "Connect DESSMonitor"}</button></div></div>{localForThisSystem && localMonitoring.status !== "idle" ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#eef7f2] p-3 text-xs text-[#246548]"><span>{localMonitoring.status === "requesting" ? "Choose your KMF device…" : localConnected ? `Connected to ${localMonitoring.deviceName}; monitoring continues while PVIntell is open.` : localMonitoring.error}</span>{localConnected ? <button type="button" onClick={localMonitoring.disconnect} className="shrink-0 rounded-lg border border-[#b9d9c8] bg-white px-3 py-2 font-bold text-[#246548]">Disconnect</button> : null}</div> : null}
      {showConnect ? <form onSubmit={connectDess} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2"><label className="text-xs font-bold">DESSMonitor username<input name="username" autoComplete="username" required className="field" placeholder="Email or account name"/></label><label className="text-xs font-bold">DESSMonitor password<input name="password" type="password" autoComplete="current-password" required className="field" placeholder="Your DESSMonitor password"/></label><div className="sm:col-span-2"><p className="mb-3 text-[10px] leading-4 text-muted">Your password is sent directly to the PVIntell server, encrypted in Supabase Vault and never returned to this browser.</p><button disabled={connecting} className="h-10 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:opacity-50">{connecting ? "Signing in and finding your system…" : "Connect and test"}</button></div></form> : null}</section><div className="grid gap-2 sm:grid-cols-2">{Object.entries(providerCatalog).filter(([id]) => !["dess_monitor", "junctek_local"].includes(id)).map(([id, p]) => <div key={id} className="card p-3"><strong className="text-xs">{p.label}</strong><p className="mt-1 text-[10px] leading-4 text-muted">{p.reason}</p></div>)}</div></> : !latest ? <Notice icon={CircleGauge} title="Connected, awaiting readings" detail="Your account and logger were found. PVIntell is ready for the first scheduled data sync."/> : <>
      <section><div className="eyebrow">Current readings</div>{data.connection?.provider === "junctek_local" ? <JunctekReadingPanel latest={latest} deviceName={data.devices[0]?.displayName}/> : <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><Tile label="Solar production" text={reading(latest.pvPowerW, "W")} icon={Sun}/><Tile label="Site load" text={reading(latest.loadPowerW, "W")} icon={Zap}/>{battery ? <Tile label="Battery" text={latest.batterySocPercent != null ? preciseReading(latest.batterySocPercent, "%") : preciseReading(latest.batteryVoltageV, "V")} icon={Battery}/> : null}{latest.gridPowerW != null ? <Tile label="Grid flow" text={reading(latest.gridPowerW, "W")} icon={Activity}/> : null}</div>}</section>
      {data.samples.length ? <section className="card p-4"><div className="eyebrow">Recent history</div><div className="mt-3 max-h-52 overflow-auto">{data.samples.slice(-24).reverse().map((sample) => data.connection?.provider === "junctek_local" ? <div key={sample.measuredAt} className="grid grid-cols-4 gap-2 border-b border-line py-2 text-[10px]"><span>{new Date(sample.measuredAt).toLocaleString()}</span><span>Voltage: {preciseReading(sample.batteryVoltageV, "V")}</span><span>Current: {preciseReading(sample.batteryCurrentA, "A")}</span><span>Power: {preciseReading(sample.batteryPowerW, "W")}</span></div> : <div key={sample.measuredAt} className="grid grid-cols-3 gap-2 border-b border-line py-2 text-[10px]"><span>{new Date(sample.measuredAt).toLocaleString()}</span><span>Solar: {reading(sample.pvPowerW, "W")}</span><span>Load: {reading(sample.loadPowerW, "W")}</span></div>)}</div></section> : null}
      {data.alerts.length ? <section><div className="eyebrow">Alerts</div><div className="mt-3 space-y-2">{data.alerts.map((alert) => <div key={alert.id} className="card flex gap-3 p-4"><AlertTriangle size={16}/><div><strong className="text-xs">{alert.title}</strong>{alert.message ? <p className="mt-1 text-[10px] text-muted">{alert.message}</p> : null}</div></div>)}</div></section> : null}
      {data.devices.length ? <section className="card p-4"><div className="eyebrow">Connected devices</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{data.devices.map((device) => <div key={device.id} className="rounded-xl bg-[#f4f7fa] p-3 text-xs"><strong>{device.displayName}</strong><span className="float-right capitalize text-muted">{device.status}</span><p className="mt-1 text-[10px] text-muted">{device.deviceType}</p></div>)}</div></section> : null}</>}
    </> : null}
  </div>;
}
function Tile({ label, text, icon: Icon }: { label: string; text: string; icon: typeof Activity }) { return <div className="card min-w-0 p-3"><div className="flex justify-between gap-2"><span className="eyebrow">{label}</span><Icon size={15} className="text-brand"/></div><div className="mt-2 truncate text-sm font-extrabold">{text}</div></div>; }
function JunctekReadingPanel({ latest, deviceName }: { latest: NonNullable<MonitoringSnapshot["latest"]>; deviceName?: string }) {
  const soc = latest.batterySocPercent; const level = soc == null ? 0 : Math.max(0, Math.min(100, soc));
  const wattsIn = Math.max(0, latest.batteryPowerW ?? 0); const wattsOut = Math.max(0, -(latest.batteryPowerW ?? 0));
  const flow = wattsIn > 0 ? "CHG" : wattsOut > 0 ? "DSG" : "IDLE";
  return <div className="card mt-3 overflow-hidden"><div className={`grid gap-4 p-4 sm:grid-cols-[minmax(180px,1fr)_2fr] sm:items-center ${flow === "CHG" ? "bg-[linear-gradient(120deg,#eef7f2,#f8fbfd)]" : flow === "DSG" ? "bg-[linear-gradient(120deg,#eaf3fb,#f8fbfd)]" : "bg-[linear-gradient(120deg,#f1f4f6,#f8fbfd)]"}`}><div><div className={`flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.13em] ${flow === "CHG" ? "text-[#247557]" : flow === "DSG" ? "text-[#12649f]" : "text-muted"}`}><span className={`size-2 rounded-full ${flow === "CHG" ? "bg-[#2aa876]" : flow === "DSG" ? "bg-[#2787c5]" : "bg-[#91a0ad]"}`}/>Live battery monitor<span className={`rounded-md px-2 py-1 tracking-[.08em] ${flow === "CHG" ? "bg-[#dcefe5] text-[#197554]" : flow === "DSG" ? "bg-[#dceefa] text-[#12649f]" : "bg-[#e8edf2] text-muted"}`}>{flow}</span></div><div className="mt-2 flex items-end gap-2"><strong className="font-display text-3xl leading-none text-ink">{soc == null ? "—" : `${preciseReading(soc, "%")}`}</strong></div><p className="mt-2 text-[10px] text-muted">{deviceName ?? "Junctek monitor"}</p></div><div><div className="flex items-center justify-between text-[10px] font-bold text-muted"><span>State of charge</span><span>{soc == null ? "Not reported" : `${level.toFixed(level % 1 ? 1 : 0)}%`}</span></div><div className="mt-2 flex items-center gap-2"><div className={`h-5 flex-1 overflow-hidden rounded-md bg-white p-0.5 ${flow === "CHG" ? "border border-[#b9d9c8]" : flow === "DSG" ? "border border-[#b9d5e8]" : "border border-line"}`}><div className={`h-full rounded-[4px] transition-[width] ${flow === "CHG" ? "bg-[linear-gradient(90deg,#1f8b68,#55bd7c)]" : flow === "DSG" ? "bg-[linear-gradient(90deg,#176fa9,#54a8da)]" : "bg-[#9aa8b4]"}`} style={{ width: `${level}%` }}/></div><span className={`h-2 w-1 rounded-r ${flow === "CHG" ? "bg-[#8fbda7]" : flow === "DSG" ? "bg-[#82b5d5]" : "bg-[#aeb8c0]"}`}/></div></div></div><div className="grid grid-cols-2 divide-x divide-y divide-line border-t border-line sm:grid-cols-4 sm:divide-y-0"><CompactMetric label="Voltage" value={preciseReading(latest.batteryVoltageV, "V")}/><CompactMetric label="Current" value={preciseReading(latest.batteryCurrentA, "A")}/><CompactMetric label="Watts in" value={preciseReading(wattsIn, "W")} tone="in"/><CompactMetric label="Watts out" value={preciseReading(wattsOut, "W")} tone="out"/></div></div>;
}
function CompactMetric({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) { return <div className="min-w-0 px-3 py-3 text-center"><div className={`text-[9px] font-extrabold uppercase tracking-[.12em] ${tone === "in" ? "text-[#25845f]" : tone === "out" ? "text-[#1974b8]" : "text-muted"}`}>{label}</div><div className={`mt-1 truncate text-sm font-extrabold ${tone === "in" ? "text-[#197554]" : tone === "out" ? "text-[#12649f]" : "text-ink"}`}>{value}</div></div>; }
function Notice({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) { return <section className="card flex items-start gap-3 p-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Icon size={17}/></span><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{detail}</p></div></section>; }
