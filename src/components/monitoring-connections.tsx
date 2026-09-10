"use client";

import { Activity, ArrowLeft, CloudSun, Link2, LoaderCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

type Connection = { id: string; site_id: string; project_id: string; provider: string; display_name: string; provider_account_ref?: string; status: string; is_active: boolean; last_success_at?: string };
type System = { id: string; site_id: string; name: string };
type Payload = { connections: Connection[]; sites: Array<{ id: string; name: string }>; systems: System[] };
type Station = { id: string; name: string; address?: string; timezone?: string; status?: string };
const providerName: Record<string, string> = { junctek_local: "Junctek Bluetooth", deye_cloud: "DeyeCloud" };

export function MonitoringConnections() {
  const [data, setData] = useState<Payload>(); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/monitoring/connections", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }, []);
  useEffect(() => { void load().catch((issue) => setError(issue instanceof Error ? issue.message : "Could not load connections")); }, [load]);
  async function change(connection: Connection, method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !window.confirm(`Forget ${connection.display_name}? Its stored monitoring history will also be deleted.`)) return;
    setBusy(connection.id); setError("");
    try { const response = await fetch("/api/monitoring/connections", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "activate", siteId: connection.site_id, systemId: connection.project_id, connectionId: connection.id }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); await load(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not update connection"); } finally { setBusy(""); }
  }
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl">
    <div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div>
    <header className="mt-7"><div className="eyebrow">Monitoring setup</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Connections</h1><p className="mt-1.5 text-xs leading-5 text-muted">Connect DeyeCloud stations or nearby Junctek battery monitors and assign one active data source to each system.</p></header>
    {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div> : null}
    {!data ? <div className="card mt-5 flex items-center gap-2 p-5 text-xs text-muted"><LoaderCircle size={15} className="animate-spin"/>Loading connections…</div> : <div className="mt-5 space-y-4">
      {data.systems.map((system) => { const rows = data.connections.filter((item) => item.project_id === system.id); const site = data.sites.find((item) => item.id === system.site_id); return <section key={system.id} className="card overflow-hidden">
        <div className="border-b border-line bg-white px-4 py-3"><div className="text-sm font-extrabold">{system.name}</div><div className="mt-0.5 text-[10px] text-muted">{site?.name}</div><Link href={`/sites/${system.site_id}/systems/${system.id}?view=monitor`} className="mt-2 inline-block text-xs font-bold text-brand">Open monitoring →</Link></div>
        <div className="divide-y divide-line">{rows.map((connection) => <div key={connection.id} className="flex flex-wrap items-center gap-3 p-4"><span className={`grid size-9 place-items-center rounded-lg ${connection.is_active ? "bg-[#e2f3e9] text-[#207554]" : "bg-[#eef3f8] text-brand"}`}><Activity size={16}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-xs">{connection.display_name}</strong>{connection.is_active ? <span className="rounded-md bg-[#e2f3e9] px-2 py-1 text-[9px] font-extrabold uppercase text-[#207554]">Active</span> : null}</div><div className="mt-1 text-[10px] text-muted">{providerName[connection.provider] ?? connection.provider} · {connection.status.replaceAll("_", " ")}{connection.last_success_at ? ` · Last reading ${new Date(connection.last_success_at).toLocaleString()}` : ""}</div></div>{!connection.is_active ? <button disabled={busy === connection.id} onClick={() => void change(connection, "PATCH")} className="rounded-lg border border-line px-3 py-2 text-[10px] font-bold text-brand">Use this connection</button> : null}<button disabled={busy === connection.id} onClick={() => void change(connection, "DELETE")} aria-label={`Forget ${connection.display_name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700"><Trash2 size={14}/></button></div>)}
          {!rows.length ? <div className="p-4 text-xs text-muted">No monitoring connection has been assigned to this system.</div> : null}
        </div>
        <DeyeSetup siteId={system.site_id} systemId={system.id} onConnected={load}/>
        <div className="border-t border-line bg-[#f8fbfe] px-4 py-3 text-[10px] text-muted">Nearby battery monitor? <Link href={`/sites/${system.site_id}/systems/${system.id}?view=monitor`} className="font-bold text-brand">Connect Junctek →</Link></div>
      </section>; })}
      {!data.systems.length ? <div className="card p-6 text-xs text-muted">Create a system before assigning monitoring connections.</div> : null}
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-line p-4 text-xs text-muted"><Link2 size={16} className="mt-0.5 shrink-0"/><span>Provider passwords are sent only to the provider during sign-in. PVIntell stores the resulting authorization token in Supabase Vault and never returns it to the browser.</span></div>
    </div>}
  </div></main>;
}

function DeyeSetup({ siteId, systemId, onConnected }: { siteId: string; systemId: string; onConnected: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [region, setRegion] = useState<"eu" | "us">("eu");
  const [stations, setStations] = useState<Station[]>([]); const [stationId, setStationId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function request(action: "discover" | "connect") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/monitoring/deye", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, siteId, systemId, email, password, region, ...(action === "connect" ? { stationId } : {}) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (action === "discover") { setStations(body.stations ?? []); setStationId(body.stations?.[0]?.id ?? ""); if (!body.stations?.length) setError("This DeyeCloud account has no available stations."); }
      else { setPassword(""); setStations([]); setOpen(false); await onConnected(); }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "DeyeCloud connection failed"); } finally { setBusy(false); }
  }
  return <div className="border-t border-line p-4">
    <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><CloudSun size={17}/></span><div><h3 className="text-xs font-extrabold">Connect DeyeCloud</h3><p className="mt-1 text-[10px] leading-4 text-muted">Read-only solar, load, battery and grid monitoring from a DeyeCloud station.</p></div></div><button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-brand px-3 py-2 text-[10px] font-bold text-brand">{open ? "Cancel" : "Connect"}</button></div>
    {open ? <div className="mt-4 grid gap-3 rounded-xl border border-line bg-[#f8fbfe] p-4 sm:grid-cols-2">
      <label className="text-[10px] font-bold">DeyeCloud email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-white px-3 text-xs"/></label>
      <label className="text-[10px] font-bold">DeyeCloud password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-white px-3 text-xs"/></label>
      <label className="text-[10px] font-bold sm:col-span-2">DeyeCloud account region<select value={region} onChange={(event) => { setRegion(event.target.value as "eu" | "us"); setStations([]); }} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-white px-3 text-xs"><option value="eu">Europe / Africa / Asia-Pacific</option><option value="us">North or South America</option></select></label>
      {!stations.length ? <button type="button" disabled={busy || !email || !password} onClick={() => void request("discover")} className="h-10 rounded-lg bg-brand px-4 text-xs font-bold text-white disabled:opacity-40 sm:col-span-2">{busy ? "Signing in…" : "Sign in and find stations"}</button> : <><label className="text-[10px] font-bold sm:col-span-2">Station<select value={stationId} onChange={(event) => setStationId(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-line bg-white px-3 text-xs">{stations.map((station) => <option key={station.id} value={station.id}>{station.name}{station.address ? ` — ${station.address}` : ""}</option>)}</select></label><button type="button" disabled={busy || !stationId} onClick={() => void request("connect")} className="h-10 rounded-lg bg-brand px-4 text-xs font-bold text-white disabled:opacity-40 sm:col-span-2">{busy ? "Connecting…" : "Use this station"}</button></>}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[10px] text-red-700 sm:col-span-2">{error}</p> : null}
      <p className="text-[9px] leading-4 text-muted sm:col-span-2">Your password is used for this sign-in request and is not retained. DeyeCloud authorization may eventually require reconnection.</p>
    </div> : null}
  </div>;
}
