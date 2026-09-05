"use client";

import { Activity, ArrowLeft, Link2, LoaderCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

type Connection = { id: string; site_id: string; project_id: string; provider: string; display_name: string; provider_account_ref?: string; status: string; is_active: boolean; last_success_at?: string };
type System = { id: string; site_id: string; name: string };
type Payload = { connections: Connection[]; sites: Array<{ id: string; name: string }>; systems: System[] };
const providerName: Record<string, string> = { junctek_local: "Bluetooth", dess_monitor: "DESSMonitor", victron_vrm: "Victron VRM", solarman: "Solarman", pvintell_gateway: "PVIntell gateway" };

export function MonitoringConnections() {
  const [data, setData] = useState<Payload>(); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/monitoring/connections", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }, []);
  useEffect(() => {
    // State changes only after the external request settles.
    const request = fetch("/api/monitoring/connections", { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); })
      .catch((issue) => setError(issue instanceof Error ? issue.message : "Could not load connections"));
    return () => { void request; };
  }, []);
  async function change(connection: Connection, method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !window.confirm(`Forget ${connection.display_name}? Its stored monitoring history will also be deleted.`)) return;
    setBusy(connection.id); setError("");
    try { const response = await fetch("/api/monitoring/connections", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "activate", siteId: connection.site_id, systemId: connection.project_id, connectionId: connection.id }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); await load(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Could not update connection"); } finally { setBusy(""); }
  }
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><header className="mt-7"><div className="eyebrow">Monitoring setup</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Connections</h1><p className="mt-1.5 text-xs leading-5 text-muted">Each system can keep several monitoring methods. Only the active connection supplies its current view.</p></header>{error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div> : null}{!data ? <div className="card mt-5 flex items-center gap-2 p-5 text-xs text-muted"><LoaderCircle size={15} className="animate-spin"/>Loading connections…</div> : <div className="mt-5 space-y-4">{data.systems.map((system) => { const rows = data.connections.filter((item) => item.project_id === system.id); const site = data.sites.find((item) => item.id === system.site_id); return <section key={system.id} className="card overflow-hidden"><div className="border-b border-line bg-white px-4 py-3"><div className="text-sm font-extrabold">{system.name}</div><div className="mt-0.5 text-[10px] text-muted">{site?.name}</div></div><div className="divide-y divide-line">{rows.length ? rows.map((connection) => <div key={connection.id} className="flex flex-wrap items-center gap-3 p-4"><span className={`grid size-9 place-items-center rounded-lg ${connection.is_active ? "bg-[#e2f3e9] text-[#207554]" : "bg-[#eef3f8] text-brand"}`}><Activity size={16}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-xs">{connection.display_name}</strong>{connection.is_active ? <span className="rounded-md bg-[#e2f3e9] px-2 py-1 text-[9px] font-extrabold uppercase text-[#207554]">Active</span> : null}</div><div className="mt-1 text-[10px] text-muted">{providerName[connection.provider] ?? connection.provider}{connection.last_success_at ? ` · Last reading ${new Date(connection.last_success_at).toLocaleString()}` : ""}</div></div>{!connection.is_active ? <button disabled={busy === connection.id} onClick={() => void change(connection, "PATCH")} className="rounded-lg border border-line px-3 py-2 text-[10px] font-bold text-brand">Use this connection</button> : null}<button disabled={busy === connection.id} onClick={() => void change(connection, "DELETE")} aria-label={`Forget ${connection.display_name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700"><Trash2 size={14}/></button></div>) : <div className="p-4 text-xs text-muted">No monitoring connection has been assigned to this system.</div>}</div></section>; })}{!data.systems.length ? <div className="card p-6 text-xs text-muted">Create a system before assigning monitoring connections.</div> : null}<div className="flex items-start gap-3 rounded-xl border border-dashed border-line p-4 text-xs text-muted"><Link2 size={16} className="mt-0.5 shrink-0"/><span>New Bluetooth devices are assigned to the system whose Monitor page started the connection. A device already assigned elsewhere is blocked until it is forgotten or reassigned.</span></div></div>}</div></main>;
}
