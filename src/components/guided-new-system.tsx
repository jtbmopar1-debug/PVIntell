"use client";

import { ArrowLeft, ArrowRight, Bot, Check, CircleHelp, Plus, Ruler, Save, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { discoveryStages, helpForExperience, unknownAnswer, visibleDiscoveryQuestions, type DiscoveryAnswers, type DiscoveryQuestion } from "@/discovery/new-system";
import type { OnboardingAnswers } from "@/onboarding/assessment";

export function GuidedNewSystem({ profile, sites, initialAnswers, initialQuestionId, existingSystemId, siteDiscoveryId, returnUrl, stageFilter }: {
  profile: OnboardingAnswers;
  sites: Array<{ id: string; name: string }>;
  initialAnswers: DiscoveryAnswers;
  initialQuestionId?: string;
  existingSystemId?: string;
  /** A Site owns one combined Site + System discovery brief. */
  siteDiscoveryId?: string;
  returnUrl?: string;
  stageFilter?: "site";
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<DiscoveryAnswers>(initialAnswers);
  const questionsFor = (values: DiscoveryAnswers) => visibleDiscoveryQuestions(values).filter((item) => (!stageFilter || item.stage === stageFilter) && !(siteDiscoveryId && item.id === "site_name"));
  const initialQuestions = questionsFor(initialAnswers);
  const [index, setIndex] = useState(() => Math.max(0, initialQuestions.findIndex((question) => question.id === initialQuestionId)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const questions = useMemo(() => questionsFor(answers), [answers, stageFilter, siteDiscoveryId]);
  const reviewing = index >= questions.length;
  const question = reviewing ? undefined : questions[Math.min(index, questions.length - 1)];
  const stageIndex = question ? discoveryStages.findIndex((stage) => stage.id === question.stage) : discoveryStages.length;
  const answered = questions.filter((item) => {
    const value = answers[item.id];
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
  }).length;
  const currentAnswerComplete = question ? discoveryAnswerComplete(question.id, answers[question.id]) : true;

  async function save(nextAnswers: DiscoveryAnswers, nextQuestionId?: string) {
    setSaving(true); setError("");
    try {
      const response = await fetch(siteDiscoveryId ? `/api/sites/${siteDiscoveryId}/discovery` : "/api/discovery/new-system", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers, questionId: nextQuestionId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save discovery");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save discovery"); }
    finally { setSaving(false); }
  }

  function setAnswer(value: string | number | string[]) {
    setAnswers((current) => {
      if (!question) return current;
      const next = { ...current, [question.id]: value };
      if (question.id === "panel_location" && Array.isArray(value) && value.includes("none")) {
        delete next.panel_construction_interest;
        delete next.usable_solar_space;
        delete next.panel_area_dimensions;
        delete next.panel_area_constraints;
        delete next.orientation_and_pitch;
        delete next.shading;
        delete next.structure_condition;
        delete next.storage_supply_source_off_grid;
        delete next.storage_supply_source_grid;
      }
      return next;
    });
  }

  async function next() {
    if (!question) return;
    const nextQuestions = questionsFor(answers);
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
      const response = await fetch(siteDiscoveryId ? `/api/sites/${siteDiscoveryId}/discovery` : "/api/discovery/new-system", {
        method: siteDiscoveryId || existingSystemId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(siteDiscoveryId ? { answers } : existingSystemId ? { projectId: existingSystemId, answers } : { answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not complete discovery");
      router.push(siteDiscoveryId ? (body.reviewUrl ?? returnUrl ?? "/dashboard#wattson") : (returnUrl ?? body.reviewUrl));
      router.refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not complete discovery"); setSaving(false); }
  }

  async function deleteSite() {
    if (!siteDiscoveryId || !window.confirm("Delete this Site and its discovery? Its power systems, equipment links and saved design work will also be removed.")) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/sites/${siteDiscoveryId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not delete this Site");
      router.push("/dashboard");
      router.refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not delete this Site"); setSaving(false); }
  }

  function goToStage(stageId: string) {
    const targetIndex = questions.findIndex((item) => item.stage === stageId);
    if (targetIndex >= 0) setIndex(targetIndex);
  }

  return <div className="min-h-screen bg-[#f3f6fa] p-4 md:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4"><Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/>Back to dashboard</Link><div className="flex items-center gap-2 text-[10px] font-semibold text-muted"><Save size={13}/>{saving ? "Saving…" : "Saved as you go"}</div></header>
      <div className="mt-7 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-4 lg:sticky lg:top-6">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand text-white"><Sparkles size={18}/></span><div><div className="eyebrow">Guided setup</div><div className="mt-1 text-sm font-extrabold">{siteDiscoveryId ? "Site discovery" : "New system discovery"}</div></div></div>
          <div className="mt-5 space-y-2">{discoveryStages.map((stage, position) => { const active=position===stageIndex; const done=position<stageIndex; const available=questions.some((item)=>item.stage===stage.id); return <button type="button" key={stage.id} onClick={() => goToStage(stage.id)} disabled={!available || saving} className={`w-full rounded-xl border p-3 text-left transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-45 ${active?"border-brand bg-[#edf5fd]":done?"border-[#b8ddc8] bg-[#f1faf5]":"border-line bg-white"}`}><div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${done?"bg-[#dff2e6] text-[#17603b]":active?"bg-brand text-white":"bg-[#edf1f5] text-muted"}`}>{done?<Check size={12}/>:position+1}</span><strong className="text-xs">{stage.label}</strong></div><p className="mt-2 text-[10px] leading-4 text-muted">{stage.description}</p></button>})}</div>
          <div className="mt-5"><div className="flex justify-between text-[10px] font-bold"><span>Progress</span><span>{answered}/{questions.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6edf4]"><div className="h-full rounded-full bg-[#f6c945] transition-all" style={{width:`${questions.length ? Math.round(answered/questions.length*100) : 0}%`}}/></div></div>
          {siteDiscoveryId && <button type="button" onClick={() => void deleteSite()} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#efb6a7] px-3 py-2.5 text-xs font-bold text-[#b9412b] hover:bg-[#fff1ed] disabled:opacity-40"><Trash2 size={15}/>Delete Site and discovery</button>}
        </aside>

        <main>
          {!reviewing && question ? <QuestionCard
            question={question}
            value={answers[question.id]}
            profile={profile}
            sites={sites}
            selectedSiteId={typeof answers.site_id === "string" ? answers.site_id : ""}
            panelLocations={Array.isArray(answers.panel_location) ? answers.panel_location : []}
            panelAreaDimensions={answers.panel_area_dimensions}
            setAnswer={setAnswer}
            setSite={(siteId, siteName) => setAnswers((current) => ({ ...current, site_id: siteId, site_name: siteName }))}
          /> : <Review answers={answers} questions={questions}/>} 
          {siteDiscoveryId && <div className="mt-4 rounded-xl border border-[#f1ce71] bg-[#fff9df] p-3 text-xs leading-5 text-[#725800]">This is the complete brief for this Site, including its proposed system. Saving changes flags every proposed design at this Site for review; nothing is silently overwritten.</div>}
          {error && <div className="mt-4 rounded-xl border border-[#efb6a7] bg-[#fff1ed] p-3 text-xs text-[#9b3f2c]">{error}</div>}
          <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => void back()} disabled={index===0 || saving} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-xs font-bold disabled:opacity-40"><ArrowLeft size={15}/>Back</button>{reviewing?<button type="button" onClick={() => void complete()} disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-xs font-bold text-white disabled:opacity-40"><Bot size={16}/>{siteDiscoveryId ? "Save and continue with Wattson" : "Save and review with Wattson"}</button>:question?<button type="button" onClick={() => void next()} disabled={!currentAnswerComplete || (question.id==="site_name" && sites.length>0 && !answers.site_id) || saving} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-xs font-bold text-white disabled:opacity-40">Continue<ArrowRight size={15}/></button>:null}</div>
        </main>
      </div>
    </div>
  </div>;
}

function QuestionCard({ question, value, profile, sites, selectedSiteId, panelLocations, panelAreaDimensions, setAnswer, setSite }: { question: DiscoveryQuestion; value: string | number | string[] | undefined; profile: OnboardingAnswers; sites: Array<{ id: string; name: string }>; selectedSiteId: string; panelLocations: string[]; panelAreaDimensions: string | number | string[] | undefined; setAnswer: (value: string | number | string[]) => void; setSite: (siteId: string, siteName: string) => void }) {
  const unknown = value === unknownAnswer;
  const choices = question.type === "choice" || question.type === "multi_choice";
  if (question.id === "site_name" && sites.length > 0) {
    return <SiteQuestionCard question={question} profile={profile} sites={sites} selectedSiteId={selectedSiteId} value={value} setSite={setSite}/>;
  }
  if (question.id === "panel_area_dimensions") {
    return <PanelDimensionsCard question={question} profile={profile} panelLocations={panelLocations} value={value} setAnswer={setAnswer}/>;
  }
  if (question.id === "orientation_and_pitch") {
    return <OrientationCard question={question} profile={profile} panelLocations={panelLocations} panelAreaDimensions={panelAreaDimensions} value={value} setAnswer={setAnswer}/>;
  }
  if (question.id === "panel_area_constraints") {
    return <PanelObstructionsCard question={question} profile={profile} panelLocations={panelLocations} panelAreaDimensions={panelAreaDimensions} value={value} setAnswer={setAnswer}/>;
  }
  if (question.id === "structure_condition") {
    return <StructureConditionCard question={question} profile={profile} panelLocations={panelLocations} panelAreaDimensions={panelAreaDimensions} value={value} setAnswer={setAnswer}/>;
  }
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="p-6 md:p-8">{choices?<div className="grid gap-3 sm:grid-cols-2">{question.options?.map((option)=>{const currentValues=Array.isArray(value)?value:typeof value==="string"&&value!==unknownAnswer?[value]:[];const selected=question.type==="multi_choice"?currentValues.includes(option.value):value===option.value;const nextValues=option.value==="none"?["none"]:selected?currentValues.filter((item)=>item!==option.value):[...currentValues.filter((item)=>item!=="none"),option.value];return <button key={option.value} type="button" onClick={()=>setAnswer(question.type==="multi_choice"?nextValues:option.value)} className={`rounded-2xl border p-4 text-left transition ${selected?"border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]":"border-line bg-white hover:border-[#8ab0d2]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm">{option.label}</strong>{selected&&<Check className="text-brand" size={16}/>}</div><p className="mt-2 text-[11px] leading-5 text-muted">{option.description}</p></button>})}</div>:question.type==="textarea"?<textarea rows={6} disabled={unknown} value={unknown?"":String(value??"")} onChange={(event)=>setAnswer(event.target.value)} className="field mt-0 min-h-36 py-3 disabled:bg-[#eef2f6]" placeholder={unknown?"Wattson will revisit this after the questionnaire":"Type what you know…"}/>:<div className="relative"><input type={question.type} disabled={unknown} min={question.type==="number"?0:undefined} value={unknown?"":String(value??"")} onChange={(event)=>setAnswer(question.type==="number"&&event.target.value!==""?Number(event.target.value):event.target.value)} className="field mt-0 pr-28 disabled:bg-[#eef2f6]" placeholder={unknown?"Wattson will revisit this":"Type your answer"}/>{question.unit&&<span className="absolute inset-y-0 right-4 grid place-items-center text-xs font-semibold text-muted">{question.unit}</span>}</div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={()=>setAnswer(unknown?"":unknownAnswer)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${unknown?"bg-[#fff3bd] text-[#725800]":"border border-line text-muted"}`}><CircleHelp size={15}/>{unknown?"I’ll answer this now":"I don’t know"}</button>{unknown&&<span className="text-[11px] text-muted">This will be added to Wattson’s review list.</span>}</div>
    </div>
  </section>;
}

type PanelArea = { id: string; name: string; lengthM: string; widthM: string };
type PanelOrientation = { id: string; name: string; direction: string; slope: string };
type StructureCondition = { id: string; name: string; material: string; age: string; condition: string };
type PanelObstruction = { id: string; areaId: string; kind: string; lengthM: string; widthM: string };

function discoveryAnswerComplete(questionId: string, value: string | number | string[] | undefined) {
  if (value === unknownAnswer) return true;
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return false;
  if (questionId === "panel_area_dimensions" && typeof value === "string") {
    try {
      const areas = JSON.parse(value) as PanelArea[];
      return areas.length > 0 && areas.every((area) => area.name.trim() && Number(area.lengthM) > 0 && Number(area.widthM) > 0);
    } catch { return false; }
  }
  if (questionId === "orientation_and_pitch" && typeof value === "string") {
    try {
      const orientations = JSON.parse(value) as PanelOrientation[];
      return orientations.length > 0 && orientations.every((area) => area.direction && area.slope);
    } catch { return false; }
  }
  if (questionId === "structure_condition" && typeof value === "string") {
    try {
      const structures = JSON.parse(value) as StructureCondition[];
      return structures.length > 0 && structures.every((area) => area.material && area.age && area.condition);
    } catch { return false; }
  }
  if (questionId === "panel_area_constraints" && typeof value === "string") {
    try {
      const obstructions = JSON.parse(value) as PanelObstruction[];
      return obstructions.length > 0 && obstructions.every((item) => item.kind === "none" || (item.areaId && item.kind && Number(item.lengthM) > 0 && Number(item.widthM) > 0));
    } catch { return false; }
  }
  return true;
}

const panelLocationLabels: Record<string, string> = {
  main_roof: "Main roof",
  other_roof: "Garage, shed or another roof",
  ground: "Ground area",
  fence: "Fence or vertical screen",
  wall_facade: "Wall or façade",
  carport_pergola: "Carport, pergola or canopy",
  curved_lightweight: "Curved or weight-limited surface",
  mobile: "Vehicle, boat or movable structure",
};

function panelAreas(value: string | number | string[] | undefined, locations: string[]): PanelArea[] {
  if (typeof value === "string" && value !== unknownAnswer) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((area): area is PanelArea => Boolean(area && typeof area === "object" && "id" in area && "name" in area));
        if (valid.length) return valid.map((area) => ({ ...area, lengthM: String(area.lengthM ?? ""), widthM: String(area.widthM ?? "") }));
      }
    } catch {
      // Older free-text answers are replaced by the structured fields below.
    }
  }
  const selected = locations.filter((location) => location !== "none");
  return (selected.length ? selected : ["panel_area"]).map((location, index) => ({
    id: `${location}-${index}`,
    name: panelLocationLabels[location] ?? `Panel area ${index + 1}`,
    lengthM: "",
    widthM: "",
  }));
}

function PanelDimensionsCard({ question, profile, panelLocations, value, setAnswer }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  panelLocations: string[];
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
}) {
  const [showMeasureHelp, setShowMeasureHelp] = useState(false);
  const unknown = value === unknownAnswer;
  const areas = panelAreas(value, panelLocations);
  const saveAreas = (next: PanelArea[]) => setAnswer(JSON.stringify(next));
  const updateArea = (id: string, field: keyof Omit<PanelArea, "id">, fieldValue: string) => {
    saveAreas(areas.map((area) => area.id === id ? { ...area, [field]: fieldValue } : area));
  };
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8">
      <div className="eyebrow">{question.stage}</div>
      <h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1>
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span>
        <div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div>
      </div>
    </div>
    <div className="space-y-3 p-6 md:p-8">
      <div className="flex justify-end"><button type="button" onClick={() => setShowMeasureHelp(true)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-brand"><Ruler size={15}/>How to measure the area</button></div>
      {!unknown && areas.map((area, index) => {
        const areaM2 = Number(area.lengthM) > 0 && Number(area.widthM) > 0 ? Number(area.lengthM) * Number(area.widthM) : 0;
        return <div key={area.id} className="grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-xs font-bold"><span>Area name</span><input value={area.name} onChange={(event) => updateArea(area.id, "name", event.target.value)} className="field mt-0" placeholder={`Panel area ${index + 1}`}/></label>
          <label className="space-y-1.5 text-xs font-bold"><span>Usable length</span><div className="relative"><input type="number" min="0" step="0.1" value={area.lengthM} onChange={(event) => updateArea(area.id, "lengthM", event.target.value)} className="field mt-0 pr-10" placeholder="0.0"/><span className="absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">m</span></div></label>
          <label className="space-y-1.5 text-xs font-bold"><span>Usable width</span><div className="relative"><input type="number" min="0" step="0.1" value={area.widthM} onChange={(event) => updateArea(area.id, "widthM", event.target.value)} className="field mt-0 pr-10" placeholder="0.0"/><span className="absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">m</span></div></label>
          <div className="flex items-center justify-between gap-3 md:block"><span className="text-[11px] font-semibold text-muted">{areaM2 > 0 ? `${areaM2.toFixed(1)} m²` : "Area —"}</span><button type="button" disabled={areas.length === 1} onClick={() => saveAreas(areas.filter((item) => item.id !== area.id))} className="ml-3 rounded-lg border border-line p-2 text-muted disabled:opacity-30" aria-label={`Remove ${area.name}`}><Trash2 size={15}/></button></div>
        </div>;
      })}
      {!unknown && <button type="button" onClick={() => saveAreas([...areas, { id: `area-${Date.now()}`, name: `Panel area ${areas.length + 1}`, lengthM: "", widthM: "" }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-brand"><Plus size={15}/>Add another panel area</button>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><button type="button" onClick={() => setAnswer(unknown ? "" : unknownAnswer)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${unknown ? "bg-[#fff3bd] text-[#725800]" : "border border-line text-muted"}`}><CircleHelp size={15}/>{unknown ? "I’ll enter measurements" : "I don’t know"}</button>{unknown && <span className="text-[11px] text-muted">Wattson can ask for measurements or a site photo later.</span>}</div>
    </div>
    {showMeasureHelp && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#10233a]/55 p-4" onMouseDown={() => setShowMeasureHelp(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="measure-area-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line p-5 md:p-6"><div><div className="eyebrow">Measurement guide</div><h2 id="measure-area-title" className="mt-2 font-display text-2xl font-extrabold">How to measure a panel area</h2></div><button type="button" onClick={() => setShowMeasureHelp(false)} className="rounded-xl border border-line p-2 text-muted" aria-label="Close measurement guide"><X size={18}/></button></div>
        <div className="max-h-[75vh] overflow-y-auto p-5 md:p-6">
          <img src="/guides/measure-panel-area.svg" alt="Diagram showing how to measure the usable length and width of a solar panel area while excluding obstructions" className="w-full rounded-2xl border border-line bg-[#f5f9fd]"/>
          <ol className="mt-5 grid gap-3 text-xs leading-5 text-muted sm:grid-cols-2">
            <li className="rounded-xl bg-[#f5f8fb] p-3"><strong className="text-ink">1. Measure the clear rectangle.</strong><br/>Record the usable length and width in metres—not the entire roof or property.</li>
            <li className="rounded-xl bg-[#f5f8fb] p-3"><strong className="text-ink">2. Exclude obvious obstacles.</strong><br/>Do not include skylights, chimneys, vents or sections that cannot hold panels.</li>
            <li className="rounded-xl bg-[#f5f8fb] p-3"><strong className="text-ink">3. Keep areas separate.</strong><br/>Add another row for each roof face, fence section, wall or differently oriented area.</li>
            <li className="rounded-xl bg-[#f5f8fb] p-3"><strong className="text-ink">4. Approximate is acceptable.</strong><br/>Use your best safe measurement and update it later after a closer inspection.</li>
          </ol>
        </div>
      </div>
    </div>}
  </section>;
}

const directionOptions = [
  ["north", "North (0°)"], ["north_east", "North-east (45°)"], ["east", "East (90°)"],
  ["south_east", "South-east (135°)"], ["south", "South (180°)"], ["south_west", "South-west (225°)"],
  ["west", "West (270°)"], ["north_west", "North-west (315°)"], ["flat", "Flat / no facing direction"], ["unknown", "I don’t know"],
] as const;

const slopeOptions = [
  ["flat", "Flat (0–5°)"], ["low", "Low slope (6–20°)"], ["medium", "Medium slope (21–35°)"],
  ["steep", "Steep (36–60°)"], ["very_steep", "Very steep (61–89°)"], ["vertical", "Vertical (90°)"], ["unknown", "I don’t know"],
] as const;

function panelOrientations(value: string | number | string[] | undefined, areas: PanelArea[]): PanelOrientation[] {
  if (typeof value === "string" && value !== unknownAnswer) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const saved = parsed.filter((item): item is PanelOrientation => Boolean(item && typeof item === "object" && "id" in item && "name" in item));
        if (saved.length) return areas.map((area) => {
          const match = saved.find((item) => item.id === area.id || item.name === area.name);
          return match ? { id: area.id, name: area.name, direction: String(match.direction ?? ""), slope: String(match.slope ?? "") } : { id: area.id, name: area.name, direction: "", slope: "" };
        });
      }
    } catch {
      // Older free-text answers are replaced by the structured selectors below.
    }
  }
  return areas.map((area) => ({ id: area.id, name: area.name, direction: "", slope: "" }));
}

function OrientationCard({ question, profile, panelLocations, panelAreaDimensions, value, setAnswer }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  panelLocations: string[];
  panelAreaDimensions: string | number | string[] | undefined;
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
}) {
  const unknown = value === unknownAnswer;
  const areas = panelAreas(panelAreaDimensions, panelLocations);
  const orientations = panelOrientations(value, areas);
  const update = (id: string, field: "direction" | "slope", fieldValue: string) => {
    setAnswer(JSON.stringify(orientations.map((area) => area.id === id ? { ...area, [field]: fieldValue } : area)));
  };
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8">
      <div className="eyebrow">{question.stage}</div>
      <h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1>
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div>
    </div>
    <div className="space-y-3 p-6 md:p-8">
      {!unknown && orientations.map((area) => <div key={area.id} className="grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 md:grid-cols-[1.2fr_1fr_1fr] md:items-end">
        <div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Panel area</span><div className="mt-2 text-sm font-extrabold">{area.name}</div></div>
        <label className="space-y-1.5 text-xs font-bold"><span>Facing direction</span><select value={area.direction} onChange={(event) => update(area.id, "direction", event.target.value)} className="field mt-0"><option value="">Choose direction</option>{directionOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-bold"><span>Existing surface slope</span><select value={area.slope} onChange={(event) => update(area.id, "slope", event.target.value)} className="field mt-0"><option value="">Choose slope</option>{slopeOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
      </div>)}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><button type="button" onClick={() => setAnswer(unknown ? "" : unknownAnswer)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${unknown ? "bg-[#fff3bd] text-[#725800]" : "border border-line text-muted"}`}><CircleHelp size={15}/>{unknown ? "I’ll choose the options" : "I don’t know any of these"}</button>{unknown && <span className="text-[11px] text-muted">Wattson can help identify direction and slope from measurements or photos later.</span>}</div>
    </div>
  </section>;
}

const obstructionTypes = [["chimney", "Chimney"], ["skylight", "Skylight or roof window"], ["vent", "Vent, flue or pipe"], ["dormer", "Dormer or raised roof section"], ["access", "Access or maintenance area"], ["other", "Other obstruction"]] as const;

function panelObstructions(value: string | number | string[] | undefined): PanelObstruction[] {
  if (typeof value === "string" && value !== unknownAnswer) {
    try {
      const parsed = JSON.parse(value) as PanelObstruction[];
      if (Array.isArray(parsed) && parsed.length) return parsed.map((item) => ({ id: String(item.id), areaId: String(item.areaId ?? ""), kind: String(item.kind ?? ""), lengthM: String(item.lengthM ?? ""), widthM: String(item.widthM ?? "") }));
    } catch { /* Older free text is replaced by structured entries. */ }
  }
  return [];
}

function PanelObstructionsCard({ question, profile, panelLocations, panelAreaDimensions, value, setAnswer }: { question: DiscoveryQuestion; profile: OnboardingAnswers; panelLocations: string[]; panelAreaDimensions: string | number | string[] | undefined; value: string | number | string[] | undefined; setAnswer: (value: string | number | string[]) => void }) {
  const unknown = value === unknownAnswer;
  const areas = panelAreas(panelAreaDimensions, panelLocations);
  const items = panelObstructions(value);
  const save = (next: PanelObstruction[]) => setAnswer(JSON.stringify(next));
  const update = (id: string, field: keyof Omit<PanelObstruction, "id">, nextValue: string) => save(items.map((item) => item.id === id ? { ...item, [field]: nextValue } : item));
  const nextObstructionId = items.reduce((highest, item) => {
    const suffix = Number(item.id.replace(/^obstruction-/, ""));
    return Number.isFinite(suffix) ? Math.max(highest, suffix) : highest;
  }, 0) + 1;
  const add = () => save([...items.filter((item) => item.kind !== "none"), { id: `obstruction-${nextObstructionId}`, areaId: areas[0]?.id ?? "", kind: "", lengthM: "", widthM: "" }]);
  const total = items.filter((item) => item.kind !== "none").reduce((sum, item) => sum + Number(item.lengthM || 0) * Number(item.widthM || 0), 0);
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="space-y-3 p-6 md:p-8">
      {!unknown && items.filter((item) => item.kind !== "none").map((item) => <div key={item.id} className="grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 md:grid-cols-[1.2fr_1.35fr_1fr_1fr_auto] md:items-end"><label className="space-y-1.5 text-xs font-bold"><span>Panel area</span><select value={item.areaId} onChange={(event) => update(item.id, "areaId", event.target.value)} className="field mt-0">{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-bold"><span>Obstruction</span><select value={item.kind} onChange={(event) => update(item.id, "kind", event.target.value)} className="field mt-0"><option value="">Choose type</option>{obstructionTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="space-y-1.5 text-xs font-bold"><span>Length (m)</span><input type="number" min="0" step="0.1" value={item.lengthM} onChange={(event) => update(item.id, "lengthM", event.target.value)} className="field mt-0"/></label><label className="space-y-1.5 text-xs font-bold"><span>Width (m)</span><input type="number" min="0" step="0.1" value={item.widthM} onChange={(event) => update(item.id, "widthM", event.target.value)} className="field mt-0"/></label><button type="button" onClick={() => save(items.filter((entry) => entry.id !== item.id))} className="rounded-lg border border-line p-2 text-muted hover:text-[#b9412b]" aria-label="Remove obstruction"><Trash2 size={15}/></button></div>)}
      {!unknown && items.some((item) => item.kind === "none") && <div className="rounded-xl bg-[#f1faf5] p-4 text-xs font-semibold text-[#17603b]">No known obstructions recorded. This can be changed later.</div>}
      {!unknown && <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-brand"><Plus size={15}/>Add obstruction</button><button type="button" onClick={() => save([{ id: "none", areaId: "", kind: "none", lengthM: "", widthM: "" }])} className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-muted">No known obstructions</button>{total > 0 && <span className="text-xs font-semibold text-muted">Known area to exclude: {total.toFixed(1)} m²</span>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><button type="button" onClick={() => setAnswer(unknown ? "" : unknownAnswer)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${unknown ? "bg-[#fff3bd] text-[#725800]" : "border border-line text-muted"}`}><CircleHelp size={15}/>{unknown ? "I’ll record these later" : "I don’t know"}</button>{unknown && <span className="text-[11px] text-muted">Wattson will keep usable panel area unconfirmed until it is measured.</span>}</div>
    </div>
  </section>;
}

const structureMaterialOptions = [
  ["corrugated_metal", "Corrugated or trapezoidal metal roof"], ["standing_seam", "Standing-seam metal roof"],
  ["tile", "Tile roof"], ["shingle", "Shingle roof"], ["membrane", "Flat membrane roof"],
  ["concrete", "Concrete roof or slab"], ["timber", "Timber structure"], ["steel", "Steel structure or frame"],
  ["wall", "Wall or façade"], ["fence", "Fence or vertical screen"], ["ground", "Ground area — frame not selected"],
  ["mobile", "Vehicle, boat or movable surface"], ["other", "Other / not listed"], ["unknown", "I don’t know"],
] as const;

const structureAgeOptions = [
  ["new", "New or under 5 years"], ["5_15", "About 5–15 years"], ["16_30", "About 16–30 years"],
  ["over_30", "More than 30 years"], ["not_built", "Not built or not applicable"], ["unknown", "I don’t know"],
] as const;

const structureConditionOptions = [
  ["good", "Good — no known damage"], ["serviceable", "Weathered but serviceable"],
  ["repair_needed", "Repairs may be needed"], ["replacement_planned", "Replacement or rebuilding is planned"],
  ["not_checked", "Not inspected / I don’t know"],
] as const;

function structureConditions(value: string | number | string[] | undefined, areas: PanelArea[]): StructureCondition[] {
  if (typeof value === "string" && value !== unknownAnswer) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const saved = parsed.filter((item): item is StructureCondition => Boolean(item && typeof item === "object" && "id" in item && "name" in item));
        if (saved.length) return areas.map((area) => {
          const match = saved.find((item) => item.id === area.id || item.name === area.name);
          return match ? { id: area.id, name: area.name, material: String(match.material ?? ""), age: String(match.age ?? ""), condition: String(match.condition ?? "") } : { id: area.id, name: area.name, material: "", age: "", condition: "" };
        });
      }
    } catch {
      // Older free-text answers are replaced by the structured selectors below.
    }
  }
  return areas.map((area) => ({ id: area.id, name: area.name, material: "", age: "", condition: "" }));
}

function StructureConditionCard({ question, profile, panelLocations, panelAreaDimensions, value, setAnswer }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  panelLocations: string[];
  panelAreaDimensions: string | number | string[] | undefined;
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
}) {
  const unknown = value === unknownAnswer;
  const areas = panelAreas(panelAreaDimensions, panelLocations);
  const structures = structureConditions(value, areas);
  const update = (id: string, field: "material" | "age" | "condition", fieldValue: string) => setAnswer(JSON.stringify(structures.map((area) => area.id === id ? { ...area, [field]: fieldValue } : area)));
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="space-y-3 p-6 md:p-8">
      {!unknown && structures.map((area) => <div key={area.id} className="grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 lg:grid-cols-[1.1fr_1.4fr_1fr_1.2fr] lg:items-end">
        <div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Possible area</span><div className="mt-2 text-sm font-extrabold">{area.name}</div></div>
        <label className="space-y-1.5 text-xs font-bold"><span>Surface or support type</span><select value={area.material} onChange={(event) => update(area.id, "material", event.target.value)} className="field mt-0"><option value="">Choose type</option>{structureMaterialOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-bold"><span>Approximate age</span><select value={area.age} onChange={(event) => update(area.id, "age", event.target.value)} className="field mt-0"><option value="">Choose age</option>{structureAgeOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-bold"><span>Current condition</span><select value={area.condition} onChange={(event) => update(area.id, "condition", event.target.value)} className="field mt-0"><option value="">Choose condition</option>{structureConditionOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
      </div>)}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><button type="button" onClick={() => setAnswer(unknown ? "" : unknownAnswer)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${unknown ? "bg-[#fff3bd] text-[#725800]" : "border border-line text-muted"}`}><CircleHelp size={15}/>{unknown ? "I’ll choose the options" : "I don’t know any of these"}</button>{unknown && <span className="text-[11px] text-muted">The supporting structure can be inspected and recorded later.</span>}</div>
    </div>
  </section>;
}

function SiteQuestionCard({ question, profile, sites, selectedSiteId, value, setSite }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  sites: Array<{ id: string; name: string }>;
  selectedSiteId: string;
  value: string | number | string[] | undefined;
  setSite: (siteId: string, siteName: string) => void;
}) {
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8">
      <div className="eyebrow">{question.stage}</div>
      <h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1>
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span>
        <div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div>
      </div>
    </div>
    <div className="p-6 md:p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {sites.map((site) => {
          const selected = selectedSiteId === site.id;
          return <button key={site.id} type="button" onClick={() => setSite(site.id, site.name)} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white hover:border-[#8ab0d2]"}`}>
            <div className="flex items-start justify-between gap-3"><strong className="text-sm">{site.name}</strong>{selected && <Check className="text-brand" size={16}/>}</div>
            <p className="mt-2 text-[11px] leading-5 text-muted">Add this power system to the existing Site.</p>
          </button>;
        })}
        <button type="button" onClick={() => setSite("__new__", "")} className={`rounded-2xl border p-4 text-left transition ${selectedSiteId === "__new__" ? "border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white hover:border-[#8ab0d2]"}`}>
          <div className="flex items-start justify-between gap-3"><strong className="text-sm">Create a new Site</strong>{selectedSiteId === "__new__" && <Check className="text-brand" size={16}/>}</div>
          <p className="mt-2 text-[11px] leading-5 text-muted">Use this when the system is at a different property or location.</p>
        </button>
      </div>
      {selectedSiteId === "__new__" && <input autoFocus type="text" value={String(value ?? "")} onChange={(event) => setSite("__new__", event.target.value)} className="field mt-4" placeholder="Name the new Site, e.g. River Views"/>}
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
  if (typeof value === "string" && ["panel_area_dimensions", "orientation_and_pitch", "structure_condition", "panel_area_constraints"].includes(question.id)) {
    try {
      const rows = JSON.parse(value) as Array<Record<string, unknown>>;
      if (Array.isArray(rows)) return rows.map((row) => {
        const name = String(row.name ?? "Panel area");
        if (question.id === "panel_area_dimensions") return `${name}: ${String(row.lengthM ?? "?")} m × ${String(row.widthM ?? "?")} m`;
        if (question.id === "orientation_and_pitch") return `${name}: ${String(row.direction ?? "unknown direction").replaceAll("_", " ")}, ${String(row.slope ?? "unknown slope").replaceAll("_", " ")}`;
        if (question.id === "panel_area_constraints") return row.kind === "none" ? "No known obstructions" : `${String(row.kind ?? "obstruction").replaceAll("_", " ")}: ${String(row.lengthM ?? "?")} m × ${String(row.widthM ?? "?")} m`;
        return `${name}: ${String(row.material ?? "unknown support").replaceAll("_", " ")}, ${String(row.age ?? "unknown age").replaceAll("_", " ")}, ${String(row.condition ?? "unknown condition").replaceAll("_", " ")}`;
      }).join("; ");
    } catch { return "Needs structured details"; }
  }
  if (Array.isArray(value)) return value.map((item)=>question.options?.find((option)=>option.value===item)?.label??item).join(", ");
  return question.options?.find((option)=>option.value===value)?.label ?? `${value}${question.unit?` ${question.unit}`:""}`;
}
