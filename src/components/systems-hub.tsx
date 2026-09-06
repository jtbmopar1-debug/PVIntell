"use client";

import { Activity, ArrowRight, CheckCircle2, ClipboardCheck, FileSearch, LayoutDashboard, MapPin, Menu, Network, Package, Ruler, Sparkles, Trash2, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { allHowToGuides, UniversalHowToMenu } from "@/components/pvintell-workspace";
import type { Site, SystemSummary } from "@/domain/models";

type SystemsHubProps = {
  sites: Site[];
  systems: SystemSummary[];
  drafts: Array<{ id: string; siteId?: string; name: string; status: string; questionId?: string | null }>;
  selectedSiteId?: string;
};

const operationalPhases = new Set(["monitor", "diagnose", "maintain", "explain"]);

function actionHref(system: SystemSummary, action: string) {
  const root = `/sites/${system.siteId}/systems/${system.id}`;
  if (action === "schematic") return `${root}/schematic`;
  if (action === "design") return `${root}/design`;
  if (action === "proposed-schematic") return `${root}/design/schematic`;
  if (action === "as-built") return `${root}?view=system`;
  if (action === "overview") return root;
  return `${root}?view=${action}`;
}

const installedActions = [
  ["overview", "Overview", "System specifications at a glance.", LayoutDashboard],
  ["as-built", "System Overview", "Full specifications and as-built records.", Package],
  ["schematic", "Schematic", "Connections and system layout.", Network],
  ["monitor", "Monitor", "Performance, diagnostics and upkeep.", Activity],
] as const;

const discoveryActions = [
  ["setup", "Discovery", "Needs, site constraints and known equipment.", FileSearch],
  ["design", "System Overview", "Discovery-prefilled sizing and planning numbers.", Ruler],
  ["proposed-schematic", "System schematic", "The working proposal and component centrepoint.", Network],
  ["build", "Build It", "Installation guidance, routes and records.", Wrench],
  ["commission", "Commission", "Checks and results before service.", ClipboardCheck],
] as const;

export function SystemsHub({ sites, systems, drafts, selectedSiteId }: SystemsHubProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? sites[0];
  const visibleSystems = selectedSite ? systems.filter((system) => system.siteId === selectedSite.id) : systems;
  const visibleDrafts = selectedSite ? drafts.filter((draft) => !draft.siteId || draft.siteId === selectedSite.id) : drafts;
  const localDate = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: selectedSite?.timezone ?? "UTC" }).format(new Date());

  async function askGuide(guide: (typeof allHowToGuides)[number], question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) {
    const response = await fetch("/api/wattson/guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question, siteId: selectedSite?.id, guide, recentConversation, guideIndex: allHowToGuides.map(({ id, title, group, aliases }) => ({ id, title, group, aliases })) }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
    return body;
  }

  const siteQuery = selectedSite ? `?site=${selectedSite.id}` : "";
  async function remove(kind: "system" | "draft", id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This permanently removes ${kind === "draft" ? "this unfinished discovery" : "this system and all of its records"}.`)) return;
    const response = await fetch(kind === "draft" ? `/api/discovery/drafts/${id}` : `/api/systems/${id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { window.alert(body.error ?? "Could not delete this item."); return; }
    router.refresh();
  }
  return <div className="min-h-screen bg-canvas text-ink">
    <header className="sticky top-0 z-40 border-b border-line bg-white/98 shadow-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:px-6">
        <Link href={`/dashboard${siteQuery}`} className="shrink-0"><BrandLogo/></Link>
        {sites.length ? <details className="relative shrink-0"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-[#f6f9fc] px-3 py-2 text-[11px] font-bold text-brand"><MapPin size={13}/><span className="max-w-36 truncate">{selectedSite?.name}</span></summary><div className="absolute left-0 top-11 z-50 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl">{sites.map((site) => <Link key={site.id} href={`/systems?site=${site.id}`} className={`block rounded-xl px-3 py-2 text-[11px] font-bold ${site.id === selectedSite?.id ? "bg-[#fff2b8] text-brand" : "text-muted hover:bg-[#eef3f8]"}`}>{site.name}</Link>)}</div></details> : null}
        <div className="hidden min-w-0 flex-1 md:block"><div className="truncate text-xs font-extrabold">{selectedSite?.location ?? "Your systems"}</div><div className="mt-0.5 text-[9px] font-semibold text-muted">{localDate}</div></div>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          <Link href={`/dashboard${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Dashboard</Link>
          <Link href={`/systems${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Systems</Link>
          <UniversalHowToMenu location={selectedSite?.location ?? ""} onAsk={askGuide}/>
          <Link href={`/settings${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Settings</Link>
        </nav>
        <button type="button" onClick={() => setMenuOpen((open) => !open)} className="ml-auto grid size-9 place-items-center rounded-xl border border-line bg-white text-muted md:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X size={17}/> : <Menu size={18}/>}</button>
      </div>
      {menuOpen ? <nav className="grid gap-1 border-t border-line p-3 md:hidden"><Link href={`/dashboard${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Dashboard</Link><Link href={`/systems${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Systems</Link><div className="rounded-lg text-xs font-bold text-brand"><UniversalHowToMenu location={selectedSite?.location ?? ""} onAsk={askGuide}/></div><Link href={`/settings${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Settings</Link></nav> : null}
    </header>

    <main className="mx-auto max-w-[1180px] p-4 pb-20 md:p-5">
      <div>
        <div><div className="eyebrow">{selectedSite ? `Systems at ${selectedSite.name}` : "Your power systems"}</div><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em]">Systems</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-muted">Open the tools that belong to each system. Installed systems stay focused on records and operation; active projects retain their discovery, design and build path.</p></div>
      </div>

      <section className="mt-5 grid gap-3">
        {visibleDrafts.map((draft) => <article key={`draft-${draft.id}`} className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[linear-gradient(105deg,#eef5fc,#fff8d9)] p-3"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#fff0a9] text-brand"><Sparkles size={20}/></span><div><h2 className="font-display text-lg font-extrabold">{draft.name}</h2><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-muted">Discovery in progress · not yet proposed</p></div></div><div className="flex items-center gap-2"><Link href={`/discovery/new-system?draft=${draft.id}`} className="flex items-center gap-2 text-[11px] font-bold text-brand">Continue discovery <ArrowRight size={14}/></Link><button type="button" onClick={() => void remove("draft", draft.id, draft.name)} className="grid size-8 place-items-center rounded-lg border border-[#e7b7af] text-[#a7442d]" aria-label={`Delete ${draft.name}`}><Trash2 size={14}/></button></div></div><div className="p-2"><Link href={`/discovery/new-system?draft=${draft.id}`} className="flex min-h-14 items-center gap-2.5 rounded-lg border border-line bg-white px-2.5 py-2"><span className="grid size-8 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><FileSearch size={15}/></span><span><strong className="block text-[11px]">Discovery</strong><span className="text-[9px] text-muted">Return to the exact question where you stopped.</span></span><ArrowRight size={12} className="ml-auto text-[#9aabba]"/></Link></div></article>)}
        {visibleSystems.map((system) => {
          const installed = operationalPhases.has(system.phase);
          const actions = installed ? installedActions : discoveryActions;
          return <article key={system.id} className="card overflow-hidden">
            <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-line p-3 ${installed ? "bg-[linear-gradient(105deg,#eef7f2,#ffffff)]" : "bg-[linear-gradient(105deg,#eef5fc,#fff8d9)]"}`}>
              <div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-2xl ${installed ? "bg-[#dff3e8] text-[#20724b]" : "bg-[#fff0a9] text-brand"}`}>{installed ? <Activity size={20}/> : <Sparkles size={20}/>}</span><div><h2 className="font-display text-lg font-extrabold">{system.name}</h2><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-muted">{installed ? "Installed · commissioned" : `Active project · ${system.phase}`} · {system.projectType}</p></div></div>
              <div className="flex items-center gap-2"><Link href={actionHref(system, installed ? "overview" : system.phase === "discover" ? "setup" : "proposed-schematic")} className="flex items-center gap-2 text-[11px] font-bold text-brand">Open system <ArrowRight size={14}/></Link><button type="button" onClick={() => void remove("system", system.id, system.name)} className="grid size-8 place-items-center rounded-lg border border-[#e7b7af] text-[#a7442d]" aria-label={`Delete ${system.name}`}><Trash2 size={14}/></button></div>
            </div>
            <div className={`grid gap-2 p-2 sm:grid-cols-2 ${installed ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              {actions.map(([id, title, detail, Icon]) => { const complete = system.completedAreas?.includes(id); return <Link key={id} href={actionHref(system, id)} className={`group flex min-h-14 items-center gap-2.5 rounded-lg border px-2.5 py-2 ${complete ? "border-[#9bd2ad] bg-[#f2fbf5]" : "border-line bg-white hover:border-[#8ab0d2] hover:bg-[#f8fbfe]"}`}><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${complete ? "bg-[#dff3e8] text-[#17603b]" : "bg-[#eaf2fb] text-brand"}`}>{complete ? <CheckCircle2 size={16}/> : <Icon size={15}/>}</span><span className="min-w-0"><strong className="block text-[11px] leading-4">{title}</strong><span className="block truncate text-[9px] leading-4 text-muted">{complete ? "Complete" : detail}</span></span><ArrowRight size={12} className="ml-auto shrink-0 text-[#9aabba] group-hover:text-brand"/></Link>; })}
            </div>
          </article>;
        })}
        {!visibleSystems.length && !visibleDrafts.length ? <div className="card p-4 md:p-6"><h2 className="font-display text-lg font-extrabold">No systems at this Site yet</h2><p className="mt-2 text-xs text-muted">Start a system to plan something new, or use Record installed equipment from the dashboard for an installation already in place.</p><Link href="/discovery/new-system" className="mt-5 block min-h-36 rounded-2xl border border-[#e5b92e] bg-[#f6c945] p-5 transition hover:-translate-y-0.5 hover:bg-[#f9d65b] hover:shadow-md md:p-6"><span className="flex items-center justify-between gap-3"><strong className="text-base text-brand">Start a new system</strong><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/55 text-brand"><ArrowRight size={17}/></span></span><span className="mt-3 block max-w-xl text-xs leading-5 text-[#3f5870]">Build and design a system with Wattson’s help.</span></Link></div> : null}
      </section>
    </main>
  </div>;
}
