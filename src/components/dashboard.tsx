"use client";

import { ArrowRight, Bot, Calculator, ChevronDown, CircleGauge, ClipboardCheck, Cloud, CloudRain, CloudSun, Home, ImagePlus, LayoutDashboard, MapPin, Menu as MenuIcon, Package, RotateCcw, Send, Settings2, Sparkles, Sun, Thermometer, Waypoints, Wind, Wrench, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { allHowToGuides, UniversalHowToMenu } from "@/components/pvintell-workspace";
import type { ChatMessage, Site, SystemSummary } from "@/domain/models";
import type { OnboardingAnswers } from "@/onboarding/assessment";
import { formatRainfall, formatTemperature, formatWindSpeed, useUnitPreferences } from "@/preferences/units";
import { fiveDaySolarOutlook, latestForecastHour, type SolarArrayForecastInput } from "@/weather/forecast";
import { useForecastNow, useSolarWeather } from "@/weather/use-solar-weather";

type Profile = { displayName: string; location: string; timezone: string; assessment: OnboardingAnswers };
type DashboardProps = { profile: Profile; sites: Site[]; systems: SystemSummary[]; solarBySite: Record<string, number>; solarArraysBySite?: Record<string, SolarArrayForecastInput[]>; initialMessages: ChatMessage[]; conversationId?: string; initialSiteId?: string; autoStartProposal?: boolean; email: string };

function useCloseFloatingMenus() {
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      document.querySelectorAll<HTMLDetailsElement>("header details").forEach((details) => {
        if (!target || !details.contains(target)) details.open = false;
      });
    }
    function closeAfterChoice(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("header details") || target.closest("summary")) return;
      if (target.closest("details")?.querySelector("#global-how-to-search")) return;
      document.querySelectorAll<HTMLDetailsElement>("header details").forEach((details) => {
        details.open = false;
      });
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("click", closeAfterChoice);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("click", closeAfterChoice);
    };
  }, []);
}

export function Dashboard({ profile, sites, systems, solarBySite, solarArraysBySite = {}, initialMessages, conversationId, initialSiteId, autoStartProposal = false, email }: DashboardProps) {
  useCloseFloatingMenus();
  const router = useRouter();
  const [siteId, setSiteId] = useState(initialSiteId && sites.some((site) => site.id === initialSiteId) ? initialSiteId : sites[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File>();
  const [sending, setSending] = useState(false);
  const [wattsonOpen, setWattsonOpen] = useState(autoStartProposal);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [choosingView, setChoosingView] = useState<string>();
  const proposalStarted = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const selectedSite = sites.find((site) => site.id === siteId);
  const siteSystems = systems.filter((system) => system.siteId === siteId);
  const selectedSolarArrays = selectedSite ? solarArraysBySite[selectedSite.id] ?? [] : [];
  const selectedSolarKw = selectedSite ? solarBySite[selectedSite.id] ?? 0 : 0;
  const weather = useSolarWeather(selectedSite ?? { id: "none", name: "", location: "", timezone: profile.timezone, locationSource: "manual", locationConfirmed: false });
  const forecastNow = useForecastNow();
  const { preferences: units } = useUnitPreferences();

  const today = useMemo(() => {
    if (!selectedSite || !weather.data) return undefined;
    const timezone = weather.data.site.timezone || selectedSite.timezone;
    const summary = fiveDaySolarOutlook(
      weather.data.hours,
      timezone,
      selectedSolarArrays.length ? selectedSolarArrays : selectedSolarKw,
      forecastNow,
      { latitude: selectedSite.latitude, longitude: selectedSite.longitude, timezone },
    )[0];
    if (!summary) return undefined;
    return {
      expected: summary.expectedKwh,
      remaining: summary.remainingKwh,
      peak: summary.peak,
      current: latestForecastHour(summary.hours, forecastNow),
      rain: summary.rainMm,
      maxWind: summary.maxWind,
      forecastBasis: summary.forecastBasis,
      fetchedAt: weather.data.fetchedAt,
    };
  }, [forecastNow, selectedSite, selectedSolarArrays, selectedSolarKw, weather.data]);

  const nextSteps = useMemo(() => {
    const goals = profile.assessment.goals ?? [];
    const steps: Array<{ title: string; detail: string; href: string }> = [{ title: "Start a new system", detail: "Work from your needs and existing equipment toward a clear proposed system.", href: "/discovery/new-system" }];
    if (goals.includes("Record an as-built system") && systems[0]) steps.push({ title: "Record installed equipment", detail: "Add each inverter, battery, PV string and connection as it is actually installed.", href: `/sites/${systems[0].siteId}/systems/${systems[0].id}` });
    if (goals.includes("Understand what I already have") && systems[0]) steps.push({ title: "Build the system schematic", detail: "Map the equipment and connections so the complete system is easy to understand.", href: `/sites/${systems[0].siteId}/systems/${systems[0].id}/schematic` });
    return steps.slice(0, 3);
  }, [profile.assessment.goals, systems]);

  async function send(messageOverride?: string) {
    const message = messageOverride?.trim() || input.trim() || (attachment ? "Please use this image as evidence for the current discovery question." : "");
    if (!message || sending) return;
    const attachmentLabel = attachment ? `\n\n[Attached image: ${attachment.name}]` : "";
    setWattsonOpen(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: `${message}${attachmentLabel}`, createdAt: new Date().toISOString() }]);
    setInput("");
    setSending(true);
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
    setWattsonOpen(true);
    void send(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoStartProposal || proposalStarted.current || sending || !siteId) return;
    proposalStarted.current = true;
    setWattsonOpen(true);
    void send("Use this completed Site discovery brief to create the first evidence-led proposed system outline now. Explain the proposed components in plain language, make clear that nothing is purchased or installed, and take me to Proposed design.");
  }, [autoStartProposal, sending, siteId]);

  useEffect(() => {
    if (!wattsonOpen) return;
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending, wattsonOpen]);

  async function startAgain() {
    if (sending) return;
    const response = await fetch("/api/wattson/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "dashboard" }) });
    const body = await response.json();
    if (!response.ok) { window.alert(body.error ?? "Could not start a new conversation"); return; }
    setMessages([]); setInput(""); setAttachment(undefined);
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

  async function askGuide(guide: (typeof allHowToGuides)[number], question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) {
    if (!selectedSite) return { message: `${guide.whatItIs ?? guide.summary}\n\n${guide.whatItDoes ?? "Open the guide for the full step-by-step instructions."}` };
    const response = await fetch("/api/wattson/guide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: question,
        siteId: selectedSite.id,
        guide,
        recentConversation,
        guideIndex: allHowToGuides.map(({ id, title, group, aliases }) => ({ id, title, group, aliases })),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
    return body;
  }

  const localDate = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: selectedSite?.timezone ?? profile.timezone }).format(new Date());

  return (
    <div className="min-h-screen bg-[#edf3f7] text-ink">
      <header className="sticky top-0 z-40 border-b border-[#cfdbe6] bg-white/98 shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:px-6">
          <Link href="/dashboard" className="shrink-0"><Logo /></Link>
          {sites.length ? (
            <label className="ml-auto flex items-center gap-2 rounded-xl border border-line bg-[#f6f9fc] px-3 py-2 text-[11px] font-bold text-brand md:ml-3">
              <MapPin size={13} />
              <select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="max-w-36 bg-transparent outline-none" aria-label="Selected site">
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </label>
          ) : null}
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="truncate text-xs font-extrabold">{selectedSite?.location || profile.location || "Your PVIntell workspace"}</div>
            <div className="mt-0.5 text-[9px] font-semibold text-muted">{localDate}</div>
          </div>
          <button type="button" onClick={() => setWattsonOpen(true)} className="hidden h-9 items-center gap-2 rounded-xl bg-brand px-4 text-[11px] font-bold text-white sm:flex"><Bot size={14} /> Ask Wattson</button>
          <Link href="/account" className="hidden size-9 place-items-center rounded-xl border border-line bg-white text-muted md:grid" title={`Settings · ${email}`}><Settings2 size={16} /></Link>
          <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted md:hidden" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={17} /> : <MenuIcon size={18} />}
          </button>
        </div>

        <nav className="mx-auto hidden max-w-[1440px] items-center gap-1 border-t border-line px-6 py-2 md:flex">
          <Link href="/dashboard" className="shrink-0 rounded-xl bg-[#fff2b8] px-3 py-2 text-[11px] font-extrabold text-brand">Dashboard</Link>
          <NavDropdown label="Plan">
            <MenuLink href="/discovery/new-system" icon={Sparkles} label="Start a new system" />
            <MenuButton icon={Home} label="Site overview" onClick={() => selectedSite ? router.push(`/sites/${selectedSite.id}`) : router.push("/discovery/new-system")} />
            <MenuButton icon={Calculator} label="Proposed design" onClick={() => openSystemView("design")} />
          </NavDropdown>
          <NavDropdown label="Build">
            <MenuButton icon={Wrench} label="Build schedule" onClick={() => openSystemView("build")} />
            <MenuButton icon={ClipboardCheck} label="Commissioning" onClick={() => openSystemView("commission")} />
          </NavDropdown>
          <NavDropdown label="Records">
            <MenuButton icon={Package} label="Site equipment" onClick={() => openSystemView("equipment")} />
            <MenuButton icon={LayoutDashboard} label="As-built overview" onClick={() => openSystemView("system")} />
            <MenuButton icon={Waypoints} label="System schematic" onClick={() => openSystemView("schematic")} />
            <MenuButton icon={CircleGauge} label="Monitor" onClick={() => openSystemView("monitor")} />
          </NavDropdown>
          <button type="button" onClick={() => openSystemView("weather")} className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Solar weather</button>
          <UniversalHowToMenu location={selectedSite?.location ?? profile.location} onAsk={askGuide} />
          <Link href="/glossary" className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Glossary</Link>
          <Link href="/account" className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Settings</Link>
          <form action="/auth/signout" method="post" className="ml-auto shrink-0"><button className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Sign out</button></form>
        </nav>
        {mobileMenuOpen ? (
          <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white p-3 md:hidden" aria-label="Mobile navigation">
            <div className="grid gap-1">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#fff2b8] px-3 py-2.5 text-xs font-extrabold text-brand">Dashboard</Link>
              <MobileNavGroup label="Plan">
                <Link href="/discovery/new-system" className="mobile-nav-item">Start a new system</Link>
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); selectedSite ? router.push(`/sites/${selectedSite.id}`) : router.push("/discovery/new-system"); }}>Site overview</button>
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); openSystemView("design"); }}>Proposed design</button>
              </MobileNavGroup>
              <MobileNavGroup label="Build">
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); openSystemView("build"); }}>Build schedule</button>
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); openSystemView("commission"); }}>Commissioning</button>
              </MobileNavGroup>
              <MobileNavGroup label="Records">
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); openSystemView("equipment"); }}>Site equipment</button>
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); openSystemView("system"); }}>As-built overview</button>
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); openSystemView("schematic"); }}>System schematic</button>
                <button type="button" className="mobile-nav-item" onClick={() => { setMobileMenuOpen(false); openSystemView("monitor"); }}>Monitor</button>
              </MobileNavGroup>
              <button type="button" className="rounded-lg px-3 py-2.5 text-left text-xs font-bold text-muted" onClick={() => { setMobileMenuOpen(false); openSystemView("weather"); }}>Solar weather</button>
              <div className="rounded-lg text-xs font-bold text-muted"><UniversalHowToMenu location={selectedSite?.location ?? profile.location} onAsk={askGuide} /></div>
              <Link href="/glossary" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-xs font-bold text-muted">Glossary</Link>
              <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-xs font-bold text-muted">Settings</Link>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setWattsonOpen(true); }} className="rounded-lg bg-brand px-3 py-2.5 text-left text-xs font-bold text-white">Ask Wattson</button>
              <form action="/auth/signout" method="post"><button className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-bold text-muted">Sign out</button></form>
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1320px] space-y-4 p-4 pb-20 md:p-6 md:pb-20">
        <section
          className="relative min-h-[220px] overflow-hidden rounded-2xl bg-[#174d77] bg-cover bg-center shadow-[0_14px_36px_rgba(16,50,78,.18)]"
          style={{ backgroundImage: "linear-gradient(90deg, rgba(8,39,67,.94) 0%, rgba(10,55,88,.78) 45%, rgba(10,55,88,.08) 100%), url('/backgrounds/haniaipics-ai-generated-8886042_1920.jpg')" }}
        >
          <div className="relative z-10 flex min-h-[220px] max-w-3xl flex-col justify-between p-5 text-white md:p-6">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ffe07b]">Today at {selectedSite?.name ?? "PVIntell"}</div>
              <h1 className="mt-2 max-w-xl font-display text-2xl font-extrabold tracking-[-.045em] md:text-[34px]">Good to see you{profile.displayName ? `, ${profile.displayName}` : ""}.</h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-white/80">Your weather, solar outlook and next useful actions—without digging through the rest of the system.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <WeatherPill icon={Sun} label={today?.current?.irradiance != null ? `${Math.round(today.current.irradiance)} W/m² now` : "Solar data pending"} />
              <WeatherPill icon={Thermometer} label={today?.current?.temperature != null ? `${formatTemperature(today.current.temperature, units)} now` : "Temperature pending"} />
              <WeatherPill icon={Cloud} label={today?.current?.cloudCover != null ? `${Math.round(today.current.cloudCover)}% cloud` : "Cloud data pending"} />
              <WeatherPill icon={Wind} label={today?.current?.windSpeed != null ? `${formatWindSpeed(today.current.windSpeed, units)} wind` : "Wind data pending"} />
            </div>
          </div>
        </section>

        {weather.error ? <div className="rounded-2xl border border-[#e8c86b] bg-[#fff8d9] px-4 py-3 text-xs text-[#735800]">Today’s live weather could not be loaded. Your saved site and system information is still available.</div> : null}

        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div><div className="eyebrow">Today’s solar conditions</div><h2 className="mt-2 font-display text-xl font-extrabold">The useful numbers at a glance</h2></div>
            {selectedSite ? <button onClick={() => openSystemView("weather")} className="shrink-0 text-[11px] font-bold text-brand">Full forecast →</button> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric icon={Sun} label="Expected solar today" value={selectedSite ? today ? `${today.expected.toFixed(1)} kWh` : weather.loading ? "Loading…" : "—" : "No site"} detail={selectedSite && today ? `${today.remaining.toFixed(1)} kWh still available · ${today.forecastBasis === "array-geometry" ? "using panel angle" : "basic estimate"}` : selectedSite ? `${selectedSolarKw.toFixed(1)} kW of recorded panels` : "Add a site to begin"} />
            <Metric icon={CloudSun} label="Best solar hour" value={today?.peak ? new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: selectedSite?.timezone }).format(new Date(today.peak.time)) : "—"} detail={today?.peak ? `${Math.round(today.peak.irradiance ?? 0)} W/m² forecast` : "Waiting for site weather"} />
            <Metric icon={Thermometer} label="Temperature now" value={today?.current?.temperature != null ? formatTemperature(today.current.temperature, units) : "—"} detail={today?.current?.cloudCover != null ? `${Math.round(today.current.cloudCover)}% cloud cover` : "Current local conditions"} />
            <Metric icon={CloudRain} label="Rain today" value={today ? formatRainfall(today.rain, units) : "—"} detail={today ? `Wind up to ${formatWindSpeed(today.maxWind, units)}` : "Daily forecast total"} />
            <Metric icon={Waypoints} label="Systems here" value={`${selectedSite ? siteSystems.length : systems.length}`} detail={selectedSite ? `At ${selectedSite.name}` : `${systems.length} across all sites`} />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <section className="card p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div><div className="eyebrow">Continue where it matters</div><h2 className="mt-2 font-display text-xl font-extrabold">Recommended next</h2></div>
              <span className="grid size-10 place-items-center rounded-2xl bg-[#fff2b8] text-brand"><ArrowRight size={17} /></span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {nextSteps.map((step) => (
                <Link key={step.title} href={step.href} className="rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#8ab0d2] hover:shadow-md">
                  <div className="flex items-center justify-between gap-3"><strong className="text-sm">{step.title}</strong><ArrowRight className="shrink-0 text-brand" size={15} /></div>
                  <p className="mt-2 text-[11px] leading-5 text-muted">{step.detail}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="card p-4 md:p-5">
            <div className="eyebrow">Selected site</div>
            {selectedSite ? (
              <>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div><h3 className="text-lg font-extrabold">{selectedSite.name}</h3><p className="mt-1 text-xs text-muted">{selectedSite.location}</p></div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#eaf2fb] text-brand"><MapPin size={17} /></span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-[10px]">
                  <div className="rounded-xl bg-[#f2f6f9] p-3"><span className="text-muted">Recorded PV</span><strong className="mt-1 block text-sm">{selectedSolarKw.toFixed(1)} kW</strong></div>
                  <div className="rounded-xl bg-[#f2f6f9] p-3"><span className="text-muted">Systems</span><strong className="mt-1 block text-sm">{siteSystems.length}</strong></div>
                </div>
                <p className="mt-4 text-[10px] text-muted">Weather updated {today?.fetchedAt ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: selectedSite.timezone, timeZoneName: "short" }).format(new Date(today.fetchedAt)) : "—"}</p>
                <Link href={`/sites/${selectedSite.id}`} className="mt-4 flex h-10 items-center justify-center rounded-xl border border-line text-xs font-bold text-brand">Open site</Link>
              </>
            ) : (
              <><p className="mt-3 text-xs leading-5 text-muted">Create a site to give weather, designs and Wattson the right local context.</p><Link href="/discovery/new-system" className="mt-4 flex h-10 items-center justify-center rounded-xl bg-brand text-xs font-bold text-white">Start here</Link></>
            )}
          </section>
        </div>
      </main>

      {!wattsonOpen ? (
        <button id="wattson" type="button" onClick={() => setWattsonOpen(true)} className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl bg-brand px-5 py-4 text-sm font-extrabold text-white shadow-[0_18px_50px_rgba(12,56,91,.35)] transition hover:-translate-y-0.5">
          <span className="grid size-8 place-items-center rounded-xl bg-white/15"><Bot size={18} /></span>Ask Wattson
          {messages.length ? <span className="grid size-5 place-items-center rounded-full bg-[#f6c945] text-[9px] text-brand">{messages.length}</span> : null}
        </button>
      ) : (
        <section id="wattson" className="fixed bottom-3 right-3 z-50 flex h-[min(520px,calc(100vh-1.5rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#b9cad9] bg-white shadow-[0_18px_50px_rgba(9,37,61,.26)]">
          <div className="flex items-center gap-3 border-b border-line bg-[linear-gradient(100deg,#eaf3fb,#fff6ce)] p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Bot size={19} /></span>
            <div className="min-w-0 flex-1"><div className="eyebrow">Wattson</div><h2 className="mt-1 truncate text-sm font-extrabold">{selectedSite ? selectedSite.name : "Your solar guide"}</h2></div>
            <button type="button" onClick={() => void startAgain()} disabled={sending} className="grid size-9 place-items-center rounded-xl border border-line bg-white text-brand disabled:opacity-40" title="Start a separate chat"><RotateCcw size={14} /></button>
            <button type="button" onClick={() => setWattsonOpen(false)} className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted" aria-label="Close Wattson"><X size={16} /></button>
          </div>
          <div ref={chatScrollRef} className="thin-scrollbar min-h-[260px] flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-xs leading-5 ${message.role === "user" ? "bg-brand text-white" : "bg-[#edf2f7] text-ink"}`}>
                  {message.content}
                  {message.actionUrl ? <Link href={message.actionUrl} className="mt-3 flex items-center gap-2 font-bold text-brand">{message.actionLabel ?? "Open"}<ArrowRight size={13} /></Link> : null}
                </div>
              </div>
            )) : <div className="rounded-2xl bg-[#edf2f7] p-4 text-xs leading-5">Hi{profile.displayName ? ` ${profile.displayName}` : ""}. Ask me about this site, your system, or what to do next.</div>}
            {sending ? <div className="text-xs text-muted">Wattson is thinking…</div> : null}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-line p-3">
            {attachment ? <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#edf2f7] px-3 py-2 text-[10px] font-semibold text-muted"><ImagePlus size={14} /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)} aria-label="Remove attached image"><X size={13} /></button></div> : null}
            <div className="flex items-end gap-2">
              <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-white text-brand" title="Add a bill, label, site or roof photo"><ImagePlus size={17} /><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={sending} onChange={(event) => setAttachment(event.target.files?.[0])} /></label>
              <textarea rows={2} value={input} onChange={(event) => setInput(event.target.value)} className="field mt-0 min-h-[44px] flex-1 resize-none py-3" placeholder="Ask Wattson…" />
              <button disabled={(!input.trim() && !attachment) || sending} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40"><Send size={16} /></button>
            </div>
          </form>
        </section>
      )}

      {choosingView ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0b2740]/45 p-5 backdrop-blur-sm">
          <div className="card w-full max-w-md bg-white p-6 shadow-2xl">
            <div className="flex justify-between"><div><div className="eyebrow">Choose a system</div><h2 className="mt-2 text-xl font-extrabold">Where are you working?</h2></div><button onClick={() => setChoosingView(undefined)} aria-label="Close system picker"><X size={18} /></button></div>
            <div className="mt-5 space-y-2">{siteSystems.map((system) => <Link key={system.id} href={systemHref(system, choosingView)} className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-bold hover:border-[#7aa6d1] hover:bg-[#eff5fa]"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Zap size={16} /></span>{system.name}<span className="ml-auto text-brand">›</span></Link>)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Logo() {
  return <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[11px] bg-[#f6c945] text-[#143c63]"><Zap size={19} fill="currentColor" /></span><div className="hidden sm:block"><div className="font-display text-[17px] font-extrabold tracking-[-.04em]">PVIntell</div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-muted">Power, made clear</div></div></div>;
}

function NavDropdown({ label, children }: { label: string; children: ReactNode }) {
  return <details className="group relative shrink-0"><summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">{label}<ChevronDown size={13} className="transition group-open:rotate-180" /></summary><div className="absolute left-0 top-10 z-50 w-60 rounded-2xl border border-line bg-white p-2 shadow-[0_18px_50px_rgba(9,37,61,.18)]">{children}</div></details>;
}

function MobileNavGroup({ label, children }: { label: string; children: ReactNode }) {
  return <details className="group rounded-lg border border-line"><summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-bold text-muted">{label}<ChevronDown size={14} className="transition group-open:rotate-180" /></summary><div className="grid border-t border-line bg-[#f7f9fb] p-1.5">{children}</div></details>;
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: typeof Sun; label: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-muted hover:bg-[#eef3f8] hover:text-brand"><Icon size={15} />{label}</Link>;
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof Sun; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-muted hover:bg-[#eef3f8] hover:text-brand"><Icon size={15} />{label}</button>;
}

function WeatherPill({ icon: Icon, label }: { icon: typeof Sun; label: string }) {
  return <span className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-bold backdrop-blur-sm"><Icon size={14} className="text-[#ffe07b]" />{label}</span>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Sun; label: string; value: string; detail: string }) {
  return <div className="card flex min-h-24 flex-col justify-between p-3"><div className="flex justify-between gap-2"><span className="text-[10px] font-semibold text-muted">{label}</span><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Icon size={14} /></span></div><div className="mt-2"><div className="font-display text-xl font-extrabold tracking-[-.04em]">{value}</div><div className="mt-0.5 text-[9px] leading-3 text-muted">{detail}</div></div></div>;
}
