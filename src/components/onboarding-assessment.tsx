"use client";

import { ArrowLeft, ArrowRight, Bot, Check, LoaderCircle, LocateFixed, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OnboardingAnswers } from "@/onboarding/assessment";
import { BrandLogo } from "@/components/brand-logo";

type MultiKey = "history" | "currentSituation" | "goals";
type RegionMatch = { name: string; label: string; latitude: number; longitude: number; timezone: string };

function worldwideTimezones(current?: string) {
  let zones: string[] = [];
  try { zones = Intl.supportedValuesOf("timeZone"); } catch { zones = ["UTC", "Pacific/Auckland", "Australia/Sydney", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"]; }
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

const historyChoices = [
  "No previous solar work",
  "Helped with an installation",
  "Designed or installed my own system",
  "Maintain or troubleshoot systems",
  "Work in the electrical or solar industry",
];
const situationChoices = [
  "Planning my first system",
  "Already own equipment",
  "Have an existing working system",
  "Inherited or bought a second-hand system",
  "Upgrading or expanding a system",
  "Diagnosing a problem",
];
const goalChoices = [
  "Understand what I already have",
  "Design a new system",
  "Record an as-built system",
  "Install or commission safely",
  "Monitor performance",
  "Improve reliability or running cost",
];

export function OnboardingAssessment({ initialAnswers, editing = false }: { initialAnswers: OnboardingAnswers; editing?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [regionMatches, setRegionMatches] = useState<RegionMatch[]>([]);
  const [searchingRegion, setSearchingRegion] = useState(false);
  const [locatingRegion, setLocatingRegion] = useState(false);
  const [regionLater, setRegionLater] = useState(false);
  const [timezoneLater, setTimezoneLater] = useState(false);
  const timezones = useMemo(() => worldwideTimezones(answers.timezone), [answers.timezone]);

  useEffect(() => {
    if (editing) return;
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
    window.localStorage.setItem("pvintell:theme:v1", "light");
    void fetch("/api/account/theme", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: "light" }) });
  }, [editing]);

  useEffect(() => {
    if (answers.timezone || timezoneLater) return;
    const detection = window.setTimeout(() => setAnswers((current) => ({
      ...current,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })), 0);
    return () => window.clearTimeout(detection);
  }, [answers.timezone, timezoneLater]);

  const ready = useMemo(() => {
    if (step === 0) return Boolean(answers.displayName?.trim() && (answers.location?.trim() || regionLater) && (answers.timezone || timezoneLater));
    if (step === 1) return Boolean(answers.experience);
    if (step === 2) return Boolean(answers.electricalConfidence);
    if (step === 3) return Boolean(answers.history?.length);
    if (step === 4) return Boolean(answers.currentSituation?.length);
    return Boolean(answers.goals?.length);
  }, [answers, regionLater, step, timezoneLater]);

  function toggle(key: MultiKey, value: string) {
    setAnswers((current) => {
      const values = current[key] ?? [];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  }

  async function searchRegion() {
    const query = answers.location?.trim() ?? "";
    if (query.length < 2) return;
    setSearchingRegion(true); setError("");
    try {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`);
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not search regions.");
      setRegionMatches(body.results ?? []);
      if (!(body.results ?? []).length) setError("No matching region was found. Try a nearby town or a region and country.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not search regions."); } finally { setSearchingRegion(false); }
  }
  function chooseRegion(match: RegionMatch) { setAnswers((current) => ({ ...current, location: match.label, timezone: match.timezone })); setRegionLater(false); setTimezoneLater(false); setRegionMatches([]); setError(""); }
  function useMyRegion() {
    if (!navigator.geolocation) { setError("Location access is not available on this device."); return; }
    setLocatingRegion(true); setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`/api/location/reverse?latitude=${coords.latitude}&longitude=${coords.longitude}`);
        const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not identify this region.");
        setAnswers((current) => ({ ...current, location: body.label, timezone: body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone })); setRegionLater(false); setTimezoneLater(false); setRegionMatches([]);
      } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not identify this region."); } finally { setLocatingRegion(false); }
    }, () => { setError("PVIntell could not access this device’s location. You can search for your region instead."); setLocatingRegion(false); }, { enableHighAccuracy: false, timeout: 12_000 });
  }

  async function save(completed = false) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, completed, editing }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save your assessment");
      if (completed) {
        router.push(editing ? "/settings" : "/dashboard?welcome=1");
        router.refresh();
      }
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save your assessment");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (step === 5) await save(true);
    else {
      if (await save(false)) setStep((current) => current + 1);
    }
  }

  const panels = [
    <div key="location" className="space-y-4">
      <label className="text-xs font-bold">What should Wattson call you?<input className="field" value={answers.displayName ?? ""} onChange={(event) => setAnswers({ ...answers, displayName: event.target.value })} placeholder="Your name" autoFocus /></label>
      <div><label className="text-xs font-bold">What region are you based in?<div className="mt-1 flex gap-2"><input disabled={regionLater} className="field mt-0 disabled:bg-[#eef2f6]" value={answers.location ?? ""} onChange={(event) => { setAnswers({ ...answers, location: event.target.value }); setRegionMatches([]); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchRegion(); } }} placeholder="For example, Waikato, New Zealand"/><button type="button" onClick={() => void searchRegion()} disabled={regionLater || searchingRegion || (answers.location?.trim().length ?? 0) < 2} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Search regions">{searchingRegion ? <LoaderCircle className="animate-spin" size={17}/> : <Search size={17}/>}</button></div></label><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={useMyRegion} disabled={regionLater || locatingRegion} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold disabled:opacity-40"><LocateFixed size={14}/>{locatingRegion ? "Finding your region…" : "Use my location"}</button><button type="button" onClick={() => { setRegionLater((current) => !current); setAnswers((current) => ({ ...current, location: "" })); setRegionMatches([]); }} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${regionLater ? "border-brand bg-[#edf5fd] text-brand" : "border-line bg-white"}`}>{regionLater ? "Add region now" : "I’ll add it later"}</button></div>{regionMatches.length ? <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white">{regionMatches.map((match) => <button key={`${match.latitude}:${match.longitude}`} type="button" onClick={() => chooseRegion(match)} className="block w-full border-b border-line px-4 py-3 text-left text-xs last:border-0 hover:bg-[#edf5fd]"><strong>{match.name}</strong><span className="mt-1 block text-[10px] text-muted">{match.label} · {match.timezone}</span></button>)}</div> : null}<span className="mt-2 block text-[10px] font-normal leading-4 text-muted">A broad region is enough—no street address is required. “Use my location” resolves the region without saving the device coordinates. Exact Site pins remain private to your signed-in account.</span></div>
      <div><label className="text-xs font-bold">Your timezone<select disabled={timezoneLater} className="field disabled:bg-[#eef2f6]" value={answers.timezone ?? ""} onChange={(event) => { setAnswers({ ...answers, timezone: event.target.value }); setTimezoneLater(false); }}><option value="">Select a timezone</option>{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll("_", " ")}</option>)}</select></label><button type="button" onClick={() => { setTimezoneLater((current) => !current); setAnswers((current) => ({ ...current, timezone: "" })); }} className={`mt-2 rounded-xl border px-3 py-2 text-[11px] font-bold ${timezoneLater ? "border-brand bg-[#edf5fd] text-brand" : "border-line bg-white"}`}>{timezoneLater ? "Choose timezone now" : "I’ll add it later"}</button></div>
    </div>,
    <ChoiceGrid key="experience" selected={answers.experience} onSelect={(value) => setAnswers({ ...answers, experience: value as OnboardingAnswers["experience"] })} choices={[
      ["new", "I’m completely new", "I have no solar understanding or knowledge yet. Start at the beginning and explain every term in plain language."],
      ["some", "I know the basics", "I understand the main parts but still want guidance."],
      ["experienced", "I’m experienced", "I have designed, installed or maintained systems."],
      ["professional", "I’m a professional", "Use technical detail, while still confirming jurisdiction and role."],
    ]} />,
    <ChoiceGrid key="confidence" selected={answers.electricalConfidence} onSelect={(value) => setAnswers({ ...answers, electricalConfidence: value as OnboardingAnswers["electricalConfidence"] })} choices={[
      ["learn", "Novice, willing to learn", "I know little about solar, electrical work or installation, but I want clear explanations and can learn step by step."],
      ["basic", "Practical DIY builder", "I’m comfortable with drills, screws, bolts, brackets and ordinary hand tools. I can mount equipment, route cables and follow instructions, but electrical design and testing are new to me."],
      ["confident", "Proficient electrical DIYer", "I’m comfortable with mechanical installation, diagrams, meters, cable preparation, volts and amps, protection and equipment settings—but I’m not necessarily licensed."],
      ["qualified", "Qualified electrical or solar professional", "I hold qualifications or licensing relevant to electrical, solar or power-system work in the project’s location."],
    ]} />,
    <MultiChoices key="history" values={answers.history ?? []} choices={historyChoices} onToggle={(value) => toggle("history", value)} />,
    <MultiChoices key="situation" values={answers.currentSituation ?? []} choices={situationChoices} onToggle={(value) => toggle("currentSituation", value)} />,
    <div key="goals"><MultiChoices values={answers.goals ?? []} choices={goalChoices} onToggle={(value) => toggle("goals", value)} /></div>,
  ];
  const prompts = [
    ["First, where are we working?", "Location sets your timezone and helps Wattson use the correct regional context."],
    ["How familiar are you with solar power?", "There is no test here. I’ll adjust the language and depth to suit you."],
    ["What best matches your practical experience?", "Think about building, mounting, tools and electrical knowledge. This sets Wattson’s teaching level and the detail used in each guide."],
    ["What have you worked with before?", "Choose everything that applies. Experience can be practical, informal or professional."],
    ["Where are you starting from?", "Choose what already exists today. This tells PVIntell whether you are starting fresh, recording equipment, changing a system or investigating a problem."],
    ["What should PVIntell help you do?", "Choose the outcomes you want. These can overlap with your starting point—for example, an existing system can be recorded, monitored or expanded."],
  ];

  return <main className="min-h-screen lg:grid lg:grid-cols-[300px_1fr]">
    <aside className="hidden border-r border-line bg-[#0f3b66] p-8 text-white lg:flex lg:flex-col">
      <BrandLogo inverse />
      <div className="mt-16"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#f6c945]">Your starting profile</div><h2 className="mt-4 font-display text-3xl font-extrabold leading-tight">Wattson should understand you before advising you.</h2><p className="mt-4 text-sm leading-6 text-[#d5e2ee]">Your answers set the language, safety boundaries and starting workflow. You can update them later.</p></div>
      <div className="mt-auto flex gap-3 rounded-2xl border border-white/15 bg-white/5 p-4"><ShieldCheck className="shrink-0 text-[#f6c945]" size={20}/><p className="text-[11px] leading-5 text-[#d5e2ee]">PVIntell adapts its explanations to your experience, highlights specific risks and helps you plan verification where it matters.</p></div>
    </aside>
    <section className="grid min-h-screen place-items-center p-5 md:p-10">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold text-brand"><Bot size={18}/> Wattson assessment</div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">{step + 1} of 6</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#dfe8f0]"><div className="h-full rounded-full bg-[#f6c945] transition-all" style={{ width: `${((step + 1) / 6) * 100}%` }}/></div>
        <div className="card mt-5 p-6 md:p-8">
          <div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eaf2fb] text-brand"><Sparkles size={19}/></span><div><div className="eyebrow">Wattson asks</div><h1 className="mt-3 font-display text-2xl font-extrabold md:text-3xl">{prompts[step][0]}</h1><p className="mt-2 text-sm leading-6 text-muted">{prompts[step][1]}</p></div></div>
          <div className="mt-7">{panels[step]}</div>
          {error && <div className="mt-5 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">{error}</div>}
          <div className="mt-7 flex items-center justify-between"><button type="button" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)} className="flex items-center gap-2 px-2 py-2 text-xs font-bold text-muted disabled:invisible"><ArrowLeft size={15}/> Back</button><button type="button" disabled={!ready || saving} onClick={() => void next()} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:opacity-40">{saving ? "Saving…" : step === 5 ? (editing ? "Save changes" : "Build my dashboard") : "Continue"}{step === 5 ? <Check size={15}/> : <ArrowRight size={15}/>}</button></div>
        </div>
      </div>
    </section>
  </main>;
}

function ChoiceGrid({ choices, selected, onSelect }: { choices: string[][]; selected?: string; onSelect: (value: string) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{choices.map(([value, title, detail]) => <button type="button" key={value} onClick={() => onSelect(value)} className={`rounded-2xl border p-4 text-left transition ${selected === value ? "border-brand bg-[#edf5fc] ring-2 ring-[#165d9c]/10" : "border-line bg-white hover:border-[#8ab0d2]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm">{title}</strong>{selected === value && <Check className="text-brand" size={16}/>}</div><p className="mt-2 text-[11px] leading-5 text-muted">{detail}</p></button>)}</div>;
}

function MultiChoices({ choices, values, onToggle }: { choices: string[]; values: string[]; onToggle: (value: string) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{choices.map((choice) => { const selected = values.includes(choice); return <button type="button" key={choice} onClick={() => onToggle(choice)} className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left text-xs font-bold ${selected ? "border-brand bg-[#edf5fc] text-brand" : "border-line bg-white"}`}><span className={`grid size-5 shrink-0 place-items-center rounded-md border ${selected ? "border-brand bg-brand text-white" : "border-[#cbd7e2]"}`}>{selected && <Check size={12}/>}</span>{choice}</button>; })}</div>;
}
