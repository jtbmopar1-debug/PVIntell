"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Bot,
  Camera,
  Calculator,
  Check,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  CloudSun,
  Compass,
  HelpCircle,
  Home,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Menu,
  Package,
  PlugZap,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Waypoints,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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
import {
  scenarioForStart,
  systemDiscoveryQuestionnaire,
  type QuestionnaireAnswer,
} from "@/questionnaires/templates";
import { SystemQuestionnaire } from "@/components/system-questionnaire";
import { SiteEquipmentInventory } from "@/components/site-equipment";
import { SolarWeather } from "@/components/solar-weather";
import { SiteOverview } from "@/components/site-overview";
import { SystemEquipmentOverview } from "@/components/system-equipment-overview";
import { DesignCalculator } from "@/components/design-calculator";

export type WorkspaceView =
  | "site"
  | "wattson"
  | "setup"
  | "equipment"
  | "weather"
  | "design"
  | "system"
  | "schematic"
  | "build"
  | "commission"
  | "monitor";
type View = WorkspaceView;
type QuestionnaireDrafts = Record<
  string,
  {
    version: number;
    status: string;
    answers: Record<string, QuestionnaireAnswer>;
  }
>;
const ai = new MockAIProvider();
const store = new BrowserProjectStore();
const starts = [
  ["Off-grid home", "Power a home without relying on the grid", Home],
  [
    "Battery backup",
    "Keep essentials running through outages",
    BatteryCharging,
  ],
  ["Cabin or tiny home", "Design a practical small power system", Sun],
  ["Boat or caravan", "Build for life on the move", Compass],
  ["Upgrade a system", "Make existing solar work harder", Wrench],
  [
    "Diagnose a problem",
    "Understand what your system is telling you",
    CircleGauge,
  ],
] as const;
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
const QuestionnairePanel = SystemQuestionnaire;

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
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
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
  initialSite = demoSite,
  sites = [demoSite],
  systems = [demoSystem],
  initialQuestionnaires = {},
  initialSiteEquipment = [],
  cloud = false,
  sitePage = false,
  systemPage = false,
  initialView,
  email = "",
  showGoogleWelcome = false,
}: {
  initialProject?: Project;
  initialMessages?: ChatMessage[];
  initialSite?: Site;
  sites?: Site[];
  systems?: SystemSummary[];
  initialQuestionnaires?: QuestionnaireDrafts;
  initialSiteEquipment?: SiteEquipment[];
  cloud?: boolean;
  sitePage?: boolean;
  systemPage?: boolean;
  initialView?: WorkspaceView;
  email?: string;
  showGoogleWelcome?: boolean;
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [view, setView] = useState<View>(
    initialView ?? (systemPage ? "system" : sitePage ? "site" : "wattson"),
  );
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<string>();
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<
    Record<string, QuestionnaireAnswer>
  >(initialQuestionnaires[systemDiscoveryQuestionnaire.key]?.answers ?? {});
  const [savingQuestionnaire, setSavingQuestionnaire] = useState(false);
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
  async function saveQuestionnaire(
    answers: Record<string, QuestionnaireAnswer>,
    status: "draft" | "completed" = "draft",
  ) {
    if (!cloud) return;
    setSavingQuestionnaire(true);
    try {
      const response = await fetch(
        `/api/questionnaires/${systemDiscoveryQuestionnaire.key}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            version: systemDiscoveryQuestionnaire.version,
            status,
            answers,
          }),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Could not save questionnaire");
      }
    } finally {
      setSavingQuestionnaire(false);
    }
  }
  function openQuestionnaire(title: string) {
    const scenario = scenarioForStart(title);
    const next = scenario
      ? { ...questionnaireAnswers, scenario }
      : questionnaireAnswers;
    setQuestionnaireAnswers(next);
    setView("setup");
    if (scenario) void saveQuestionnaire(next);
  }
  async function reviewQuestionnaire() {
    await saveQuestionnaire(questionnaireAnswers, "completed");
    setView("wattson");
    await send(
      "I've completed my system setup questionnaire. Please review it, identify any important gaps, and tell me the next best step.",
    );
  }
  async function send(text = input) {
    const message = text.trim();
    const start = message.match(/^I want to start with: (.*?)\./);
    if (start) {
      openQuestionnaire(start[1]);
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
          }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "Wattson is unavailable");
        reply = body.message;
        citations = body.citations;
        actionUrl = body.actionUrl;
        actionLabel = body.actionLabel;
        if (body.actionUrl) router.push(body.actionUrl);
        else if (body.actions?.length) router.refresh();
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

  async function startConversationAgain() {
    if (!cloud || sending) return;
    const response = await fetch("/api/wattson/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "system", projectId: project.id }),
    });
    const body = await response.json();
    if (!response.ok) {
      window.alert(body.error ?? "Could not start a new conversation");
      return;
    }
    setMessages([]);
    setInput("");
  }
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
      body.set("file", file);
      const response = await fetch("/api/wattson", { method: "POST", body });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Wattson could not inspect the image");
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
    { id: "weather" as View, label: "Solar weather", icon: CloudSun },
    { id: "design" as View, label: "Proposed design", icon: Calculator },
    { id: "system" as View, label: "As-built overview", icon: LayoutDashboard },
    { id: "schematic" as View, label: "As-built schematic", icon: Waypoints },
    { id: "build" as View, label: "Build", icon: Wrench },
    { id: "commission" as View, label: "Commission", icon: ClipboardCheck },
    { id: "monitor" as View, label: "Monitor", icon: CircleGauge },
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[226px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[226px] flex-col overflow-y-auto border-r border-[#dce4ec] bg-[#f8fafc] p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
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
          Start here
          <ChevronRight className="ml-auto" size={14} />
        </Link>}
        <button
          onClick={() => setView("wattson")}
          className={`${cloud ? "mt-2" : "mt-5"} flex items-center gap-3 rounded-xl bg-brand px-3 py-3 text-xs font-bold text-white`}
        >
          <Sparkles size={16} />
          Ask Wattson
          <ChevronRight className="ml-auto" size={14} />
        </button>
        {cloud && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-2">
            <div className="px-2 py-1">
              <div className="eyebrow text-[#7b8a9c]">My sites</div>
            </div>
            <div className="mt-2 space-y-1">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-bold ${site.id === initialSite.id ? "bg-[#fff6cf] text-brand" : "text-muted hover:bg-[#eef3f8]"}`}
                >
                  <MapPin size={12} />
                  <span className="truncate">{site.name}</span>
                </Link>
              ))}
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
              Dashboard
            </Link>
          )}
          {nav.map(({ id, label, icon: Icon }) =>
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
          {cloud && (
            <form action="/auth/signout" method="post">
              <button className="mt-3 text-[10px] font-bold text-brand">
                Sign out
              </button>
            </form>
          )}
        </div>
      </aside>
      {menu && (
        <button
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[68px] items-center border-b border-line bg-[rgba(245,247,250,.9)] px-5 backdrop-blur-xl md:px-8">
          <button className="mr-3 lg:hidden" onClick={() => setMenu(true)}>
            <Menu size={21} />
          </button>
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold">
              {project.name}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-muted">
              {initialSite.name} • {project.location} • {project.systemVoltage}{" "}
              V {project.projectType}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Badge tone="green">● Normal</Badge>
            <Link
              href="/account"
              aria-label="Account settings"
              className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted"
            >
              <Settings2 size={16} />
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-[1320px] p-5 md:p-8">
          {view === "site" && (
            <SiteOverview
              site={initialSite}
              systems={systems}
              activeSystemId={project.id}
              components={project.components}
              equipment={initialSiteEquipment}
              solarArrayKw={installedSolarKw}
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
              openQuestionnaire={openQuestionnaire}
              project={project}
              loads={loads}
              solar={solar}
              battery={battery}
              inverter={inverter}
              startAgain={startConversationAgain}
            />
          )}{" "}
          {view === "setup" && (
            <QuestionnairePanel
              answers={questionnaireAnswers}
              setAnswers={setQuestionnaireAnswers}
              save={saveQuestionnaire}
              review={reviewQuestionnaire}
              saving={savingQuestionnaire}
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
            <SolarWeather site={initialSite} solarArrayKw={installedSolarKw} />
          )}{" "}
          {view === "design" && <DesignCalculator project={project} site={initialSite} />}{" "}
          {view === "system" && (
            <SystemEquipmentOverview
              project={project}
              onAskWattson={() => setView("wattson")}
            />
          )}{" "}
          {view === "build" && <Build project={project} />}{" "}
          {view === "commission" && (
            <Commission project={project} persist={persist} />
          )}{" "}
          {view === "monitor" && (
            <Monitor project={project} findings={findings} />
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
  startAgain,
}: any) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="card overflow-hidden">
        <div className="border-b border-line bg-[linear-gradient(125deg,#fafcfe_10%,#fff7d6)] px-6 py-7 md:px-8">
          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white">
              <Bot size={23} />
            </span>
            <div>
              <div className="eyebrow">Wattson • your power guide</div>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">
                What do you want to do?
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Describe your life and what you want to power. I’ll handle the
                calculations, assumptions, and explanations.
              </p>
            </div>
            <button type="button" onClick={() => void startAgain()} disabled={sending} className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[10px] font-bold text-brand disabled:opacity-40"><RotateCcw size={13}/>Start again</button>
          </div>
        </div>
        <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-3">
          {starts.map(([title, desc, Icon]) => (
            <button
              key={title}
              onClick={() =>
                send(
                  `I want to start with: ${title}. I don't know much about solar yet.`,
                )
              }
              className="group rounded-2xl border border-line bg-white p-4 text-left hover:border-[#7ea8ce]"
            >
              <div className="flex justify-between">
                <span className="grid size-8 place-items-center rounded-xl bg-[#eaf2fb] text-brand">
                  <Icon size={16} />
                </span>
                <ArrowRight size={14} />
              </div>
              <div className="mt-3 text-xs font-bold">{title}</div>
              <div className="mt-1 text-[10px] leading-4 text-muted">
                {desc}
              </div>
            </button>
          ))}
        </div>
        <div className="wattson-conversation thin-scrollbar space-y-5 overflow-y-auto p-6">
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
                <div>{m.content}</div>
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
            placeholder="I’m building a small cabin and need a fridge, lights and water pump…"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-xs outline-none"
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
            <div className="eyebrow">Working design</div>
            <Badge>{project.assumptions.length} assumptions</Badge>
          </div>
          <div className="mt-5 space-y-4">
            <Rec
              icon={Sun}
              label="Solar"
              value={`${(solar.suggestedWatts / 1000).toFixed(1)} kW`}
              detail={`${solar.panelCount} × ${solar.panelWatts} W panels`}
            />
            <Rec
              icon={BatteryCharging}
              label="Battery"
              value={`${battery.usableKWh} kWh`}
              detail={`${battery.nominalKWh} kWh nominal`}
            />
            <Rec
              icon={PlugZap}
              label="Inverter"
              value={`${(inverter.recommendedWatts / 1000).toFixed(1)} kW`}
              detail="Includes surge headroom"
            />
          </div>
          <button
            onClick={() => send("Why do I need this inverter size?")}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8f0f8] py-2.5 text-xs font-bold"
          >
            <HelpCircle size={14} />
            Explain this design
          </button>
        </div>
        <div className="card p-5">
          <div className="eyebrow">What Wattson knows</div>
          <div className="mt-4 space-y-3">
            <Fact label="Daily energy" value={`${loads.dailyKWh} kWh`} />
            <Fact label="Tracked loads" value={`${project.loads.length}`} />
            <Fact label="Reserve" value={`${project.autonomyDays} days`} />
          </div>
          <p className="mt-4 rounded-xl bg-[#fff5d9] p-3 text-[10px] text-[#765c1c]">
            <Lightbulb className="mr-1 inline" size={12} /> Estimates stay
            visible until confirmed.
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
                System overview
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

function Safety() {
  return (
    <div className="flex gap-3 rounded-2xl border border-[#ecd9aa] bg-[#fff8e7] p-4 text-[#6f5518]">
      <AlertTriangle size={18} />
      <div>
        <div className="text-xs font-bold">Important safety note</div>
        <p className="mt-1 text-[10px] leading-4">
          High-current DC and mains work can cause fire, serious injury, or
          death. Follow the exact equipment instructions, work within your
          knowledge and equipment limits, and get competent help when needed.
        </p>
      </div>
    </div>
  );
}

function buildStepDescription(title: string, fallback: string) {
  const name = title.toLowerCase();
  if (name.includes("planning")) return "Confirm locations, cable routes, access, manuals and any site-specific approvals you choose to track.";
  if (name.includes("battery")) return "Mount the batteries as specified and verify isolation, protection and conductors before connection.";
  if (name.includes("dc protection")) return "Plan and verify fusing, isolation and over-current protection for every DC conductor section.";
  if (name.includes("inverter")) return "Mount the inverter with the required clearances and keep DC, AC and communication routes organised.";
  if (name.includes("pv installation")) return "Install the array, earthing, cabling, labels and isolation shown in the recorded design.";
  if (name.includes("ac wiring")) return "Complete and verify the planned AC connections, protection, changeover and isolation.";
  if (name.includes("communication")) return "Connect and verify inverter, BMS, meter and monitoring communications.";
  if (name.includes("configuration")) return "Apply equipment-approved limits and record the system's operating priorities.";
  if (name.includes("pre-power")) return "Verify polarity, torque, insulation, protective devices and the as-built record before energising.";
  if (name.includes("commission")) return "Follow the equipment startup sequence and record the initial measurements and behaviour.";
  return fallback;
}

function buildStepTitle(title: string) {
  return title.toLowerCase().includes("planning")
    ? "Planning & site preparation"
    : title;
}

function Build({ project }: { project: Project }) {
  const done = project.installationSteps.filter((s) => s.complete).length;
  return (
    <div className="animate-rise space-y-6">
      <Heading
        eyebrow="Build mode"
        title="One safe step at a time"
        description="Wattson keeps the sequence, expected results and relevant checks visible."
      />
      <div className="card p-6">
        <div className="flex justify-between text-xs">
          <strong>Installation progress</strong>
          <strong>
            {done}/{project.installationSteps.length}
          </strong>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#e4eaf0]">
          <div
            className="h-full rounded-full bg-brand"
            style={{
              width: `${(done / project.installationSteps.length) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {project.installationSteps.map((s, i) => (
          <Link key={s.id} href={`/sites/${project.siteId}/systems/${project.id}/build/${s.id}`} className="card flex gap-4 p-5 transition hover:-translate-y-0.5 hover:border-[#7da8ce] hover:shadow-md">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full border ${s.complete ? "bg-brand text-white" : "bg-white"}`}>
              {s.complete ? <Check size={15} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <h3 className="text-sm font-bold">{buildStepTitle(s.title)}</h3>
                <Badge
                  tone={s.safetyLevel === "licensed" ? "amber" : "neutral"}
                >
                  {s.safetyLevel === "licensed" ? "check / connect" : s.safetyLevel === "high-current-dc" ? "controlled DC" : s.safetyLevel === "low-voltage" ? "equipment setup" : "DIY planning"}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                {buildStepDescription(s.title, s.description)}
              </p>
            </div>
            <ChevronRight className="mt-2 shrink-0 text-brand" size={16}/>
          </Link>
        ))}
      </div>
      <Safety />
    </div>
  );
}
function Commission({
  project,
  persist,
}: {
  project: Project;
  persist: (p: Project) => void;
}) {
  function add() {
    if (project.commissioning.some((x) => x.id === "output")) return;
    persist({
      ...project,
      commissioning: [
        ...project.commissioning,
        {
          id: "output",
          label: "Inverter output",
          value: "230.4 V / 50.0 Hz",
          expected: "230 V / 50 Hz",
          recordedAt: new Date().toISOString(),
          result: "pass",
        },
      ],
    });
  }
  return (
    <div className="animate-rise space-y-6">
      <Heading
        eyebrow="Commissioning"
        title="Verify before you energise"
        description="Measurements become a permanent baseline for this system."
      />
      <Safety />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden">
          {project.commissioning.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 border-b border-line px-6 py-4"
            >
              <span className="grid size-8 place-items-center rounded-full bg-[#e7f0fb] text-brand">
                <Check size={15} />
              </span>
              <div className="flex-1">
                <div className="text-xs font-bold">{r.label}</div>
                <div className="text-[10px] text-muted">
                  Expected: {r.expected}
                </div>
              </div>
              <strong className="text-xs">{r.value}</strong>
            </div>
          ))}
        </div>
        <div className="card p-6">
          <Bot className="text-brand" />
          <div className="eyebrow mt-5">Next with Wattson</div>
          <h3 className="mt-2 font-display text-xl font-extrabold">
            Check inverter output
          </h3>
          <p className="mt-3 text-xs leading-5 text-muted">
            Verify AC output and protection with suitable test equipment and
            enough experience to interpret the results. An independent check
            is sensible if anything is uncertain.
          </p>
          <button
            onClick={add}
            className="mt-5 w-full rounded-xl bg-brand py-3 text-xs font-bold text-white"
          >
            Record demo reading
          </button>
        </div>
      </div>
    </div>
  );
}
function Monitor({ project, findings }: { project: Project; findings: any[] }) {
  return (
    <div className="animate-rise space-y-6">
      <Heading
        eyebrow="Live system"
        title="Good afternoon — your system is healthy"
        description={`Mock normalized telemetry for ${project.name}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Battery"
          value={`${demoTelemetry["battery.soc"]}%`}
          detail={`${demoTelemetry["battery.voltage"]} V • charging`}
          icon={BatteryCharging}
        />
        <Metric
          label="Solar now"
          value="3.82 kW"
          detail={`${demoTelemetry["pv.energyToday"]} kWh today`}
          icon={Sun}
        />
        <Metric
          label="Home load"
          value="1.24 kW"
          detail={`${demoTelemetry["load.energyToday"]} kWh today`}
          icon={Home}
        />
        <Metric
          label="To battery"
          value="2.49 kW"
          detail="Surplus solar charging"
          icon={Zap}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="card p-6">
          <div className="eyebrow">Energy today</div>
          <Chart />
        </div>
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex justify-between">
              <div className="eyebrow">Weather outlook</div>
              <CloudSun className="text-[#d89628]" />
            </div>
            <div className="mt-4 font-display text-3xl font-extrabold">
              18°{" "}
              <span className="text-xs font-normal text-muted">
                Bright intervals
              </span>
            </div>
          </div>
          <div className="card p-5">
            <div className="eyebrow">Wattson’s check</div>
            {findings.map((f) => (
              <div key={f.id} className="mt-4 flex gap-3">
                <ShieldCheck className="text-brand" />
                <div>
                  <div className="text-xs font-bold">{f.title}</div>
                  <p className="mt-1 text-[10px] text-muted">{f.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function Chart() {
  const a = [0, 0, 0.2, 0.8, 2, 3.5, 4.8, 4.2, 3.3, 2, 0.5, 0],
    b = [0.4, 0.3, 0.5, 0.8, 0.6, 1, 0.9, 1.3, 0.8, 0.7, 1, 0.5],
    p = (d: number[]) =>
      d
        .map((v, i) => `${(i / (d.length - 1)) * 100},${90 - (v / 5) * 75}`)
        .join(" ");
  return (
    <div className="mt-6 h-60">
      <svg
        viewBox="0 0 100 96"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <polyline
          points={p(a)}
          fill="none"
          stroke="#d8a000"
          strokeWidth="1.5"
        />
        <polyline
          points={p(b)}
          fill="none"
          stroke="#2f5272"
          strokeWidth="1.2"
        />
      </svg>
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
