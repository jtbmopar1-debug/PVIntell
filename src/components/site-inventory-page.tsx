"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  CloudSun,
  LayoutDashboard,
  MapPin,
  Menu,
  MoreHorizontal,
  Package,
  Settings2,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SolarWeather } from "@/components/solar-weather";
import { UniversalHowToMenu } from "@/components/pvintell-workspace";
import type { Site, SiteEquipment, SystemSummary } from "@/domain/models";

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-[11px] bg-[#f6c945] text-[#143c63]">
        <Zap size={19} fill="currentColor" />
      </span>
      <div>
        <div className="font-display text-[17px] font-extrabold tracking-[-.04em]">
          PVIntell
        </div>
        <div className="text-[9px] font-bold uppercase tracking-[.18em] text-muted">
          Power, made clear
        </div>
      </div>
    </div>
  );
}

const systemNavigation = [
  ["equipment", "Site equipment", Package],
  ["weather", "Solar weather", CloudSun],
  ["system", "As-built record", LayoutDashboard],
] as const;

export function SiteInventoryPage({
  site,
  sites,
  initialSystems,
  equipment,
  email,
  weatherMode = false,
  solarArrayKw = 0,
}: {
  site: Site;
  sites: Site[];
  initialSystems: SystemSummary[];
  equipment: SiteEquipment[];
  email: string;
  weatherMode?: boolean;
  solarArrayKw?: number;
}) {
  const router = useRouter();
  const [systems, setSystems] = useState(initialSystems);
  const [editing, setEditing] = useState<SystemSummary | "new">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [choosingView, setChoosingView] = useState<string>();
  const [expandedSiteId, setExpandedSiteId] = useState(site.id);
  const available = equipment.filter((item) => !item.assignedProjectId);
  const assigned = equipment.length - available.length;
  const systemHref = (systemId: string, view: string) =>
    view === "schematic"
      ? `/sites/${site.id}/systems/${systemId}/schematic`
      : view === "design"
        ? `/sites/${site.id}/systems/${systemId}/design`
      : `/sites/${site.id}/systems/${systemId}?view=${view}`;

  async function saveSystem(formData: FormData) {
    setSaving(true);
    setError("");
    const payload = {
      siteId: site.id,
      name: formData.get("name"),
      projectType: formData.get("projectType"),
      startingGoal: formData.get("startingGoal"),
    };
    try {
      const response = await fetch(
        editing === "new" ? "/api/systems" : `/api/systems/${editing?.id}`,
        {
          method: editing === "new" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Could not save power system");
      setEditing(undefined);
      if (editing === "new") router.push(`/sites/${site.id}/systems/${body.id}?view=wattson`);
      else router.refresh();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not save power system",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeSystem(system: SystemSummary) {
    if (
      !window.confirm(
        `Delete ${system.name}? This also removes its design, equipment records, Wattson history and monitoring data. This cannot be undone.`,
      )
    )
      return;
    const response = await fetch(`/api/systems/${system.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      window.alert(body.error ?? "Could not delete system");
      return;
    }
    setSystems((current) => current.filter((item) => item.id !== system.id));
    router.refresh();
  }

  function openSystemView(view: string) {
    if (!systems.length) {
      router.push("/dashboard#wattson");
      return;
    }
    if (systems.length === 1) {
      router.push(systemHref(systems[0].id, view));
      return;
    }
    setChoosingView(view);
  }

  return (
    <div className="min-h-screen">
      <aside
        className="hidden"
      >
        <div className="flex h-12 items-center justify-between px-2">
          <Logo />
          <button className="lg:hidden" onClick={() => setMenu(false)}>
            <X size={18} />
          </button>
        </div>
        <Link
          href="/discovery/new-system"
          className="mt-5 flex items-center gap-3 rounded-xl bg-[#f6c945] px-3 py-3 text-xs font-extrabold text-[#143c63]"
        >
          <Zap size={16} />
          New independent Site<span className="ml-auto">›</span>
        </Link>
        <button
          onClick={() => router.push(`/sites/${site.id}/wattson`)}
          className="mt-2 flex items-center gap-3 rounded-xl bg-brand px-3 py-3 text-xs font-bold text-white"
        >
          <Zap size={16} />
          Continue project<span className="ml-auto">›</span>
        </button>
        <div className="mt-5 rounded-2xl border border-line bg-white p-2">
          <div className="px-2 py-1">
            <div className="eyebrow text-[#7b8a9c]">My sites</div>
          </div>
          <div className="mt-2 space-y-1">
            {sites.map((item) => {
              const active = item.id === site.id;
              const expanded = expandedSiteId === item.id;
              const className = `flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold ${active ? "bg-[#fff6cf] text-brand" : "text-muted hover:bg-[#eef3f8]"}`;
              return <div key={item.id} className="space-y-0.5">
                <button type="button" onClick={() => active ? setExpandedSiteId(expanded ? "" : item.id) : router.push(`/sites/${item.id}`)} className={className}><MapPin size={12}/><span className="min-w-0 flex-1 truncate">{item.name}</span>{expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button>
                {expanded && <div className="ml-4 space-y-0.5 border-l border-[#dbe5ef] pl-2"><Link href={`/sites/${item.id}`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Project home</Link><Link href={`/sites/${item.id}/discovery`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Discovery brief</Link>{active && <><Link href={`/sites/${item.id}/wattson`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Continue with Wattson</Link>{systems.length === 1 ? <Link href={systemHref(systems[0].id, "design")} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#b9412b] hover:bg-[#fff1ee]">Proposed design</Link> : <button onClick={() => openSystemView("design")} className="flex w-full rounded-lg px-2 py-1.5 text-left text-[10px] font-bold text-[#b9412b] hover:bg-[#fff1ee]">Proposed design</button>}{systems.length === 1 ? <Link href={systemHref(systems[0].id, "build")} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Build record</Link> : <button onClick={() => openSystemView("build")} className="flex w-full rounded-lg px-2 py-1.5 text-left text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Build record</button>}</>}</div>}
              </div>;
            })}
          </div>
        </div>
        <nav className="mt-5 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"
          >
            <LayoutDashboard size={17} />
            All sites
          </Link>
          <div className="px-3 pt-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#7b8a9c]">Site tools</div>
          {systemNavigation.map(([view, label, Icon]) =>
            view === "weather" ? (
              weatherMode ? <div key={view} className="flex w-full items-center gap-3 rounded-xl border-l-4 border-[#f6c945] bg-[#fff6cf] px-3 py-2.5 text-left text-sm font-semibold text-[#143c63]"><Icon size={17}/>{label}</div> : <Link
                key={view}
                prefetch={false}
                href={`/sites/${site.id}/weather`}
                className="flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-left text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"
              ><Icon size={17} />{label}</Link>
            ) : (
              <button
                key={view}
                onClick={() => openSystemView(view)}
                className="flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-left text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"
              >
                <Icon size={17} />
                {label}
              </button>
            ),
          )}
          <Link href="/glossary" className="flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-left text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"><BookOpen size={17}/>Glossary</Link>
        </nav>
        <div className="mt-auto rounded-2xl border border-line bg-white p-3.5">
          <div className="text-xs font-bold">Cloud data saved</div>
          <p className="mt-2 truncate text-[10px] text-muted">{email}</p>
          <form action="/auth/signout" method="post">
            <button className="mt-3 text-[10px] font-bold text-brand">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="sticky top-0 z-50 border-b border-line bg-[rgba(248,250,252,.96)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:px-6"><Link href="/dashboard" className="shrink-0"><Logo/></Link><details className="relative shrink-0"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold text-brand"><MapPin size={13}/><span className="max-w-36 truncate">{site.name}</span><ChevronDown size={13}/></summary><div className="absolute left-0 top-11 z-50 w-64 rounded-2xl border border-line bg-white p-3 shadow-xl"><div className="eyebrow px-2 pb-2">My Sites</div>{sites.map((item) => <Link key={item.id} href={`/sites/${item.id}`} className={`block rounded-xl px-3 py-2 text-[11px] font-bold ${item.id === site.id ? "bg-[#fff6cf] text-brand" : "text-muted hover:bg-[#eef3f8]"}`}>{item.name}</Link>)}<Link href="/discovery/new-system" className="mt-3 block rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-[#143c63]">New independent Site</Link></div></details><div className="min-w-0 flex-1"><div className="eyebrow text-[8px]">Site workspace</div><div className="mt-1 truncate text-xs font-extrabold">{site.name} <span className="font-medium text-muted">· {site.location}</span></div></div><Link href={`/sites/${site.id}/wattson`} className="hidden h-9 items-center gap-2 rounded-xl bg-brand px-4 text-[11px] font-bold text-white sm:flex"><Zap size={14}/>Ask Wattson</Link><UniversalHowToMenu location={site.location} onAsk={(guide) => { sessionStorage.setItem("pvintell:wattson-prompt", `Show me how to work with ${guide.title}. Explain what it is, what it does, where it connects, and guide me one simple step at a time.`); router.push(systems.length === 1 ? systemHref(systems[0].id, "wattson") : `/sites/${site.id}/wattson`); }}/><Link href="/account" className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted"><Settings2 size={16}/></Link></div>
          <nav className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-1 border-t border-line px-4 py-2 md:px-6"><Link href="/dashboard" className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">All Sites</Link><Link href={`/sites/${site.id}`} className="rounded-xl bg-[#fff6cf] px-3 py-2 text-[11px] font-bold text-brand">Overview</Link><Link href={`/sites/${site.id}/discovery`} className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Discovery</Link><button type="button" onClick={() => openSystemView("design")} className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Proposed design</button><button type="button" onClick={() => openSystemView("build")} className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Build</button><button type="button" onClick={() => openSystemView("system")} className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Records</button><Link href={`/sites/${site.id}/weather`} className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Solar weather</Link><form action="/auth/signout" method="post" className="ml-auto"><button className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Sign out</button></form></nav>
        </header>
        <div className="mx-auto max-w-[1220px] space-y-8 p-5 md:p-8">
          {weatherMode ? (
            <SolarWeather site={site} solarArrayKw={solarArrayKw} />
          ) : (
            <>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="eyebrow">Site overview</div>
                  <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">
                    {site.name} project workspace
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                    This Site is one independent project. Discovery, the proposed design, Wattson’s guidance and the as-built record all stay together here.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/sites/${site.id}/wattson`} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-xs font-bold text-brand">
                    <Zap size={15} />
                    Continue project with Wattson
                  </Link>
                  <Link href={`/sites/${site.id}/discovery`} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-xs font-bold text-brand">
                    <ClipboardCheck size={15} />
                    Review discovery
                  </Link>
                  <Link href="/discovery/new-system" className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white">
                    <Zap size={15} />
                    Start a new independent Site
                  </Link>
                </div>
              </div>
              <section className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                  <div><div className="eyebrow">Your project path</div><h2 className="mt-2 text-lg font-extrabold">Where you are: plan first, then build</h2><p className="mt-1 text-xs leading-5 text-muted">Keep this Site’s discovery, Wattson conversation, proposed design and as-built record together here.</p></div>
                  <Link href={`/sites/${site.id}/wattson`} className="text-xs font-bold text-brand">Continue with Wattson →</Link>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Link href={`/sites/${site.id}/discovery`} className="rounded-xl border border-line p-4 hover:border-[#7aa6d1]"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-brand">1 · Discovery</div><strong className="mt-2 block text-sm">Review your brief</strong><p className="mt-1 text-[10px] leading-4 text-muted">Confirm what this independent Site needs.</p></Link>
                  {systems.length === 1 ? <Link href={systemHref(systems[0].id, "design")} className="rounded-xl border border-[#ecaaa0] bg-[#fff7f5] p-4 hover:border-[#d56e61]"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#b9412b]">2 · Proposed design</div><strong className="mt-2 block text-sm">See Wattson’s plan</strong><p className="mt-1 text-[10px] leading-4 text-muted">Proposed only — nothing here is installed.</p></Link> : <button onClick={() => openSystemView("design")} className="rounded-xl border border-[#ecaaa0] bg-[#fff7f5] p-4 text-left hover:border-[#d56e61]"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#b9412b]">2 · Proposed design</div><strong className="mt-2 block text-sm">See Wattson’s plan</strong><p className="mt-1 text-[10px] leading-4 text-muted">Choose the technical record for this proposal.</p></button>}
                  {systems.length === 1 ? <Link href={systemHref(systems[0].id, "build")} className="rounded-xl border border-line p-4 hover:border-[#7aa6d1]"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-brand">3 · Build record</div><strong className="mt-2 block text-sm">Record what exists</strong><p className="mt-1 text-[10px] leading-4 text-muted">Only add equipment after it is actually selected or installed.</p></Link> : <button onClick={() => openSystemView("build")} className="rounded-xl border border-line p-4 text-left hover:border-[#7aa6d1]"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-brand">3 · Build record</div><strong className="mt-2 block text-sm">Record what exists</strong><p className="mt-1 text-[10px] leading-4 text-muted">Choose the technical record to open.</p></button>}
                </div>
              </section>
              {site.discoveryNeedsReview && <div className="rounded-2xl border border-[#f1ce71] bg-[#fff9df] p-4 text-sm leading-6 text-[#725800]">Site discovery has changed. Review this Site’s proposed system designs, requirements and schematic before continuing.</div>}
              {systems.length ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {systems.map((system) => (
                    <article key={system.id} className="card p-5">
                      <div className="flex items-start justify-between">
                        <span className="grid size-10 place-items-center rounded-xl bg-[#eaf2fb] text-brand">
                          <Zap size={18} />
                        </span>
                        <button
                          onClick={() => setEditing(system)}
                          aria-label={`Edit ${system.name}`}
                          className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-[#eef3f8]"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                      <h2 className="mt-5 text-base font-bold">
                        {system.name}
                      </h2>
                      <div className="mt-2 flex gap-2">
                        <span className="rounded-full bg-[#edf2f7] px-2 py-1 text-[9px] font-bold uppercase">
                          {system.projectType}
                        </span>
                        <span className="rounded-full bg-[#fff1cf] px-2 py-1 text-[9px] font-bold uppercase text-[#8b6512]">
                          {system.phase}
                        </span>
                      </div>
                      <Link
                        href={`/sites/${site.id}/systems/${system.id}`}
                        className="mt-5 grid h-11 place-items-center rounded-xl bg-brand text-xs font-bold text-white"
                      >
                        Open system
                      </Link>
                      <button
                        onClick={() => void removeSystem(system)}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-bold text-[#9b4033]"
                      >
                        <Trash2 size={13} />
                        Delete system
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="card grid min-h-64 place-items-center p-8 text-center">
                  <div>
                    <Zap className="mx-auto text-brand" />
                    <h2 className="mt-4 text-lg font-bold">
                      No power systems yet
                    </h2>
                    <p className="mt-2 text-xs text-muted">
                      Add Main house, Studio, Workshop or any independent system
                      at this property.
                    </p>
                    <button
                      onClick={() => setEditing("new")}
                      className="mt-5 rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white"
                    >
                      Add the first system
                    </button>
                  </div>
                </div>
              )}
              <section>
                <div className="eyebrow">Other equipment at this site</div>
                <h2 className="mt-2 text-xl font-extrabold">
                  Spare or not yet assigned
                </h2>
                <p className="mt-2 text-xs text-muted">
                  This is separate from the installed equipment inside each
                  power system. {available.length} available item
                  {available.length === 1 ? "" : "s"}
                  {assigned ? ` · ${assigned} already assigned` : ""}.
                </p>
                {available.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {available.map((item) => (
                      <div key={item.id} className="card p-4">
                        <div className="text-xs font-bold">{item.name}</div>
                        <div className="mt-1 text-[10px] text-muted">
                          {[item.manufacturer, item.model]
                            .filter(Boolean)
                            .join(" · ") || item.type}{" "}
                          · Qty {item.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      {choosingView && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0b2740]/45 p-5 backdrop-blur-sm">
          <div className="card w-full max-w-md bg-white p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <div className="eyebrow">Choose a system</div>
                <h2 className="mt-2 text-xl font-extrabold">
                  Where are you working?
                </h2>
              </div>
              <button
                onClick={() => setChoosingView(undefined)}
                aria-label="Close system picker"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {systems.map((system) => (
                <Link
                  key={system.id}
                  href={systemHref(system.id, choosingView)}
                  className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-bold hover:border-[#7aa6d1] hover:bg-[#eff5fa]"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-[#eaf2fb] text-brand">
                    <Zap size={16} />
                  </span>
                  {system.name}
                  <span className="ml-auto text-brand">›</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 grid items-start justify-items-center overflow-y-auto overscroll-contain bg-[#0b2740]/45 p-3 backdrop-blur-sm sm:p-5">
          <form
            action={saveSystem}
            className={`card my-2 max-h-[calc(100dvh-1rem)] w-full overflow-y-auto overscroll-contain bg-white p-5 shadow-2xl sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6 ${editing === "new" ? "max-w-2xl" : "max-w-md"}`}
          >
            <div className="flex justify-between">
              <div>
                <div className="eyebrow">{editing === "new" ? "Wattson setup" : "Power system"}</div>
                <h2 className="mt-2 text-xl font-extrabold">
                  {editing === "new" ? "Tell me what you’re working with" : "Edit system"}
                </h2>
              </div>
              <button type="button" onClick={() => setEditing(undefined)}>
                <X size={18} />
              </button>
            </div>
            {error && (
              <div className="mt-4 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">
                {error}
              </div>
            )}
            {editing === "new" && <p className="mt-3 text-xs leading-5 text-muted">No solar terminology needed. Your answers let me organise the setup correctly, and we can change them later.</p>}
            <div className="mt-5 space-y-5">
              <label className="text-xs font-bold">
                {editing === "new" ? "What should we call this power setup?" : "System name"}
                <input
                  name="name"
                  required
                  defaultValue={editing === "new" ? "" : editing.name}
                  className="field"
                  placeholder="e.g. Main house"
                />
              </label>
              {editing === "new" ? <>
                <fieldset><legend className="text-xs font-bold">What are you trying to do first?</legend><div className="mt-2 grid gap-2">
                  {[
                    ["Record equipment that is already installed", "Help me understand or document what is here now."],
                    ["Plan a new power setup", "Work out what I need before buying or building."],
                    ["Improve or expand an existing setup", "Add capacity, replace equipment or improve how it runs."],
                    ["Find a problem", "Help me understand faults or unexpected behaviour."],
                  ].map(([value, detail]) => <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 text-xs hover:border-[#7aa6d1]"><input type="radio" name="startingGoal" value={value} required className="mt-0.5 accent-[#165d9c]"/><span><strong>{value}</strong><span className="mt-1 block text-[10px] leading-4 text-muted">{detail}</span></span></label>)}
                </div></fieldset>
                <fieldset><legend className="text-xs font-bold">How does—or should—this place get electricity?</legend><div className="mt-2 grid gap-2">
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 text-xs hover:border-[#7aa6d1]"><input type="radio" name="projectType" value="off-grid" required className="mt-0.5 accent-[#165d9c]"/><span><strong>There is no normal electricity-company supply</strong><span className="mt-1 block text-[10px] leading-4 text-muted">Solar, batteries or a generator must provide the power.</span></span></label>
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 text-xs hover:border-[#7aa6d1]"><input type="radio" name="projectType" value="hybrid" required className="mt-0.5 accent-[#165d9c]"/><span><strong>There is an electricity supply, but I also want backup</strong><span className="mt-1 block text-[10px] leading-4 text-muted">Solar or batteries should keep selected things running during an outage.</span></span></label>
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 text-xs hover:border-[#7aa6d1]"><input type="radio" name="projectType" value="grid-tied" required className="mt-0.5 accent-[#165d9c]"/><span><strong>There is an electricity supply and I mainly want to use more solar</strong><span className="mt-1 block text-[10px] leading-4 text-muted">The aim is usually to reduce imported electricity; outage backup is not the starting goal.</span></span></label>
                </div></fieldset>
              </> : <label className="text-xs font-bold">System type<select name="projectType" defaultValue={editing.projectType} className="field"><option value="off-grid">Off-grid</option><option value="hybrid">Hybrid</option><option value="grid-tied">Grid-tied</option></select></label>}
            </div>
            <button
              disabled={saving}
              className="mt-6 h-11 w-full rounded-xl bg-brand text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : editing === "new" ? "Create this setup and continue with Wattson" : "Save power system"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
