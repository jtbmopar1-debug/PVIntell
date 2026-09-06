"use client";

import { ArrowLeft, ChevronRight, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { allHowToGuides, type NoviceHowToGuide } from "@/components/pvintell-workspace";

function GuideList({ title, items }: { title: string; items?: readonly string[] }) {
  if (!items?.length) return null;
  return <section className="rounded-xl border border-line bg-white p-4"><h3 className="text-sm font-extrabold">{title}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-muted">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand"/>{item}</li>)}</ul></section>;
}

export function HowToLibrary({ siteId, siteName, location }: { siteId?: string; siteName?: string; location?: string }) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const siteQuery = siteId ? `?site=${siteId}` : "";
  const selected = allHowToGuides.find((guide) => guide.id === selectedId);
  const sections = useMemo(() => Array.from(new Set(allHowToGuides.map((guide) => guide.group))).sort(), []);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allHowToGuides.filter((guide) => {
      if (section && guide.group !== section) return false;
      if (!needle) return true;
      return [guide.title, guide.group, guide.summary, ...(guide.aliases ?? []), ...(guide.keywords ?? [])].join(" ").toLowerCase().includes(needle);
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [query, section]);

  return <div className="min-h-screen bg-canvas text-ink">
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-4 md:px-6">
        <Link href={`/dashboard${siteQuery}`} className="shrink-0"><BrandLogo/></Link>
        <div className="hidden min-w-0 flex-1 sm:block"><strong className="block truncate text-xs">How-to library</strong><span className="block truncate text-[10px] text-muted">{siteName ? `${siteName} · ` : ""}{location ?? "Practical solar guidance"}</span></div>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary navigation"><Link href={`/dashboard${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Dashboard</Link><Link href={`/systems${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Systems</Link><Link href={`/how-to${siteQuery}`} aria-current="page" className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">How to</Link><Link href={`/settings${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Settings</Link></nav>
        <button type="button" onClick={() => setMenuOpen((open) => !open)} className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-brand md:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X size={18}/> : <Menu size={19}/>}</button>
      </div>
      {menuOpen ? <nav className="grid gap-1 border-t border-line p-3 md:hidden"><Link href={`/dashboard${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">Dashboard</Link><Link href={`/systems${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">Systems</Link><Link href={`/how-to${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">How to</Link><Link href={`/settings${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">Settings</Link></nav> : null}
    </header>

    <main className="mx-auto max-w-[1180px] p-4 pb-20 md:p-6">
      {selected ? <GuideDetail guide={selected} back={() => setSelectedId("")}/> : <>
        <div className="mb-5 overflow-hidden rounded-2xl bg-cover bg-center p-5 text-white shadow-[0_12px_30px_rgba(12,39,65,.16)] sm:p-7" style={{ backgroundImage: "linear-gradient(90deg, rgba(8,35,58,.94), rgba(8,35,58,.68)), url('/backgrounds/vilkasss-ai-generated-8897488_1920.jpg')" }}><div className="eyebrow text-[#ffd44f]">Solar knowledge base</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em] sm:text-3xl">How can we help?</h1><p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/90">Search the full library or choose a section. Guides now open here with room to read comfortably on phones.</p></div>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-white px-4 shadow-sm"><Search size={18} className="shrink-0 text-brand"/><span className="sr-only">Search the How-to library</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search panels, batteries, MC4, mounting…" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"/></label>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2"><button type="button" onClick={() => setSection("")} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${!section ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"}`}>All guides</button>{sections.map((name) => <button key={name} type="button" onClick={() => setSection(name)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${section === name ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"}`}>{name}</button>)}</div>
        <div className="mt-5 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold">{section || (query ? "Search results" : "All guides")}</h2><span className="text-xs font-bold text-muted">{visible.length} guides</span></div>
        {visible.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((guide) => <button key={guide.id} type="button" onClick={() => setSelectedId(guide.id)} className="card group flex min-h-28 items-center gap-3 p-3 text-left"><span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white p-1"><img src={guide.image} alt="" className="max-h-full max-w-full object-contain"/></span><span className="min-w-0 flex-1"><span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-muted">{guide.group}</span><strong className="mt-1 block text-sm leading-5 text-ink">{guide.title}</strong><span className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{guide.summary}</span></span><ChevronRight size={16} className="shrink-0 text-brand"/></button>)}</div> : <div className="card mt-3 p-8 text-center text-sm text-muted">No guide matches that search.</div>}
      </>}
    </main>
  </div>;
}

function GuideDetail({ guide, back }: { guide: NoviceHowToGuide; back: () => void }) {
  return <article className="mx-auto max-w-4xl">
    <button type="button" onClick={back} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-brand"><ArrowLeft size={16}/> Back to guides</button>
    <div className="card overflow-hidden"><div className="grid gap-5 p-4 sm:grid-cols-[220px_1fr] sm:p-6"><div className="flex min-h-44 items-center justify-center rounded-xl border border-line bg-white p-3"><img src={guide.image} alt={`Reference for ${guide.title}`} className="max-h-64 max-w-full object-contain"/></div><div><div className="eyebrow">{guide.group}</div><h1 className="mt-2 font-display text-2xl font-extrabold">{guide.title}</h1><p className="mt-3 text-sm leading-6 text-muted">{guide.summary}</p></div></div>
      <div className="space-y-4 border-t border-line p-4 sm:p-6">{(guide.whatItIs || guide.whatItDoes) ? <div className="grid gap-3 sm:grid-cols-2">{guide.whatItIs ? <section className="rounded-xl border border-line bg-white p-4"><h3 className="text-sm font-extrabold">What is this?</h3><p className="mt-2 text-sm leading-6 text-muted">{guide.whatItIs}</p></section> : null}{guide.whatItDoes ? <section className="rounded-xl border border-line bg-white p-4"><h3 className="text-sm font-extrabold">What does it do?</h3><p className="mt-2 text-sm leading-6 text-muted">{guide.whatItDoes}</p></section> : null}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><GuideList title="What to buy" items={guide.buy}/><GuideList title="Tools" items={guide.tools}/><GuideList title="Before you start" items={guide.before}/></div>
        <section><h2 className="text-base font-extrabold">Put it together</h2><ol className="mt-3 grid gap-3 sm:grid-cols-2">{guide.steps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-3 rounded-xl border border-line bg-white p-4 text-sm leading-6"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{index + 1}</span>{step}</li>)}</ol></section>
        <GuideList title="Final checks" items={guide.checks}/>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">{guide.sourceUrl ? <a href={guide.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">Open detailed source →</a> : null}<p className="text-xs leading-5 text-muted">Source: {guide.source}</p></div>
      </div>
    </div>
  </article>;
}
