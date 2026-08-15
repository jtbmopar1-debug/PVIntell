"use client";

import { ArrowLeft, ArrowRight, Bot, Check, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OnboardingAnswers } from "@/onboarding/assessment";

type MultiKey = "history" | "currentSituation" | "goals";

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

export function OnboardingAssessment({ initialAnswers }: { initialAnswers: OnboardingAnswers }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (answers.timezone) return;
    const detection = window.setTimeout(() => setAnswers((current) => ({
      ...current,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })), 0);
    return () => window.clearTimeout(detection);
  }, [answers.timezone]);

  const ready = useMemo(() => {
    if (step === 0) return Boolean(answers.displayName?.trim() && answers.location?.trim() && answers.timezone);
    if (step === 1) return Boolean(answers.experience);
    if (step === 2) return Boolean(answers.electricalConfidence);
    if (step === 3) return Boolean(answers.history?.length);
    if (step === 4) return Boolean(answers.currentSituation?.length);
    return Boolean(answers.goals?.length);
  }, [answers, step]);

  function toggle(key: MultiKey, value: string) {
    setAnswers((current) => {
      const values = current[key] ?? [];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  }

  async function save(completed = false) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, completed }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save your assessment");
      if (completed) {
        router.push("/dashboard");
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
      <label className="text-xs font-bold">Where are you based?<input className="field" value={answers.location ?? ""} onChange={(event) => setAnswers({ ...answers, location: event.target.value })} placeholder="Town or region, country" /></label>
      <label className="text-xs font-bold">Your timezone<input className="field" value={answers.timezone ?? ""} onChange={(event) => setAnswers({ ...answers, timezone: event.target.value })} placeholder="Pacific/Auckland" /></label>
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
    <div key="goals" className="space-y-5"><MultiChoices values={answers.goals ?? []} choices={goalChoices} onToggle={(value) => toggle("goals", value)} /><label className="block text-xs font-bold">Anything Wattson should know now? <span className="font-normal text-muted">(optional)</span><textarea className="field min-h-24 py-3" value={answers.notes ?? ""} onChange={(event) => setAnswers({ ...answers, notes: event.target.value })} placeholder="Existing equipment, unusual power needs, current concerns, or what success looks like…" /></label></div>,
  ];
  const prompts = [
    ["First, where are we working?", "Location sets your timezone and helps Wattson use the correct regional context."],
    ["How familiar are you with solar power?", "There is no test here. I’ll adjust the language and depth to suit you."],
    ["What best matches your practical experience?", "Think about building, mounting, tools and electrical knowledge. This sets Wattson’s teaching level; it does not grant permission for regulated work."],
    ["What have you worked with before?", "Choose everything that applies. Experience can be practical, informal or professional."],
    ["What do you have in front of you now?", "This decides whether we begin with design, inventory, an as-built record, an upgrade or diagnosis."],
    ["What would you like PVIntell to help with?", "Choose as many as you need. Your dashboard and next steps will be shaped around these goals."],
  ];

  return <main className="min-h-screen lg:grid lg:grid-cols-[300px_1fr]">
    <aside className="hidden border-r border-line bg-[#0f3b66] p-8 text-white lg:flex lg:flex-col">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#f6c945] text-[#143c63]"><Zap size={21} fill="currentColor" /></span><div><div className="font-display text-xl font-extrabold">PVIntell</div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-[#bfd3e6]">Power, made clear</div></div></div>
      <div className="mt-16"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#f6c945]">Your starting profile</div><h2 className="mt-4 font-display text-3xl font-extrabold leading-tight">Wattson should understand you before advising you.</h2><p className="mt-4 text-sm leading-6 text-[#d5e2ee]">Your answers set the language, safety boundaries and starting workflow. You can update them later.</p></div>
      <div className="mt-auto flex gap-3 rounded-2xl border border-white/15 bg-white/5 p-4"><ShieldCheck className="shrink-0 text-[#f6c945]" size={20}/><p className="text-[11px] leading-5 text-[#d5e2ee]">PVIntell separates DIY work from tasks that local rules reserve for inspection, certification, connection or an authorised electrical worker.</p></div>
    </aside>
    <section className="grid min-h-screen place-items-center p-5 md:p-10">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold text-brand"><Bot size={18}/> Wattson assessment</div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">{step + 1} of 6</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#dfe8f0]"><div className="h-full rounded-full bg-[#f6c945] transition-all" style={{ width: `${((step + 1) / 6) * 100}%` }}/></div>
        <div className="card mt-5 p-6 md:p-8">
          <div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eaf2fb] text-brand"><Sparkles size={19}/></span><div><div className="eyebrow">Wattson asks</div><h1 className="mt-3 font-display text-2xl font-extrabold md:text-3xl">{prompts[step][0]}</h1><p className="mt-2 text-sm leading-6 text-muted">{prompts[step][1]}</p></div></div>
          <div className="mt-7">{panels[step]}</div>
          {error && <div className="mt-5 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">{error}</div>}
          <div className="mt-7 flex items-center justify-between"><button type="button" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)} className="flex items-center gap-2 px-2 py-2 text-xs font-bold text-muted disabled:invisible"><ArrowLeft size={15}/> Back</button><button type="button" disabled={!ready || saving} onClick={() => void next()} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:opacity-40">{saving ? "Saving…" : step === 5 ? "Build my dashboard" : "Continue"}{step === 5 ? <Check size={15}/> : <ArrowRight size={15}/>}</button></div>
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
