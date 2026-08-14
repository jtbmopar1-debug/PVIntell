"use client";

import {
  CircleGauge, ClipboardCheck, ClipboardList, CloudSun, Home, LayoutDashboard,
  MapPin, Menu, MessageCircle, MoreHorizontal, Package, Plus, Settings2,
  Trash2, Wrench, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Site, SiteEquipment, SystemSummary } from "@/domain/models";

function Logo() {
  return <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[11px] bg-brand text-white"><Zap size={19} fill="currentColor"/></span><div><div className="font-display text-[17px] font-extrabold tracking-[-.04em]">PVIntell</div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-muted">Power, made clear</div></div></div>;
}

const systemNavigation = [
  ["wattson", "Wattson", MessageCircle],
  ["setup", "System questionnaire", ClipboardList],
  ["equipment", "Site equipment", Package],
  ["weather", "Solar weather", CloudSun],
  ["system", "System overview", LayoutDashboard],
  ["build", "Build", Wrench],
  ["commission", "Commission", ClipboardCheck],
  ["monitor", "Monitor", CircleGauge],
] as const;

export function SiteInventoryPage({ site, sites, initialSystems, equipment, email }: { site: Site; sites: Site[]; initialSystems: SystemSummary[]; equipment: SiteEquipment[]; email: string }) {
  const router = useRouter();
  const [systems, setSystems] = useState(initialSystems);
  const [editing, setEditing] = useState<SystemSummary | "new">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [choosingView, setChoosingView] = useState<string>();
  const available = equipment.filter((item) => !item.assignedProjectId);
  const assigned = equipment.length - available.length;
  const systemHref = (systemId: string, view: string) => `/sites/${site.id}/systems/${systemId}?view=${view}`;

  async function saveSystem(formData: FormData) {
    setSaving(true); setError("");
    const payload = { siteId: site.id, name: formData.get("name"), projectType: formData.get("projectType") };
    try {
      const response = await fetch(editing === "new" ? "/api/systems" : `/api/systems/${editing?.id}`, { method: editing === "new" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save power system");
      setEditing(undefined); router.refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save power system"); }
    finally { setSaving(false); }
  }

  async function removeSystem(system: SystemSummary) {
    if (!window.confirm(`Delete ${system.name}? This also removes its design, equipment records, Wattson history and monitoring data. This cannot be undone.`)) return;
    const response = await fetch(`/api/systems/${system.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { window.alert(body.error ?? "Could not delete system"); return; }
    setSystems((current) => current.filter((item) => item.id !== system.id)); router.refresh();
  }

  async function addSite() {
    const name = window.prompt("Name this site or property", "My site")?.trim();
    if (!name) return;
    const response = await fetch("/api/sites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    const body = await response.json();
    if (!response.ok) { window.alert(body.error ?? "Could not create site"); return; }
    router.push(`/sites/${body.id}`);
  }

  function openSystemView(view: string) {
    if (!systems.length) { setEditing("new"); return; }
    if (systems.length === 1) { router.push(systemHref(systems[0].id, view)); return; }
    setChoosingView(view);
  }

  return <div className="min-h-screen lg:grid lg:grid-cols-[226px_1fr]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[226px] flex-col overflow-y-auto border-r border-line bg-[#f8faf6] p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-12 items-center justify-between px-2"><Logo/><button className="lg:hidden" onClick={() => setMenu(false)}><X size={18}/></button></div>
      <button onClick={() => openSystemView("wattson")} className="mt-5 flex items-center gap-3 rounded-xl bg-brand px-3 py-3 text-xs font-bold text-white"><Zap size={16}/>Ask Wattson<span className="ml-auto">›</span></button>
      <div className="mt-5 rounded-2xl border border-line bg-white p-2">
        <div className="flex items-center justify-between px-2 py-1"><div className="eyebrow text-[#869089]">My sites</div><button onClick={() => void addSite()} aria-label="Add site" className="grid size-7 place-items-center rounded-lg bg-[#edf3e9] text-brand"><Plus size={14}/></button></div>
        <div className="mt-2 space-y-1">{sites.map((item) => <Link key={item.id} href={`/sites/${item.id}`} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-bold ${item.id === site.id ? "bg-[#e6efe7] text-brand" : "text-muted hover:bg-[#f1f4ef]"}`}><MapPin size={12}/><span className="truncate">{item.name}</span></Link>)}</div>
      </div>
      <nav className="mt-5 space-y-1">
        <Link href={`/sites/${site.id}`} className="flex items-center gap-3 rounded-xl bg-[#e8eee7] px-3 py-2.5 text-sm font-semibold"><Home size={17}/>Site overview</Link>
        {systemNavigation.map(([view, label, Icon]) => <button key={view} onClick={() => openSystemView(view)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#6c7770] hover:bg-[#eef2ec]"><Icon size={17}/>{label}</button>)}
      </nav>
      <div className="mt-auto rounded-2xl border border-line bg-white p-3.5"><div className="text-xs font-bold">Cloud data saved</div><p className="mt-2 truncate text-[10px] text-muted">{email}</p><form action="/auth/signout" method="post"><button className="mt-3 text-[10px] font-bold text-brand">Sign out</button></form></div>
    </aside>
    {menu && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMenu(false)}/>} 
    <main className="min-w-0">
      <header className="sticky top-0 z-20 flex h-[68px] items-center border-b border-line bg-[rgba(244,246,241,.9)] px-5 backdrop-blur-xl md:px-8"><button className="mr-3 lg:hidden" onClick={() => setMenu(true)}><Menu size={21}/></button><div><div className="font-display text-sm font-bold">{site.name}</div><div className="mt-0.5 text-[10px] text-muted">{site.location}</div></div><Link href="/account" className="ml-auto grid size-9 place-items-center rounded-xl border border-line bg-white text-muted"><Settings2 size={16}/></Link></header>
      <div className="mx-auto max-w-[1220px] space-y-8 p-5 md:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">Site overview</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">Power systems at {site.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Each building or independent power setup gets its own system. Open Main House or Studio to see and edit the equipment installed in that system.</p></div><button onClick={() => setEditing("new")} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white"><Plus size={15}/>Add power system</button></div>
        {systems.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{systems.map((system) => <article key={system.id} className="card p-5"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3e9] text-brand"><Zap size={18}/></span><button onClick={() => setEditing(system)} aria-label={`Edit ${system.name}`} className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-[#f1f4ef]"><MoreHorizontal size={16}/></button></div><h2 className="mt-5 text-base font-bold">{system.name}</h2><div className="mt-2 flex gap-2"><span className="rounded-full bg-[#edf0eb] px-2 py-1 text-[9px] font-bold uppercase">{system.projectType}</span><span className="rounded-full bg-[#fff1cf] px-2 py-1 text-[9px] font-bold uppercase text-[#8b6512]">{system.phase}</span></div><Link href={`/sites/${site.id}/systems/${system.id}`} className="mt-5 grid h-11 place-items-center rounded-xl bg-brand text-xs font-bold text-white">Open system</Link><button onClick={() => void removeSystem(system)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-bold text-[#9b4033]"><Trash2 size={13}/>Delete system</button></article>)}</div> : <div className="card grid min-h-64 place-items-center p-8 text-center"><div><Zap className="mx-auto text-brand"/><h2 className="mt-4 text-lg font-bold">No power systems yet</h2><p className="mt-2 text-xs text-muted">Add Main house, Studio, Workshop or any independent system at this property.</p><button onClick={() => setEditing("new")} className="mt-5 rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white">Add the first system</button></div></div>}
        <section><div className="eyebrow">Other equipment at this site</div><h2 className="mt-2 text-xl font-extrabold">Spare or not yet assigned</h2><p className="mt-2 text-xs text-muted">This is separate from the installed equipment inside each power system. {available.length} available item{available.length === 1 ? "" : "s"}{assigned ? ` · ${assigned} already assigned` : ""}.</p>{available.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{available.map((item) => <div key={item.id} className="card p-4"><div className="text-xs font-bold">{item.name}</div><div className="mt-1 text-[10px] text-muted">{[item.manufacturer, item.model].filter(Boolean).join(" · ") || item.type} · Qty {item.quantity}</div></div>)}</div>}</section>
      </div>
    </main>
    {choosingView && <div className="fixed inset-0 z-50 grid place-items-center bg-[#10251c]/45 p-5 backdrop-blur-sm"><div className="card w-full max-w-md bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><div className="eyebrow">Choose a system</div><h2 className="mt-2 text-xl font-extrabold">Where are you working?</h2></div><button onClick={() => setChoosingView(undefined)} aria-label="Close system picker"><X size={18}/></button></div><div className="mt-5 space-y-2">{systems.map((system) => <Link key={system.id} href={systemHref(system.id, choosingView)} className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-bold hover:border-[#91ad98] hover:bg-[#f1f5ef]"><span className="grid size-9 place-items-center rounded-xl bg-[#edf3e9] text-brand"><Zap size={16}/></span>{system.name}<span className="ml-auto text-brand">›</span></Link>)}</div></div></div>}
    {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-[#10251c]/45 p-5 backdrop-blur-sm"><form action={saveSystem} className="card w-full max-w-md bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><div className="eyebrow">Power system</div><h2 className="mt-2 text-xl font-extrabold">{editing === "new" ? "Add a system" : "Edit system"}</h2></div><button type="button" onClick={() => setEditing(undefined)}><X size={18}/></button></div>{error && <div className="mt-4 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">{error}</div>}<div className="mt-5 space-y-4"><label className="text-xs font-bold">System name<input name="name" required defaultValue={editing === "new" ? "" : editing.name} className="field" placeholder="e.g. Main house"/></label><label className="text-xs font-bold">System type<select name="projectType" defaultValue={editing === "new" ? "off-grid" : editing.projectType} className="field"><option value="off-grid">Off-grid</option><option value="hybrid">Hybrid</option><option value="grid-tied">Grid-tied</option></select></label></div><button disabled={saving} className="mt-6 h-11 w-full rounded-xl bg-brand text-xs font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save power system"}</button></form></div>}
  </div>;
}
