"use client";
import Link from "next/link";
import { Activity, AlertTriangle, CircleGauge, RefreshCw, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Project, Site } from "@/domain/models";
import { monitoringViewState, type MonitoringSnapshot } from "@/monitoring/types";
import { useLocalMonitoring } from "@/components/local-monitoring-provider";
const statusNames = { empty: "Not connected", current: "Live", partial: "Partial data", stale: "Data delayed", error: "Connection issue" };
const preciseReading = (number: number | undefined, unit: string) => number == null ? "Not reported" : `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
const providerLabel = (provider?: string) => provider === "deye_cloud" ? "DeyeCloud" : provider === "junctek_local" ? "Junctek" : "Not connected";

export function SystemMonitor({ project, site }: { project: Project; site: Site }) {
  const [data, setData] = useState<MonitoringSnapshot>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const local = useLocalMonitoring();
  const localHere = local.scope?.siteId === site.id && local.scope.systemId === project.id;
  const connected = localHere && local.status === "connected";
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const sync = await fetch("/api/monitoring/deye", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sync", siteId: site.id, systemId: project.id }) });
      if (!sync.ok) { const syncBody = await sync.json().catch(() => ({})); throw new Error(syncBody.error || "DeyeCloud refresh failed"); }
      const response = await fetch(`/api/monitoring?siteId=${site.id}&systemId=${project.id}`, { cache: "no-store" });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Connection data unavailable"); }
    finally { setBusy(false); }
  }, [project.id, site.id]);
  useEffect(() => { const frame = requestAnimationFrame(() => void refresh()); return () => cancelAnimationFrame(frame); }, [refresh, local.lastSavedAt]);
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000); return () => window.clearInterval(timer); }, [refresh]);
  const latest = localHere && local.lastReading ? local.lastReading : data?.latest;
  const state = connected ? "current" : data ? monitoringViewState(data) : "empty";
  async function connect() {
    setConnecting(true); setError("");
    try { await local.connectJunctek({ siteId: site.id, systemId: project.id }); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not connect Junctek"); }
    finally { setConnecting(false); }
  }
  return <div className="animate-rise space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">Monitoring</div><h1 className="mt-2 font-display text-3xl font-extrabold">{project.name}</h1><p className="mt-2 text-xs text-muted">Provider readings for this system at {site.name}.</p></div><button type="button" onClick={() => void refresh()} disabled={busy} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-brand"><RefreshCw size={14} className={busy ? "animate-spin" : ""}/>Refresh</button></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Tile label="Status" text={statusNames[state]} icon={Activity}/><Tile label="Provider" text={connected ? "Junctek" : providerLabel(data?.connection?.provider)} icon={CircleGauge}/><Tile label="Last reading" text={latest ? new Date(latest.measuredAt).toLocaleString() : "Not reported"} icon={RefreshCw}/><Tile label="Active alerts" text={String(data?.alerts.length ?? 0)} icon={AlertTriangle}/></div>
    <section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-sm font-extrabold">Connect Junctek</h2><p className="mt-2 max-w-xl text-xs leading-5 text-muted">Connect a supported nearby Junctek battery monitor. Bluetooth readings continue while PVIntell is open in a compatible browser.</p></div>{connected ? <button type="button" onClick={local.disconnect} className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-xs font-bold text-brand"><Unplug size={15}/>Disconnect Bluetooth</button> : <button type="button" onClick={() => void connect()} disabled={connecting} className="rounded-xl bg-brand px-4 py-3 text-xs font-bold text-white disabled:opacity-50">{connecting ? "Choose your device…" : "Connect Junctek"}</button>}</div>
      <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">Want to record daily solar, SOC or generator use? <Link className="font-bold text-brand" href={`/monitor?system=${project.id}`}>Open Monitor daily log →</Link></p>
    </section>
    {error || localHere && local.error ? <Notice icon={AlertTriangle} title="Connection unavailable" detail={error || local.error || ""}/> : null}
    {latest ? <ProviderReadingPanel latest={latest} deviceName={localHere ? local.deviceName : data?.connection?.displayName ?? data?.devices[0]?.displayName} provider={connected ? "junctek_local" : data?.connection?.provider}/> : <Notice icon={CircleGauge} title="No readings yet" detail="Connect DeyeCloud in Connections or connect a nearby Junctek monitor to receive readings."/>}
    {data?.samples.length ? <section className="card p-4"><div className="eyebrow">Recent provider readings</div><div className="mt-3 max-h-60 overflow-auto">{data.samples.slice(-24).reverse().map((sample) => <div key={sample.measuredAt} className="grid grid-cols-5 gap-2 border-b border-line py-2 text-[10px]"><span>{new Date(sample.measuredAt).toLocaleString()}</span><span>{preciseReading(sample.pvPowerW, "W PV")}</span><span>{preciseReading(sample.loadPowerW, "W load")}</span><span>{preciseReading(sample.gridPowerW, "W grid")}</span><span>{preciseReading(sample.batterySocPercent, "% SOC")}</span></div>)}</div></section> : null}
  </div>;
}
function Tile({ label, text, icon: Icon }: { label: string; text: string; icon: typeof Activity }) { return <div className="card min-w-0 p-3"><div className="flex justify-between gap-2"><span className="eyebrow">{label}</span><Icon size={15} className="text-brand"/></div><div className="mt-2 truncate text-sm font-extrabold">{text}</div></div>; }
function ProviderReadingPanel({ latest, deviceName, provider }: { latest: NonNullable<MonitoringSnapshot["latest"]>; deviceName?: string; provider?: string }) {
  const soc = latest.batterySocPercent; const level = soc == null ? 0 : Math.max(0, Math.min(100, soc));
  const wattsIn = Math.max(0, latest.batteryPowerW ?? 0); const wattsOut = Math.max(0, -(latest.batteryPowerW ?? 0));
  const flow = wattsIn > 0 ? "CHG" : wattsOut > 0 ? "DSG" : "IDLE";
  return <div className="card mt-3 overflow-hidden"><div className={`grid gap-4 p-4 sm:grid-cols-[minmax(180px,1fr)_2fr] sm:items-center ${flow === "CHG" ? "bg-[linear-gradient(120deg,#eef7f2,#f8fbfd)]" : flow === "DSG" ? "bg-[linear-gradient(120deg,#eaf3fb,#f8fbfd)]" : "bg-[linear-gradient(120deg,#f1f4f6,#f8fbfd)]"}`}><div><div className={`flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.13em] ${flow === "CHG" ? "text-[#247557]" : flow === "DSG" ? "text-[#12649f]" : "text-muted"}`}><span className={`size-2 rounded-full ${flow === "CHG" ? "bg-[#2aa876]" : flow === "DSG" ? "bg-[#2787c5]" : "bg-[#91a0ad]"}`}/>Measured provider data<span className={`rounded-md px-2 py-1 tracking-[.08em] ${flow === "CHG" ? "bg-[#dcefe5] text-[#197554]" : flow === "DSG" ? "bg-[#dceefa] text-[#12649f]" : "bg-[#e8edf2] text-muted"}`}>{flow}</span></div><div className="mt-2 flex items-end gap-2"><strong className="font-display text-3xl leading-none text-ink">{soc == null ? preciseReading(latest.pvPowerW, "W PV") : preciseReading(soc, "%")}</strong></div><p className="mt-2 text-[10px] text-muted">{deviceName ?? providerLabel(provider)}</p></div><div><div className="flex items-center justify-between text-[10px] font-bold text-muted"><span>{soc == null ? "Current solar output" : "State of charge"}</span><span>{soc == null ? preciseReading(latest.pvPowerW, "W") : `${level.toFixed(level % 1 ? 1 : 0)}%`}</span></div>{soc != null ? <div className="mt-2 flex items-center gap-2"><div className={`h-5 flex-1 overflow-hidden rounded-md bg-white p-0.5 ${flow === "CHG" ? "border border-[#b9d9c8]" : flow === "DSG" ? "border border-[#b9d5e8]" : "border border-line"}`}><div className={`h-full rounded-[4px] transition-[width] ${flow === "CHG" ? "bg-[linear-gradient(90deg,#1f8b68,#55bd7c)]" : flow === "DSG" ? "bg-[linear-gradient(90deg,#176fa9,#54a8da)]" : "bg-[#9aa8b4]"}`} style={{ width: `${level}%` }}/></div><span className={`h-2 w-1 rounded-r ${flow === "CHG" ? "bg-[#8fbda7]" : flow === "DSG" ? "bg-[#82b5d5]" : "bg-[#aeb8c0]"}`}/></div> : null}</div></div><div className="grid grid-cols-2 divide-x divide-y divide-line border-t border-line sm:grid-cols-4 sm:divide-y-0"><CompactMetric label="Solar" value={preciseReading(latest.pvPowerW, "W")}/><CompactMetric label="Load" value={preciseReading(latest.loadPowerW, "W")}/><CompactMetric label="Grid" value={preciseReading(latest.gridPowerW, "W")}/><CompactMetric label="Battery" value={preciseReading(latest.batteryPowerW, "W")}/></div></div>;
}
function CompactMetric({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) { return <div className="min-w-0 px-3 py-3 text-center"><div className={`text-[9px] font-extrabold uppercase tracking-[.12em] ${tone === "in" ? "text-[#25845f]" : tone === "out" ? "text-[#1974b8]" : "text-muted"}`}>{label}</div><div className={`mt-1 truncate text-sm font-extrabold ${tone === "in" ? "text-[#197554]" : tone === "out" ? "text-[#12649f]" : "text-ink"}`}>{value}</div></div>; }
function Notice({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) { return <section className="card flex items-start gap-3 p-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Icon size={17}/></span><div><h2 className="text-sm font-extrabold">{title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{detail}</p></div></section>; }
