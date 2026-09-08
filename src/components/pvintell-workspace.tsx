"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  AlertTriangle,
  ArrowLeft,
  BatteryCharging,
  Bot,
  Camera,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Download,
  HelpCircle,
  Home,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Mail,
  Menu,
  Package,
  PlugZap,
  Printer,
  Send,
  ShoppingCart,
  Sparkles,
  Sun,
  Waypoints,
  WalletCards,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MockAIProvider } from "@/ai/provider";
import {
  demoProject,
  demoTelemetry,
  initialConversation,
} from "@/data/demo-project";
import {
  calculateLoads,
  sizeBattery,
  sizeInverter,
  sizeSolar,
} from "@/domain/calculations";
import type {
  ChatMessage,
  Load,
  Project,
  Site,
  SiteEquipment,
  SystemSummary,
} from "@/domain/models";
import { evaluateDiagnostics } from "@/diagnostics/rules";
import { BrowserProjectStore } from "@/persistence/project-store";
import { SiteEquipmentInventory } from "@/components/site-equipment";
import { SystemMonitor } from "@/components/system-monitor";
import { expandedHowToGuides } from "@/guides/how-to-expansion";
import { planningHowToGuides } from "@/guides/how-to-planning";
import { componentHowToGuides } from "@/guides/how-to-components";
import { howToGuideDetails } from "@/guides/how-to-details";
import { batteryHardwareHowToGuides } from "@/guides/how-to-battery-hardware";
import { coreHardwareHowToGuides } from "@/guides/how-to-core-hardware";
import { practicalBasicsHowToGuides } from "@/guides/how-to-practical-basics";
import { evChargingHowToGuides } from "@/guides/how-to-ev-charging";
import { windGenerationHowToGuides } from "@/guides/how-to-wind-generation";
import { solarHotWaterHowToGuides } from "@/guides/how-to-solar-hot-water";
import { SolarWeather } from "@/components/solar-weather";
import { BrandLogo } from "@/components/brand-logo";
import { WattsonHeaderAction } from "@/components/wattson-header-action";
import { SiteOverview } from "@/components/site-overview";
import { SystemEquipmentOverview } from "@/components/system-equipment-overview";
import { SystemTechnicalOverview } from "@/components/system-technical-overview";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import { DesignCalculator, ProposedBuildSchematic } from "@/components/design-calculator";
import type { SolarArrayForecastInput } from "@/weather/forecast";
import { usePurchasePromptPreference } from "@/preferences/financials";

export type WorkspaceView =
  | "site"
  | "overview"
  | "wattson"
  | "equipment"
  | "weather"
  | "design"
  | "proposed-schematic"
  | "system"
  | "schematic"
  | "build"
  | "shopping-list"
  | "commission"
  | "monitor";
type View = WorkspaceView;
type QuestionnaireDrafts = Record<
  string,
  {
    version: number;
    status: string;
    answers: Record<string, unknown>;
  }
>;
const ai = new MockAIProvider();
const store = new BrowserProjectStore();

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

const demoSite: Site = {
  id: "demo-site",
  name: "Demo site",
  location: demoProject.location,
  timezone: "Pacific/Auckland",
  locationSource: "manual",
  locationConfirmed: true,
};
const demoSystem: SystemSummary = {
  id: demoProject.id,
  siteId: demoSite.id,
  name: demoProject.name,
  projectType: demoProject.projectType,
  phase: demoProject.phase,
};
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber";
}) {
  const c =
    tone === "green"
      ? "bg-[#e7f0fb] text-[#175a96]"
      : tone === "amber"
        ? "bg-[#fff1cf] text-[#8b6512]"
        : "bg-[#edf2f7] text-[#566579]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${c}`}
    >
      {children}
    </span>
  );
}
function Logo() {
  return <BrandLogo />;
}
function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.045em] md:text-[30px]">
        {title}
      </h1>
      <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">
        {description}
      </p>
    </div>
  );
}

function discoverLoads(message: string, project: Project) {
  const templates: Array<{ words: string[]; load: Omit<Load, "id"> }> = [
    {
      words: ["fridge", "freezer"],
      load: {
        name: "Fridge / freezer",
        watts: 140,
        quantity: 1,
        hoursPerDay: 10,
        surgeWatts: 700,
        currentType: "AC",
        confidence: "estimated",
        simultaneous: true,
      },
    },
    {
      words: ["water pump", "pump"],
      load: {
        name: "Water pump",
        watts: 1200,
        quantity: 1,
        hoursPerDay: 1,
        surgeWatts: 3600,
        currentType: "AC",
        confidence: "estimated",
        simultaneous: true,
      },
    },
    {
      words: ["television", "tv"],
      load: {
        name: "TV",
        watts: 110,
        quantity: 1,
        hoursPerDay: 4,
        surgeWatts: 110,
        currentType: "AC",
        confidence: "estimated",
        simultaneous: true,
      },
    },
    {
      words: ["microwave"],
      load: {
        name: "Microwave",
        watts: 1500,
        quantity: 1,
        hoursPerDay: 0.3,
        surgeWatts: 1800,
        currentType: "AC",
        confidence: "estimated",
        simultaneous: false,
      },
    },
  ];
  const lower = message.toLowerCase();
  const additions = templates
    .filter(
      (t) =>
        t.words.some((w) => lower.includes(w)) &&
        !project.loads.some((l) => l.name === t.load.name),
    )
    .map((t) => ({ ...t.load, id: crypto.randomUUID() }));
  return additions.length
    ? { ...project, loads: [...project.loads, ...additions] }
    : project;
}

export function PVIntellWorkspace({
  initialProject = demoProject,
  initialMessages = initialConversation,
  initialConversationId,
  initialSite = demoSite,
  sites = [demoSite],
  systems = [demoSystem],
  initialSiteEquipment = [],
  cloud = false,
  sitePage = false,
  systemPage = false,
  initialView,
  initialWattsonPrompt,
  email = "",
  showGoogleWelcome = false,
}: {
  initialProject?: Project;
  initialMessages?: ChatMessage[];
  initialConversationId?: string;
  initialSite?: Site;
  sites?: Site[];
  systems?: SystemSummary[];
  initialQuestionnaires?: QuestionnaireDrafts;
  initialSiteEquipment?: SiteEquipment[];
  cloud?: boolean;
  sitePage?: boolean;
  systemPage?: boolean;
  initialView?: WorkspaceView;
  initialWattsonPrompt?: string;
  email?: string;
  showGoogleWelcome?: boolean;
}) {
  useCloseFloatingMenus();
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [view, setView] = useState<View>(
    initialView ?? (systemPage ? (initialProject.phase === "monitor" ? "overview" : "system") : sitePage ? "site" : "wattson"),
  );
  const [messages, setMessages] = useState(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [input, setInput] = useState(initialWattsonPrompt ?? "");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [expandedSiteId, setExpandedSiteId] = useState(initialSite.id);
  const [equipmentToEdit, setEquipmentToEdit] = useState<string>();
  const loads = useMemo(() => calculateLoads(project.loads), [project.loads]);
  const solar = useMemo(
    () =>
      sizeSolar({ dailyWh: loads.dailyWh, peakSunHours: project.peakSunHours }),
    [loads.dailyWh, project.peakSunHours],
  );
  const installedSolarKw = useMemo(
    () =>
      project.pvArrays.reduce(
        (total, array) =>
          total + (array.panelWatts ?? 0) * (array.panelCount ?? 0),
        0,
      ) / 1000,
    [project.pvArrays],
  );
  const installedSolarArrays = useMemo<SolarArrayForecastInput[]>(
    () => project.pvArrays.flatMap((array) => {
      const capacityKw = (array.panelWatts ?? 0) * (array.panelCount ?? 0) / 1000;
      if (capacityKw <= 0) return [];
      return [{
        capacityKw,
        azimuthDegrees: array.orientationDegrees ?? null,
        tiltDegrees: array.tiltDegrees ?? null,
      }];
    }),
    [project.pvArrays],
  );
  const battery = useMemo(
    () =>
      sizeBattery({
        dailyWh: loads.dailyWh,
        autonomyDays: project.autonomyDays,
        systemVoltage: project.systemVoltage,
      }),
    [loads.dailyWh, project.autonomyDays, project.systemVoltage],
  );
  const inverter = useMemo(() => sizeInverter(loads), [loads]);
  const findings = useMemo(
    () =>
      evaluateDiagnostics({
        current: demoTelemetry,
        inverterRatedWatts: 8000,
        lowBatteryVoltage: 48,
        isDaylight: true,
      }),
    [],
  );
  const monitorOnly = ["monitor", "diagnose", "maintain", "explain"].includes(project.phase);
  const hasProjectHistory = project.goal !== "Record equipment that is already installed";
  const viewingProjectHistory = monitorOnly && hasProjectHistory && ["design", "proposed-schematic", "build", "commission"].includes(view);
  function persist(p: Project) {
    setProject(p);
    if (cloud) {
      void fetch(`/api/projects/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      });
    } else store.save(p);
  }
  async function completeCommissioning() {
    if (cloud) {
      const response = await fetch(`/api/systems/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phase: "monitor" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not mark this system as commissioned.");
    }
    setProject((current) => ({ ...current, phase: "monitor" }));
    setView("overview");
    router.refresh();
  }
  function openDiscovery() {
    router.push(cloud ? `/sites/${initialSite.id}/discovery` : "/discovery/new-system");
  }
  async function send(text = input) {
    const message = text.trim();
    const start = message.match(/^I want to start with: (.*?)\./);
    if (start) {
      openDiscovery();
      return;
    }
    if (!message || sending) return;
    const updated = discoverLoads(message, project);
    persist(updated);
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");
    setSending(true);
    let reply: string;
    let citations: ChatMessage["citations"];
    let actionUrl: string | undefined;
    let actionLabel: string | undefined;
    try {
      if (cloud) {
        const response = await fetch("/api/wattson", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message,
            projectId: updated.id,
            project: updated,
            conversationId,
          }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "Wattson is unavailable");
        if (typeof body.conversationId === "string") setConversationId(body.conversationId);
        reply = body.message;
        citations = body.citations;
        actionUrl = body.actionUrl;
        actionLabel = body.actionLabel;
        if (body.actions?.length) router.refresh();
      } else
        reply = await ai.sendMessage(message, {
          project: updated,
          telemetry: demoTelemetry,
          findings,
        });
    } catch (error) {
      reply =
        error instanceof Error
          ? `I couldn't reach the cloud service just now: ${error.message}. Your project changes are still saved.`
          : "I couldn't reach the cloud service just now.";
    }
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
        createdAt: new Date().toISOString(),
        citations,
        actionUrl,
        actionLabel,
      },
    ]);
    setSending(false);
  }

  useEffect(() => {
    const prompt = sessionStorage.getItem("pvintell:wattson-prompt");
    if (!prompt) return;
    sessionStorage.removeItem("pvintell:wattson-prompt");
    setView("wattson");
    void send(prompt);
    // This is a one-time handoff from the persistent How-to menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendImage(file: File) {
    if (sending) return;
    const message =
      "Please inspect this attached image. Extract only values that are clearly visible. If it belongs to an existing system item and the match is unambiguous, update that record; otherwise ask me which item it belongs to.";
    const preview = URL.createObjectURL(file);
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: `Photo attached: ${file.name}`,
        createdAt: new Date().toISOString(),
        imageUrl: preview,
      },
    ]);
    setSending(true);
    try {
      const body = new FormData();
      body.set("message", message);
      body.set("projectId", project.id);
      body.set("project", JSON.stringify(project));
      if (conversationId) body.set("conversationId", conversationId);
      body.set("file", file);
      const response = await fetch("/api/wattson", { method: "POST", body });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Wattson could not inspect the image");
      if (typeof result.conversationId === "string") setConversationId(result.conversationId);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.message,
          createdAt: new Date().toISOString(),
          citations: result.citations,
        },
      ]);
      if (result.actions?.length) router.refresh();
    } catch (problem) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            problem instanceof Error
              ? problem.message
              : "Wattson could not inspect the image.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }
  const nav = [
    ...(sitePage
      ? [{ id: "site" as View, label: "Site overview", icon: Home }]
      : []),
    { id: "equipment" as View, label: "Site equipment", icon: Package },
    { id: "design" as View, label: "Proposed design", icon: Calculator },
    { id: "overview" as View, label: "System overview", icon: LayoutDashboard },
    { id: "system" as View, label: "As-built equipment", icon: Package },
    { id: "schematic" as View, label: "As-built schematic", icon: Waypoints },
    { id: "build" as View, label: "Build", icon: Wrench },
    { id: "shopping-list" as View, label: "Shopping list", icon: ShoppingCart },
    { id: "commission" as View, label: "Startup & Handover", icon: ClipboardCheck },
    { id: "monitor" as View, label: "Monitor", icon: CircleGauge },
  ];
  const outlineReady = ["solar-array", "inverter", "battery", "protection"].every((id) => project.designCalculator?.proposedChecklist?.[id]);
  const proposedSchematicReviewed = project.designCalculator?.proposedChecklist?.["proposed-schematic"] ?? false;
  const currentViewLabel = monitorOnly && view === "wattson" ? "Installed system" : view === "proposed-schematic" ? "Proposed schematic" : nav.find((item) => item.id === view)?.label ?? (monitorOnly ? "Installed system" : "Project planning");
  async function askGuide(guide: NoviceHowToGuide, question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) {
    if (!cloud) {
      const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
      const relatedType = guide.types?.find((type) => terms.some((term) => `${type.name} ${type.description}`.toLowerCase().includes(term)));
      return { message: relatedType ? `${relatedType.name}: ${relatedType.description}${relatedType.bestFor ? ` It is usually used for ${relatedType.bestFor.toLowerCase()}` : ""}${relatedType.watchFor ? ` Check: ${relatedType.watchFor}` : ""}` : `${guide.whatItIs} ${guide.whatItDoes}` };
    }
    const response = await fetch("/api/wattson/guide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: question, projectId: project.id, project, guide, recentConversation, guideIndex: allHowToGuides.map(({ id, title, group, aliases }) => ({ id, title, group, aliases })) }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
    return body;
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
        {cloud && <Link
          href="/discovery/new-system"
          className="mt-5 flex items-center gap-3 rounded-xl bg-[#f6c945] px-3 py-3 text-xs font-extrabold text-[#143c63]"
        >
          <Sparkles size={16} />
          New independent Site
          <ChevronRight className="ml-auto" size={14} />
        </Link>}
        <button
          onClick={() => setView("wattson")}
          className={`${cloud ? "mt-2" : "mt-5"} flex items-center gap-3 rounded-xl bg-brand px-3 py-3 text-xs font-bold text-white`}
        >
          <Sparkles size={16} />
          Continue project
          <ChevronRight className="ml-auto" size={14} />
        </button>
        {cloud && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-2">
            <div className="px-2 py-1">
              <div className="eyebrow text-[#7b8a9c]">My sites</div>
            </div>
            <div className="mt-2 space-y-1">
              {sites.map((site) => {
                const active = site.id === initialSite.id;
                const expanded = expandedSiteId === site.id;
                const className = `flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold ${active ? "bg-[#fff6cf] text-brand" : "text-muted hover:bg-[#eef3f8]"}`;
                return <div key={site.id} className="space-y-0.5"><button type="button" onClick={() => active ? setExpandedSiteId(expanded ? "" : site.id) : router.push(`/sites/${site.id}`)} className={className}><MapPin size={12}/><span className="min-w-0 flex-1 truncate">{site.name}</span>{expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button>{expanded && <div className="ml-4 space-y-0.5 border-l border-[#dbe5ef] pl-2"><Link href={`/sites/${site.id}`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Project home</Link><Link href={`/sites/${site.id}/discovery?system=${project.id}`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Discovery brief</Link>{active && <><Link href={`/sites/${site.id}/wattson`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-muted hover:bg-[#eaf2fb] hover:text-brand">Continue with Wattson</Link><Link href={`/sites/${site.id}/systems/${project.id}/design`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#b9412b] hover:bg-[#fff1ee]">Proposed outline</Link>{outlineReady ? <Link href={`/sites/${site.id}/systems/${project.id}/design/schematic`} className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#b9412b] hover:bg-[#fff1ee]">Proposed schematic</Link> : <span className="flex rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#9aa8b6]">Proposed schematic · locked</span>}<button disabled={!proposedSchematicReviewed} onClick={() => setView("build")} className={`flex w-full rounded-lg px-2 py-1.5 text-left text-[10px] font-bold ${proposedSchematicReviewed ? "text-muted hover:bg-[#eaf2fb] hover:text-brand" : "cursor-not-allowed text-[#9aa8b6]"}`}>{proposedSchematicReviewed ? "Build plan" : "Build plan · locked"}</button></>}</div>}</div>;
              })}
            </div>
          </div>
        )}
        <nav className="mt-5 space-y-1">
          {cloud && (
            <Link
              href="/dashboard"
              className="flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"
            >
              <LayoutDashboard size={17} />
              All sites
            </Link>
          )}
          {cloud && <div className="px-3 pt-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#7b8a9c]">Site tools</div>}
          {nav.filter(({ id }) => !cloud || ["equipment", "weather"].includes(id)).map(({ id, label, icon: Icon }) =>
            id === "weather" || id === "design" || id === "schematic" ? (
              <Link
                key={id}
                prefetch={id !== "weather"}
                href={
                  id === "weather"
                    ? `/sites/${initialSite.id}/weather`
                    : id === "design"
                      ? `/sites/${initialSite.id}/systems/${project.id}/design`
                    : `/sites/${initialSite.id}/systems/${project.id}/schematic`
                }
                className="flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-sm font-semibold text-[#66758a] hover:bg-[#eef3f8]"
              >
                <Icon size={17} />
                {label}
              </Link>
            ) : (
              <button
                key={id}
                onClick={() => {
                  setView(id);
                  setMenu(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 text-sm font-semibold ${view === id ? "border-[#f6c945] bg-[#fff6cf] text-[#143c63]" : "border-transparent text-[#66758a] hover:bg-[#eef3f8]"}`}
              >
                <Icon size={17} />
                {label}
              </button>
            ),
          )}
        </nav>
        <div className="mt-auto rounded-2xl border border-line bg-white p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="size-2 rounded-full bg-[#2f80c1]" />
            {cloud ? "Cloud systems saved" : "Demo system online"}
          </div>
          <p className="mt-2 truncate text-[10px] leading-4 text-muted">
            {cloud ? email : "Live-shaped sample data. No hardware connected."}
          </p>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="system-workspace-header sticky top-0 z-50 border-b border-line bg-[rgba(248,250,252,.98)]">
          <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-4 px-4 md:px-6">
            <Link href="/dashboard" className="shrink-0"><Logo /></Link>
            {cloud && <WattsonHeaderAction siteId={initialSite.id}/>} 
            {cloud && <details className="relative hidden shrink-0 md:block"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold text-brand"><MapPin size={13}/><span className="max-w-32 truncate">{initialSite.name}</span><ChevronDown size={13}/></summary><div className="absolute left-0 top-11 z-50 w-64 rounded-2xl border border-line bg-white p-3 shadow-xl"><div className="eyebrow px-2 pb-2">My Sites</div><div className="space-y-1">{sites.map((site) => <Link key={site.id} href={`/sites/${site.id}`} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${site.id === initialSite.id ? "bg-[#fff6cf] text-brand" : "text-muted hover:bg-[#eef3f8]"}`}><MapPin size={12}/><span className="truncate">{site.name}</span></Link>)}</div><Link href="/discovery/new-system" className="mt-3 flex items-center gap-2 rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-[#143c63]"><Sparkles size={13}/>New independent Site</Link></div></details>}
             <div className="hidden min-w-0 flex-1 border-l border-line pl-4 md:block">
              <div className="eyebrow text-[8px]">{currentViewLabel}</div>
               <div className="mt-1 truncate text-xs font-extrabold">{project.name} <span className="font-medium text-muted">· {project.location} · {project.projectType}</span></div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {cloud && <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation"><Link href={`/dashboard?site=${initialSite.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Dashboard</Link><Link href={`/systems?site=${initialSite.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Systems</Link><Link href={`/how-to?site=${initialSite.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">How to</Link><Link href={`/settings?site=${initialSite.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Settings</Link></nav>}
              <button type="button" onClick={() => setMenu((open) => !open)} className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted md:hidden" aria-label={menu ? "Close navigation" : "Open navigation"} aria-expanded={menu}>{menu ? <X size={17}/> : <Menu size={18}/>}</button>
              </div>
            </div>
            {view !== "monitor" && <nav className="mx-auto hidden max-w-[1440px] flex-wrap items-center gap-1 border-t border-line px-6 py-1.5 md:flex" aria-label="System navigation">
            <button type="button" onClick={() => setView("site")} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold ${view === "site" ? "bg-[#fff6cf] text-brand" : "text-muted hover:bg-[#eef3f8]"}`}>Site</button>
            {!monitorOnly && <details className="relative shrink-0"><summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Plan ▾</summary><div className="fixed left-auto z-50 mt-1 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl"><Link href={`/sites/${initialSite.id}/discovery?system=${project.id}`} className="block rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Discovery brief</Link><button type="button" onClick={() => setView("wattson")} className="block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Continue planning with Wattson</button><Link href={`/sites/${initialSite.id}/systems/${project.id}/design`} className="block rounded-xl px-3 py-2 text-[11px] font-bold text-[#b9412b] hover:bg-[#fff1ee]">Proposed system outline</Link>{outlineReady ? <Link href={`/sites/${initialSite.id}/systems/${project.id}/design/schematic`} className="block rounded-xl px-3 py-2 text-[11px] font-bold text-[#b9412b] hover:bg-[#fff1ee]">Proposed build schematic</Link> : <span className="block rounded-xl px-3 py-2 text-[11px] font-bold text-[#9aa8b6]">Proposed schematic · locked</span>}</div></details>}
            {monitorOnly && hasProjectHistory && <details className="relative shrink-0"><summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Project history ▾</summary><div className="fixed left-auto z-50 mt-1 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl"><Link href={`/sites/${initialSite.id}/discovery`} className="block rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Original discovery brief</Link><Link href={`/sites/${initialSite.id}/systems/${project.id}/design`} className="block rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Original proposed design</Link>{outlineReady ? <Link href={`/sites/${initialSite.id}/systems/${project.id}/design/schematic`} className="block rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Original proposed schematic</Link> : null}<button type="button" onClick={() => setView("build")} className="block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Build record</button><button type="button" onClick={() => setView("commission")} className="block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Startup & handover record</button></div></details>}
            {!monitorOnly && <details className="relative shrink-0"><summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Build ▾</summary><div className="fixed left-auto z-50 mt-1 w-56 rounded-2xl border border-line bg-white p-2 shadow-xl"><button type="button" disabled={!proposedSchematicReviewed} onClick={() => setView("build")} className={`block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold ${proposedSchematicReviewed ? "text-muted hover:bg-[#eef3f8]" : "cursor-not-allowed text-[#9aa8b6]"}`}>{proposedSchematicReviewed ? "Build schedule" : "Build schedule · locked"}</button><button type="button" onClick={() => setView("commission")} className="block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Startup & Handover</button></div></details>}
            <details className="relative shrink-0"><summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">System records ▾</summary><div className="fixed left-auto z-50 mt-1 w-56 rounded-2xl border border-line bg-white p-2 shadow-xl"><button type="button" onClick={() => setView("overview")} className="block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold text-muted hover:bg-[#eef3f8]">System overview</button><button type="button" onClick={() => setView("system")} className="block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold text-muted hover:bg-[#eef3f8]">As-built equipment</button><Link href={`/sites/${initialSite.id}/systems/${project.id}/schematic`} className="block rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">As-built schematic</Link><button type="button" onClick={() => setView("equipment")} className="block w-full rounded-xl px-3 py-2 text-left text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Site equipment</button></div></details>
            {monitorOnly && <button type="button" onClick={() => setView("monitor")} className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold text-muted hover:bg-[#eef3f8]">Monitor</button>}
           </nav>}
            {menu ? <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white p-3 md:hidden" aria-label="Mobile navigation"><div className="grid gap-1">
              {cloud ? <><Link href={`/dashboard?site=${initialSite.id}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Dashboard</Link><Link href={`/systems?site=${initialSite.id}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Systems</Link></> : null}
              {view !== "monitor" ? <><div className="my-1 border-t border-line" />
              <button type="button" onClick={() => { setView("site"); setMenu(false); }} className="mobile-nav-item">Site</button>
              {(!monitorOnly || hasProjectHistory) && <><Link href={`/sites/${initialSite.id}/discovery?system=${project.id}`} className="mobile-nav-item">{monitorOnly ? "Original discovery" : "Discovery"}</Link>
              <Link href={`/sites/${initialSite.id}/systems/${project.id}/design`} className="mobile-nav-item">{monitorOnly ? "Original proposed design" : "Proposed design"}</Link>
              {outlineReady ? <Link href={`/sites/${initialSite.id}/systems/${project.id}/design/schematic`} className="mobile-nav-item">{monitorOnly ? "Original proposed schematic" : "Proposed schematic"}</Link> : null}
              <button type="button" disabled={!monitorOnly && !proposedSchematicReviewed} onClick={() => { setView("build"); setMenu(false); }} className="mobile-nav-item disabled:opacity-45">{monitorOnly ? "Build record" : proposedSchematicReviewed ? "Build schedule" : "Build schedule · locked"}</button>
              <button type="button" onClick={() => { setView("commission"); setMenu(false); }} className="mobile-nav-item">{monitorOnly ? "Startup & handover record" : "Startup & Handover"}</button></>}
              <button type="button" onClick={() => { setView("overview"); setMenu(false); }} className="mobile-nav-item">System overview</button>
              <button type="button" onClick={() => { setView("system"); setMenu(false); }} className="mobile-nav-item">As-built equipment</button>
              <Link href={`/sites/${initialSite.id}/systems/${project.id}/schematic`} className="mobile-nav-item">As-built schematic</Link>
              <button type="button" onClick={() => { setView("equipment"); setMenu(false); }} className="mobile-nav-item">Site equipment</button>
              {monitorOnly ? <button type="button" onClick={() => { setView("monitor"); setMenu(false); }} className="mobile-nav-item">Monitor</button> : null}</> : null}
              <div className="my-1 border-t border-line" />
              <Link href={`/how-to?site=${initialSite.id}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">How to</Link>
              <Link href={`/settings?site=${initialSite.id}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Settings</Link>
            </div></nav> : null}
         </header>
         <div className={`mx-auto max-w-[1320px] p-4 md:p-6 ${view === "proposed-schematic" || view === "schematic" ? "schematic-workspace-content" : ""}`}>
           {systemPage && <Link href={`/systems?site=${initialSite.id}`} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-brand"><ArrowLeft size={14}/>Back to systems</Link>}
           {viewingProjectHistory ? <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#efd98e] bg-[#fff9e3] px-4 py-3 text-[11px] leading-5 text-[#765918]"><ClipboardCheck className="mt-0.5 shrink-0" size={15}/><p><strong>Project history.</strong> This is the retained discovery, proposal, build or commissioning record for an installed system. Current equipment belongs in the as-built records.</p></div> : null}
          {view === "site" && (
            <SiteOverview
              site={initialSite}
              systems={systems}
              activeSystemId={project.id}
              components={project.components}
              equipment={initialSiteEquipment}
              solarArrayKw={installedSolarKw}
              solarArrays={installedSolarArrays}
              onAddSystem={() => router.push("/discovery/new-system")}
              onOpenSystem={() => setView("system")}
              onOpenWeather={() =>
                router.push(`/sites/${initialSite.id}/weather`)
              }
              onOpenEquipment={(id) => {
                setEquipmentToEdit(id || undefined);
                setView("equipment");
              }}
            />
          )}{" "}
          {view === "wattson" && (
            <Wattson
              messages={messages}
              input={input}
              setInput={setInput}
              send={send}
              sending={sending}
              project={project}
              loads={loads}
              solar={solar}
              battery={battery}
              inverter={inverter}
            />
          )}{" "}
          {view === "equipment" && (
            <SiteEquipmentInventory
              siteId={initialSite.id}
              projectId={project.id}
              initialEquipment={initialSiteEquipment}
              initialEditId={equipmentToEdit}
            />
          )}{" "}
          {view === "weather" && (
            <SolarWeather site={initialSite} solarArrayKw={installedSolarKw} solarArrays={installedSolarArrays} />
          )}{" "}
          {view === "design" && <DesignCalculator project={project} site={initialSite} />}{" "}
          {view === "proposed-schematic" && <ProposedBuildSchematic project={project} site={initialSite} />}{" "}
          {view === "overview" && (
            <SystemTechnicalOverview
              project={project}
              onAskWattson={() => setView("wattson")}
              onOpenMonitor={() => setView("monitor")}
            />
          )}{" "}
          {view === "system" && (
            <SystemEquipmentOverview
              project={project}
              onAskWattson={() => setView("wattson")}
            />
          )}{" "}
          {view === "build" && <Build project={project} location={initialSite.location} onAskGuide={askGuide} />}{" "}
          {view === "shopping-list" && <Build project={project} location={initialSite.location} onAskGuide={askGuide} shoppingListOnly />}{" "}
          {view === "commission" && (
            <Commission project={project} complete={completeCommissioning} />
          )}{" "}
          {view === "monitor" && (
            <SystemMonitor project={project} site={initialSite} />
          )}
        </div>
      </main>
      {view === "wattson" && cloud && (
        <WattsonPhotoButton disabled={sending} send={sendImage} />
      )}{" "}
      {showGoogleWelcome && <GoogleWelcome />}
    </div>
  );
}

function GoogleWelcome() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b2740]/45 p-5 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-welcome-title"
        className="card w-full max-w-md bg-white p-7 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#eaf2fb] font-bold text-[#4285f4]">
            G
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-[#eef3f8]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="eyebrow mt-6">Account created</div>
        <h2
          id="google-welcome-title"
          className="mt-3 font-display text-2xl font-extrabold tracking-[-.04em]"
        >
          Welcome to PVIntell
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Your account currently signs in with Google. You can keep using
          Google, or set a PVIntell password from Account settings if you also
          want email-and-password login.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setOpen(false)}
            className="h-11 rounded-xl border border-line bg-white text-xs font-bold"
          >
            Continue with Google
          </button>
          <Link
            href="/account"
            className="grid h-11 place-items-center rounded-xl bg-brand text-xs font-bold text-white"
          >
            Set a password
          </Link>
        </div>
      </div>
    </div>
  );
}

function Wattson({
  messages,
  input,
  setInput,
  send,
  sending,
  project,
  loads,
  solar,
  battery,
  inverter,
}: any) {
  const conversationRef = useRef<HTMLDivElement>(null);
  const installed = ["monitor", "diagnose", "maintain", "explain"].includes(project.phase);
  const installedPvWatts = project.pvArrays.reduce((total: number, array: { panelWatts?: number; panelCount?: number }) => total + Number(array.panelWatts ?? 0) * Number(array.panelCount ?? 0), 0);
  const installedBatteryCount = project.components.filter((component: { kind?: string; name?: string }) => component.kind === "battery" || /\bbatter(?:y|ies)\b/i.test(component.name ?? "")).reduce((total: number, component: { quantity?: number }) => total + Number(component.quantity ?? 1), 0);
  const installedInverterCount = project.components.filter((component: { kind?: string; name?: string }) => component.kind === "inverter" || /\binverter\b/i.test(component.name ?? "")).reduce((total: number, component: { quantity?: number }) => total + Number(component.quantity ?? 1), 0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const conversation = conversationRef.current;
      if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, sending]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="card overflow-hidden">
        <div className="border-b border-line bg-[linear-gradient(125deg,#fafcfe_10%,#fff7d6)] px-5 py-5 md:px-6">
          <div className="flex gap-4">
            <div>
              <div className="eyebrow">System-specific Wattson</div>
              <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.045em] md:text-[30px]">
                {installed ? "Ask about this installed system" : "Ask about this proposed system"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                {installed ? "Wattson uses this system’s as-built equipment, connections, saved knowledge and monitoring records. Ask about operation, expansion, maintenance or a fault without reopening the proposed build." : "Wattson already has this system’s discovery, calculations and proposed arrangement. Ask about a component, connection or design decision without starting over."}
              </p>
            </div>
          </div>
        </div>
        <div ref={conversationRef} className="wattson-conversation thin-scrollbar space-y-3 overflow-y-auto p-4 md:p-5">
          {messages.map((m: ChatMessage) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand text-white">
                  <Sparkles size={13} />
                </span>
              )}
              <div
                className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-xs leading-5 ${m.role === "user" ? "rounded-br-md bg-[#123b66] text-white" : "rounded-tl-md bg-[#eef3f8]"}`}
              >
                {m.imageUrl && (
                  <a href={m.imageUrl} target="_blank" rel="noreferrer">
                    {/* Private signed storage URL; native img avoids a public remote-image allowlist. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.imageUrl}
                      alt="Photo attached to Wattson chat"
                      className="mb-3 max-h-64 w-full rounded-xl object-contain"
                    />
                  </a>
                )}
                <FormattedChatMessage content={m.content}/>
                {m.citations?.length ? (
                  <div className="mt-3 border-t border-[#d4dee8] pt-2 text-[10px]">
                    <strong>Sources</strong>
                    {m.citations.map((citation, index) => (
                      <a
                        key={citation.url}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate font-semibold text-brand hover:underline"
                      >
                        {index + 1}. {citation.title}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {sending && (
            <div className="text-xs text-muted">Wattson is thinking…</div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="m-6 mt-0 flex items-end gap-2 rounded-2xl border border-[#cfdae5] bg-white p-2 shadow-lg"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={installed ? "Ask about this system, a reading, fault, setting or possible expansion…" : "I’m building a small cabin and need a fridge, lights and water pump…"}
            className="min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-base leading-6 outline-none sm:min-h-0 sm:text-xs sm:leading-5"
          />
          <button
            disabled={!input.trim()}
            className="grid size-10 place-items-center rounded-xl bg-brand text-white disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </section>
      <aside className="space-y-5">
        <div className="card p-5">
          <div className="flex justify-between">
            <div className="eyebrow">{installed ? "Installed record" : "Working design"}</div>
            <Badge>{project.assumptions.length} assumptions</Badge>
          </div>
          <div className="mt-5 space-y-4">
            <Rec
              icon={Sun}
              label="Solar"
              value={`${((installed ? installedPvWatts : solar.suggestedWatts) / 1000).toFixed(1)} kW`}
              detail={installed ? `${project.pvArrays.length} recorded PV string${project.pvArrays.length === 1 ? "" : "s"}` : `${solar.panelCount} × ${solar.panelWatts} W panels`}
            />
            <Rec
              icon={BatteryCharging}
              label="Battery"
              value={installed ? (installedBatteryCount ? `${installedBatteryCount} recorded` : "None recorded") : `${battery.usableKWh} kWh`}
              detail={installed ? "Installed battery records" : `${battery.nominalKWh} kWh nominal`}
            />
            <Rec
              icon={PlugZap}
              label="Inverter"
              value={installed ? (installedInverterCount ? `${installedInverterCount} recorded` : "None recorded") : `${(inverter.recommendedWatts / 1000).toFixed(1)} kW`}
              detail={installed ? "Installed inverter records" : "Includes surge headroom"}
            />
          </div>
          <button
            onClick={() => send(installed ? "Summarise my installed system record and identify any missing details." : "Why do I need this inverter size?")}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8f0f8] py-2.5 text-xs font-bold"
          >
            <HelpCircle size={14} />
            {installed ? "Summarise this system" : "Explain this design"}
          </button>
        </div>
        <div className="card p-5">
          <div className="eyebrow">What Wattson knows</div>
          <div className="mt-4 space-y-3">
            {installed ? <><Fact label="PV strings" value={`${project.pvArrays.length}`} /><Fact label="Equipment records" value={`${project.components.length}`} /><Fact label="Connections" value={`${project.connections.length}`} /></> : <><Fact label="Daily energy" value={`${loads.dailyKWh} kWh`} /><Fact label="Tracked loads" value={`${project.loads.length}`} /><Fact label="Reserve" value={`${project.autonomyDays} days`} /></>}
          </div>
          <p className="mt-4 rounded-xl bg-[#fff5d9] p-3 text-[10px] text-[#765c1c]">
            <Lightbulb className="mr-1 inline" size={12} /> {installed ? "Answers use the installed record, not the old proposal." : "Estimates stay visible until confirmed."}
          </p>
        </div>
      </aside>
    </div>
  );
}
function Rec({ icon: Icon, label, value, detail }: any) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-[#eaf2fb] text-brand">
        <Icon size={17} />
      </span>
      <div>
        <div className="text-[10px] text-muted">{label}</div>
        <div className="font-display text-lg font-extrabold">{value}</div>
        <div className="text-[10px] text-muted">{detail}</div>
      </div>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line pb-2.5 text-xs">
      <span className="text-muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: any;
}) {
  return (
    <div className="card flex min-h-36 flex-col justify-between p-5">
      <div className="flex justify-between">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <span className="grid size-8 place-items-center rounded-xl bg-[#e6f0fa] text-brand">
          <Icon size={16} />
        </span>
      </div>
      <div>
        <div className="font-display text-[28px] font-extrabold tracking-[-.045em]">
          {value}
        </div>
        <div className="text-[11px] text-muted">{detail}</div>
      </div>
    </div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function System({
  project,
  loads,
  solar,
  battery,
  inverter,
  technical,
  setTechnical,
  persist,
}: any) {
  return (
    <div className="animate-rise space-y-6">
      <Heading
        eyebrow="Design"
        title="Your system, without the guesswork"
        description="A living design built from what you’ve told Wattson. Estimated details stay marked until confirmed."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Daily use"
          value={`${loads.dailyKWh} kWh`}
          detail="Estimated average day"
          icon={Zap}
        />
        <Metric
          label="Solar array"
          value={`${(solar.suggestedWatts / 1000).toFixed(1)} kW`}
          detail={`${solar.panelCount} panels suggested`}
          icon={Sun}
        />
        <Metric
          label="Battery"
          value={`${battery.usableKWh} kWh`}
          detail={`${project.autonomyDays} days reserve`}
          icon={BatteryCharging}
        />
        <Metric
          label="Inverter"
          value={`${(inverter.recommendedWatts / 1000).toFixed(1)} kW`}
          detail="Includes load headroom"
          icon={PlugZap}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="card p-6">
          <div className="flex justify-between">
            <div>
              <div className="eyebrow">Power flow</div>
              <h2 className="mt-2 font-display text-xl font-extrabold">
                As-built power flow
              </h2>
            </div>
            <button
              onClick={() => setTechnical(!technical)}
              className="rounded-xl border border-line px-3 text-[10px] font-bold"
            >
              {technical ? "Simple view" : "Show technical"}
            </button>
          </div>
          <Flow technical={technical} />
        </div>
        <div className="card p-5">
          <div className="flex justify-between">
            <div className="eyebrow">Assumptions</div>
            <Badge tone="amber">Needs review</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {project.assumptions.map((a: any) => (
              <div
                key={a.id}
                className="rounded-xl border border-line bg-white p-3"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="text-xs font-bold">{a.label}</div>
                    <div className="mt-1 text-[11px] text-muted">{a.value}</div>
                  </div>
                  <Badge
                    tone={a.confidence === "confirmed" ? "green" : "amber"}
                  >
                    {a.confidence}
                  </Badge>
                </div>
                {a.confidence === "estimated" && (
                  <button
                    onClick={() =>
                      persist({
                        ...project,
                        assumptions: project.assumptions.map((x: any) =>
                          x.id === a.id ? { ...x, confidence: "confirmed" } : x,
                        ),
                      })
                    }
                    className="mt-3 text-[10px] font-bold text-brand"
                  >
                    Confirm value →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line px-6 py-5">
          <div className="eyebrow">Load model</div>
          <h2 className="mt-2 font-display text-lg font-extrabold">
            What you want to run
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="bg-[#f2f6fa] text-[10px] uppercase text-muted">
              <tr>
                <th className="px-6 py-3">Load</th>
                <th>Power</th>
                <th>Use/day</th>
                <th>Energy/day</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {project.loads.map((l: any) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-6 py-3.5 font-bold">{l.name}</td>
                  <td>{l.watts} W</td>
                  <td>{l.hoursPerDay} h</td>
                  <td>
                    {((l.watts * l.quantity * l.hoursPerDay) / 1000).toFixed(2)}{" "}
                    kWh
                  </td>
                  <td>
                    <Badge
                      tone={l.confidence === "confirmed" ? "green" : "amber"}
                    >
                      {l.confidence}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function Flow({ technical }: { technical: boolean }) {
  const nodes = [
    ["PV array", "5.4 kW", Sun, "2×6 • Voc 247V"],
    ["Hybrid inverter", "8.0 kW", PlugZap, "MPPT 120–430V"],
    ["Battery bank", "20.5 kWh", BatteryCharging, "51.2V • 400Ah"],
    ["Home loads", "1.24 kW", Home, "230V • 50Hz"],
  ] as const;
  return (
    <div className="mt-7 flex flex-col gap-3 md:flex-row md:items-center">
      {nodes.map(([l, v, I, t], i) => (
        <div key={l} className="contents">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-white p-4 md:flex-col md:text-center">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#eaf2fb] text-brand">
              <I size={19} />
            </span>
            <div>
              <div className="text-xs font-bold">{l}</div>
              <div className="text-[10px] text-muted">{v}</div>
              {technical && (
                <div className="font-mono text-[9px] text-muted">{t}</div>
              )}
            </div>
          </div>
          {i < 3 && (
            <ChevronRight
              className="mx-auto rotate-90 text-muted md:rotate-0"
              size={14}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export type NoviceHowToGuide = {
  group: string;
  id: string;
  title: string;
  aliases?: readonly string[];
  image: string;
  summary: string;
  whatItIs?: string;
  whatItDoes?: string;
  types?: readonly {
    name: string;
    description: string;
    image?: string;
    imageCredit?: string;
    imageSourceUrl?: string;
    imageLicense?: string;
    bestFor?: string;
    watchFor?: string;
  }[];
  usedFor?: readonly string[];
  questions?: readonly {
    question: string;
    answer: string;
  }[];
  buy?: readonly string[];
  tools?: readonly string[];
  before?: readonly string[];
  steps: readonly string[];
  checks?: readonly string[];
  keywords?: readonly string[];
  source: string;
  sourceUrl?: string;
};

const noviceHowToGuides: readonly NoviceHowToGuide[] = [
  { group: "Panel mounting", id: "mounting-metal", title: "Corrugated or trapezoidal metal roof", image: "/guides/mounting/corrugated-metal-timber.png", summary: "Fix a roof-profile-matched interface through the sheet into confirmed structure, then attach the rail without destroying the weather seal.", whatItIs: "A metal-roof interface is the shaped foot between the roof sheet and the aluminium rail. It transfers wind and panel loads into a purlin, batten or rafter; the thin roof sheet is not automatically the structure.", whatItDoes: "It holds the rail at planned fixing points while a bonded washer, gasket, flashing or manufacturer-approved sealing system keeps the penetration weather-tight.", buy: ["One engineered mounting family: compatible roof interfaces or hanger bolts, rails, rail splices, end clamps, mid clamps and bonding/earthing parts", "The interface shaped for the exact rib/profile—not a generic flat foot forced onto a curve", "Fasteners approved by that mounting system for the confirmed substrate: timber and steel schedules are different", "Bonded washers, gaskets or approved sealant/flashing specified by the roof-interface maker", "UV-rated cable clips and edge protection that fit the selected rail"], tools: ["Roof access and fall controls appropriate to the location", "Internal access, drawings or a reliable method to locate purlin/batten/rafter centres", "Tape, straightedge, non-permanent marker and string line", "Correct hex socket/driver and a calibrated torque wrench for the selected hardware", "Roof-safe cleaning materials; no swarf may remain on coated metal"], before: ["Identify the exact sheet profile, material, condition, pitch and roof warranty", "Confirm whether the structural member is timber or steel and record its grade/thickness and fixing depth", "Use the engineered rail/interface spacing for local wind, snow and site exposure—do not copy spacing from another roof", "Map edges, ridges, valleys, gutters, skylights, vents, fire/access paths and safe cable entry", "Stop if the roof is brittle, corroded, asbestos-suspect, structurally uncertain or cannot be accessed safely"], steps: ["Inspect from below where possible. Mark the centreline of each confirmed structural purlin, batten or rafter on the roof; a stud finder or tapping alone is not proof", "Lay out the engineered interface positions. Dry-fit the profile-specific foot so it sits flat without rocking, distorting the sheet or blocking drainage", "Use only the selected system’s fastener schedule. As one manufacturer example—not a universal rule—Clenergy’s NZ engineering tables distinguish 14g T17 screws for specified timber from 14g Teks screws for specified steel", "Fit the specified gasket, bonded washer, flashing or sealant exactly as its manual shows. Do not mix sealants with roof coatings unless compatibility is confirmed", "Drive the fastener perpendicular into the confirmed structure. Tighten a bonded washer until it makes the specified seal; do not leave it loose or crush/extrude it", "Attach and align rails, install approved splices and expansion gaps, then tighten only to the mounting manufacturer’s stated torque", "Fit modules using their permitted clamp zones, add the selected bonding parts and support every cable clear of the roof, sharp edges and water paths", "Photograph each fixing and cable route, remove all metal swarf, and complete the pull/torque/weatherproofing checks before modules hide the work"], checks: ["Every fixing lands in confirmed structure and matches the engineered plan", "Interfaces sit flush; sheets are not crushed and drainage remains open", "Washers/gaskets are evenly seated with no exposed failed penetration", "Rail is straight, splice/edge distances are correct and all torque values are recorded", "No loose cable, connector, sharp edge or drilling swarf remains beneath the array"], source: "Clenergy PV-ezRack SolarRoof global product-family example—use the manual and engineering letter for the exact selected product and country", sourceUrl: "https://www.clenergy.com.au/wp-content/uploads/2023/03/clenergy-pvezRack-solarroof-installationguide-english.pdf" },
  { group: "Panel mounting", id: "mounting-tile", title: "Tile or terracotta roof", image: "/guides/mounting/tile-roof-hook.png", summary: "Fix a compatible hook into confirmed structure while keeping tiles unloaded, seated and weatherproof.", whatItIs: "A tile roof hook passes between tiles and carries the rail from the structural rafter or truss below. The tile is weather cladding; it must not become the load-bearing spacer.", whatItDoes: "It transfers array loads around the tile into the roof structure while maintaining the roof’s drainage plane.", buy: ["Hooks or replacement-tile mounts approved for the exact tile profile and mounting family", "Manufacturer-approved structural fasteners, rails, splices, module clamps and bonding parts", "Compatible flashing or replacement tiles where the chosen system requires them", "Matching spare tiles—old tiles often crack when lifted"], tools: ["Tile-lifting tools and non-damaging access equipment", "Rafter-location method and inspection access", "Correct driver/socket and calibrated torque wrench", "Manufacturer-permitted tile relief tool only where the system explicitly allows tile modification"], before: ["Identify concrete, clay/terracotta, slate or another tile type and record condition", "Confirm rafter position, dimensions and condition; battens are not automatically an approved structural fixing", "Check the selected hook’s tile clearance, uplift capacity, roof pitch and flashing method", "Stop for brittle tiles, damaged underlay, unknown structure or any roof-access hazard"], steps: ["Lift the required tiles carefully and expose the fixing area without damaging underlay", "Confirm and mark the structural rafter—not merely the tile batten", "Position the selected hook and use its approved number, diameter, embedment and arrangement of structural fasteners", "Adjust the hook so the tile can return to its natural position without carrying or pressing on the hook", "Fit the selected flashing/replacement tile or permitted tile treatment exactly as the product manual shows", "Refit the tile, check laps and drainage, then attach and align the rail", "Install clamps, bonding and cable support using the module and mounting-system clamp zones and torque schedule", "Photograph the open fixing and finished weather detail before it is hidden"], checks: ["Hook is fixed to confirmed structure", "Tile sits naturally, is not cracked or lifted, and does not bear on the hook", "Underlay, flashing and water path remain continuous", "Rail, clamps, bonding and cable support match the selected manuals"], source: "Clenergy SolarRoof mounting-family example; use the exact tile-hook and flashing manual for the selected country and product", sourceUrl: "https://www.clenergy.com.au/wp-content/uploads/2023/03/clenergy-pvezRack-solarroof-installationguide-english.pdf" },
  { group: "Panel mounting", id: "mounting-standing-seam", title: "Standing-seam or non-penetrating roof", image: "/guides/mounting/standing-seam-clamp.png", summary: "Clamp a tested fitting to a compatible seam without penetrating the roof sheet.", whatItIs: "A standing-seam clamp grips the raised folded seam of a compatible metal roof. Clamp shape, seam shape, roof material and gauge must be a tested combination.", whatItDoes: "It transfers loads through the seam attachment without drilling through the weather surface.", buy: ["Clamp model explicitly listed for the measured seam profile and material", "Approved rail or direct-attach module hardware", "Specified setscrews/bolts, module clamps and bonding parts from the same tested system"], tools: ["Seam profile gauge or careful measurement tools", "Correct driver bit and calibrated torque wrench", "Roof-safe access and non-marking layout tools"], before: ["Identify seam manufacturer/profile, dimensions, metal type and gauge", "Obtain the clamp compatibility and load table—appearance is not proof of fit", "Use the engineered clamp count and spacing for local wind/snow loads", "Confirm whether the roof maker preserves its warranty with the selected clamp"], steps: ["Measure and record the exact seam profile", "Match it to the clamp maker’s published compatibility data", "Place the clamp in the specified orientation and location on the seam", "Tighten the round-point setscrew/fastener in the stated sequence with a calibrated torque wrench; do not substitute a penetration", "Attach the rail or direct module fitting with the supplied hardware", "Install module clamps and bonding parts to their stated zones and torque", "Recheck clamp torque where the manufacturer requires retensioning and record every clamp"], checks: ["Correct clamp for the exact seam—not merely the same roof colour or general shape", "No puncture, torn coating or malformed seam", "Clamp spacing, orientation and recorded torque match the engineered plan", "Rail/direct attachments, bonding and module clamps match the tested system"], source: "S-5 standing-seam clamp product example; verify the current compatibility and installation data for the exact clamp", sourceUrl: "https://www.s-5.com/wp-content/uploads/sites/2/2016/11/Prod-Lit-S-5-S.pdf" },
  { group: "Panel mounting", id: "mounting-flat", title: "Flat roof or tilt frame", image: "/schematic-components/roof-mounting-system.jpg", summary: "Select a penetrative or ballasted system from the structural and wind design—not by appearance.", steps: ["Confirm roof structure, membrane, drainage and wind region", "Use the engineered layout for tilt, row spacing and ballast/fixings", "Keep drainage and maintenance routes clear", "Record pads, ballast, anchors, bonding and cable support"], source: "Schletter flat-roof mounting instructions", sourceUrl: "https://www.schletter-group.com/en-US/download-center/category-us/flat-roof-systems-us/" },
  { group: "Panel mounting", id: "mounting-ground", title: "Ground-mounted frame", image: "/schematic-components/roof-mounting-system.jpg", summary: "Treat foundations, posts, corrosion, wind and clearances as a designed structure.", steps: ["Confirm ground conditions, services, boundaries and shading", "Use the engineered post/foundation and bracing layout", "Set rails square and to the proposed direction and slope", "Record foundations, fasteners, bonding and protected cable entry"], source: "Use the exact ground-mount structural and installation manual for the selected system." },
  { group: "Panel mounting", id: "mounting-vertical", title: "Fence, wall or vertical array", image: "/schematic-components/roof-mounting-system.jpg", summary: "Check the supporting structure, public access, wind loading and rear cable protection.", steps: ["Confirm the fence or wall is designed for the added loads", "Set out module clamps only inside permitted frame zones", "Protect all rear cables and connectors from access and damage", "Record clearances, fixings, bonding and cable routes"], source: "Use the selected mounting-system and module manuals plus the Site structural design." },
  { group: "Panels and solar cable", id: "panels", title: "Solar panels", image: "/guides/panels/rigid-framed-roof-array.png", summary: "Handle, position and secure the proposed modules without damaging frames, glass or cables.", steps: ["Check every panel for transport damage and confirm its label", "Place panels only on the approved mounting zones", "Keep cables supported and clear of sharp edges and the roof", "Record panel order and the proposed string each panel belongs to"], source: "Use the exact module and mounting-system installation manuals." },
  { group: "Panels and solar cable", id: "mc4", title: "Solar cable and MC4-style connectors", image: "/guides/mc4/mc4-assembly-overview.png", summary: "Recognise the preparation sequence. Connector family, cable, dimensions and tools must all match the exact manufacturer instructions.", steps: ["Match the male/female housing, metal contact, seal and approved solar cable", "Measure the strip length from the connector maker’s table—do not guess", "Crimp the specified contact with the specified die and locator; do not substitute solder unless that exact manufacturer explicitly requires it", "Inspect the crimp, insert it until retained, lightly pull-test, then close the gland with the specified assembly tool and torque"], source: "Stäubli MC4-Evo 2 assembly instructions MA298", sourceUrl: "https://www.staubli.com/content/dam/ecs/technical-documentation/assembly-instructions/RE/PV_MA298-en.pdf" },
  { group: "Power equipment", id: "controller", title: "Solar power controller", image: "/schematic-components/mppt-charge-controller.jpg", summary: "Mount the controller, provide airflow and identify the panel and battery sides before any connection.", steps: ["Read the exact controller manual and mark its clearances", "Mount it in the permitted direction on a suitable dry surface", "Label the panel side and battery side before routing cable", "Leave final protection, polarity checks and connection for the controlled connection stage"], source: "Use the exact controller manufacturer’s installation manual." },
  { group: "Power equipment", id: "battery", title: "Battery storage", image: "/schematic-components/lifepo4-battery-bank.jpg", summary: "Position and secure the battery bank while keeping terminals protected and ventilation clear.", steps: ["Confirm chemistry, weight, permitted orientation and indoor/outdoor rating", "Prepare a dry, stable location with the maker’s required clearance", "Secure the batteries and protect terminals from tools or dropped metal", "Record polarity, fuse location and cable route before connection"], source: "Victron Lithium Battery Smart installation guidance", sourceUrl: "https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/installation.html" },
  { group: "Power equipment", id: "inverter", title: "Hybrid inverter / charger", image: "/schematic-components/hybrid-inverter.jpg", summary: "Mount the hybrid inverter where it stays dry, ventilated, serviceable and close enough to the battery.", steps: ["Read the exact model manual before choosing the wall", "Mark required space above, below and beside the unit", "Use a structure that can safely hold the unit’s weight", "Plan separate, protected paths for solar, battery, building power, earth and communication cables"], source: "Use the exact inverter/charger installation manual." },
  { group: "Safety and connection", id: "protection", title: "Fuses and safety switches", image: "/schematic-components/dc-fuse.jpg", summary: "Understand which cable each fuse, breaker or isolator protects before anything is connected.", steps: ["Find the safety device on the proposed schematic", "Trace the cable it is intended to protect", "Confirm the proposed rating against the real cable and equipment manuals", "Label the device and leave it open/off until the pre-power checks are complete"], source: "Ratings remain design-specific and require verification before connection." },
  { group: "Safety and connection", id: "switchboard", title: "Building power and final connection", image: "/schematic-components/ac-distribution-board.jpg", summary: "Prepare the records and physical route, then hand the required testing and connection to the authorised person.", steps: ["Confirm which loads and circuits the system will supply", "Photograph and label both ends of every prepared route", "Make sure the proposed schematic matches what was actually built", "Arrange the required testing, inspection, certification and final connection"], source: "WorkSafe New Zealand: DIY solar installations", sourceUrl: "https://www.worksafe.govt.nz/about-us/news-and-media/diy-solar-installation" },
];

const howToSectionByGuide: Record<string, string> = {
  "mounting-metal": "Roofing and roof structure",
  "mounting-tile": "Roofing and roof structure",
  "mounting-standing-seam": "Roofing and roof structure",
  "mounting-flat": "Roofing and roof structure",
  "mounting-ground": "Mounting systems and hardware",
  "mounting-vertical": "Mounting systems and hardware",
  panels: "Solar panels and module types",
  mc4: "DC wiring and connections",
  controller: "Batteries and charging",
  battery: "Batteries and charging",
  inverter: "Inverters and power conversion",
  protection: "Protection and isolation",
  switchboard: "AC wiring and connections",
};

function howToSection(guide: NoviceHowToGuide) {
  return howToSectionByGuide[guide.id] ?? guide.group;
}

// The legacy seed data used broad display groups. Normalise it once so every
// consumer sees the new learning-library taxonomy without duplicating guides.
noviceHowToGuides.forEach((guide) => {
  (guide as { group: string }).group = howToSection(guide);
});

const additionalHowToGuides: readonly NoviceHowToGuide[] = [
  { group: "Solar panels and module types", id: "panel-monofacial", title: "Rigid framed monofacial panels", image: "/guides/panels/rigid-framed-roof-array.png", summary: "The common glass-and-aluminium module that produces mainly from its front face.", whatItIs: "A rigid framed PV module with a front glass surface, solar cells, backsheet or rear glass, junction box, leads and aluminium frame.", whatItDoes: "It converts light into DC electricity and provides tested frame zones for clamps or bolts.", buy: ["Modules with matching electrical ratings and certifications for the destination", "Mounting hardware approved for the exact frame thickness and clamp zone", "Matching connector family—not merely a connector that physically plugs in"], tools: ["Label camera/scanner", "Module handling grips appropriate to the maker", "Torque wrench and clamp hardware specified by the mounting system"], before: ["Read the module installation manual", "Record Voc, Isc, Vmp, Imp, maximum system voltage, fuse rating, dimensions, weight and permitted clamp zones", "Check transport damage, glass, frame, junction box and leads"], steps: ["Plan module position and string order", "Lift by the frame using the maker's handling method", "Place only on the designed supports", "Clamp inside the permitted zones and apply the mounting-system torque", "Support leads and connectors clear of the roof"], checks: ["No mixed electrical ratings without a checked design", "All clamps are inside permitted zones", "No cable or connector rests on the roof"], source: "Use the exact module installation manual and selected mounting-system manual." },
  { group: "Solar panels and module types", id: "panel-bifacial", title: "Bifacial panels", image: "/schematic-components/solar-panel-pv-module.jpg", summary: "Glass/glass or transparent-back modules that can generate from light reaching both faces.", whatItIs: "A PV module whose rear face also contributes power.", whatItDoes: "It can increase energy yield when the rear has useful reflected light and is not blocked by rails, roof or dense mounting.", buy: ["Bifacial module model", "Mounting layout compatible with rear-side exposure and frame/clamp zones", "Inverter and conductor design based on the approved bifacial current assumptions"], before: ["Check whether the surface and mounting height can provide useful rear irradiance", "Use the designer's bifacial gain assumption rather than adding an arbitrary percentage", "Confirm glass/glass handling and clamp requirements"], steps: ["Record both-face construction and electrical label", "Lay out supports to minimise prohibited rear shading", "Mount using approved zones and torque", "Keep rear surface, cables and junction boxes serviceable"], checks: ["Current and protection design includes the approved gain", "Rear glass is undamaged", "Structure does not create avoidable concentrated shading"], source: "Use the exact bifacial module manual and the system designer's approved current/yield assumptions." },
  { group: "Solar panels and module types", id: "panel-flexible", title: "Flexible and semi-flexible panels", image: "/guides/panels/flexible-and-rigid-modules.png", summary: "Lightweight modules for compatible curved or weight-limited surfaces; attachment and heat control are product-specific.", whatItIs: "A thin PV laminate or semi-flexible module with limited permitted bend radius.", whatItDoes: "It provides solar generation where a conventional framed module and rail system may be impractical.", buy: ["Module approved for the surface, curvature, traffic and environment", "Exact maker-approved adhesive, mechanical fastener or mounting carrier", "Cable glands, edge protection and strain relief"], before: ["Confirm minimum bend radius and whether continuous bonding is permitted", "Check roof/membrane chemical compatibility and heat dissipation", "Plan replacement: some adhesive installations are difficult to remove"], steps: ["Prepare a clean, dry compatible surface", "Mark the no-bend and attachment zones", "Apply only the specified attachment system and cure conditions", "Route leads with strain relief and protected entry"], checks: ["No crease, cell crack or bend below the limit", "No trapped water or unsupported cable", "Attachment and thermal conditions match the manual"], source: "Use the exact flexible-module installation and adhesive/mounting instructions." },
  { group: "Mounting systems and hardware", id: "mount-rails", title: "Rails, rail splices and expansion gaps", image: "/schematic-components/roof-mounting-system.jpg", summary: "Rails carry module clamps between structural roof or ground interfaces.", whatItIs: "Extruded structural members with matched channels for interfaces, splices, clamps, bonding and cable management.", whatItDoes: "It keeps modules aligned and transfers their loads to the planned attachment points.", buy: ["Rail profile from one engineered mounting family", "Approved splice type and hardware", "End caps and cable-management accessories where required"], tools: ["Tape, string line and square", "Rail cutting tool approved for aluminium", "Deburring tool and calibrated torque wrench"], before: ["Use the engineering table for span, cantilever and attachment spacing", "Check thermal expansion and maximum continuous rail length", "Plan splice positions away from prohibited zones"], steps: ["Cut square and deburr", "Attach rail loosely to all interfaces", "Align and level the run", "Install splices and expansion gaps as specified", "Torque attachments and record them"], checks: ["Span, cantilever, splice and gaps match the plan", "No sharp swarf or edge remains", "Rail is straight and secure"], source: "Use the selected mounting system's structural and installation manual." },
  { group: "Mounting systems and hardware", id: "mount-clamps", title: "Panel mid clamps and end clamps", image: "/schematic-components/roof-mounting-system.jpg", summary: "Matched clamps hold module frames to rails at permitted frame zones.", whatItIs: "End clamps hold an outside frame edge; mid clamps hold adjacent module frames.", whatItDoes: "It transfers module uplift and downward loads into the rail while maintaining spacing.", buy: ["Clamp model matching rail family and module frame thickness", "Bonding/grounding version where the design relies on it", "End caps or array-edge finish parts"], tools: ["Correct hex bit", "Calibrated torque wrench", "Module spacing gauge if supplied"], before: ["Check module clamp zones and frame thickness", "Confirm clamp engagement and bonding method", "Do not mix look-alike clamps from untested systems"], steps: ["Seat the clamp hardware correctly in the rail", "Place the module inside its permitted clamp zone", "Ensure the clamp face sits fully on the frame", "Torque to the selected mounting manual", "Mark or record the completed torque"], checks: ["Full clamp engagement", "Correct edge distance and module gap", "No clamp on glass, drainage hole or prohibited frame zone"], source: "Use both the exact module manual and mounting-system clamp instructions." },
  { group: "Mounting systems and hardware", id: "mount-fasteners-sealing", title: "Roof fasteners, washers, flashing and sealants", image: "/guides/mounting/corrugated-metal-timber.png", summary: "Choose the fixing and weatherproofing system from the roof, substrate and mounting manufacturer's tested detail.", whatItIs: "The structural fastener transfers load; the bonded washer, gasket, flashing or sealant restores the weather barrier.", whatItDoes: "Together they secure the interface and prevent water ingress without damaging the roof coating or membrane.", buy: ["Specified fastener for confirmed timber, light-gauge steel, structural steel, masonry or another substrate", "Specified bonded washer/gasket/flashing", "Chemically compatible primer or sealant only where the detail requires it"], tools: ["Correct pilot drill where specified", "Perpendicular driver and correct socket", "Torque/depth control", "Surface preparation and cleanup materials"], before: ["Confirm substrate material, grade/thickness and required embedment", "Check corrosion class and metal compatibility", "Read roof warranty and sealant compatibility data"], steps: ["Prepare and mark the structural fixing centre", "Fit the specified weather component", "Drill only where and how the manual permits", "Drive perpendicular and stop at the stated washer compression/torque", "Tool and cure sealant only if the selected detail requires it"], checks: ["Fastener is in structure, not sheet alone", "Washer is neither loose nor crushed", "No incompatible sealant or exposed swarf", "Penetration is photographed before concealment"], source: "Exact values come from the mounting-system engineering letter, fastener maker and roof/waterproofing manufacturer." },
  { group: "DC wiring and connections", id: "dc-cable", title: "PV DC cable: type, size and routing", image: "/schematic-components/pv-cable-dc.jpg", summary: "Solar cable must suit voltage, current, temperature, UV, environment, connector and voltage-drop design.", whatItIs: "Double-insulated cable designed and approved for PV DC circuits.", whatItDoes: "It carries string or array current between modules, combiners, protection and power electronics.", buy: ["Approved PV cable with the calculated conductor size and environmental rating", "Compatible connector/contact size", "UV-rated clips, conduit/glands and identification"], tools: ["Cable cutter and maker-approved stripper", "Routing/measurement tools", "Test instruments appropriate to the work and local rules"], before: ["Calculate current, voltage, temperature derating and voltage drop", "Separate positive and negative routes only as the design requires", "Plan protection from sharp edges, water, animals and movement"], steps: ["Measure the real route including service loops", "Cut cleanly and identify both ends", "Support at the required intervals", "Protect every entry and bend", "Test and record before energising"], checks: ["Cable label and size match design", "No cable rests on roof or sharp metal", "Polarity and route labels are clear"], source: "Use applicable local PV wiring rules plus the cable, connector and equipment manuals." },
  { group: "DC wiring and connections", id: "dc-strings-combiners", title: "PV strings, parallel connections and combiner boxes", image: "/schematic-components/dc-combiner-box.jpg", summary: "Series modules raise voltage; parallel strings raise current and may require string protection and a combiner.", whatItIs: "A string is a series chain of modules. A combiner brings multiple strings into a protected output.", whatItDoes: "It creates the inverter/controller input voltage and current while keeping strings identifiable and protectable.", buy: ["Combiner and terminals rated for maximum DC voltage/current and environment", "Required string fuses/breakers, isolator and surge protection", "Matched glands, labels and cable-management parts"], before: ["Check minimum/maximum string voltage across temperature", "Check MPPT current and short-circuit limits", "Determine whether reverse-current protection is required"], steps: ["Assign and label every module/string", "Route positive and negative conductors consistently", "Terminate only with approved components and controlled torque", "Test each string separately before combining", "Record Voc, polarity and insulation results as permitted"], checks: ["String count and polarity match schematic", "Protection ratings match conductors and module limits", "Unused entries are sealed"], source: "String design and testing require the exact module, combiner and inverter/controller data plus local rules." },
  { group: "AC wiring and connections", id: "ac-output", title: "Inverter AC output and distribution connection", image: "/schematic-components/ac-distribution-board.jpg", summary: "The inverter's AC output feeds a distribution board, dedicated loads or grid connection through designed protection and isolation.", whatItIs: "The mains-voltage side of the solar power system.", whatItDoes: "It distributes usable AC power and coordinates protection, earthing, neutral and changeover arrangements.", buy: ["Cable and containment from the approved AC design", "Correct breaker/RCBO/RCD and isolator types", "Labels, glands, distribution or changeover equipment"], before: ["Confirm local licensing and prescribed-work boundary", "Use prospective fault current, earthing and disconnection calculations", "Confirm inverter neutral/earth and backup-output requirements"], steps: ["Prepare the approved route and equipment positions", "Keep conductors protected and identified", "Terminate, torque and test only by the authorised person where required", "Update the schematic and circuit schedule", "Certify, inspect and connect as locally required"], checks: ["Protection and conductor match", "Neutral/earth arrangement matches inverter mode", "All required test and certification records exist"], source: "Use local electrical rules, network requirements and the exact inverter installation manual." },
  { group: "Protection and isolation", id: "protection-types", title: "DC fuses, breakers, isolators and surge protection", image: "/schematic-components/dc-fuse.jpg", summary: "These devices do different jobs; voltage, current, polarity, interrupt rating and DC suitability matter.", whatItIs: "Fuses and breakers interrupt overcurrent; isolators provide a switching point; surge devices divert transient overvoltage.", whatItDoes: "It limits fault damage and provides planned isolation and protection zones.", buy: ["Devices explicitly rated for the circuit's DC or AC voltage and current", "Correct poles, utilization category, interrupt rating and enclosure", "Matched fuse holders/fuses and surge protective devices where required"], before: ["Calculate maximum current and conductor capacity", "Check source backfeed paths and battery fault current", "Use the equipment maker's permitted protection range"], steps: ["Place each device on the schematic before installation", "Trace which conductor/equipment it protects", "Install with required polarity, enclosure and conductor control", "Label source and load sides", "Test operation and record exact model/rating"], checks: ["No AC-only device used on a DC circuit", "Interrupt rating is adequate", "Every protected cable section is accounted for"], source: "Final device selection requires the circuit design, equipment manuals and applicable local standards." },
  { group: "Earthing and bonding", id: "earthing-bonding", title: "Module, rail and equipment bonding", image: "/schematic-components/earthing-ground-bar.jpg", summary: "Bonding joins exposed conductive parts into the designed protective earthing system.", whatItIs: "Approved lugs, clips, washers and conductors that maintain an electrical path between metal parts.", whatItDoes: "It supports protective-device operation and reduces dangerous touch voltage under fault conditions.", buy: ["Listed/approved bonding hardware for the exact rail and module", "Correct conductor type, size, colour/identification and terminals", "Corrosion-compatible lugs and fasteners"], before: ["Understand whether module clamps provide tested bonding", "Plan across rail splices and removable sections", "Check local earthing topology and lightning/surge requirements"], steps: ["Clean/contact surfaces only as the hardware manual requires", "Fit bonding clips/lugs in the stated orientation", "Route and protect the conductor", "Torque and mark connections", "Continuity-test and record as locally permitted"], checks: ["Every required exposed part is included", "No dissimilar-metal corrosion path", "Continuity remains across splices and removable modules"], source: "Use the mounting-system bonding manual, equipment manuals and local earthing rules." },
  { group: "Tools and workmanship", id: "tools-mechanical", title: "Mechanical solar toolkit", image: "/schematic-components/roof-mounting-system.jpg", summary: "Layout, cutting, fastening and torque tools must match the selected roof and mounting system.", whatItIs: "The controlled tools used to locate structure, set out mounts, cut/deburr rail and tighten hardware.", whatItDoes: "It turns a mounting plan into repeatable, inspectable work without relying on feel.", buy: ["Tape, square, string/chalk line and non-damaging markers", "Correct sockets/bits, drill stops and calibrated torque wrench", "Rail saw/cutter, deburring tool and swarf cleanup", "Roof-access and fall-control equipment appropriate to local requirements"], before: ["Read every tool and mounting manual", "Calibrate/check torque tools", "Confirm roof-access plan and exclusion area"], steps: ["Lay out before drilling", "Use the correct tool for each substrate", "Deburr every cut", "Torque rather than guess", "Clean and photograph work before covering it"], checks: ["No damaged bits or uncalibrated torque tool", "No swarf, sharp rail edge or uncontrolled roof access"], source: "Tool choice follows the selected product manuals and local work-at-height requirements." },
  { group: "Tools and workmanship", id: "tools-electrical", title: "Connector, cable and electrical test tools", image: "/guides/mc4/mc4-assembly-overview.png", summary: "Correct cutters, strippers, crimp dies, torque tools and test instruments are connector- and task-specific.", whatItIs: "Purpose-made preparation and verification tools—not generic pliers and guesswork.", whatItDoes: "It produces repeatable terminations and measurements that can be inspected and traced.", buy: ["Cable cutter and connector-maker stripping tool", "Specified crimper, die and locator", "Connector assembly/torque tools", "Meters/testers with the required category, range and proving method"], before: ["Match tool part numbers to connector and contact", "Confirm calibration and test leads", "Know which tests are legally restricted or hazardous"], steps: ["Inspect and identify tools", "Set maker-specific dimensions", "Make and inspect a sample termination where appropriate", "Use a controlled test sequence", "Record tool, setting and result"], checks: ["No mixed connector/tool family", "No damaged dies or unproved meter", "Results are recorded against the correct circuit"], source: "Use the exact connector and test-equipment instructions plus local safe-work rules." },
  { group: "Testing and commissioning", id: "testing-commissioning", title: "Pre-power checks and commissioning", image: "/schematic-components/ac-distribution-board.jpg", summary: "Verify the physical build, schematic, protection, settings and measured results before energising.", whatItIs: "A planned inspection and test sequence completed before and during first startup.", whatItDoes: "It finds polarity, insulation, wiring, torque, configuration and documentation errors before they become damage or hazards.", buy: ["Required labels and records", "Calibrated test equipment appropriate to the system", "Manufacturer commissioning forms or current instructions"], before: ["Finish the as-built schematic", "Confirm authorised persons and inspection requirements", "Use the equipment maker's power-up and shutdown sequence"], steps: ["Complete visual and mechanical inspection", "Verify isolation, polarity, protection and earthing", "Perform required electrical tests", "Apply approved settings", "Energise in the documented order", "Record baseline voltage, current, power, alarms and firmware"], checks: ["No unresolved design change", "All results within accepted limits", "Certificates, photos, settings and shutdown instructions saved"], source: "Commissioning must follow local rules and every installed equipment manufacturer's current procedure." },
  { group: "Inverters and power conversion", id: "power-optimisers", title: "DC power optimisers", image: "/schematic-components/mppt-charge-controller.jpg", summary: "Panel-level DC electronics used with a specifically compatible string inverter and system design.", whatItIs: "An electronic unit fitted to one module or a small module group. It conditions that module's DC output and communicates with a compatible inverter/platform.", whatItDoes: "Depending on the product, it can provide panel-level maximum-power tracking, monitoring and required shutdown behaviour while the central inverter still produces AC.", buy: ["Optimiser model explicitly compatible with the exact module and inverter", "Approved input leads, output connector family and mounting hardware", "Compatible inverter, communications and any required gateway"], tools: ["Module/optimiser compatibility data", "Connector-family tools", "Torque tool for the mounting method", "Commissioning app or interface where required"], before: ["Check module Voc/Isc/current/power against optimiser limits across temperature", "Check minimum/maximum optimiser and string counts", "Confirm local shutdown and rooftop electronics requirements", "Plan replacement access beneath the array"], steps: ["Record each optimiser serial number and module position", "Mount in the permitted orientation and location with airflow and drainage", "Connect only the approved module and output connector arrangement", "Build strings to the optimiser/inverter rules", "Commission communications and verify every mapped module"], checks: ["No unsupported optimiser/inverter/module combination", "No unit or connector resting on the roof", "Serial-number map matches physical module positions", "Shutdown and monitoring behaviour verified"], source: "Use the exact optimiser and compatible inverter design/installation manuals; compatibility is product-specific." },
  { group: "Inverters and power conversion", id: "microinverters", title: "Microinverters", image: "/schematic-components/hybrid-inverter.jpg", summary: "Small inverters mounted at modules that convert panel DC into an AC branch circuit.", whatItIs: "A panel-level or small-group inverter fitted beneath the array and connected to an approved AC trunk/branch system.", whatItDoes: "It provides module-level conversion and monitoring and can suit roofs with multiple directions or partial shade, while moving more electronics onto the roof.", buy: ["Microinverter model compatible with module current, voltage and power", "Manufacturer AC trunk cable, connectors, terminators, caps and branch accessories", "Approved mounting/bonding hardware, gateway and required AC protection/isolation"], tools: ["Manufacturer trunk-connector tools", "Torque wrench and mounting tools", "Commissioning app/gateway", "Required AC test instruments for authorised work"], before: ["Check maximum units per branch and voltage/frequency version", "Confirm local AC, rapid-shutdown, roof-access and isolation requirements", "Plan trunk cable, branch transition, gateway communications and future replacement access", "Map serial numbers before modules cover the units"], steps: ["Set out and mount each unit in its permitted position and orientation", "Attach the approved trunk cable and protect every unused connector with the correct cap/terminator", "Connect each compatible module lead without cross-mating connector families", "Complete the designed AC branch, protection and isolation through the required authorised process", "Commission the gateway and map each unit to its module position"], checks: ["Branch count and protection match the design", "All rooftop connectors are supported and sealed", "Every serial number reports in the correct physical position", "Required AC testing, inspection and records are complete"], source: "Use the exact microinverter, trunk-cable, gateway and module manuals plus local AC installation rules." },
];

const compatibilityHowToGuides: readonly NoviceHowToGuide[] = [
  { group: "Inverters and power conversion", id: "optimiser-compatibility", title: "Check optimiser, panel and inverter compatibility", image: "/schematic-components/mppt-charge-controller.jpg", summary: "Prove the complete electrical chain before selecting optimisers; a physically connectable combination may still exceed a current, voltage, power or string limit.", whatItIs: "A datasheet and compatibility check covering the module into the optimiser, then the optimiser string into each inverter MPPT.", whatItDoes: "It prevents an optimiser proposal that the panel or inverter cannot operate safely or correctly—such as an inverter input whose permitted current is below the proposed optimiser/string arrangement.", buy: ["Nothing until the exact module, optimiser and inverter models pass the check", "Manufacturer-approved connector/adaptor arrangement only after compatibility is confirmed"], tools: ["Current manufacturer datasheets", "Manufacturer compatibility letter/tool where supplied", "Cold-temperature voltage and maximum-current/string worksheet"], before: ["Record module Voc, Vmp, Isc, Imp and power", "Check optimiser maximum input voltage, operating range, maximum input current/Isc, power and maximum output current/voltage", "Check inverter MPPT voltage range, maximum operating input current and maximum short-circuit current per input/MPPT", "Count series devices and every parallel string on each MPPT", "Confirm the exact optimiser/inverter pairing is supported"], steps: ["Check module-to-optimiser voltage, current, Isc and power at the applicable design conditions", "Check minimum and maximum optimiser count and string power", "Calculate the voltage/current presented to each inverter MPPT", "Apply parallel-string current correctly instead of checking only one string", "Compare operating current and short-circuit current with the inverter's separate limits", "Save the datasheets and compatibility evidence with the proposal; unresolved values stay unverified"], checks: ["Every limit passes with the required design factors", "Connector family and polarity are approved", "No unsupported mixed optimiser models", "Wattson cites the exact datasheet values used"], source: "SolarEdge power-optimizer datasheets illustrate separate module input and optimiser output-current limits; use the exact selected manufacturers' current documents.", sourceUrl: "https://knowledge-center.solaredge.com/sites/kc/files/se-power-optimizer-datasheet-eng-row.pdf" },
];

const componentPlanningHowToGuides = planningHowToGuides.filter((guide) => guide.group !== "Start here: system choices");
const supersededHowToGuideIds = new Set([
  "protection",
  "protection-types",
  "mount-rails",
  "mount-clamps",
  "dc-cable",
  "dc-strings-combiners",
  "earthing-bonding",
]);
const rawHowToGuides: readonly NoviceHowToGuide[] = [...noviceHowToGuides, ...additionalHowToGuides, ...compatibilityHowToGuides, ...componentPlanningHowToGuides, ...expandedHowToGuides, ...componentHowToGuides, ...batteryHardwareHowToGuides, ...coreHardwareHowToGuides, ...practicalBasicsHowToGuides, ...evChargingHowToGuides, ...solarHotWaterHowToGuides, ...windGenerationHowToGuides].filter((guide) => !supersededHowToGuideIds.has(guide.id));
export const allHowToGuides: readonly NoviceHowToGuide[] = rawHowToGuides.map((guide) => {
  const detail = howToGuideDetails[guide.id as keyof typeof howToGuideDetails];
  const enriched: NoviceHowToGuide = detail ? { ...guide, ...detail } : guide;
  return {
    ...enriched,
    whatItIs: enriched.whatItIs ?? enriched.summary,
    whatItDoes: enriched.whatItDoes ?? `It performs the ${enriched.title.toLowerCase()} job shown on the proposed or as-built schematic. Its exact purpose and connections must be traced on that Site's drawing before it is selected or installed.`,
    usedFor: enriched.usedFor ?? [howToSection(enriched)],
    questions: enriched.questions ?? [
      { question: `Why would I use ${enriched.title.toLowerCase()}?`, answer: enriched.whatItDoes ?? enriched.summary },
      { question: "Do I have to use it?", answer: "Only when the approved system schematic, selected equipment manuals or local requirements call for this component or function. A simpler or integrated product may perform the same job; Wattson should show the energy path and the alternative before anything is purchased." },
      { question: "Does its type, size or rating matter?", answer: "Yes. Select it from the real voltage, current or load, environment, connected equipment, fault duty and manufacturer compatibility—not from appearance or a generic product name. Values that are not yet known must remain marked unverified." },
      { question: "Where and how should it be mounted?", answer: "Use the exact product orientation, support, enclosure, ventilation, weather, clearance and cable-strain instructions. The Site's country and local rules decide regulated access or height requirements; there is no single global mounting height that PVIntell should invent." },
    ],
  };
});

const howToGroupOrder = [
  "Roofing and roof structure",
  "Solar hot water",
  "Solar panels and module types",
  "Mounting systems and hardware",
  "DC wiring and connections",
  "Protection and isolation",
  "Batteries and charging",
  "Inverters and power conversion",
  "AC wiring and connections",
  "Earthing and bonding",
  "Monitoring and communications",
  "Pools and controllable loads",
  "EV charging and transport",
  "Tools and workmanship",
  "Testing and commissioning",
  "Wind generation",
] as const;

function localHowToAuthority(location?: string) {
  const browserContext = typeof navigator === "undefined" ? "" : `${navigator.language} ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  const value = `${location ?? ""} ${browserContext}`.toLowerCase();
  if (value.includes("new zealand") || value.includes("aotearoa") || value.includes("auckland") || value.includes("wellington") || value.includes("christchurch") || value.includes("pacific/auckland") || value.includes("en-nz")) return { label: "New Zealand requirements", note: "PV work, roof access, certification and inspection must follow New Zealand requirements. The exact product engineering letter and Site wind/structure design still control the fixing schedule.", url: "https://www.worksafe.govt.nz/about-us/news-and-media/diy-solar-installation" };
  if (value.includes("australia") || value.includes("sydney") || value.includes("melbourne") || value.includes("brisbane") || value.includes("perth") || value.includes("adelaide") || value.includes("australia/") || value.includes("en-au")) return { label: "Australian requirements", note: "Use the applicable state or territory rules, accredited design and installation requirements, approved products and the exact mounting-system engineering documentation.", url: "https://cer.gov.au/schemes/renewable-energy-target/renewable-energy-target-participants-and-industry/rooftop-solar-installers-and-designers" };
  if (value.includes("united states") || value.includes("america/") || value.includes("en-us")) return { label: "United States requirements", note: "Permits, structural attachment, fire access, electrical rules and inspection vary by state and local authority. Use the approved plan and listed mounting-system instructions.", url: "https://www.energy.gov/cmei/systems/permitting-and-inspection-rooftop-solar" };
  return { label: "Local requirements", note: "Use the saved Site country and local authority requirements for structural design, wind/snow/fire loads, permitted work, inspection and connection. Product-family examples never replace the exact local approval and manufacturer manual." };
}

function HowToList({ title, items }: { title: string; items?: readonly string[] }) {
  if (!items?.length) return null;
  return <details className="rounded-xl border border-line bg-white p-3" open={title === "Before you start"}><summary className="cursor-pointer text-[11px] font-extrabold text-brand">{title}</summary><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-[10px] leading-4 text-muted"><Check size={13} className="mt-0.5 shrink-0 text-[#288253]"/>{item}</li>)}</ul></details>;
}

function SimpleMessage({ content }: { content: string }) {
  function inline(text: string) {
    return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={`${index}:${part}`}>{part.slice(2, -2)}</strong>
        : <span key={`${index}:${part}`}>{part}</span>,
    );
  }
  return <div className="space-y-2 whitespace-normal">{content.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-1"/>;
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    return bullet
      ? <div key={index} className="flex gap-2"><span aria-hidden="true">•</span><span>{inline(bullet[1])}</span></div>
      : <p key={index}>{inline(trimmed)}</p>;
  })}</div>;
}

function HowToTypes({ guide }: { guide: NoviceHowToGuide }) {
  return <>
    {guide.aliases?.length ? <p className="mt-3 text-[10px] text-muted"><strong>Also known as:</strong> {guide.aliases.join(" · ")}</p> : null}
    {guide.usedFor?.length ? <div className="mt-4 rounded-xl border border-line bg-white p-4"><h3 className="text-[11px] font-extrabold text-brand">B. What is it used for?</h3><div className="mt-3 flex flex-wrap gap-2">{guide.usedFor.map((use) => <span key={use} className="rounded-full bg-[#eef3f8] px-3 py-1 text-[10px] font-bold text-[#52657a]">{use}</span>)}</div></div> : null}
    {guide.types?.length ? <div className="mt-5">
      <h3 className="text-sm font-extrabold">C. What it looks like — common types and variations</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {guide.types.map((type) => <article key={type.name} className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="p-4">
            <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg border border-[#e3eaf1] bg-white p-2 sm:h-28">
              {/* Local reference images vary in size and shape; native dimensions prevent blurry upscaling. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={type.image ?? guide.image} alt={type.name} className="h-auto max-h-full w-auto max-w-full object-contain"/>
            </div>
            {type.imageCredit ? <p className="mb-2 text-[8px] leading-3 text-muted">Image: {type.imageSourceUrl ? <a href={type.imageSourceUrl} target="_blank" rel="noreferrer" className="underline">{type.imageCredit}</a> : type.imageCredit}{type.imageLicense ? ` · ${type.imageLicense}` : ""}</p> : null}
            <h4 className="text-[11px] font-extrabold text-brand">{type.name}</h4>
            <p className="mt-2 text-[10px] leading-5 text-muted">{type.description}</p>
            {type.bestFor ? <p className="mt-3 text-[9px] leading-4"><strong>Usually used for:</strong> {type.bestFor}</p> : null}
            {type.watchFor ? <p className="mt-2 text-[9px] leading-4 text-[#8a5e12]"><strong>Check:</strong> {type.watchFor}</p> : null}
          </div>
        </article>)}
      </div>
    </div> : null}
    {guide.questions?.length ? <div className="mt-5"><h3 className="text-sm font-extrabold">Questions you are probably asking</h3><div className="mt-3 space-y-2">{guide.questions.map((item) => <details key={item.question} className="rounded-xl border border-line bg-[#f8fafc] p-4"><summary className="cursor-pointer text-[11px] font-extrabold text-brand">{item.question}</summary><p className="mt-3 text-[10px] leading-5 text-muted">{item.answer}</p></details>)}</div></div> : null}
  </>;
}

type GuideChatReply = { message: string; citations?: readonly { title: string; url: string }[] };
type GuideChatLine = { id: string; role: "user" | "assistant"; content: string; citations?: GuideChatReply["citations"] };

function GuideWattsonChat({ guide, onAsk, onClose }: { guide: NoviceHowToGuide; onAsk: (guide: NoviceHowToGuide, question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) => Promise<GuideChatReply>; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lines, setLines] = useState<GuideChatLine[]>([{ id: "intro", role: "assistant", content: `I’m focused on ${guide.title}. Ask what a part is, what it does, what it looks like, how it relates to nearby components, or which step you are stuck on.` }]);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const conversation = conversationRef.current;
      if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [lines.length, sending]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;
    const userLine: GuideChatLine = { id: crypto.randomUUID(), role: "user", content: question };
    const nextLines = [...lines, userLine];
    setLines(nextLines);
    setInput("");
    setSending(true);
    try {
      const reply = await onAsk(guide, question, lines.slice(-7).map(({ role, content }) => ({ role, content })));
      setLines((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: reply.message, citations: reply.citations }]);
    } catch (error) {
      setLines((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? `I couldn’t answer that just now: ${error.message}` : "I couldn’t answer that just now." }]);
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0d2238]/45 p-0 sm:items-center sm:p-3" role="dialog" aria-modal="true" aria-label={`Ask Wattson about ${guide.title}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[calc(100dvh-3rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-2xl sm:h-auto sm:max-h-[min(680px,88dvh)] sm:rounded-2xl">
        <header className="flex items-start gap-3 border-b border-line bg-[#f8fafc] p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><Bot size={18}/></span>
          <div className="min-w-0 flex-1"><div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#3373aa]">Temporary guide help</div><h2 className="mt-1 truncate text-sm font-extrabold">{guide.title}</h2><p className="mt-1 text-[9px] text-muted">This subject chat is cleared when you close it and is not added to your project conversation.</p></div>
          <button type="button" onClick={onClose} aria-label="Close guide chat" className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted"><X size={15}/></button>
        </header>
        <div ref={conversationRef} className="min-h-52 flex-1 space-y-3 overflow-y-auto p-4">
          {lines.map((line) => <div key={line.id} className={`max-w-[92%] rounded-2xl px-4 py-3 text-[13px] leading-5 sm:max-w-[88%] sm:text-[11px] ${line.role === "user" ? "ml-auto bg-brand text-white" : "bg-[#eef3f8] text-[#20334a]"}`}><SimpleMessage content={line.content}/>{line.citations?.length ? <div className="mt-2 flex flex-wrap gap-2">{line.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold underline sm:text-[9px]">{citation.title}</a>)}</div> : null}</div>)}
          {sending ? <div className="inline-flex rounded-2xl bg-[#eef3f8] px-4 py-3 text-[10px] font-bold text-muted">Wattson is checking this guide…</div> : null}
        </div>
        <form onSubmit={submit} className="border-t border-line p-3"><div className="flex gap-2"><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask about ${guide.title.toLowerCase()}…`} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-[#f8fafc] px-4 text-xs outline-none focus:border-brand"/><button type="submit" disabled={!input.trim() || sending} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Send question"><Send size={16}/></button></div></form>
      </section>
    </div>,
    document.body,
  );
}

export function UniversalHowToMenu({ onAsk, location }: { onAsk: (guide: NoviceHowToGuide, question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) => Promise<GuideChatReply>; location?: string }) {
  const [query, setQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [chatGuide, setChatGuide] = useState<NoviceHowToGuide | null>(null);
  const search = query.trim().toLowerCase();
  const visible = search
    ? allHowToGuides.filter((guide) =>
        [howToSection(guide), guide.title, ...(guide.aliases ?? []), guide.summary, guide.whatItIs, guide.whatItDoes, guide.source, ...(guide.keywords ?? []), ...(guide.usedFor ?? []), ...(guide.types ?? []).flatMap((type) => [type.name, type.description, type.bestFor, type.watchFor]), ...(guide.questions ?? []).flatMap((item) => [item.question, item.answer]), ...(guide.buy ?? []), ...(guide.tools ?? []), ...(guide.before ?? []), ...guide.steps, ...(guide.checks ?? [])].filter((value): value is string => Boolean(value)).some((value) =>
          value.toLowerCase().includes(search),
        ),
      )
    : allHowToGuides;
  const groups = [
    ...howToGroupOrder.filter((group) => visible.some((guide) => howToSection(guide) === group)),
    ...Array.from(new Set(visible.map(howToSection))).filter((group) => !howToGroupOrder.includes(group as (typeof howToGroupOrder)[number])),
  ].sort((left, right) => left.localeCompare(right));
  const selected = allHowToGuides.find((guide) => guide.id === selectedId);
  const localAuthority = localHowToAuthority(location);

  return (
    <details className="relative" onToggle={(event) => { if (!event.currentTarget.open) { setQuery(""); setSelectedSection(""); setSelectedId(""); setChatGuide(null); } }}>
      <summary className="cursor-pointer list-none rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-[#143c63]">How to ▾</summary>
      {selected ? <button type="button" aria-label="Close the open How-to guide" onClick={() => setSelectedId("")} className="fixed inset-0 z-[80] cursor-default bg-[#0d2238]/45 backdrop-blur-sm"/> : null}
      <div className={selected ? "fixed inset-0 z-[90] overflow-y-auto bg-white p-3 shadow-[0_30px_100px_rgba(9,37,61,.4)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[82dvh] sm:w-[min(60rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-line sm:p-4" : `fixed inset-x-2 bottom-2 top-16 z-50 overflow-y-auto rounded-xl border border-line bg-white p-3 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-20 sm:max-h-[min(34rem,calc(100dvh-6rem))] sm:-translate-x-1/2 sm:p-2 ${selectedSection ? "sm:w-[min(24rem,calc(100vw-1rem))]" : "sm:w-[min(15rem,calc(100vw-1rem))]"}`}>
        <div className="sticky top-0 z-10 -mx-0.5 bg-white px-0.5 pb-2">
          <label htmlFor="global-how-to-search" className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#52657a]">Search the How-to library</label>
          <input id="global-how-to-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value) setSelectedSection(""); }} placeholder="Panel mounts, MC4, battery..." className="mt-1.5 h-8 w-full rounded-lg border border-line bg-[#f8fafc] px-2.5 text-[10px] outline-none focus:border-brand" />
          <p className="mt-1.5 text-[8px] text-muted">Hover or choose a section, then pick a guide.</p>
        </div>
        {selected ? (
          <section className="relative">
            <div className="mb-3 flex items-center justify-between gap-3"><button type="button" onClick={() => setSelectedId("")} className="text-[11px] font-bold text-brand">← Back to {selectedSection || "How-to guides"}</button><button type="button" onClick={() => setSelectedId("")} aria-label="Close guide" className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted"><X size={16}/></button></div>
            <div className="mx-auto flex h-48 w-full max-w-2xl items-center justify-center overflow-hidden rounded-xl border border-[#dce5ee] bg-white p-3 shadow-[0_8px_24px_rgba(18,53,86,.08)] sm:h-auto sm:min-h-44 sm:rounded-2xl sm:p-4">
              {/* Preserve each local reference image at its natural size; never stretch a small diagram to banner width. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.image} alt={`Reference image for ${selected.title}`} className="max-h-full max-w-full object-contain sm:h-auto sm:max-h-80 sm:w-auto" />
            </div>
            <div className="mt-5"><div className="eyebrow">{selected.group}</div><h2 className="mt-2 text-xl font-extrabold">{selected.title}</h2><p className="mt-2 text-xs leading-5 text-muted">{selected.summary}</p>{(selected.whatItIs || selected.whatItDoes) && <div className="mt-4 grid gap-3 sm:grid-cols-2">{selected.whatItIs && <div className="rounded-xl bg-[#eef5fc] p-4"><strong className="text-[11px]">What is this?</strong><p className="mt-2 text-[10px] leading-5 text-muted">{selected.whatItIs}</p></div>}{selected.whatItDoes && <div className="rounded-xl bg-[#fff8df] p-4"><strong className="text-[11px]">What does it do?</strong><p className="mt-2 text-[10px] leading-5 text-muted">{selected.whatItDoes}</p></div>}</div>}<HowToTypes guide={selected}/><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><HowToList title="What to buy" items={selected.buy}/><HowToList title="Tools" items={selected.tools}/><HowToList title="Before you start" items={selected.before}/></div><div className="mt-5"><h3 className="text-sm font-extrabold">Put it together</h3><ol className="mt-3 grid gap-2 sm:grid-cols-2">{selected.steps.map((step, index) => <li key={step} className="flex gap-3 rounded-xl bg-[#f4f7fa] p-3 text-[10px] leading-5"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[9px] font-bold text-white">{index + 1}</span>{step}</li>)}</ol></div><div className="mt-4 grid gap-3 md:grid-cols-2"><HowToList title="Final checks" items={selected.checks}/><div className="rounded-xl border border-[#efd98e] bg-[#fff9e3] p-3"><strong className="text-[11px] text-[#765918]">{localAuthority.label}</strong><p className="mt-2 text-[10px] leading-4 text-[#765918]">{localAuthority.note}</p>{localAuthority.url && <a href={localAuthority.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[10px] font-bold underline">Open local authority guidance</a>}</div></div><div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">{selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-[11px] font-bold text-white">Open the detailed manufacturer guide →</a> : <p className="text-[10px] font-bold text-[#765918]">{selected.source}</p>}<button type="button" onClick={() => setChatGuide(selected)} className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-[11px] font-bold text-brand">Stuck? Ask Wattson about this guide</button></div>{selected.sourceUrl && <p className="mt-2 text-[9px] leading-4 text-muted">Source example: {selected.source}</p>}<div className="mt-6 border-t border-line pt-4"><button type="button" onClick={() => setSelectedId("")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[11px] font-bold text-brand">← Back to {selectedSection || "How-to guides"}</button></div></div>
          </section>
        ) : search && visible.length ? (
          <div><div className="mb-2 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8a9c]">Matching sections</div><div className="space-y-0.5">{groups.map((group) => <button key={group} type="button" onMouseEnter={() => setSelectedSection(group)} onFocus={() => setSelectedSection(group)} onClick={() => { setQuery(""); setSelectedSection(group); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[11px] font-extrabold hover:bg-[#eef3f8]"><span>{group}</span><ChevronRight size={13} className="shrink-0 text-brand"/></button>)}</div></div>
        ) : selectedSection ? (
          <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <section className="hidden sm:block sm:border-r sm:border-line sm:pr-2">
              <div className="mb-1 text-[8px] font-extrabold uppercase tracking-[.1em] text-[#7b8a9c]">How-to sections</div>
              <div>{groups.map((group) => <button key={group} type="button" onMouseEnter={() => { setSelectedSection(group); setSelectedId(""); }} onFocus={() => { setSelectedSection(group); setSelectedId(""); }} onClick={() => { setSelectedSection(group); setSelectedId(""); }} className={`flex w-full items-center justify-between gap-1 rounded-md px-1.5 py-1 text-left text-[8px] font-extrabold leading-3 ${selectedSection === group ? "bg-[#fff4c5] text-brand" : "hover:bg-[#eef3f8]"}`}><span>{group}</span><ChevronRight size={10} className="shrink-0 text-brand"/></button>)}</div>
            </section>
            <section>
              <button type="button" onClick={() => setSelectedSection("")} className="mb-1 text-left text-[8px] font-extrabold uppercase tracking-[.1em] text-[#7b8a9c] sm:pointer-events-none">← {selectedSection}</button>
              <div>{allHowToGuides.filter((guide) => howToSection(guide) === selectedSection).sort((left, right) => left.title.localeCompare(right.title)).map((guide) => <button key={guide.id} type="button" onClick={() => setSelectedId(guide.id)} className="flex w-full items-center justify-between gap-1 rounded-md border border-transparent px-1.5 py-1.5 text-left text-[8px] font-bold leading-3 hover:border-line hover:bg-[#eef3f8]">{guide.title}<ChevronRight size={10} className="shrink-0 text-brand"/></button>)}</div>
            </section>
          </div>
        ) : visible.length ? (
          <div><div className="mb-2 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7b8a9c]">How-to sections</div><div className="space-y-0.5">{groups.map((group) => <button key={group} type="button" onMouseEnter={() => setSelectedSection(group)} onFocus={() => setSelectedSection(group)} onClick={() => setSelectedSection(group)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-[10px] font-extrabold hover:border-line hover:bg-[#eef3f8]"><span>{group}</span><span className="flex items-center gap-1.5 text-[8px] font-bold text-muted">{visible.filter((guide) => howToSection(guide) === group).length}<ChevronRight size={12} className="text-brand"/></span></button>)}</div></div>
        ) : <div className="rounded-xl bg-[#f4f7fa] p-5 text-center text-xs text-muted">No guide matches that search yet.</div>}
      </div>
      {chatGuide ? <GuideWattsonChat guide={chatGuide} onAsk={onAsk} onClose={() => setChatGuide(null)}/> : null}
    </details>
  );
}

function Build({ project, location, onAskGuide, shoppingListOnly = false }: { project: Project; location?: string; onAskGuide: (guide: NoviceHowToGuide, question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) => Promise<GuideChatReply>; shoppingListOnly?: boolean }) {
  const isPoolSystem = /pool|spa|swimming/.test(`${project.name} ${project.projectType} ${JSON.stringify(project.designDiscovery ?? {})}`.toLowerCase());
  type ShoppingItem = { name: string; specification: string; quantity: string; regulated: boolean; basis?: string };
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const acquiredStorageKey = `pvintell:shopping-acquired:${project.id}`;
  const moduleCompletionStorageKey = `pvintell:build-modules:${project.id}`;
  const [acquired, setAcquired] = useState<Record<string, boolean>>({});
  const [completedModules, setCompletedModules] = useState<Record<string, boolean>>({});
  const { enabled: purchasePromptsEnabled } = usePurchasePromptPreference();
  const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null);
  const [purchaseDraft, setPurchaseDraft] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", vendor: "", notes: "" });
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseNotice, setPurchaseNotice] = useState("");
  const [selectedBuildModuleId, setSelectedBuildModuleId] = useState("");
  const [moduleChatGuide, setModuleChatGuide] = useState<NoviceHowToGuide | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(acquiredStorageKey);
        if (stored) setAcquired(JSON.parse(stored) as Record<string, boolean>);
        const completed = window.localStorage.getItem(moduleCompletionStorageKey);
        if (completed) setCompletedModules(JSON.parse(completed) as Record<string, boolean>);
      } catch { /* A blocked or damaged local store must not stop the shopping list. */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [acquiredStorageKey, moduleCompletionStorageKey]);
  const setModuleCompleted = (moduleId: string, complete: boolean) => setCompletedModules((current) => {
    const next = { ...current, [moduleId]: complete };
    try { window.localStorage.setItem(moduleCompletionStorageKey, JSON.stringify(next)); } catch { /* Keep completion usable for this session. */ }
    return next;
  });
  const decimal = (value: number, places = 1) => Number.isFinite(value) ? value.toFixed(places) : "—";
  const proposal = project.designCalculator?.proposedAsBuiltDraft;
  const acceptedComponents = (proposal?.nodes ?? []).filter((node) => node.reviewed);
  const acceptedConnections = (proposal?.connections ?? []).filter((connection) => connection.configured);
  const design = project.designCalculator ?? {};
  const acceptedPvNodes = acceptedComponents.filter((node) => node.id === "solar" || node.id.startsWith("solar-pv-"));
  const hasAsBuiltRecord = project.pvArrays.length > 0 || project.components.length > 0 || project.connections.length > 0;
  const proposedPanelCount = acceptedPvNodes.reduce((total, node) => total + (node.id.startsWith("solar-pv-") ? Number(design.panelsPerString ?? 0) : Number(design.panelCount ?? 0)), 0);
  const acceptedPanelCount = hasAsBuiltRecord
    ? project.pvArrays.reduce((total, array) => total + Number(array.panelCount ?? 0), 0)
    : proposedPanelCount;
  const acceptedPvStrings = hasAsBuiltRecord
    ? project.pvArrays.reduce((total, array) => total + Number(array.strings ?? 1), 0)
    : acceptedPvNodes.length || (acceptedPanelCount ? 1 : 0);
  const panelsPerAcceptedRow = acceptedPvStrings ? Math.max(1, Math.ceil(acceptedPanelCount / acceptedPvStrings)) : 0;
  const panelWidthM = Number(design.panelWidthMm ?? 0) / 1000;
  const assumedRowLengthM = panelsPerAcceptedRow && panelWidthM ? panelsPerAcceptedRow * panelWidthM + Math.max(0, panelsPerAcceptedRow - 1) * .02 : 0;
  const mountingLocations = design.mountingLocations ?? [];
  const hasGroundMount = mountingLocations.includes("ground");
  const groundOnly = mountingLocations.length > 0 && mountingLocations.every((location) => location === "ground");
  const groundRows = hasGroundMount ? groundOnly ? acceptedPvStrings : Math.max(1, Math.floor(acceptedPvStrings / Math.max(1, mountingLocations.length))) : 0;
  const railRows = Math.max(0, acceptedPvStrings - groundRows);
  const railRuns = railRows * 2;
  const railStockLengthM = 4;
  const railLinearM = assumedRowLengthM * railRuns;
  const railStockQuantity = railLinearM ? Math.ceil(railLinearM / railStockLengthM) : 0;
  const railJoinQuantity = assumedRowLengthM > railStockLengthM ? railRuns * Math.ceil(assumedRowLengthM / railStockLengthM - 1) : 0;
  const middleClampQuantity = acceptedPvStrings * Math.max(0, panelsPerAcceptedRow - 1) * 2;
  const endClampQuantity = acceptedPvStrings * 4;
  const routeLengthWithAllowance = (lengthM: number) => Math.ceil(lengthM * 1.1);
  const groupedRoutes = acceptedConnections.reduce((groups, connection) => {
    if (!connection.lengthM || !connection.cableSizeMm2) return groups;
    const key = `${connection.kind}:${connection.cableSizeMm2}`;
    const current = groups.get(key) ?? { kind: connection.kind, cableSizeMm2: connection.cableSizeMm2, lengthM: 0, routeCount: 0 };
    current.lengthM += connection.lengthM;
    current.routeCount += 1;
    groups.set(key, current);
    return groups;
  }, new Map<string, { kind: "solar-dc" | "battery-dc" | "ac" | "earth"; cableSizeMm2: number; lengthM: number; routeCount: number }>());
  const pvRouteLength = acceptedConnections.filter((connection) => connection.kind === "solar-dc").reduce((total, connection) => total + Number(connection.lengthM ?? 0), 0);
  const isolators = acceptedComponents.filter((node) => node.id.includes("solar-safety"));
  const stringVoc = Number(design.panelVocV ?? 0) * Number(design.panelsPerString ?? 0);
  const isolatorVoltage = stringVoc <= 600 ? 600 : stringVoc <= 1000 ? 1000 : 1500;
  const pvProtection = acceptedConnections.filter((connection) => connection.kind === "solar-dc").reduce((largest, connection) => Math.max(largest, Number(connection.protectionAmps ?? 0)), 0);
  const isolatorCurrent = [20, 25, 32, 40, 50, 63].find((rating) => rating >= Math.max(20, pvProtection)) ?? Math.ceil(Math.max(20, pvProtection));
  const acProtection = acceptedConnections.filter((connection) => connection.kind === "ac" && !connection.authorityCheck).reduce((largest, connection) => Math.max(largest, Number(connection.protectionAmps ?? 0)), 0);
  const shoppingItems: ShoppingItem[] = [];

  if (acceptedPanelCount) {
    if (hasAsBuiltRecord && project.pvArrays.length) {
      for (const array of project.pvArrays) shoppingItems.push({
        name: `${array.name} solar PV modules`,
        specification: `${array.manufacturer ?? "Manufacturer not recorded"}${array.panelModel ? ` ${array.panelModel}` : ""}${array.panelWatts ? ` · ${array.panelWatts} W` : ""}${array.openCircuitVoltageV ? ` · Voc ${array.openCircuitVoltageV} V` : ""}`,
        quantity: `${array.panelCount ?? 0} panels`,
        regulated: false,
        basis: `Current as-built record · ${array.strings ?? 1} string${(array.strings ?? 1) === 1 ? "" : "s"}`,
      });
    } else shoppingItems.push({
      name: "Solar PV module",
      specification: `${design.panelWatts ?? "Rating to confirm"} W${design.panelLengthMm && design.panelWidthMm ? ` · ${design.panelLengthMm} × ${design.panelWidthMm} mm` : ""}${design.panelWeightKg ? ` · ${design.panelWeightKg} kg` : ""}${design.panelVocV ? ` · Voc ${design.panelVocV} V` : ""}`,
      quantity: `${acceptedPanelCount} panels`,
      regulated: false,
      basis: `${acceptedPvStrings} accepted PV string${acceptedPvStrings === 1 ? "" : "s"}`,
    });
    if (groundRows) {
      shoppingItems.push(
        { name: "Ground-mount structural frame", specification: `Frame and cross-members sized for ${groundRows * panelsPerAcceptedRow} modules`, quantity: `${groundRows} row set${groundRows === 1 ? "" : "s"}`, regulated: false, basis: groundOnly ? "Accepted ground-mount location" : "Planning split across the accepted ground and building locations" },
        { name: "Ground-frame foundation / anchor set", specification: "To suit the confirmed soil, wind zone and frame engineering", quantity: `${groundRows} row set${groundRows === 1 ? "" : "s"}`, regulated: false },
      );
    }
    if (railRows) {
      shoppingItems.push(
        { name: "Solar panel mounting rail", specification: `${railStockLengthM} m rail lengths · compatible with selected module clamps`, quantity: railStockQuantity ? `${railStockQuantity} lengths` : "Layout confirmation required", regulated: false, basis: `${decimal(railLinearM, 1)} linear m plus cutting allocation; assumes one portrait row per accepted string` },
        { name: "Rail splice / extension kit", specification: "Matched to the selected rail system", quantity: `${railJoinQuantity} kits`, regulated: false, basis: "One splice at each planned rail extension" },
        { name: "Roof mounting feet / brackets", specification: "Matched to roof cladding, structure and rail system", quantity: railLinearM ? `${railRuns * (Math.ceil(assumedRowLengthM / 1.2) + 1)} mounts` : "Layout confirmation required", regulated: false, basis: "Planning spacing of no more than 1.2 m; final engineering controls" },
      );
    }
    shoppingItems.push(
      { name: "Panel centre clamp", specification: "Matched to module frame thickness and rail system", quantity: `${middleClampQuantity}`, regulated: false },
      { name: "Panel end clamp", specification: "Matched to module frame thickness and rail system", quantity: `${endClampQuantity}`, regulated: false },
      { name: "PV frame earth / bonding clamp", specification: "Compatible listed bonding hardware", quantity: `${Math.max(2, acceptedPvStrings * 2)}`, regulated: true },
      { name: "MC4-compatible connector pair", specification: "Same connector family approved for the selected modules and inverter leads", quantity: `${acceptedPvStrings} pairs`, regulated: true },
    );
  }

  if (isolators.length) shoppingItems.push({ name: "PV DC isolator", specification: `${isolatorVoltage} V DC · ${isolatorCurrent} A minimum · DC-PV2 load-break · poles and IP rating to suit location`, quantity: `${isolators.length}`, regulated: true, basis: "One accepted isolator per independent PV string" });

  for (const route of groupedRoutes.values()) {
    const purchaseLength = routeLengthWithAllowance(route.lengthM);
    if (route.kind === "solar-dc") {
      shoppingItems.push(
        { name: "Red solar PV cable", specification: `${route.cableSizeMm2} mm² · PV1-F or locally compliant equivalent`, quantity: `${purchaseLength} m`, regulated: true, basis: `${decimal(route.lengthM, 1)} m configured route plus 10% termination allowance` },
        { name: "Black solar PV cable", specification: `${route.cableSizeMm2} mm² · PV1-F or locally compliant equivalent`, quantity: `${purchaseLength} m`, regulated: true, basis: `${decimal(route.lengthM, 1)} m configured route plus 10% termination allowance` },
      );
    } else if (route.kind === "battery-dc") {
      shoppingItems.push(
        { name: "Red battery cable", specification: `${route.cableSizeMm2} mm² flexible DC cable`, quantity: `${purchaseLength} m`, regulated: true, basis: `${decimal(route.lengthM, 1)} m configured route plus 10% termination allowance` },
        { name: "Black battery cable", specification: `${route.cableSizeMm2} mm² flexible DC cable`, quantity: `${purchaseLength} m`, regulated: true, basis: `${decimal(route.lengthM, 1)} m configured route plus 10% termination allowance` },
        { name: "Battery cable lug", specification: `To suit ${route.cableSizeMm2} mm² cable and selected terminal studs`, quantity: `${route.routeCount * 4}`, regulated: true },
      );
    } else if (route.kind === "ac") {
      shoppingItems.push({ name: "AC power cable", specification: `${route.cableSizeMm2} mm² ${design.connectionType === "ac_three" ? "4C+E" : "2C+E"} · installation type to suit route`, quantity: `${purchaseLength} m`, regulated: true, basis: `${decimal(route.lengthM, 1)} m configured route plus 10% termination allowance` });
    } else {
      shoppingItems.push({ name: "Green/yellow protective earth cable", specification: `${route.cableSizeMm2} mm²`, quantity: `${purchaseLength} m`, regulated: true, basis: `${decimal(route.lengthM, 1)} m configured route plus 10% termination allowance` });
    }
  }

  if (pvRouteLength) shoppingItems.push(
    { name: "UV-rated conduit for PV routes", specification: "Conduit diameter to final cable-fill and installation calculation", quantity: `${routeLengthWithAllowance(pvRouteLength)} m`, regulated: true, basis: `${decimal(pvRouteLength, 1)} m configured PV route plus 10% allowance` },
    { name: "PV conduit saddles / supports", specification: "UV-resistant and matched to selected conduit", quantity: `${Math.ceil(routeLengthWithAllowance(pvRouteLength) / .75)}`, regulated: false, basis: "Planning support spacing of 750 mm; final installation method controls" },
    { name: "PV cable glands and entries", specification: "IP-rated, UV-resistant and matched to cable / enclosure", quantity: `${Math.max(4, acceptedPvStrings * 4)}`, regulated: true },
    { name: "PV DC labels and warning set", specification: "Complete durable identification set for array, isolators, routes and inverter", quantity: "1 set", regulated: true },
  );

  for (const node of hasAsBuiltRecord ? [] : acceptedComponents) {
    if (node.id === "solar" || node.id.startsWith("solar-pv-") || node.id.includes("solar-safety")) continue;
    if (node.id.includes("inverter")) shoppingItems.push({ name: node.label, specification: `${design.inverterKw ?? "Rating to confirm"} kW continuous · ${node.detail}`, quantity: "1", regulated: true });
    else if (node.id === "ac-safety") shoppingItems.push({ name: "AC circuit breaker / safety switch", specification: `${design.connectionType === "ac_three" ? 400 : 230} V AC · ${acProtection || "rating to confirm"} A · poles, curve, fault rating and RCD type to final design`, quantity: "1", regulated: true });
    else if (node.id === "battery-safety") shoppingItems.push({ name: "Battery DC fuse and isolator", specification: node.detail, quantity: "1 set", regulated: true });
    else if (node.id === "earth") shoppingItems.push({ name: "Earthing electrode and termination kit", specification: node.detail, quantity: "1 set", regulated: true });
    else shoppingItems.push({ name: node.label, specification: node.detail, quantity: "1", regulated: node.id.includes("switchboard") || node.id.includes("controller") || node.authorityCheck === true });
  }
  if (hasAsBuiltRecord) for (const component of project.components) shoppingItems.push({
    name: component.name,
    specification: [component.manufacturer, component.model, component.location, component.notes].filter(Boolean).join(" · ") || "Specifications not recorded",
    quantity: String(component.quantity || 1),
    regulated: ["inverter", "charger", "generator", "protection", "isolator", "cable", "combiner"].includes(component.kind),
    basis: "Current as-built equipment record",
  });
  type BuildModule = {
    id: string;
    title: string;
    description: string;
    guideGroups: readonly string[];
    guideIds?: readonly string[];
    evidence: (value: string) => boolean;
    Icon: typeof Sun;
  };
  const acceptedDesignText = hasAsBuiltRecord
    ? [
        ...project.pvArrays.map((array) => `${array.name} solar pv panel array ${array.panelCount ?? ""} ${array.manufacturer ?? ""} ${array.panelModel ?? ""}`),
        ...project.components.map((component) => `${component.kind} ${component.name} ${component.manufacturer ?? ""} ${component.model ?? ""} ${component.location ?? ""}`),
        ...project.connections.map((connection) => `${connection.connectionType} ${connection.name} ${connection.sourceRef} ${connection.targetRef}`),
      ].join(" ").toLowerCase()
    : [...acceptedComponents.map((node) => `${node.id} ${node.label} ${node.detail}`), ...acceptedConnections.map((connection) => `${connection.kind} ${connection.label} ${connection.from} ${connection.to}`)].join(" ").toLowerCase();
  const includesAny = (...terms: string[]) => terms.some((term) => acceptedDesignText.includes(term));
  const panelModuleTitle = groundOnly
    ? "Panels, ground mount and framing"
    : hasGroundMount
      ? "Panels and mounting systems"
      : "Panels, roof mounting and framing";
  const moduleDefinitions: BuildModule[] = [
    { id: "pv-array", title: panelModuleTitle, description: "Modules, structural supports, rails or frames, clamps and weatherproof mounting.", guideGroups: ["Roofing and roof structure", "Solar panels and module types", "Mounting systems and hardware"], evidence: (value) => /solar[- ]pv|panels?|mount|frame|rail|clamp|anchor/.test(value), Icon: Sun },
    { id: "pv-dc", title: "PV strings, DC cable and isolation", description: "String wiring, connectors, conduit, labels, DC protection and isolators up to the inverter.", guideGroups: ["DC wiring and connections", "Protection and isolation"], guideIds: ["mc4"], evidence: (value) => /solar pv cable|mc4|pv dc|pv conduit|pv cable|pv string|isolator/.test(value), Icon: PlugZap },
    { id: "battery", title: "Battery storage and battery DC", description: "Battery mounting, interconnection, protection, isolation and battery management equipment.", guideGroups: ["Batteries and charging"], evidence: (value) => /battery|bms/.test(value), Icon: BatteryCharging },
    { id: "inverter", title: "Inverter and power conversion", description: "Mounting, clearances, equipment interfaces, settings and the planned conversion equipment.", guideGroups: ["Inverters and power conversion"], guideIds: ["inverter", "controller"], evidence: (value) => /inverter|controller|mppt|optimiser|microinverter/.test(value), Icon: Zap },
    { id: "ac", title: "AC supply, switchboard and protection", description: "AC cabling, breakers, safety switches, distribution boards and the building connection.", guideGroups: ["AC wiring and connections", "Protection and isolation"], guideIds: ["switchboard"], evidence: (value) => /ac power|circuit breaker|safety switch|switchboard|power board|grid supply|building power/.test(value), Icon: Waypoints },
    { id: "generator", title: "Generator and source changeover", description: "Generator location, inlet, transfer or changeover equipment, protection and source interlocking.", guideGroups: ["AC wiring and connections", "Protection and isolation"], guideIds: ["generator-integration"], evidence: (value) => /generator|genset/.test(value), Icon: Zap },
    { id: "earthing", title: "Earthing and equipment bonding", description: "Protective earth conductors, array bonds, electrodes, compatible lugs and continuity checks.", guideGroups: ["Earthing and bonding"], evidence: (value) => /earth|\bbond\b|bonding|grounding|electrode/.test(value), Icon: Waypoints },
  ];
  const shoppingItemModuleId = (item: ShoppingItem) => {
    const value = `${item.name} ${item.specification}`.toLowerCase();
    if (/generator|genset/.test(value)) return "generator";
    if (/battery|bms/.test(value)) return "battery";
    if (/earth|\bbond\b|bonding|grounding|electrode/.test(value)) return "earthing";
    if (/solar pv module|mount|frame|rail|clamp|anchor/.test(value)) return "pv-array";
    if (/solar pv cable|mc4|pv dc|pv conduit|pv cable|isolator|warning/.test(value)) return "pv-dc";
    if (/inverter|controller|mppt|optimiser|microinverter/.test(value)) return "inverter";
    return "ac";
  };
  const buildModules = moduleDefinitions.filter((module) => {
    if (module.id === "pv-array") return acceptedPanelCount > 0;
    if (module.id === "pv-dc") return acceptedConnections.some((connection) => connection.kind === "solar-dc") || isolators.length > 0;
    if (module.id === "battery") return includesAny("battery", "bms");
    if (module.id === "inverter") return includesAny("inverter", "controller", "mppt", "optimiser", "microinverter");
    if (module.id === "ac") return acceptedConnections.some((connection) => connection.kind === "ac") || includesAny("switchboard", "power board", "grid supply", "building power", "safety switch");
    if (module.id === "generator") return includesAny("generator", "genset");
    return acceptedConnections.some((connection) => connection.kind === "earth") || includesAny("earth", " bond", "bonding", "grounding", "electrode");
  });
  const buildModuleIds = buildModules.map((module) => module.id).join("|");
  useEffect(() => {
    const moduleIds = buildModuleIds ? buildModuleIds.split("|") : [];
    const allComplete = moduleIds.length > 0 && moduleIds.every((moduleId) => completedModules[moduleId]);
    try { window.localStorage.setItem(`pvintell:build-complete:${project.id}`, allComplete ? "true" : "false"); } catch { /* Completion remains usable on this page. */ }
  }, [buildModuleIds, completedModules, project.id]);
  const selectedBuildModule = buildModules.find((module) => module.id === selectedBuildModuleId);
  const buildGuideIds = (module: BuildModule) => {
    if (module.id === "pv-array") return new Set([
      "panels",
      "read-module-label",
      "rails-splices-module-clamps",
      ...(hasGroundMount ? ["mounting-ground"] : []),
      ...(mountingLocations.includes("carport_pergola") ? ["carport-pergola-canopy"] : []),
      ...(mountingLocations.some((location) => location === "fence" || location === "wall_facade") ? ["mounting-vertical"] : []),
    ]);
    if (module.id === "pv-dc") return new Set(["mc4", "connector-compatibility", "pv-cable-selection-sizing", "pv-cable-support-management", "dc-load-break-isolators", "conduit-containment-types", "cable-route-planning"]);
    if (module.id === "battery") return new Set(["battery", "battery-cables-lugs", ...(includesAny("bms") ? ["battery-bms"] : []), ...(includesAny("battery cabinet", "battery rack", "battery enclosure") ? ["battery-enclosures-racks"] : [])]);
    if (module.id === "inverter") return new Set(["inverter"]);
    if (module.id === "ac") return new Set(["ac-output", "ac-breakers-isolators", "rcd-rcbo-selection", "cable-route-planning"]);
    if (module.id === "generator") return new Set(["generator-integration"]);
    return new Set(["earth-electrodes-bonding-difference", "install-earth-peg-ground-rod"]);
  };
  const guidesForModule = (module: BuildModule) => {
    const allowedIds = buildGuideIds(module);
    return allHowToGuides.filter((guide) => allowedIds.has(guide.id));
  };
  const authority = localHowToAuthority(location);
  const selectedModuleGuides = selectedBuildModule ? guidesForModule(selectedBuildModule) : [];
  const selectedModuleMaterials = selectedBuildModule ? shoppingItems.filter((item) => shoppingItemModuleId(item) === selectedBuildModule.id) : [];
  const selectedModuleComponents = selectedBuildModule ? acceptedComponents.filter((node) => selectedBuildModule.evidence(`${node.id} ${node.label} ${node.detail}`.toLowerCase())) : [];
  const selectedModuleConnections = selectedBuildModule ? acceptedConnections.filter((connection) => selectedBuildModule.evidence(`${connection.kind} ${connection.label} ${connection.from} ${connection.to}`.toLowerCase())) : [];
  const moduleGuide = selectedBuildModule ? {
    ...(selectedModuleGuides[0] ?? { group: "Build modules", image: "/schematic-components/ac-distribution-board.jpg", steps: [], source: "The accepted schematic, selected product manuals and local requirements." }),
    id: `build-module-${selectedBuildModule.id}`,
    title: selectedBuildModule.title,
    summary: selectedBuildModule.description,
    whatItIs: `This build module groups the accepted ${selectedBuildModule.title.toLowerCase()} equipment, materials and relevant installation guidance in one place.`,
    whatItDoes: "It keeps guidance tied to a physical part of the accepted schematic instead of presenting a generic sequence of unrelated tasks.",
  } satisfies NoviceHowToGuide : null;
  const itemKey = (item: ShoppingItem) => `${item.name}::${item.specification}::${item.quantity}`;
  const acquiredCount = shoppingItems.filter((item) => acquired[itemKey(item)]).length;
  const toggleAcquired = (item: ShoppingItem) => {
    const key = itemKey(item);
    const willBeAcquired = !acquired[key];
    setAcquired((current) => {
      const next = { ...current, [key]: !current[key] };
      try { window.localStorage.setItem(acquiredStorageKey, JSON.stringify(next)); } catch { /* Keep the checkbox usable for this session. */ }
      return next;
    });
    if (willBeAcquired && purchasePromptsEnabled) {
      setPurchaseDraft({ date: new Date().toISOString().slice(0, 10), amount: "", vendor: "", notes: "" });
      setPurchaseError("");
      setPurchaseNotice("");
      setPurchaseItem(item);
    }
  };
  const addPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!purchaseItem) return;
    const amount = Number(purchaseDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPurchaseError("Enter the total amount paid for this item.");
      return;
    }
    setPurchaseSaving(true);
    setPurchaseError("");
    try {
      const response = await fetch("/api/system-financials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          purchase: {
            date: purchaseDraft.date,
            description: `${purchaseItem.name} · ${purchaseItem.quantity}`,
            amount,
            vendor: purchaseDraft.vendor.trim() || undefined,
            notes: [purchaseItem.specification, purchaseDraft.notes.trim()].filter(Boolean).join(" · "),
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not add this purchase.");
      setPurchaseItem(null);
      setPurchaseNotice(`${purchaseItem.name} added to Financials.`);
    } catch (problem) {
      setPurchaseError(problem instanceof Error ? problem.message : "Could not add this purchase.");
    } finally {
      setPurchaseSaving(false);
    }
  };
  const exportRows = () => shoppingItems.map((item) => ({ ...item, acquired: acquired[itemKey(item)] ? "Yes" : "No" }));
  const downloadCsv = () => {
    const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = exportRows();
    const csv = [
      ["Acquired", "Item", "Specification", "Quantity", "Requirement", "Calculation basis"],
      ...rows.map((item) => [item.acquired, item.name, item.specification, item.quantity, item.regulated ? "Certification check" : "General material", item.basis ?? ""]),
    ].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "system"}-shopping-list.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const emailList = () => {
    const body = exportRows().map((item) => `${item.acquired === "Yes" ? "[x]" : "[ ]"} ${item.name} — ${item.quantity}\n${item.specification}${item.basis ? `\nBasis: ${item.basis}` : ""}`).join("\n\n");
    window.open(`mailto:?subject=${encodeURIComponent(`${project.name} shopping list`)}&body=${encodeURIComponent(body)}`, "_self");
  };
  const printList = () => {
    const cleanup = () => document.body.classList.remove("shopping-list-print");
    document.body.classList.add("shopping-list-print");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };
  return (
    <div className="animate-rise space-y-6">
      <Heading
        eyebrow={shoppingListOnly ? "Accepted design" : "Build It · installation modules"}
        title={shoppingListOnly ? "Shopping List" : "Build the system by module"}
        description={shoppingListOnly ? "Source the accepted equipment, supporting hardware and calculated cable lengths, then tick each item as you acquire it." : "Choose a physical section of the accepted design, then open only the equipment, materials and how-to guidance you need for that work."}
      />
      {isPoolSystem && !shoppingListOnly ? <aside className="flex gap-3 rounded-2xl border border-[#e6b84c] bg-[#fff7d6] p-4 text-[10px] leading-5 text-[#684d0d]"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><div><strong className="block text-xs">Pool chemicals rapidly corrode electrical equipment</strong><p className="mt-1">Locate the inverter, switchgear, controllers, batteries and terminations in a dry, very well-ventilated equipment area, separated from chlorine, salt, acid and dosing-chemical storage or fumes. Do not treat a closed pool plant room as clean air. Keep chemical containers and dosing points away from electrical equipment, follow every product’s environmental and clearance limits, and let Wattson check the proposed location before mounting.</p></div></aside> : null}
      {shoppingListOnly ? <section id="build-shopping-list" className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line bg-[#eef5fc] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><Package size={18} className="mt-0.5 shrink-0 text-brand"/><div><div className="eyebrow">Accepted design shopping list</div><h2 className="mt-1 text-base font-extrabold">Everything required for this build</h2><p className="mt-1 max-w-2xl text-[10px] leading-4 text-muted">Accepted components expand into products, supporting hardware and calculated cable lengths.</p><p className="mt-1 text-[10px] font-bold text-brand">{acquiredCount}/{shoppingItems.length} acquired</p>{purchaseNotice ? <p className="mt-1 text-[10px] font-bold text-[#17603b]">✓ {purchaseNotice} <Link href={`${base}/financials`} className="underline">View Financials</Link></p> : null}</div></div>
          {shoppingItems.length ? <div className="shopping-list-actions flex flex-wrap gap-1.5"><button type="button" onClick={downloadCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[10px] font-bold text-white"><Download size={13}/>Download CSV</button><button type="button" onClick={printList} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand bg-white px-3 text-[10px] font-bold text-brand"><Printer size={13}/>Print / PDF</button><button type="button" onClick={emailList} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand bg-white px-3 text-[10px] font-bold text-brand"><Mail size={13}/>Email list</button></div> : null}
        </div>
        {shoppingItems.length ? <div className="p-3 sm:p-4"><div className="overflow-hidden rounded-xl border border-line"><div className="hidden grid-cols-[2rem_minmax(9rem,1fr)_minmax(14rem,1.8fr)_6rem_8rem] gap-2 bg-[#edf5fc] px-3 py-2 text-[8px] font-extrabold uppercase tracking-[.08em] text-muted sm:grid"><span>Got</span><span>Item</span><span>Specification</span><span>Quantity</span><span>Requirement</span></div>{shoppingItems.map((item, index) => { const checked = acquired[itemKey(item)] ?? false; return <article key={`${item.name}-${index}`} className={`grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-2 gap-y-1 border-t border-line px-3 py-2.5 first:border-t-0 sm:grid-cols-[2rem_minmax(9rem,1fr)_minmax(14rem,1.8fr)_6rem_8rem] sm:items-start ${item.regulated ? "bg-[#fff9df]" : "bg-white"} ${checked ? "opacity-60" : ""}`}><label className="row-span-2 flex min-h-6 cursor-pointer items-start pt-0.5 sm:row-span-1" title={`Mark ${item.name} as acquired`}><input type="checkbox" checked={checked} onChange={() => toggleAcquired(item)} className="size-4 accent-[#238653]"/><span className="sr-only">{item.name} acquired</span></label><strong className={`min-w-0 text-[10px] leading-4 ${checked ? "line-through" : ""}`}>{item.name}</strong><strong className="text-right text-[10px] leading-4 text-brand sm:text-left">{item.quantity}</strong><div className="col-span-2 col-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1"><p className="text-[9px] font-semibold leading-4 text-ink">{item.specification}</p>{item.basis ? <p className="text-[8px] leading-3 text-muted">{item.basis}</p> : null}</div><span className="col-span-2 col-start-2 sm:col-span-1 sm:col-start-5 sm:row-start-1">{item.regulated ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0bd] px-2 py-1 text-[7px] font-extrabold uppercase tracking-[.04em] text-[#765918]"><AlertTriangle size={9}/>Certification check</span> : <span className="inline-flex rounded-full bg-[#e8f5ed] px-2 py-1 text-[7px] font-extrabold uppercase tracking-[.04em] text-[#17603b]">General material</span>}</span></article>; })}</div></div> : <p className="p-5 text-xs text-muted">Accept component specifications on the proposed schematic to build this list.</p>}
        <div className="border-t border-[#efd98e] bg-[#fff9e3] px-4 py-2 text-[9px] leading-4 text-[#765918]">“Certification check” means a registered electrical worker must confirm the product, installation, testing, certification and any required inspection before energisation.</div>
      </section> : null}
      {!shoppingListOnly && !selectedBuildModule ? <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="eyebrow">Modules in this accepted design</div><h2 className="mt-2 text-lg font-extrabold">Choose the part of the system you are installing</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-muted">Each module combines its accepted equipment, shopping-list materials and relevant visual guidance. There is no forced task order.</p></div>
          <Link href={`${base}?view=shopping-list`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand bg-white px-4 text-xs font-bold text-brand"><ShoppingCart size={15}/>Open shopping list</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {buildModules.map((module) => {
            const materialCount = shoppingItems.filter((item) => shoppingItemModuleId(item) === module.id).length;
            const guideCount = guidesForModule(module).length;
            const completed = completedModules[module.id] ?? false;
            return <article key={module.id} className={`card group flex min-h-44 flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md ${completed ? "border-[#72b98b] bg-[#f1faf4]" : "hover:border-brand"}`}>
              <button type="button" onClick={() => setSelectedBuildModuleId(module.id)} className="flex flex-1 flex-col text-left">
              <span className="grid size-11 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><module.Icon size={21}/></span>
              <h3 className="mt-4 text-base font-extrabold">{module.title}</h3>
              <p className="mt-2 flex-1 text-[11px] leading-5 text-muted">{module.description}</p>
              <span className="mt-4 flex w-full items-center justify-between border-t border-line pt-3 text-[10px] font-bold text-brand"><span>{materialCount} materials · {guideCount} how-to subjects</span><ChevronRight size={15}/></span>
              </button>
              <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-line pt-3 text-[10px] font-extrabold text-[#17603b]"><input type="checkbox" checked={completed} onChange={(event) => setModuleCompleted(module.id, event.target.checked)} className="size-4 accent-[#238653]"/>Completed</label>
            </article>;
          })}
        </div>
        {!buildModules.length ? <div className="card mt-4 p-6 text-xs leading-5 text-muted">Accept the component specifications and configure the schematic connections before opening the installation modules.</div> : null}
      </section> : null}
      {!shoppingListOnly && selectedBuildModule ? <section className="space-y-4">
        <button type="button" onClick={() => setSelectedBuildModuleId("")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[11px] font-bold text-brand"><ArrowLeft size={14}/>All build modules</button>
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-line bg-[#eef5fc] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand"><selectedBuildModule.Icon size={21}/></span><div><div className="eyebrow">Installation module</div><h2 className="mt-1 text-xl font-extrabold">{selectedBuildModule.title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{selectedBuildModule.description}</p></div></div>
            {moduleGuide ? <button type="button" onClick={() => setModuleChatGuide(moduleGuide)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white"><Bot size={16}/>Ask Wattson about this module</button> : null}
          </div>
          {selectedBuildModule.id === "earthing" ? <div className="border-b border-line bg-[#f1faf4] p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="eyebrow text-[#17603b]">This system’s supplied earthing plan</div><h3 className="mt-2 text-sm font-extrabold">Follow the green routes on the accepted schematic</h3><p className="mt-1 max-w-3xl text-[10px] leading-5 text-muted">The routes below define what is bonded and where it returns. They do not, by themselves, decide whether this Site should reuse a compliant existing electrode or install a new one. That choice depends on the existing supply earthing, electrode condition and test results, soil, equipment instructions and local rules. Do not install a new or independent panel earth by assumption.</p></div><div className="flex shrink-0 flex-col gap-2"><Link href={`${base}/design/schematic`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#72b98b] bg-white px-4 text-[10px] font-bold text-[#17603b]"><Waypoints size={14}/>Open the earthing schematic</Link>{moduleGuide ? <button type="button" onClick={() => setModuleChatGuide(moduleGuide)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#238653] px-4 text-[10px] font-bold text-white"><Bot size={14}/>Ask Wattson: existing or new peg?</button> : null}</div></div>
            <div className="mt-4 rounded-xl border border-[#e6cc74] bg-[#fff9df] p-3 text-[10px] leading-5 text-[#624b14]"><strong>Decision required before installation:</strong> record either “use existing Site electrode” with its inspection/test evidence, or “install new electrode” with its specified location and connection. Ask Wattson to work through the Site details when that decision is not already explicit.</div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">{acceptedConnections.filter((connection) => connection.kind === "earth").map((connection, index) => <div key={`${connection.from}-${connection.to}-${index}`} className="rounded-xl border border-[#9bd2ad] bg-white p-3"><strong className="block text-[11px]">{connection.label}</strong><p className="mt-1 text-[9px] leading-4 text-muted">{connection.from} → {connection.to}{connection.cableSizeMm2 ? ` · ${connection.cableSizeMm2} mm² earth conductor` : ""}{connection.lengthM ? ` · ${connection.lengthM} m route` : ""}</p></div>)}</div>
            {!acceptedConnections.some((connection) => connection.kind === "earth") ? <div className="mt-4 rounded-xl border border-[#e2a49a] bg-[#fff0ed] p-3 text-[10px] font-bold text-[#9b4033]">No accepted earth route is recorded. Return to the schematic and add the complete earthing and bonding route before installation.</div> : null}
          </div> : null}
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <div><div className="eyebrow">Accepted equipment and connections</div><div className="mt-3 space-y-2">{[...selectedModuleComponents.map((node) => ({ key: `node-${node.id}`, name: node.label, detail: node.detail })), ...selectedModuleConnections.map((connection, index) => ({ key: `connection-${index}`, name: connection.label, detail: [connection.cableSizeMm2 ? `${connection.cableSizeMm2} mm² cable` : "Cable specification accepted", connection.lengthM ? `${connection.lengthM} m route` : ""].filter(Boolean).join(" · ") }))].map((item) => <div key={item.key} className="rounded-xl border border-line bg-[#f7fafc] p-3"><strong className="text-[11px]">{item.name}</strong><p className="mt-1 text-[9px] leading-4 text-muted">{item.detail}</p></div>)}</div></div>
            <div><div className="eyebrow">Materials in the shopping list</div><div className="mt-3 space-y-2">{selectedModuleMaterials.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-[#f7fafc] p-3"><div><strong className="text-[11px]">{item.name}</strong><p className="mt-1 text-[9px] leading-4 text-muted">{item.specification}</p></div><span className="shrink-0 text-[10px] font-extrabold text-brand">{item.quantity}</span></div>)}</div></div>
          </div>
        </div>
        <div>
          <div className="eyebrow">How-to subjects for this module</div><h2 className="mt-2 text-lg font-extrabold">Open only the guidance you need</h2><p className="mt-1 text-xs text-muted">Subjects stay minimised until you choose one.</p>
          <div className="mt-4 space-y-2">{selectedModuleGuides.map((guide) => <details key={guide.id} className="card overflow-hidden"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-[#f4f7fa]"><Image src={guide.image} alt="" fill sizes="48px" className="object-contain p-1"/></span><span className="min-w-0 flex-1"><strong className="block text-xs">{guide.title}</strong><span className="mt-1 block text-[10px] leading-4 text-muted">{guide.summary}</span></span><ChevronDown size={16} className="shrink-0 text-brand"/></summary><div className="space-y-4 border-t border-line bg-[#f7fafc] p-4"><HowToTypes guide={guide}/><div className="grid gap-3 md:grid-cols-2"><HowToList title="What you may need" items={guide.buy}/><HowToList title="Tools" items={guide.tools}/></div><HowToList title="Before you start" items={guide.before}/><div><h3 className="text-[11px] font-extrabold">Installation guidance</h3><ol className="mt-3 space-y-2">{guide.steps.map((step, index) => <li key={step} className="flex gap-3 rounded-xl bg-white p-3 text-[10px] leading-5"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[9px] font-bold text-white">{index + 1}</span>{step}</li>)}</ol></div><HowToList title="Checks" items={guide.checks}/><button type="button" onClick={() => setModuleChatGuide(guide)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand bg-white px-4 text-[11px] font-bold text-brand"><Bot size={14}/>Ask Wattson about this subject</button></div></details>)}</div>
        </div>
        <div className="flex gap-3 rounded-xl border border-[#e6cc74] bg-[#fff9df] p-4 text-[10px] leading-5 text-[#624b14]"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><p><strong>{authority.label}:</strong> {authority.note} <a href={authority.url} target="_blank" rel="noreferrer" className="font-bold underline">Open authority guidance</a></p></div>
      </section> : null}
      {moduleChatGuide ? <GuideWattsonChat guide={moduleChatGuide} onAsk={onAskGuide} onClose={() => setModuleChatGuide(null)}/> : null}
      {purchaseItem ? createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#17324d]/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !purchaseSaving) setPurchaseItem(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="purchase-dialog-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-[#a8c9b4] bg-white shadow-[0_24px_70px_rgba(9,35,58,.35)]">
            <header className="flex items-start justify-between gap-3 border-b border-[#b9ddc5] bg-[#f1faf4] p-5">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#dff3e8] text-[#17603b]"><WalletCards size={19}/></span><div><div className="eyebrow text-[#17603b]">Item acquired</div><h2 id="purchase-dialog-title" className="mt-1 text-lg font-extrabold">Add this purchase to Financials?</h2></div></div>
              <button type="button" disabled={purchaseSaving} onClick={() => setPurchaseItem(null)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted disabled:opacity-50" aria-label="No thanks, close"><X size={17}/></button>
            </header>
            <form onSubmit={addPurchase} className="p-5">
              <div className="rounded-xl bg-[#eef5fc] p-3"><strong className="block text-xs">{purchaseItem.name} · {purchaseItem.quantity}</strong><p className="mt-1 text-[10px] leading-4 text-muted">{purchaseItem.specification}</p></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-bold text-muted">Purchase date<input required type="date" className="field" value={purchaseDraft.date} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, date: event.target.value })}/></label>
                <label className="text-[10px] font-bold text-muted">Total amount paid<input required autoFocus type="number" min="0.01" step="0.01" inputMode="decimal" className="field" placeholder="0.00" value={purchaseDraft.amount} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, amount: event.target.value })}/></label>
                <label className="text-[10px] font-bold text-muted sm:col-span-2">Supplier (optional)<input className="field" placeholder="Shop or supplier" value={purchaseDraft.vendor} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, vendor: event.target.value })}/></label>
                <label className="text-[10px] font-bold text-muted sm:col-span-2">Notes (optional)<input className="field" placeholder="Receipt number, delivery, discount…" value={purchaseDraft.notes} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, notes: event.target.value })}/></label>
              </div>
              {purchaseError ? <p className="mt-3 rounded-lg bg-[#fff0eb] p-3 text-[10px] text-[#913e31]">{purchaseError}</p> : null}
              <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" disabled={purchaseSaving} onClick={() => setPurchaseItem(null)} className="h-11 rounded-xl border border-brand bg-white text-xs font-bold text-brand disabled:opacity-50">No thanks</button><button disabled={purchaseSaving} className="h-11 rounded-xl bg-[#238653] text-xs font-bold text-white disabled:opacity-50">{purchaseSaving ? "Adding…" : "Add to Financials"}</button></div>
              <p className="mt-3 text-center text-[9px] leading-4 text-muted">You can turn off these prompts in Settings → Preferences.</p>
            </form>
          </section>
        </div>, document.body,
      ) : null}
    </div>
  );
}
function Commission({
  project,
  complete,
}: {
  project: Project;
  complete: () => Promise<void>;
}) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [completedModules, setCompletedModules] = useState<Record<string, boolean>>({});
  type HandoverRecord = { observations: string; readings: string; documents: string; issues: string; complete: boolean };
  const handoverStorageKey = `pvintell:handover-modules:${project.id}`;
  const emptyHandoverRecord: HandoverRecord = { observations: "", readings: "", documents: "", issues: "", complete: false };
  const [handoverRecords, setHandoverRecords] = useState<Record<string, HandoverRecord>>({});
  const [selectedHandoverId, setSelectedHandoverId] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setCompletedModules(JSON.parse(window.localStorage.getItem(`pvintell:build-modules:${project.id}`) ?? "{}") as Record<string, boolean>);
        setHandoverRecords(JSON.parse(window.localStorage.getItem(handoverStorageKey) ?? "{}") as Record<string, HandoverRecord>);
      }
      catch { setCompletedModules({}); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [handoverStorageKey, project.id]);
  const completedModuleLabels: Record<string, string> = { "pv-array": "Panels and mounting", "pv-dc": "PV strings, DC cable and isolation", battery: "Battery storage and battery DC", inverter: "Inverter and power conversion", ac: "AC supply, switchboard and protection", generator: "Generator and source changeover", earthing: "Earthing and equipment bonding" };
  const handoverModules = Object.entries(completedModules).filter(([, complete]) => complete).map(([id]) => ({ id, title: completedModuleLabels[id] ?? id }));
  const buildComplete = handoverModules.length > 0;
  const handoverComplete = handoverModules.length > 0 && handoverModules.every((module) => handoverRecords[module.id]?.complete);
  const installed = ["monitor", "diagnose", "maintain", "explain"].includes(project.phase);
  const selectedHandover = handoverModules.find((module) => module.id === selectedHandoverId) ?? handoverModules[0];
  const selectedRecord = selectedHandover ? handoverRecords[selectedHandover.id] ?? emptyHandoverRecord : emptyHandoverRecord;
  function updateHandover(moduleId: string, patch: Partial<HandoverRecord>) {
    setHandoverRecords((current) => {
      const next = { ...current, [moduleId]: { ...(current[moduleId] ?? emptyHandoverRecord), ...patch } };
      try { window.localStorage.setItem(handoverStorageKey, JSON.stringify(next)); } catch { /* Keep the record usable in this session. */ }
      return next;
    });
  }
  async function finish() {
    setCompleting(true);
    setError("");
    try { await complete(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Could not finish startup and handover."); }
    finally { setCompleting(false); }
  }
  return (
    <div className="animate-rise space-y-6">
      <Heading
        eyebrow="Startup & handover"
        title="Record startup and handover"
        description="Keep initial readings, settings, supplied documents and observed behaviour as a baseline for future support."
      />
      <div role="alert" className="flex gap-3 rounded-2xl border-2 border-[#d94a3a] bg-[#fff0ed] p-5 text-[#8f2f24] shadow-sm"><AlertTriangle size={22} className="mt-0.5 shrink-0"/><div><strong className="block text-sm">This is not an inspection or certification service</strong><p className="mt-2 text-[11px] font-semibold leading-5">PVIntell is a DIY planning, startup and record-keeping tool. Completing this page does not certify, approve or grant permission to energise the system. You are responsible for checking the requirements that apply at this Site and arranging any local-authority, electrical, network or independent inspection or certification if it is required—or if you decide you want it.</p></div></div>
      <section className="card overflow-hidden"><div className="border-b border-line bg-[#eef5fc] p-5"><div className="eyebrow">From Build It</div><h2 className="mt-2 text-base font-extrabold">Completed modules ready for startup records</h2><p className="mt-1 text-[10px] leading-5 text-muted">A module appears here only after you mark it Completed in Build It. That means the physical section is ready to record—not inspected or approved.</p></div>{handoverModules.length ? <div className="grid gap-3 p-4 md:grid-cols-2">{handoverModules.map((module) => <article key={module.id} className="rounded-xl border border-[#72b98b] bg-[#f1faf4] p-4"><div className="flex items-center gap-2 text-[#17603b]"><Check size={15}/><strong className="text-xs">{module.title}</strong></div><p className="mt-2 text-[10px] leading-4 text-muted">Ready to record first-start behaviour, relevant settings, readings, photos, supplied documents and anything needing attention.</p></article>)}</div> : <p className="p-5 text-xs text-muted">No Build It modules have been marked completed yet.</p>}</section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card overflow-hidden"><header className="border-b border-line p-5"><div className="eyebrow">Handover records</div><h2 className="mt-2 text-base font-extrabold">Record what happened at first startup</h2><p className="mt-1 text-[10px] leading-5 text-muted">Choose a completed module and keep useful facts, supplied paperwork and anything still needing attention. This is a record—not a pass/fail inspection.</p></header>{handoverModules.length ? <div className="grid min-h-[420px] md:grid-cols-[230px_minmax(0,1fr)]"><div className="border-b border-line p-3 md:border-b-0 md:border-r">{handoverModules.map((module) => { const done = handoverRecords[module.id]?.complete; return <button type="button" key={module.id} onClick={() => setSelectedHandoverId(module.id)} className={`mb-2 flex w-full items-center gap-2 rounded-xl border p-3 text-left text-[10px] font-bold ${selectedHandover?.id === module.id ? "border-brand bg-[#eef5fc]" : done ? "border-[#8fc8a2] bg-[#f1faf4] text-[#17603b]" : "border-line bg-white"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-full ${done ? "bg-[#dff3e8]" : "bg-[#eaf2fb]"}`}>{done ? <Check size={13}/> : <ClipboardCheck size={13}/>}</span>{module.title}</button>; })}</div>{selectedHandover ? <div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">Module record</div><h3 className="mt-2 text-base font-extrabold">{selectedHandover.title}</h3></div><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#8fc8a2] bg-[#f1faf4] px-3 py-2 text-[10px] font-bold text-[#17603b]"><input type="checkbox" checked={selectedRecord.complete} onChange={(event) => updateHandover(selectedHandover.id, { complete: event.target.checked })} className="size-4 accent-[#238653]"/>Record finished</label></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-bold text-muted">Startup observations<textarea className="field min-h-28 resize-y" value={selectedRecord.observations} onChange={(event) => updateHandover(selectedHandover.id, { observations: event.target.value })} placeholder="What started, what happened and what was observed…"/></label><label className="text-[10px] font-bold text-muted">Settings and readings<textarea className="field min-h-28 resize-y" value={selectedRecord.readings} onChange={(event) => updateHandover(selectedHandover.id, { readings: event.target.value })} placeholder="Values with units, settings and where they came from…"/></label><label className="text-[10px] font-bold text-muted">Documents and photo references<textarea className="field min-h-28 resize-y" value={selectedRecord.documents} onChange={(event) => updateHandover(selectedHandover.id, { documents: event.target.value })} placeholder="Manuals, serials, receipts, certificates supplied by others, photo names…"/></label><label className="text-[10px] font-bold text-muted">Open issues or follow-up<textarea className="field min-h-28 resize-y" value={selectedRecord.issues} onChange={(event) => updateHandover(selectedHandover.id, { issues: event.target.value })} placeholder="Anything unresolved, unusual or deliberately left off…"/></label></div><p className="mt-3 text-[9px] leading-4 text-muted">Changes save automatically in this browser. Uncheck “Record finished” whenever this section needs updating.</p></div> : null}</div> : <p className="p-6 text-xs text-muted">Finish at least one Build It module before creating its startup record.</p>}</section>
        <div className="card p-5">
          <div className="eyebrow">Lifecycle</div>
          <h3 className="mt-2 text-base font-extrabold">{installed ? "Installed system record" : "Ready to finish handover?"}</h3>
          <div className="mt-4 space-y-2 text-xs"><div className="flex items-center justify-between gap-3"><span>Build modules supplied</span><strong>{buildComplete ? "Yes" : "Not yet"}</strong></div><div className="flex items-center justify-between gap-3"><span>Handover records finished</span><strong>{handoverComplete ? "Yes" : "Not yet"}</strong></div></div>
          <p className="mt-4 text-[11px] leading-5 text-muted">Finishing handover changes the project to an installed system record. It records your workflow only; it does not certify the installation or authorise energisation.</p>
          {error ? <p className="mt-3 rounded-lg bg-[#fff0eb] p-3 text-[11px] text-[#913e31]">{error}</p> : null}
          <button
            onClick={() => void finish()}
            disabled={installed || !buildComplete || !handoverComplete || completing}
            className="mt-4 w-full rounded-xl bg-brand py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {installed ? "Handover recorded" : completing ? "Updating…" : "Finish startup & handover"}
          </button>
        </div>
      </div>
    </div>
  );
}
export function LegacyMonitor({ project, site }: { project: Project; site: Site }) {
  return (
    <div className="animate-rise space-y-5">
      <Heading eyebrow="System monitoring" title={project.name} description={`Dedicated monitoring for ${project.name} at ${site.name}. Live production, load and battery values will appear here after a supported data connection is configured.`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="eyebrow">System</div><div className="mt-2 text-base font-extrabold">{project.name}</div><p className="mt-1 text-[10px] text-muted">{project.systemVoltage > 0 ? `${project.systemVoltage} V · ` : ""}{project.projectType}</p></div>
        <div className="card p-4"><div className="eyebrow">Site</div><div className="mt-2 text-base font-extrabold">{site.name}</div><p className="mt-1 text-[10px] text-muted">{site.location}</p></div>
        <div className="card p-4"><div className="eyebrow">Data connection</div><div className="mt-2 text-sm font-extrabold">Not configured</div><p className="mt-1 text-[10px] text-muted">No live readings are being presented.</p></div>
      </div>
      <section className="card p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><CircleGauge size={17}/></span><div><h2 className="text-sm font-extrabold">Awaiting a monitoring connection</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">When a compatible inverter or monitoring service is connected, this page will show only {project.name} data. Other systems remain accessible from their own Monitor tiles.</p></div></div></section>
    </div>
  );
}
function WattsonPhotoButton({
  disabled,
  send,
}: {
  disabled: boolean;
  send: (file: File) => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setTarget(document.querySelector("form.m-6.mt-0.flex.items-end")),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!target) return null;
  return createPortal(
    <label
      title="Add a photo for Wattson"
      aria-label="Add a photo for Wattson"
      className={`grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-[#f5f8fc] text-brand ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <Camera size={17} />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
          event.target.value = "";
        }}
      />
    </label>,
    target,
  );
}
