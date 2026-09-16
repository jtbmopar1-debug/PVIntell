"use client";

import { ArrowRight, Bot, CheckCircle2, Cloud, ImagePlus, Menu as MenuIcon, RotateCcw, Send, Sun, Thermometer, Wind, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import { LocalDevFooter } from "@/components/localdev-footer";
import { WattsonHeaderAction } from "@/components/wattson-header-action";
import type { ChatMessage, Site, SystemSummary } from "@/domain/models";
import type { OnboardingAnswers } from "@/onboarding/assessment";
import { formatRainfall, formatTemperature, formatWindSpeed, useUnitPreferences } from "@/preferences/units";
import { fiveDaySolarOutlook, latestForecastHour, type SolarArrayForecastInput, type SolarWeatherHour } from "@/weather/forecast";
import { useForecastNow, useSolarWeather } from "@/weather/use-solar-weather";

type GuidedDiscoveryDraft = {
  id?: string;
  status?: string;
  questionId?: string | null;
  answers?: Record<string, string | number | string[]>;
  updatedAt?: string;
};
type Profile = { displayName: string; location: string; timezone: string; assessment: OnboardingAnswers & { guidedNewSystem?: GuidedDiscoveryDraft } };
type DashboardProps = { profile: Profile; sites: Site[]; systems: SystemSummary[]; discoveryDrafts?: GuidedDiscoveryDraft[]; connectedSystemIds?: string[]; resumeHrefs?: Record<string, string>; solarBySystem: Record<string, number>; solarArraysBySystem?: Record<string, SolarArrayForecastInput[]>; dashboardDefaultSystemId?: string; initialMessages: ChatMessage[]; conversationId?: string; initialSiteId?: string; initialWattsonOpen?: boolean; autoStartProposal?: boolean; showWelcome?: boolean; email: string };

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

export function Dashboard({ profile, sites, systems, discoveryDrafts = [], connectedSystemIds = [], resumeHrefs = {}, solarBySystem, solarArraysBySystem = {}, dashboardDefaultSystemId, initialMessages, conversationId, initialSiteId, initialWattsonOpen = false, autoStartProposal = false, showWelcome = false, email }: DashboardProps) {
  useCloseFloatingMenus();
  const router = useRouter();
  const dashboardDefaultSystem = systems.find((system) => system.id === dashboardDefaultSystemId);
  const siteId = dashboardDefaultSystem?.siteId ?? (systems.length
    ? initialSiteId && sites.some((site) => site.id === initialSiteId) ? initialSiteId : sites[0]?.id ?? ""
    : "");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File>();
  const [sending, setSending] = useState(false);
  const [wattsonOpen, setWattsonOpen] = useState(initialWattsonOpen || autoStartProposal);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [choosingView, setChoosingView] = useState<string>();
  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome);
  const proposalStarted = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const selectedSite = sites.find((site) => site.id === siteId);
  const forecastSite: Site = selectedSite ?? { id: "profile-region", name: profile.location || "Your region", location: profile.location, timezone: profile.timezone, locationSource: "imported", locationConfirmed: false };
  const siteSystems = systems.filter((system) => system.siteId === siteId);
  const connectedSiteSystems = siteSystems.filter((system) => connectedSystemIds.includes(system.id));
  const forecastSystem = dashboardDefaultSystem;
  const selectedSolarArrays = forecastSystem ? solarArraysBySystem[forecastSystem.id] ?? [] : [];
  const selectedSolarKw = forecastSystem ? solarBySystem[forecastSystem.id] ?? 0 : 0;
  const weather = useSolarWeather(forecastSite);
  const forecastNow = useForecastNow();
  const { preferences: units } = useUnitPreferences();

  const today = useMemo(() => {
    if (!weather.data) return undefined;
    const timezone = weather.data.site.timezone || forecastSite.timezone;
    const summary = fiveDaySolarOutlook(
      weather.data.hours,
      timezone,
      selectedSolarArrays.length ? selectedSolarArrays : selectedSolarKw,
      forecastNow,
      { latitude: forecastSite.latitude, longitude: forecastSite.longitude, timezone },
    )[0];
    if (!summary) return undefined;
    return {
      expected: forecastSystem ? summary.expectedKwh : undefined,
      remaining: forecastSystem ? summary.remainingKwh : undefined,
      peak: summary.peak,
      current: latestForecastHour(summary.hours, forecastNow, { latitude: forecastSite.latitude, longitude: forecastSite.longitude, timezone }),
      rain: summary.rainMm,
      maxWind: summary.maxWind,
      forecastBasis: summary.forecastBasis,
      fetchedAt: weather.data.fetchedAt,
      hours: summary.hours,
    };
  }, [forecastNow, forecastSite, forecastSystem, selectedSolarArrays, selectedSolarKw, weather.data]);

  const nextSteps = useMemo(() => {
    const installedHref = selectedSite ? `/record-installed?site=${selectedSite.id}` : "/record-installed";
    const guidedDraft = profile.assessment.guidedNewSystem;
    const hasGuidedDraft = guidedDraft?.status === "draft" && Boolean(guidedDraft.questionId || Object.keys(guidedDraft.answers ?? {}).length);
    const steps: Array<{ title: string; detail: string; href: string; kind: "continue" | "new" | "planned" | "installed" }> = discoveryDrafts.map((draft) => {
      const name = typeof draft.answers?.system_name === "string" ? draft.answers.system_name.trim() : "";
      return { title: name ? `Continue System Build — ${name}` : "Continue System Build", detail: "Return to the exact discovery question where you left off.", href: `/discovery/new-system?draft=${draft.id}`, kind: "continue" };
    });
    if (hasGuidedDraft) {
      const legacyName = typeof guidedDraft?.answers?.system_name === "string" ? guidedDraft.answers.system_name.trim() : "";
      steps.unshift({ title: legacyName ? `Continue System Build — ${legacyName}` : "Continue System Build", detail: "Return to the exact discovery question where you left off.", href: "/discovery/new-system", kind: "continue" });
    }
    systems.filter((system) => resumeHrefs[system.id]).reverse().forEach((system) => {
      steps.unshift({ title: `Continue System Build — ${system.name}`, detail: "Return to this proposal's saved discovery, design or build stage.", href: resumeHrefs[system.id], kind: "continue" });
    });
    steps.push({ title: "I already have a proposed plan", detail: "Specify the panels, arrays, inverter, battery, generator and other equipment you want, then build the proposed schematic.", href: `/proposals/new${selectedSite ? `?site=${selectedSite.id}` : ""}`, kind: "planned" });
    steps.push({ title: steps.length ? "Build another system for me" : "Build a system for me", detail: "Have a full system layout designed for your needs.", href: "/discovery/new-system?new=1", kind: "new" });
    steps.push({ title: "Record equipment already installed", detail: "Use the as-built path only for equipment and connections that physically exist now.", href: installedHref, kind: "installed" });
    return steps;
  }, [discoveryDrafts, profile.assessment.guidedNewSystem, selectedSite, systems, resumeHrefs]);

  async function send(messageOverride?: string) {
    const message = messageOverride?.trim() || input.trim() || (attachment ? "Please use this image as evidence for the current discovery question." : "");
    if (!message || sending) return;
    const attachmentLabel = attachment ? `\n\n[Attached image: ${attachment.name}]` : "";
    setWattsonOpen(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: `${message}${attachmentLabel}`, createdAt: new Date().toISOString() }]);
    setInput("");
    setSending(true);
    try {
      const bodyData = new FormData();
      bodyData.set("message", message);
      bodyData.set("requestId", crypto.randomUUID());
      if (attachment) bodyData.set("file", attachment);
      if (siteId) bodyData.set("siteId", siteId);
      if (activeConversationId) bodyData.set("conversationId", activeConversationId);
      if (today && weather.data) bodyData.set("weatherContext", JSON.stringify({
        site: weather.data.site,
        fetchedAt: today.fetchedAt,
        expectedSolarKwh: today.expected,
        remainingSolarKwh: today.remaining,
        forecastBasis: today.forecastBasis,
        rainMm: today.rain,
        maxWind: today.maxWind,
        peak: today.peak,
        current: today.current,
        hours: today.hours,
        allForecastHours: weather.data.hours,
      }));
      const response = await fetch("/api/wattson/dashboard", { method: "POST", body: bodyData });
      const body = await response.json();
      if (typeof body.conversationId === "string") setActiveConversationId(body.conversationId);
      if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: body.message, citations: body.citations, actionUrl: body.actionUrl, actionLabel: body.actionLabel, createdAt: new Date().toISOString() }]);
      setAttachment(undefined);
      if (body.actions?.length) router.refresh();
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
    const targetProjectId = siteSystems.length === 1 ? siteSystems[0].id : undefined;
    const response = await fetch("/api/wattson/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "dashboard", siteId: siteId || undefined, projectId: targetProjectId }) });
    const body = await response.json();
    if (!response.ok) { window.alert(body.error ?? "Could not start a new conversation"); return; }
    setActiveConversationId(body.id); setMessages([]); setInput(""); setAttachment(undefined);
    router.replace(`/dashboard${siteId ? `?site=${siteId}&conversation=${body.id}` : `?conversation=${body.id}`}#wattson`, { scroll: false });
  }

  function systemHref(system: SystemSummary, view: string) {
    if (view === "schematic") return `/sites/${system.siteId}/systems/${system.id}/schematic`;
    if (view === "design") return `/sites/${system.siteId}/systems/${system.id}/design`;
    if (view === "system") return `/sites/${system.siteId}/systems/${system.id}`;
    return `/sites/${system.siteId}/systems/${system.id}?view=${view}`;
  }

  function openMonitor() {
    if (connectedSiteSystems.length === 1) { router.push(systemHref(connectedSiteSystems[0], "monitor")); return; }
    if (connectedSiteSystems.length > 1) { setChoosingView("monitor"); return; }
    router.push(`/settings/connections${siteId ? `?site=${siteId}` : ""}`);
  }

  function dismissWelcome() {
    setWelcomeOpen(false);
    router.replace(siteId ? `/dashboard?site=${siteId}` : "/dashboard", { scroll: false });
  }

  const localDate = new Intl.DateTimeFormat("en-NZ", { weekday: "long", day: "numeric", month: "long", timeZone: weather.data?.site.timezone ?? forecastSite.timezone }).format(new Date());

  return (
    <div className="min-h-screen bg-[#edf3f7] text-ink">
      <header className="sticky top-0 z-40 border-b border-[#cfdbe6] bg-white/98 shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:px-6">
          <Link href="/dashboard" className="shrink-0"><Logo /></Link>
          <WattsonHeaderAction siteId={siteId}/>
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="truncate text-xs font-extrabold">{selectedSite?.location || profile.location || "Your PVIntell workspace"}</div>
            <div className="mt-0.5 text-[9px] font-semibold text-muted">{localDate}</div>
          </div>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            <Link href={`/dashboard${siteId ? `?site=${siteId}` : ""}`} className="shrink-0 rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Dashboard</Link>
            <Link href={`/systems${siteId ? `?site=${siteId}` : ""}`} className="shrink-0 rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Systems</Link>
            <Link href={`/how-to${siteId ? `?site=${siteId}` : ""}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">How to</Link>
            <Link href={`/monitor${siteId ? `?site=${siteId}` : ""}`} className="shrink-0 rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Monitor</Link>
            <Link href={`/tools${siteId ? `?site=${siteId}` : ""}`} className="shrink-0 rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Tools</Link>
            <Link href={`/settings${siteId ? `?site=${siteId}` : ""}`} className="shrink-0 rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Settings</Link>
          </nav>
          <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="ml-auto grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted md:hidden" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={17} /> : <MenuIcon size={18} />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white p-3 md:hidden" aria-label="Mobile navigation">
            <div className="grid gap-1">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Dashboard</Link>
              <Link href={`/systems${siteId ? `?site=${siteId}` : ""}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Systems</Link>
              <Link href={`/how-to${siteId ? `?site=${siteId}` : ""}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">How to</Link>
              <Link href={`/monitor${siteId ? `?site=${siteId}` : ""}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Monitor</Link>
              <Link href={`/tools${siteId ? `?site=${siteId}` : ""}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Tools</Link>
              <Link href={`/settings${siteId ? `?site=${siteId}` : ""}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Settings</Link>
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
              <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ffe07b]">Today at {selectedSite?.name ?? weather.data?.site.location ?? profile.location ?? "your region"}</div>
              <h1 className="mt-2 max-w-xl font-display text-2xl font-extrabold tracking-[-.045em] md:text-[34px]">Good to see you{profile.displayName ? `, ${profile.displayName}` : ""}.</h1>
              <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-white/90">Your solar system, made easier to build, understand and manage.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <WeatherPill icon={Sun} label={today?.current?.irradiance != null ? `${Math.round(today.current.irradiance)} W/m² now` : "Solar data pending"} />
              <WeatherPill icon={Thermometer} label={today?.current?.temperature != null ? `${formatTemperature(today.current.temperature, units)} now` : "Temperature pending"} />
              <WeatherPill icon={Cloud} label={today?.current?.cloudCover != null ? `${Math.round(today.current.cloudCover)}% cloud` : "Cloud data pending"} />
              <WeatherPill icon={Wind} label={today?.current?.windSpeed != null ? `${formatWindSpeed(today.current.windSpeed, units)} wind` : "Wind data pending"} />
            </div>
          </div>
        </section>

        {weather.error ? <div className="rounded-2xl border border-[#e8c86b] bg-[#fff8d9] px-4 py-3 text-xs text-[#735800]">{selectedSite ? "Today’s live weather could not be loaded. Your saved Site and system information is still available." : `Regional weather could not be loaded for ${profile.location || "your saved region"}. ${weather.error}`}</div> : null}

        <section>
          <div className="mb-2 flex items-end justify-between gap-3 sm:mb-3 sm:gap-4">
            <div><div className="eyebrow">Today’s solar conditions</div><h2 className="mt-1.5 font-display text-lg font-extrabold sm:mt-2 sm:text-xl">The useful numbers at a glance</h2></div>
            {forecastSystem ? <button onClick={() => router.push(systemHref(forecastSystem, "weather"))} className="shrink-0 text-[11px] font-bold text-brand">Full forecast →</button> : null}
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 md:grid-cols-3">
            <Metric emoji={<SolarYieldCurve />} label="Expected solar today" value={forecastSystem && today?.expected != null ? `${today.expected.toFixed(1)} kWh` : weather.loading ? "Loading…" : !systems.length && profile.location ? "Regional outlook" : "—"} detail={forecastSystem && today?.remaining != null ? `${today.remaining.toFixed(1)} kWh still available for ${forecastSystem.name} · ${today.forecastBasis === "array-geometry" ? "using panel angle" : "basic estimate"}` : !systems.length && profile.location ? `Sunlight and weather for ${weather.data?.site.location ?? profile.location} · add a system for kWh` : "Choose a dashboard default system to calculate energy"} />
            <Metric emoji={forecastWeatherEmoji(today?.peak)} label="Best solar hour" value={today?.peak ? new Intl.DateTimeFormat("en-NZ", { hour: "numeric", timeZone: weather.data?.site.timezone ?? forecastSite.timezone }).format(new Date(today.peak.time)) : "—"} detail={today?.peak ? `${Math.round(today.peak.irradiance ?? 0)} W/m² forecast` : "Waiting for regional weather"} />
            <Metric emoji="🌡️" label="Temperature now" value={today?.current?.temperature != null ? formatTemperature(today.current.temperature, units) : "—"} detail={today?.current?.cloudCover != null ? `${Math.round(today.current.cloudCover)}% cloud cover` : "Current local conditions"} />
            <Metric emoji="🌧️" label="Rain today" value={today ? formatRainfall(today.rain, units) : "—"} detail="Daily forecast total" />
            <Metric emoji="💨" label="Wind today" value={today ? formatWindSpeed(today.maxWind, units) : "—"} detail={today?.current?.windSpeed != null ? `${formatWindSpeed(today.current.windSpeed, units)} right now` : "Peak forecast speed"} />
            <Metric emoji="⚡" label="Systems here" value={`${selectedSite ? siteSystems.length : systems.length}`} detail={selectedSite ? `At ${selectedSite.name}` : `${systems.length} across all sites`} />
          </div>
        </section>

        <div>
          <section className="dashboard-actions card p-4 md:p-5">
            <div className="eyebrow">Let’s get started</div>
            <div className={`mt-5 grid gap-4 ${connectedSiteSystems.length ? "md:grid-cols-3" : "sm:grid-cols-2"}`}>
              {nextSteps.map((step) => (
                <Link key={`${step.kind}:${step.href}`} href={step.href} className={`min-h-36 rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md md:p-6 ${step.kind === "planned" || (step.kind === "continue" && step.href.includes("/systems/")) ? "border-[#e5b92e] bg-[#f6c945] hover:bg-[#f9d65b]" : step.kind === "new" ? "theme-new-system-action border-[#76abd0] bg-[#b9dcf5] hover:bg-[#c9e5f7]" : step.kind === "continue" ? "theme-continue-discovery-action border-[#76abd0] bg-[#b9dcf5] hover:bg-[#c9e5f7]" : "border-[#d98243] bg-[#f4b183] hover:bg-[#f8c39d]"}`}>
                  <div className="flex items-center justify-between gap-3"><strong className={`text-base ${step.kind === "new" ? "text-[#123d2b]" : step.kind === "continue" ? "text-[#103b5b]" : "text-brand"}`}>{step.title}</strong><span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white/55 ${step.kind === "new" ? "text-[#123d2b]" : step.kind === "continue" ? "text-[#103b5b]" : "text-brand"}`}><ArrowRight size={17} /></span></div>
                  <p className={`mt-3 max-w-xl text-xs leading-5 ${step.kind === "new" ? "text-[#294f3d]" : step.kind === "continue" ? "text-[#284f6b]" : "text-[#3f5870]"}`}>{step.detail}</p>
                </Link>
              ))}
              {connectedSiteSystems.length ? <button type="button" onClick={openMonitor} className="min-h-36 rounded-2xl border border-[#e5b92e] bg-[#f6c945] p-5 text-left transition hover:-translate-y-0.5 hover:bg-[#f9d65b] hover:shadow-md md:p-6"><div className="flex items-center justify-between gap-3"><strong className="text-base text-brand">Connect live systems</strong><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/55 text-brand"><Zap size={17}/></span></div><p className="mt-3 max-w-xl text-xs leading-5 text-[#3f5870]">Open live readings for {connectedSiteSystems.length === 1 ? connectedSiteSystems[0].name : `${connectedSiteSystems.length} connected systems at ${selectedSite?.name}`}.</p></button> : null}
            </div>
          </section>
        </div>
      </main>
      <LocalDevFooter />

      {welcomeOpen ? <FirstRunWelcome name={profile.displayName} onClose={dismissWelcome}/> : null}

      {wattsonOpen ? (
        <section id="wattson" className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-[#b9cad9] bg-white shadow-[0_18px_50px_rgba(9,37,61,.26)] sm:inset-x-auto sm:bottom-3 sm:right-3 sm:h-[min(520px,calc(100dvh-1.5rem))] sm:w-[min(380px,calc(100vw-1.5rem))] sm:rounded-2xl">
          <div className="wattson-panel-header flex items-center gap-2 border-b border-line bg-[linear-gradient(100deg,#eaf3fb,#fff6ce)] p-3 sm:gap-3 sm:p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Bot size={19} /></span>
            <div className="min-w-0 flex-1"><div className="eyebrow">Wattson</div><h2 className="mt-1 truncate text-sm font-extrabold">{selectedSite ? selectedSite.name : "Your solar guide"}</h2></div>
            <button type="button" onClick={() => void startAgain()} disabled={sending} className="grid size-9 place-items-center rounded-xl border border-line bg-white text-brand disabled:opacity-40" title="Start a separate chat"><RotateCcw size={14} /></button>
            <button type="button" onClick={() => setWattsonOpen(false)} className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted" aria-label="Close Wattson"><X size={16} /></button>
          </div>
          <div ref={chatScrollRef} className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-2xl px-3.5 py-3 text-[13px] leading-5 sm:max-w-[88%] sm:px-4 sm:text-xs ${message.role === "user" ? "bg-brand text-white" : "wattson-assistant-message bg-[#edf2f7] text-ink"}`}>
                  <FormattedChatMessage content={friendlyMonitoringReferences(message.content, systems)} />
                  {message.actionUrl ? <Link href={message.actionUrl} className="mt-3 flex items-center gap-2 font-bold text-brand">{message.actionLabel ?? "Open"}<ArrowRight size={13} /></Link> : null}
                </div>
              </div>
            )) : <div className="wattson-assistant-message rounded-2xl bg-[#edf2f7] p-4 text-xs leading-5">Hi{profile.displayName ? ` ${profile.displayName}` : ""}. Ask me about this site, your system, or what to do next.</div>}
            {sending ? <div className="text-xs text-muted">Wattson is thinking…</div> : null}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-line p-3">
            {attachment ? <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#9bd2ad] bg-[#f2fbf5] px-3 py-2 text-xs font-semibold text-[#17603b]" role="status"><CheckCircle2 size={16}/><span className="min-w-0 flex-1"><strong className="block">Photo attached — ready to send</strong><span className="block truncate text-[10px] font-normal text-muted">{attachment.name}</span></span><button type="button" onClick={() => setAttachment(undefined)} className="grid size-7 place-items-center rounded-lg hover:bg-white" aria-label="Remove attached image"><X size={14}/></button></div> : null}
            <div className="grid grid-cols-[max-content_minmax(0,1fr)_2.75rem] items-end gap-2 sm:flex">
              <label className="col-start-1 row-start-2 inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 text-[11px] font-bold text-brand sm:row-start-1" title="Add a photo from your camera, gallery or files"><ImagePlus size={17} /><span>Add photo</span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={sending} onChange={(event) => setAttachment(event.target.files?.[0])} /></label>
              <textarea rows={3} value={input} onChange={(event) => setInput(event.target.value)} className="field wattson-composer-input col-span-3 row-start-1 mt-0 min-h-16 w-full resize-none py-3 leading-6 sm:col-span-1 sm:min-h-[44px] sm:flex-1 sm:leading-5" placeholder="Ask Wattson…" />
              <button disabled={(!input.trim() && !attachment) || sending} className="col-start-3 row-start-2 grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40 sm:row-start-1"><Send size={16} /></button>
            </div>
          </form>
        </section>
      ) : null}

      {choosingView ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0b2740]/45 p-5 backdrop-blur-sm">
          <div className="card w-full max-w-md bg-white p-6 shadow-2xl">
            <div className="flex justify-between"><div><div className="eyebrow">Choose a system</div><h2 className="mt-2 text-xl font-extrabold">Where are you working?</h2></div><button onClick={() => setChoosingView(undefined)} aria-label="Close system picker"><X size={18} /></button></div>
            <div className="mt-5 space-y-2">{(choosingView === "monitor" ? connectedSiteSystems : siteSystems).map((system) => <Link key={system.id} href={systemHref(system, choosingView)} className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-bold hover:border-[#7aa6d1] hover:bg-[#eff5fa]"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Zap size={16} /></span>{system.name}<span className="ml-auto text-brand">›</span></Link>)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Logo() {
  return <BrandLogo />;
}

function FirstRunWelcome({ name, onClose }: { name: string; onClose: () => void }) {
  const steps = [
    ["Build a system", <>Select the green dashboard tile to begin discovery. Your answers define a custom system for your needs, and you can edit them later. Ask Wattson at any point if something is unclear.</>],
    ["Record an already-installed system", <>Select the yellow dashboard tile to build your existing system one component at a time on a schematic and record the details for each item.</>],
    ["Find everything under Systems", <>Installed or commissioned systems, new-system discovery, proposals, schematics, Build It sheets and eventual as-built records stay together under Systems.</>],
    ["Wattson is your solar guardian", <>Use <strong className="text-ink">Ask Wattson</strong> if you get stuck, need the current item explained using your Site and system records, or have a general question. You can also describe what exists or what you want to power; your answers can become a proposed design that you can edit, build on or change. Wattson is a powerful tool designed to help you.</>],
    ["Learn with How to", <>How to provides detailed explanations for installing solar components, including electrical and regulatory guidance selected from the system’s confirmed Site location. You can also use it simply to improve your solar knowledge.</>],
    ["Find the rest under Settings", <>Tools, account information, the Solar Glossary library and more are available from the Settings menu.</>],
  ];
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#0b2740]/50 p-3 backdrop-blur-sm sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="first-run-welcome-title" className="card flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]"><div className="flex shrink-0 items-start justify-between bg-[linear-gradient(110deg,#eaf3fb,#fff6ce)] p-5 sm:p-6"><div><div className="eyebrow">Your workspace is ready</div><h2 id="first-run-welcome-title" className="mt-3 font-display text-2xl font-extrabold">Welcome to PVIntell{name ? `, ${name}` : ""}</h2><p className="mt-2 text-sm leading-6 text-muted">You can come back to the dashboard whenever you need your bearings.</p></div><button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted" aria-label="Close welcome"><X size={17}/></button></div><div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">{steps.map(([title, detail], index) => <div key={String(title)} className="rounded-2xl border border-line p-4"><strong className="text-sm">{index + 1}. {title}</strong><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div>)}</div><div className="grid shrink-0 gap-2 border-t border-line bg-[#f7fafc] p-4 sm:grid-cols-2 sm:p-5"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-brand bg-white px-4 text-xs font-bold text-brand">Look around first</button><Link href="/discovery/new-system?new=1" className="grid h-11 place-items-center rounded-xl bg-brand px-4 text-xs font-bold text-white">Start my first system</Link></div></section></div>;
}

function friendlyMonitoringReferences(content: string, systems: SystemSummary[]) {
  return content.replace(/\[([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]/gi, (_match, id: string) => {
    const system = systems.find((item) => item.id.toLowerCase() === id.toLowerCase());
    return system ? `(${system.name} live monitoring)` : "(PVIntell live monitoring)";
  });
}

function WeatherPill({ icon: Icon, label }: { icon: typeof Sun; label: string }) {
  return <span className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-bold backdrop-blur-sm"><Icon size={14} className="text-[#ffe07b]" />{label}</span>;
}

function SolarYieldCurve() {
  return <svg viewBox="0 0 20 20" className="size-[18px] text-[#d99500]" fill="none" aria-hidden="true"><path d="M2 16C4.4 16 5.1 5 10 5s5.6 11 8 11H2Z" fill="currentColor" opacity=".22"/><path d="M2 16c2.4 0 3.1-11 8-11s5.6 11 8 11M2 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function forecastWeatherEmoji(hour?: SolarWeatherHour) {
  if (!hour) return "—";
  if ((hour.precipitation ?? 0) >= 0.2) return "🌧️";
  if ((hour.cloudCover ?? 0) >= 75) return "☁️";
  if ((hour.cloudCover ?? 0) >= 30) return "🌤️";
  return "☀️";
}

function Metric({ emoji, label, value, detail }: { emoji: ReactNode; label: string; value: string; detail: string }) {
  return <div className="card min-w-0 p-2 sm:p-3"><div className="truncate text-[8px] font-semibold leading-3 text-muted sm:text-[9px] sm:leading-4">{label}</div><div className="mt-1 flex min-w-0 items-center gap-1.5 sm:mt-1.5 sm:gap-2"><span aria-hidden="true" className="shrink-0 text-sm leading-none sm:text-base">{emoji}</span><div className="min-w-0 break-words font-display text-sm font-extrabold tracking-[-.035em] sm:text-lg">{value}</div></div><div className="mt-1 hidden truncate text-[8px] leading-3 text-muted sm:block" title={detail}>{detail}</div></div>;
}
