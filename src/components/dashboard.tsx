"use client";

import { ArrowRight, BookOpen, Bot, Calculator, CircleGauge, ClipboardCheck, CloudRain, CloudSun, Home, ImagePlus, LayoutDashboard, MapPin, Menu, Package, RotateCcw, Send, Settings2, Sparkles, Sun, Waypoints, Wrench, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Site, SystemSummary } from "@/domain/models";
import type { OnboardingAnswers } from "@/onboarding/assessment";
import { localDateKey, useSolarWeather } from "@/weather/use-solar-weather";
import { UniversalHowToMenu } from "@/components/pvintell-workspace";

type Profile = { displayName: string; location: string; timezone: string; assessment: OnboardingAnswers };

const dashboardSystemNavigation = [
  ["equipment", "Site equipment", Package],
  ["weather", "Solar weather", CloudSun],
  ["design", "Proposed design", Calculator],
  ["system", "As-built overview", LayoutDashboard],
  ["schematic", "As-built schematic", Waypoints],
  ["build", "Build", Wrench],
  ["commission", "Commission", ClipboardCheck],
  ["monitor", "Monitor", CircleGauge],
] as const;

export function Dashboard({ profile, sites, systems, solarBySite, initialMessages, conversationId, initialSiteId, autoStartProposal = false, email }: { profile: Profile; sites: Site[]; systems: SystemSummary[]; solarBySite: Record<string, number>; initialMessages: ChatMessage[]; conversationId?: string; initialSiteId?: string; autoStartProposal?: boolean; email: string }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [siteId, setSiteId] = useState(initialSiteId && sites.some((site) => site.id === initialSiteId) ? initialSiteId : sites[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File>();
  const [sending, setSending] = useState(false);
  const proposalStarted = useRef(false);
  const [choosingView, setChoosingView] = useState<string>();
  const selectedSite = sites.find((site) => site.id === siteId);
  const siteSystems = systems.filter((system) => system.siteId === siteId);
  const weather = useSolarWeather(selectedSite ?? { id: "none", name: "", location: "", timezone: profile.timezone, locationSource: "manual", locationConfirmed: false });
  const today = useMemo(() => {
    if (!selectedSite || !weather.data) return undefined;
    const key = localDateKey(new Date(), selectedSite.timezone);
    const hours = weather.data.hours.filter((hour) => localDateKey(new Date(hour.time), selectedSite.timezone) === key);
    const irradianceKwh = hours.reduce((sum, hour) => sum + Math.max(0, hour.irradiance ?? 0) / 1000, 0);
    const expected = irradianceKwh * (solarBySite[selectedSite.id] ?? 0) * 0.8;
    const peak = hours.reduce((best, hour) => (hour.irradiance ?? 0) > (best?.irradiance ?? -1) ? hour : best, hours[0]);
    return { expected, peak, rain: hours.reduce((sum, hour) => sum + Math.max(0, hour.precipitation ?? 0), 0), current: hours.find((hour) => new Date(hour.time) >= new Date()) ?? hours.at(-1), fetchedAt: weather.data.fetchedAt };
  }, [selectedSite, solarBySite, weather.data]);
  const nextSteps = useMemo(() => {
    const goals = profile.assessment.goals ?? [];
    const steps: Array<{ title: string; detail: string; href: string }> = [];
    steps.push({ title: "Start here", detail: "Set up a new Site or power system through the guided Discovery, Site, Needs and Design sequence.", href: "/discovery/new-system" });
    if (goals.includes("Record an as-built system") && systems[0]) steps.push({ title: "Record installed equipment", detail: "Add each inverter, battery, PV string and connection as it is actually installed.", href: `/sites/${systems[0].siteId}/systems/${systems[0].id}` });
    if (goals.includes("Understand what I already have") && systems[0]) steps.push({ title: "Build the system schematic", detail: "Map the equipment and connections so Wattson can understand the whole system.", href: `/sites/${systems[0].siteId}/systems/${systems[0].id}/schematic` });
    if (!steps.length && systems[0]) steps.push({ title: `Continue ${systems[0].name}`, detail: "Open its overview, records, schematic and Wattson context.", href: `/sites/${systems[0].siteId}/systems/${systems[0].id}` });
    return steps.slice(0, 3);
  }, [profile.assessment.goals, systems]);

  async function send(messageOverride?: string) {
    const message = messageOverride?.trim() || input.trim() || (attachment ? "Please use this image as evidence for the current discovery question." : "");
    if (!message || sending) return;
    const attachmentLabel = attachment ? `\n\n[Attached image: ${attachment.name}]` : "";
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: `${message}${attachmentLabel}`, createdAt: new Date().toISOString() }]);
    setInput(""); setSending(true);
    try {
      const targetProjectId = siteSystems.length === 1 ? siteSystems[0].id : systems.length === 1 ? systems[0].id : undefined;
      const bodyData = new FormData();
      bodyData.set("message", message);
      if (attachment) bodyData.set("file", attachment);
      if (targetProjectId) bodyData.set("projectId", targetProjectId);
      if (siteId) bodyData.set("siteId", siteId);
      if (conversationId) bodyData.set("conversationId", conversationId);
      const response = await fetch("/api/wattson/dashboard", { method: "POST", body: bodyData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: body.message, citations: body.citations, actionUrl: body.actionUrl, actionLabel: body.actionLabel, createdAt: new Date().toISOString() }]);
      setAttachment(undefined);
      if (body.actionUrl) router.push(body.actionUrl);
      else if (body.actions?.length) router.refresh();
    } catch (problem) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: problem instanceof Error ? problem.message : "Wattson is unavailable.", createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  }

  useEffect(() => {
    const prompt = sessionStorage.getItem("pvintell:wattson-prompt");
    if (!prompt) return;
    sessionStorage.removeItem("pvintell:wattson-prompt");
    document.querySelector("#wattson")?.scrollIntoView();
    void send(prompt);
    // One-time handoff from the persistent How-to menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoStartProposal || proposalStarted.current || sending || !siteId) return;
    proposalStarted.current = true;
    void send("Use this completed Site discovery brief to create the first evidence-led proposed system outline now. Explain the proposed components in plain language, make clear that nothing is purchased or installed, and take me to Proposed design.");
  }, [autoStartProposal, sending, siteId]);

  async function startAgain() {
    if (sending) return;
    if (selectedSite) { router.push(`/sites/${selectedSite.id}`); return; }
    const response = await fetch("/api/wattson/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "dashboard" }) });
    const body = await response.json();
    if (!response.ok) { window.alert(body.error ?? "Could not start a new conversation"); return; }
    setMessages([]);
    setInput("");
    setAttachment(undefined);
  }

  function systemHref(system: SystemSummary, view: string) {
    if (view === "schematic") return `/sites/${system.siteId}/systems/${system.id}/schematic`;
    if (view === "design") return `/sites/${system.siteId}/systems/${system.id}/design`;
    if (view === "system") return `/sites/${system.siteId}/systems/${system.id}`;
    return `/sites/${system.siteId}/systems/${system.id}?view=${view}`;
  }

  function openSystemView(view: string) {
    if (!selectedSite) { router.push("/discovery/new-system"); return; }
    if (view === "weather") { router.push(`/sites/${selectedSite.id}/weather`); return; }
    if (!siteSystems.length) { router.push(`/sites/${selectedSite.id}`); return; }
    if (siteSystems.length === 1) { router.push(systemHref(siteSystems[0], view)); return; }
    setChoosingView(view);
  }

  return <div className="min-h-screen">
    <aside className="hidden">
      <div className="flex h-12 items-center justify-between px-2"><Logo/><button className="lg:hidden" onClick={() => setMenu(false)}><X size={18}/></button></div>
      <Link href="/discovery/new-system" className="mt-5 flex items-center gap-3 rounded-xl bg-[#f6c945] px-3 py-3 text-xs font-extrabold text-[#143c63]"><Sparkles size={16}/> Start here<ArrowRight className="ml-auto" size={14}/></Link>
      <a href="#wattson" className="mt-2 flex items-center gap-3 rounded-xl bg-brand px-3 py-3 text-xs font-bold text-white"><Bot size={16}/> Ask Wattson<ArrowRight className="ml-auto" size={14}/></a>
      <div className="mt-5 rounded-2xl border border-line bg-white p-2"><div className="px-2 py-1"><div className="eyebrow text-[#7b8a9c]">My sites</div></div><div className="mt-2 space-y-1">{sites.length ? sites.map((site) => <Link key={site.id} href={`/sites/${site.id}`} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]"><MapPin size={12}/><span className="truncate">{site.name}</span></Link>) : <Link href="/discovery/new-system" className="block w-full rounded-xl bg-[#fff6cf] px-3 py-3 text-left text-[11px] font-bold text-brand">Start here →</Link>}</div></div>
      <nav className="mt-5 space-y-1">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-xl border-l-4 border-[#f6c945] bg-[#fff6cf] px-3 py-2.5 text-sm font-semibold text-[#143c63]"><LayoutDashboard size={17}/> Dashboard</Link>
        <Link href="/discovery/new-system" className="flex items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"><Sparkles size={17}/> Start here</Link>
        <button onClick={() => selectedSite ? router.push(`/sites/${selectedSite.id}`) : router.push("/discovery/new-system")} className="flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-left text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"><Home size={17}/> Site overview</button>
        {dashboardSystemNavigation.map(([view, label, Icon]) => <button key={view} onClick={() => openSystemView(view)} className="flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-left text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"><Icon size={17}/>{label}</button>)}
        <Link href="/glossary" className="flex items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"><BookOpen size={17}/>Glossary</Link>
      </nav>
      <div className="mt-5"><div className="eyebrow px-3 text-[#7b8a9c]">Your path</div><div className="mt-2 space-y-1">{nextSteps.map((step, index) => <Link key={step.title} href={step.href} className="flex gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#66758a] hover:bg-[#eef3f8]"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#eaf2fb] text-[9px] text-brand">{index + 1}</span>{step.title}</Link>)}</div></div>
      <div className="mt-auto rounded-2xl border border-line bg-white p-3.5"><Link href="/account" className="flex items-center gap-2 text-xs font-bold"><Settings2 size={14}/> Account</Link><p className="mt-2 truncate text-[10px] text-muted">{email}</p><form action="/auth/signout" method="post"><button className="mt-3 text-[10px] font-bold text-brand">Sign out</button></form></div>
    </aside>
    <main className="min-w-0"><header className="sticky top-0 z-50 border-b border-line bg-[rgba(248,250,252,.96)] backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:px-6"><Link href="/dashboard" className="shrink-0"><Logo/></Link>{sites.length ? <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold text-brand"><MapPin size={13}/><select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="max-w-36 bg-transparent outline-none">{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label> : null}<div className="min-w-0 flex-1"><div className="eyebrow text-[8px]">All Sites</div><div className="mt-1 truncate text-xs font-extrabold">Dashboard <span className="font-medium text-muted">· {profile.location || "Your PVIntell workspace"}</span></div></div><a href="#wattson" className="hidden h-9 items-center gap-2 rounded-xl bg-brand px-4 text-[11px] font-bold text-white sm:flex"><Bot size={14}/>Ask Wattson</a><UniversalHowToMenu location={selectedSite?.location ?? profile.location} onAsk={(guide) => { document.querySelector("#wattson")?.scrollIntoView({ behavior: "smooth" }); void send(`Show me how to work with ${guide.title}. Explain what it is, what it does, where it connects, and guide me one simple step at a time.`); }}/><Link href="/account" className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted"><Settings2 size={16}/></Link></div><nav className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-1 border-t border-line px-4 py-2 md:px-6"><Link href="/dashboard" className="rounded-xl bg-[#fff6cf] px-3 py-2 text-[11px] font-bold text-brand">Dashboard</Link><Link href="/discovery/new-system" className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">New Site</Link>{selectedSite && <Link href={`/sites/${selectedSite.id}`} className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Open Site</Link>}<Link href="/glossary" className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Glossary</Link><form action="/auth/signout" method="post" className="ml-auto"><button className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Sign out</button></form></nav></header>
      <div className="mx-auto max-w-[1320px] space-y-6 p-5 md:p-8">
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="eyebrow">Today with PVIntell</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[40px]">Welcome back{profile.displayName ? `, ${profile.displayName}` : ""}</h1><p className="mt-2 text-sm text-muted">Your sites, today’s solar conditions and Wattson’s next steps in one place.</p></div>{sites.length > 1 && <label className="text-xs font-bold">Weather site<select className="field min-w-56" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}</section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Sun} label="Expected solar today" value={selectedSite ? today ? `${today.expected.toFixed(1)} kWh` : weather.loading ? "Loading…" : "—" : "No site"} detail={selectedSite ? `${(solarBySite[selectedSite.id] ?? 0).toFixed(1)} kW recorded PV at ${selectedSite.name}` : "Add a site to begin"}/><Metric icon={CloudSun} label="Best solar hour" value={today?.peak ? new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: selectedSite?.timezone }).format(new Date(today.peak.time)) : "—"} detail={today?.peak ? `${Math.round(today.peak.irradiance ?? 0)} W/m² forecast` : "Waiting for site weather"}/><Metric icon={CloudRain} label="Rain today" value={today ? `${today.rain.toFixed(1)} mm` : "—"} detail={selectedSite?.timezone ? `Times shown in ${selectedSite.timezone}` : "Site timezone required"}/><Metric icon={Waypoints} label="Systems" value={`${siteSystems.length || systems.length}`} detail={selectedSite ? `At ${selectedSite.name}` : "Across all sites"}/></div>
        <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <section id="wattson" className="card overflow-hidden"><div className="flex items-center gap-4 border-b border-line bg-[linear-gradient(100deg,#eef5fc,#fff9df)] p-5 md:p-6"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Bot size={20}/></span><div><div className="eyebrow">Wattson · site project guide</div><h2 className="mt-2 font-display text-xl font-extrabold">{selectedSite ? `${selectedSite.name} · Project planning` : "What are we working on today?"}</h2><p className="mt-1 text-[11px] text-muted">{selectedSite ? "Discovery complete · Wattson will turn this brief into your proposed design." : "Choose a Site so Wattson can keep the right context."}</p></div><button type="button" onClick={() => void startAgain()} disabled={sending} className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[10px] font-bold text-brand disabled:opacity-40"><RotateCcw size={13}/><span className="hidden sm:inline">Start separate chat</span></button></div><div className="thin-scrollbar h-[340px] space-y-4 overflow-y-auto p-5">{messages.length ? messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-xs leading-5 ${message.role === "user" ? "bg-brand text-white" : "bg-[#edf2f7] text-ink"}`}>{message.content}</div></div>) : <div className="rounded-2xl bg-[#edf2f7] p-4 text-xs leading-5">Hi{profile.displayName ? ` ${profile.displayName}` : ""}. I’ll use this Site’s discovery brief to build a proposed design without treating any equipment as installed.</div>}{sending && <div className="text-xs text-muted">Wattson is thinking…</div>}</div><form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-line p-4">{attachment && <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#edf2f7] px-3 py-2 text-[10px] font-semibold text-muted"><ImagePlus size={14}/><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)} aria-label="Remove attached image"><X size={13}/></button></div>}<div className="flex items-end gap-2"><label className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-white text-brand" title="Add a bill, label, site or roof photo"><ImagePlus size={18}/><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={sending} onChange={(event) => setAttachment(event.target.files?.[0])}/></label><textarea rows={2} value={input} onChange={(event) => setInput(event.target.value)} className="field mt-0 min-h-[48px] flex-1 py-3" placeholder="Ask about this Site or attach a label, plan or photo…"/><button disabled={(!input.trim() && !attachment) || sending} className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40"><Send size={17}/></button></div></form></section>
          <aside className="space-y-5"><section className="card p-5"><div className="eyebrow">Recommended next</div><div className="mt-4 space-y-3">{nextSteps.map((step) => <Link key={step.title} href={step.href} className="block rounded-2xl border border-line bg-white p-4 hover:border-[#8ab0d2]"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{step.title}</strong><ArrowRight className="shrink-0 text-brand" size={15}/></div><p className="mt-2 text-[11px] leading-5 text-muted">{step.detail}</p></Link>)}</div></section><section className="card p-5"><div className="eyebrow">Selected site</div>{selectedSite ? <><h3 className="mt-3 text-lg font-extrabold">{selectedSite.name}</h3><p className="mt-1 text-xs text-muted">{selectedSite.location}</p><p className="mt-4 text-[10px] text-muted">Weather updated {today?.fetchedAt ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: selectedSite.timezone, timeZoneName: "short" }).format(new Date(today.fetchedAt)) : "—"}</p><Link href={`/sites/${selectedSite.id}`} className="mt-4 flex h-10 items-center justify-center rounded-xl border border-line text-xs font-bold text-brand">Open site</Link></> : <><p className="mt-3 text-xs leading-5 text-muted">Start the guided setup to create the Site and its first power system together.</p><Link href="/discovery/new-system" className="mt-4 flex h-10 items-center justify-center rounded-xl bg-brand text-xs font-bold text-white">Start here</Link></>}</section></aside>
        </div>
      </div>
    </main>
    {choosingView && <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b2740]/45 p-5 backdrop-blur-sm"><div className="card w-full max-w-md bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><div className="eyebrow">Choose a system</div><h2 className="mt-2 text-xl font-extrabold">Where are you working?</h2></div><button onClick={() => setChoosingView(undefined)} aria-label="Close system picker"><X size={18}/></button></div><div className="mt-5 space-y-2">{siteSystems.map((system) => <Link key={system.id} href={systemHref(system, choosingView)} className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-bold hover:border-[#7aa6d1] hover:bg-[#eff5fa]"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Zap size={16}/></span>{system.name}<span className="ml-auto text-brand">›</span></Link>)}</div></div></div>}
  </div>;
}

function Logo() { return <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[11px] bg-[#f6c945] text-[#143c63]"><Zap size={19} fill="currentColor"/></span><div><div className="font-display text-[17px] font-extrabold tracking-[-.04em]">PVIntell</div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-muted">Power, made clear</div></div></div>; }
function Metric({ icon: Icon, label, value, detail }: { icon: typeof Sun; label: string; value: string; detail: string }) { return <div className="card flex min-h-36 flex-col justify-between p-5"><div className="flex justify-between"><span className="text-xs font-semibold text-muted">{label}</span><span className="grid size-8 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Icon size={16}/></span></div><div><div className="font-display text-[26px] font-extrabold tracking-[-.045em]">{value}</div><div className="mt-1 text-[10px] text-muted">{detail}</div></div></div>; }
