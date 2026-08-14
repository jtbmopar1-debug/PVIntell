"use client";

import { Check, CircleHelp, Save } from "lucide-react";
import { systemDiscoveryQuestionnaire, type QuestionnaireAnswer, type QuestionnaireQuestion } from "@/questionnaires/templates";

interface Props {
  answers: Record<string, QuestionnaireAnswer>;
  setAnswers: (answers: Record<string, QuestionnaireAnswer>) => void;
  save: (answers: Record<string, QuestionnaireAnswer>, status?: "draft" | "completed") => Promise<void>;
  review: () => Promise<void>;
  saving: boolean;
}

const unknownValue = "__unknown__";

export function SystemQuestionnaire({ answers, setAnswers, save, review, saving }: Props) {
  const questions = systemDiscoveryQuestionnaire.sections.flatMap((section) => section.questions);
  const required = questions.filter((question) => question.required);
  const completed = required.filter((question) => answers[question.id] !== undefined && answers[question.id] !== "").length;
  const percent = required.length ? Math.round((completed / required.length) * 100) : 100;

  function update(question: QuestionnaireQuestion, value: QuestionnaireAnswer, saveNow = false) {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    if (saveNow) void save(next);
  }

  return <div className="animate-rise space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><div className="eyebrow">System setup</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">{systemDiscoveryQuestionnaire.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{systemDiscoveryQuestionnaire.description}</p></div>
      <div className="min-w-44 rounded-2xl border border-line bg-white p-4"><div className="flex justify-between text-xs"><strong>Required details</strong><span>{completed}/{required.length}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6ebe4]"><div className="h-full rounded-full bg-brand transition-all" style={{width:`${percent}%`}}/></div><div className="mt-2 flex items-center gap-1 text-[10px] text-muted"><Save size={11}/>{saving?"Saving…":"Saved as you go"}</div></div>
    </div>

    {systemDiscoveryQuestionnaire.sections.map((section, sectionIndex) => <section key={section.id} className="card overflow-hidden">
      <div className="border-b border-line bg-[#f5f7f2] px-6 py-5"><div className="eyebrow">Section {sectionIndex+1}</div><h2 className="mt-2 font-display text-xl font-extrabold">{section.title}</h2><p className="mt-1 text-xs text-muted">{section.description}</p></div>
      <div className="grid gap-5 p-6 md:grid-cols-2">{section.questions.map((question) => {
        const value=answers[question.id];const unknown=value===unknownValue;
        return <label key={question.id} className={question.type==="textarea"?"md:col-span-2":""}><span className="flex items-center gap-1 text-xs font-bold">{question.label}{question.required&&<span className="text-[#bd5f47]">*</span>}</span>{question.help&&<span className="mt-1 block text-[10px] leading-4 text-muted">{question.help}</span>}
          {question.type==="select"?<select value={String(value??"")} onChange={(event)=>update(question,event.target.value,true)} className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-xs outline-none focus:border-brand"><option value="">Choose an answer</option>{question.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}<option value={unknownValue}>I don’t know yet</option></select>:question.type==="textarea"?<textarea value={unknown?"":String(value??"")} disabled={unknown} onChange={(event)=>update(question,event.target.value)} onBlur={()=>void save(answers)} rows={3} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-xs outline-none focus:border-brand disabled:bg-[#eef1ec]" placeholder={unknown?"Marked for later":"Type what you know…"}/>:<div className="relative mt-2"><input type={question.type} value={unknown?"":String(value??"")} disabled={unknown} min={question.type==="number"?0:undefined} onChange={(event)=>update(question,question.type==="number"&&event.target.value!==""?Number(event.target.value):event.target.value)} onBlur={()=>void save(answers)} className="h-11 w-full rounded-xl border border-line bg-white px-3 pr-14 text-xs outline-none focus:border-brand disabled:bg-[#eef1ec]"/>{question.unit&&<span className="absolute inset-y-0 right-3 grid place-items-center text-[10px] text-muted">{question.unit}</span>}</div>}
          {question.type!=="select"&&<button type="button" onClick={()=>update(question,unknown?"":unknownValue,true)} className="mt-2 flex items-center gap-1 text-[10px] font-bold text-muted hover:text-brand"><CircleHelp size={12}/>{unknown?"Add an answer":"I don’t know yet"}</button>}
        </label>;
      })}</div>
    </section>)}

    <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center"><div><div className="text-sm font-bold">Ready for Wattson to review?</div><p className="mt-1 text-xs text-muted">You can still return and change any answer later.</p></div><button onClick={()=>void review()} disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:opacity-50"><Check size={15}/>Save and review with Wattson</button></div>
  </div>;
}

