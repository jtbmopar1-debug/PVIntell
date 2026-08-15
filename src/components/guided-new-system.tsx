"use client";

import { ArrowLeft, ArrowRight, Bot, Check, CircleHelp, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { discoveryStages, helpForExperience, unknownAnswer, visibleDiscoveryQuestions, type DiscoveryAnswers, type DiscoveryQuestion } from "@/discovery/new-system";
import type { OnboardingAnswers } from "@/onboarding/assessment";

export function GuidedNewSystem({ profile, initialAnswers, initialQuestionId }: {
  profile: OnboardingAnswers;
  initialAnswers: DiscoveryAnswers;
  initialQuestionId?: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<DiscoveryAnswers>(initialAnswers);
  const initialQuestions = visibleDiscoveryQuestions(initialAnswers);
  const [index, setIndex] = useState(() => Math.max(0, initialQuestions.findIndex((question) => question.id === initialQuestionId)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const questions = useMemo(() => visibleDiscoveryQuestions(answers), [answers]);
  const reviewing = index >= questions.length;
  const question = reviewing ? undefined : questions[Math.min(index, questions.length - 1)];
  const stageIndex = question ? discoveryStages.findIndex((stage) => stage.id === question.stage) : discoveryStages.length;
  const answered = questions.filter((item) => {
    const value = answers[item.id];
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
  }).length;

  async function save(nextAnswers: DiscoveryAnswers, nextQuestionId?: string) {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/discovery/new-system", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers, questionId: nextQuestionId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save discovery");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save discovery"); }
    finally { setSaving(false); }
  }

  function setAnswer(value: string | number | string[]) {
    setAnswers((current) => question ? { ...current, [question.id]: value } : current);
  }

  async function next() {
    if (!question) return;
    const nextQuestions = visibleDiscoveryQuestions(answers);
    const nextIndex = Math.min(index + 1, nextQuestions.length);
    await save(answers, nextQuestions[nextIndex]?.id);
    setIndex(nextIndex);
  }

  async function back() {
    const nextIndex = Math.max(0, index - 1);
    await save(answers, questions[nextIndex]?.id);
    setIndex(nextIndex);
  }

  async function complete() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/discovery/new-system", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not complete discovery");
      router.push(body.reviewUrl);
      router.refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not complete discovery"); setSaving(false); }
  }

  return <div className="min-h-screen bg-[#f3f6fa] p-4 md:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4"><Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/>Back to dashboard</Link><div className="flex items-center gap-2 text-[10px] font-semibold text-muted"><Save size={13}/>{saving ? "Saving…" : "Saved as you go"}</div></header>
      <div className="mt-7 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-4 lg:sticky lg:top-6">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand text-white"><Sparkles size={18}/></span><div><div className="eyebrow">Guided setup</div><div className="mt-1 text-sm font-extrabold">New system discovery</div></div></div>
          <div className="mt-5 space-y-2">{discoveryStages.map((stage, position) => { const active=position===stageIndex; const done=position<stageIndex; return <div key={stage.id} className={`rounded-xl border p-3 ${active?"border-brand bg-[#edf5fd]":done?"border-[#b8ddc8] bg-[#f1faf5]":"border-line bg-white"}`}><div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${done?"bg-[#dff2e6] text-[#17603b]":active?"bg-brand text-white":"bg-[#edf1f5] text-muted"}`}>{done?<Check size={12}/>:position+1}</span><strong className="text-xs">{stage.label}</strong></div><p className="mt-2 text-[10px] leading-4 text-muted">{stage.description}</p></div>})}</div>
          <div className="mt-5"><div className="flex justify-between text-[10px] font-bold"><span>Progress</span><span>{answered}/{questions.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6edf4]"><div className="h-full rounded-full bg-[#f6c945] transition-all" style={{width:`${questions.length ? Math.round(answered/questions.length*100) : 0}%`}}/></div></div>
        </aside>

        <main>
          {!reviewing && question ? <QuestionCard question={question} value={answers[question.id]} profile={profile} setAnswer={setAnswer} /> : <Review answers={answers} questions={questions}/>} 
          {error && <div className="mt-4 rounded-xl border border-[#efb6a7] bg-[#fff1ed] p-3 text-xs text-[#9b3f2c]">{error}</div>}
          <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => void back()} disabled={index===0 || saving} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-xs font-bold disabled:opacity-40"><ArrowLeft size={15}/>Back</button>{reviewing?<button type="button" onClick={() => void complete()} disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-xs font-bold text-white disabled:opacity-40"><Bot size={16}/>Save and review with Wattson</button>:question?<button type="button" onClick={() => void next()} disabled={answers[question.id]===undefined || answers[question.id]==="" || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length===0) || saving} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-xs font-bold text-white disabled:opacity-40">Continue<ArrowRight size={15}/></button>:null}</div>
        </main>
      </div>
    </div>
  </div>;
}

function QuestionCard({ question, value, profile, setAnswer }: { question: DiscoveryQuestion; value: string | number | string[] | undefined; profile: OnboardingAnswers; setAnswer: (value: string | number | string[]) => void }) {
  const unknown = value === unknownAnswer;
  const choices = question.type === "choice" || question.type === "multi_choice";
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="p-6 md:p-8">{choices?<div className="grid gap-3 sm:grid-cols-2">{question.options?.map((option)=>{const currentValues=Array.isArray(value)?value:typeof value==="string"&&value!==unknownAnswer?[value]:[];const selected=question.type==="multi_choice"?currentValues.includes(option.value):value===option.value;const nextValues=option.value==="none"?["none"]:selected?currentValues.filter((item)=>item!==option.value):[...currentValues.filter((item)=>item!=="none"),option.value];return <button key={option.value} type="button" onClick={()=>setAnswer(question.type==="multi_choice"?nextValues:option.value)} className={`rounded-2xl border p-4 text-left transition ${selected?"border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]":"border-line bg-white hover:border-[#8ab0d2]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm">{option.label}</strong>{selected&&<Check className="text-brand" size={16}/>}</div><p className="mt-2 text-[11px] leading-5 text-muted">{option.description}</p></button>})}</div>:question.type==="textarea"?<textarea rows={6} disabled={unknown} value={unknown?"":String(value??"")} onChange={(event)=>setAnswer(event.target.value)} className="field mt-0 min-h-36 py-3 disabled:bg-[#eef2f6]" placeholder={unknown?"Wattson will revisit this after the questionnaire":"Type what you know…"}/>:<div className="relative"><input type={question.type} disabled={unknown} min={question.type==="number"?0:undefined} value={unknown?"":String(value??"")} onChange={(event)=>setAnswer(question.type==="number"&&event.target.value!==""?Number(event.target.value):event.target.value)} className="field mt-0 pr-28 disabled:bg-[#eef2f6]" placeholder={unknown?"Wattson will revisit this":"Type your answer"}/>{question.unit&&<span className="absolute inset-y-0 right-4 grid place-items-center text-xs font-semibold text-muted">{question.unit}</span>}</div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={()=>setAnswer(unknown?"":unknownAnswer)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${unknown?"bg-[#fff3bd] text-[#725800]":"border border-line text-muted"}`}><CircleHelp size={15}/>{unknown?"I’ll answer this now":"I don’t know"}</button>{unknown&&<span className="text-[11px] text-muted">This will be added to Wattson’s review list.</span>}</div>
    </div>
  </section>;
}

function Review({ answers, questions }: { answers: DiscoveryAnswers; questions: DiscoveryQuestion[] }) {
  const unknowns=questions.filter((question)=>answers[question.id]===unknownAnswer);
  return <section className="card overflow-hidden bg-white"><div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">Review</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em]">Ready for Wattson</h1><p className="mt-2 text-sm leading-6 text-muted">Confirmed answers will form the design brief. Unknown items remain visibly unresolved for Wattson to explain or revisit.</p></div><div className="grid gap-3 p-6 md:grid-cols-2 md:p-8">{questions.map((question)=><div key={question.id} className="rounded-2xl border border-line p-4"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">{question.stage}</div><div className="mt-2 text-xs font-bold">{question.title}</div><div className={`mt-2 text-xs ${answers[question.id]===unknownAnswer?"text-[#8a6400]":"text-muted"}`}>{answerLabel(question,answers[question.id])}</div></div>)}</div>{unknowns.length>0&&<div className="mx-6 mb-6 flex items-start gap-3 rounded-2xl bg-[#fff6cf] p-4 text-xs leading-5 text-[#725800] md:mx-8 md:mb-8"><CircleHelp className="mt-0.5 shrink-0" size={16}/><div><strong>{unknowns.length} item{unknowns.length===1?"":"s"} for Wattson to revisit.</strong><p className="mt-1">Nothing has been guessed or treated as confirmed.</p></div></div>}</section>;
}

function answerLabel(question: DiscoveryQuestion, value: string | number | string[] | undefined) {
  if (value===unknownAnswer) return "I don’t know yet";
  if (value===undefined || value==="") return "Not answered";
  if (Array.isArray(value)) return value.map((item)=>question.options?.find((option)=>option.value===item)?.label??item).join(", ");
  return question.options?.find((option)=>option.value===value)?.label ?? `${value}${question.unit?` ${question.unit}`:""}`;
}
