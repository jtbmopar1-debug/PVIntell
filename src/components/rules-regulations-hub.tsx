"use client";

import { ArrowLeft, BookOpenCheck, ChevronRight, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { allHowToGuides } from "@/components/pvintell-workspace";

export type RulesHubSite = {
  id: string;
  name: string;
  location: string;
  locationConfirmed: boolean;
};

export type RulesHubComponent = {
  id: string;
  siteId: string;
  systemId: string;
  systemName: string;
  kind: string;
  name: string;
};

type JurisdictionMatch = { label: string; level?: string; countryCode?: string; latitude: number; longitude: number; timezone: string };

export function RulesRegulationsHub({ sites, components, initialSiteId, homeLocation }: {
  sites: RulesHubSite[];
  components: RulesHubComponent[];
  initialSiteId?: string;
  homeLocation: string;
}) {
  const router = useRouter();
  const [siteId] = useState(initialSiteId ?? sites[0]?.id ?? "");
  const [homeJurisdiction, setHomeJurisdiction] = useState(homeLocation.trim());
  const jurisdictionOptions = useMemo(() => [homeJurisdiction].filter(Boolean), [homeJurisdiction]);
  const [jurisdiction, setJurisdiction] = useState(homeLocation.trim());
  const [customJurisdiction, setCustomJurisdiction] = useState("");
  const [jurisdictionMatches, setJurisdictionMatches] = useState<JurisdictionMatch[]>([]);
  const [searchingJurisdiction, setSearchingJurisdiction] = useState(false);
  const [jurisdictionError, setJurisdictionError] = useState("");
  const usingCustomJurisdiction = !jurisdictionOptions.includes(jurisdiction);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const siteComponents = useMemo(() => components.filter((component) => !needle || `${component.name} ${component.kind} ${component.systemName}`.toLowerCase().includes(needle)), [components, needle]);
  const libraryGuides = useMemo(() => allHowToGuides.filter((guide) => !needle || `${guide.title} ${guide.group} ${guide.summary} ${(guide.aliases ?? []).join(" ")}`.toLowerCase().includes(needle)), [needle]);
  const categories = useMemo(() => Array.from(new Set(libraryGuides.map((guide) => guide.group))).sort().map((category) => ({
    category,
    guides: libraryGuides.filter((guide) => guide.group === category).sort((left, right) => left.title.localeCompare(right.title)),
  })), [libraryGuides]);

  useEffect(() => {
    const savedLocation = homeLocation.trim();
    if (!savedLocation) return;
    const controller = new AbortController();
    void fetch(`/api/location/search?q=${encodeURIComponent(savedLocation)}&scope=jurisdiction`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { results: [] })
      .then((body) => {
        const regionalLabel = body.results?.[0]?.label;
        if (typeof regionalLabel !== "string" || !regionalLabel) return;
        setHomeJurisdiction(regionalLabel);
        setJurisdiction((current) => current === savedLocation ? regionalLabel : current);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [homeLocation]);

  useEffect(() => {
    const queryText = customJurisdiction.trim();
    if (!usingCustomJurisdiction || queryText.length < 2 || queryText === jurisdiction) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingJurisdiction(true);
      setJurisdictionError("");
      try {
        const response = await fetch(`/api/location/search?q=${encodeURIComponent(queryText)}&scope=jurisdiction`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not search jurisdictions");
        setJurisdictionMatches(body.results ?? []);
        if (!(body.results ?? []).length) setJurisdictionError("No matching jurisdiction found. Add the state/province and country.");
      } catch (problem) {
        if (!controller.signal.aborted) setJurisdictionError(problem instanceof Error ? problem.message : "Could not search jurisdictions");
      } finally {
        if (!controller.signal.aborted) setSearchingJurisdiction(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [customJurisdiction, jurisdiction, usingCustomJurisdiction]);

  function openComponent(component: RulesHubComponent) {
    router.push(`/settings/regulations?site=${component.siteId}&system=${component.systemId}&component=${component.id}&jurisdiction=${encodeURIComponent(jurisdiction)}`);
  }
  function openGuide(guideId: string) {
    if (!siteId || !jurisdiction) return;
    router.push(`/settings/regulations?site=${siteId}&guide=${encodeURIComponent(guideId)}&jurisdiction=${encodeURIComponent(jurisdiction)}`);
  }

  return <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 md:px-10 md:py-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/settings" className="mb-4 inline-flex min-h-10 items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/>Back to Settings</Link>
      <header className="rounded-2xl border border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-5 sm:p-7">
        <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><BookOpenCheck size={22}/></span><div><div className="eyebrow">Settings · Rules &amp; regulations</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em] sm:text-3xl">Local component rules</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Choose the jurisdiction you want to explore, then select recorded equipment or a component-library subject. Your saved location is the default, but you can investigate another country, state, province or local authority.</p></div></div>
      </header>

      <section className="card mt-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold">Jurisdiction<select value={usingCustomJurisdiction ? "__custom" : jurisdiction} onChange={(event) => { if (event.target.value === "__custom") { setJurisdiction(""); setCustomJurisdiction(""); } else { setJurisdiction(event.target.value); setJurisdictionMatches([]); } }} className="field mt-2">{jurisdictionOptions.map((location, index) => <option key={location} value={location}>{index === 0 && location === homeLocation.trim() ? `My location · ${location}` : location}</option>)}<option value="__custom">Another country, state or jurisdiction…</option></select>{usingCustomJurisdiction ? <span className="relative mt-2 block"><input autoFocus value={customJurisdiction} onChange={(event) => { setCustomJurisdiction(event.target.value); setJurisdiction(""); }} placeholder="Search state, province or country" role="combobox" aria-expanded={Boolean(jurisdictionMatches.length)} className="field mt-0"/>{searchingJurisdiction ? <span className="absolute right-3 top-3 text-[10px] font-semibold text-muted">Searching…</span> : null}{jurisdictionMatches.length ? <span className="absolute z-20 mt-1 block w-full overflow-hidden rounded-xl border border-line bg-white shadow-xl">{jurisdictionMatches.map((match) => <button key={`${match.label}-${match.latitude}-${match.longitude}`} type="button" onClick={() => { setCustomJurisdiction(match.label); setJurisdiction(match.label); setJurisdictionMatches([]); setJurisdictionError(""); }} className="block w-full border-t border-line px-3 py-2.5 text-left text-xs first:border-t-0 hover:bg-[#eef5fc]">{match.label}</button>)}</span> : null}{jurisdictionError ? <span className="mt-1 block text-[10px] font-normal text-[#913e31]">{jurisdictionError}</span> : null}{jurisdiction && jurisdiction === customJurisdiction ? <span className="mt-1 block text-[10px] font-normal text-[#17603b]">Selected: {jurisdiction}</span> : null}</span> : null}</label>
          <label className="text-xs font-bold">Find a component or application<span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3"><Search size={15} className="text-brand"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. underground AC cable, battery fuse" className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none"/></span></label>
        </div>
        {!jurisdiction ? <div className="mt-4 flex gap-2 rounded-xl border border-[#e6cc74] bg-[#fff9df] p-3 text-[11px] leading-5 text-[#624b14]"><MapPin size={15} className="mt-0.5 shrink-0"/><span>Select a country and, where applicable, its state, province or local jurisdiction before loading rules.</span></div> : null}
      </section>

      {siteComponents.length ? <details className="card group mt-6 overflow-hidden"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className="min-w-0 flex-1"><span className="eyebrow">Recorded equipment</span><strong className="mt-1 block text-lg">Your equipment</strong><span className="mt-1 block text-[10px] text-muted">{siteComponents.length} items across your systems</span></span><ChevronRight size={17} className="shrink-0 text-brand transition group-open:rotate-90"/></summary><div className="border-t border-line">{siteComponents.map((component) => <button key={component.id} type="button" disabled={!jurisdiction} onClick={() => openComponent(component)} className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-t-0 hover:bg-[#f5f9fc] disabled:opacity-50"><span className="min-w-0 flex-1"><strong className="block text-sm">{component.name}</strong><span className="mt-1 block text-[10px] text-muted">{component.systemName} · {component.kind.replaceAll("_", " ")}</span></span><ChevronRight size={16} className="shrink-0 text-brand"/></button>)}</div></details> : null}

      <section className="mt-7"><div className="eyebrow">Complete component library</div><h2 className="mt-2 text-lg font-extrabold">Categories and applications</h2><p className="mt-1 text-xs leading-5 text-muted">Choose a category, then the exact component or installation application. Underground cabling, for example, has different questions from cable lugs or exposed PV cable.</p><div className="mt-4 space-y-3">{categories.map(({ category, guides }) => <details key={category} className="card group overflow-hidden" open={Boolean(needle)}><summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4"><span className="min-w-0 flex-1"><strong className="text-sm">{category}</strong><span className="ml-2 text-[10px] font-bold text-muted">{guides.length} {guides.length === 1 ? "subcategory" : "subcategories"}</span></span><ChevronRight size={16} className="shrink-0 text-brand transition group-open:rotate-90"/></summary><div className="border-t border-line bg-[#fbfcfd]">{guides.map((guide) => <button key={guide.id} type="button" disabled={!siteId} onClick={() => openGuide(guide.id)} className="flex w-full items-center gap-3 border-t border-line px-5 py-3 text-left first:border-t-0 hover:bg-[#eef5fc] disabled:opacity-50"><span className="min-w-0 flex-1"><strong className="block text-xs">{guide.title}</strong><span className="mt-1 line-clamp-1 block text-[10px] text-muted">{guide.summary}</span></span><ChevronRight size={15} className="shrink-0 text-brand"/></button>)}</div></details>)}</div></section>
    </div>
  </main>;
}
