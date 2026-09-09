"use client";

import { ArrowLeft, ArrowRight, Bot, Calculator, Check, ChevronDown, CircleHelp, ImagePlus, LoaderCircle, LocateFixed, MapPin, Plus, Ruler, Save, Search, Send, Sparkles, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import { PoolHeatingCalculator } from "@/components/pool-heating-calculator";
import { discoveryStages, helpForExperience, unknownAnswer, visibleDiscoveryQuestions, type DiscoveryAnswers, type DiscoveryQuestion } from "@/discovery/new-system";
import type { OnboardingAnswers } from "@/onboarding/assessment";

const EditableSiteMap = dynamic(() => import("@/components/editable-site-map"), { ssr: false });

export function GuidedNewSystem({ profile, sites, initialAnswers, initialQuestionId, discoveryDraftId, initialDiscoveryConversationId, existingSystemId, siteDiscoveryId, returnUrl, stageFilter }: {
  profile: OnboardingAnswers;
  sites: Array<{ id: string; name: string }>;
  initialAnswers: DiscoveryAnswers;
  initialQuestionId?: string;
  discoveryDraftId?: string;
  initialDiscoveryConversationId?: string;
  existingSystemId?: string;
  /** A Site owns one combined Site + System discovery brief. */
  siteDiscoveryId?: string;
  returnUrl?: string;
  stageFilter?: "site";
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<DiscoveryAnswers>(initialAnswers);
  const combinedInitialSetup = !stageFilter && !siteDiscoveryId;
  const questionsFor = (values: DiscoveryAnswers) => visibleDiscoveryQuestions(values).filter((item) => item.id !== "household_motor_ratings" && (!stageFilter || item.stage === stageFilter) && !(siteDiscoveryId && item.id === "site_name") && !(combinedInitialSetup && item.id === "site_name"));
  const initialQuestions = questionsFor(initialAnswers);
  const [index, setIndex] = useState(() => Math.max(0, initialQuestions.findIndex((question) => question.id === initialQuestionId)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [helpQuestion, setHelpQuestion] = useState<DiscoveryQuestion>();
  const [discoveryConversationId, setDiscoveryConversationId] = useState<string | undefined>(initialDiscoveryConversationId);
  const [returningToReview, setReturningToReview] = useState(false);
  const [buildingProposal, setBuildingProposal] = useState(false);
  const questions = useMemo(() => questionsFor(answers), [answers, stageFilter, siteDiscoveryId]);
  const reviewing = index >= questions.length;
  const question = reviewing ? undefined : questions[Math.min(index, questions.length - 1)];
  const stageIndex = question ? discoveryStages.findIndex((stage) => stage.id === question.stage) : discoveryStages.length;
  const answered = questions.filter((item) => {
    const value = answers[item.id];
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
  }).length;
  const newSiteLocationComplete = typeof answers.site_latitude === "number" && typeof answers.site_longitude === "number";
  const selectedHighPowerLoads = Array.isArray(answers.heavy_loads) ? answers.heavy_loads.filter((item) => item !== "none") : [];
  const highPowerRatingsComplete = highPowerLoadRatingsComplete(answers.household_motor_ratings, selectedHighPowerLoads);
  const currentAnswerComplete = question ? discoveryAnswerComplete(question.id, answers[question.id]) && (question.id !== "heavy_loads" || highPowerRatingsComplete) && !(question.id === "system_name" && combinedInitialSetup && (answers.site_id === "__new__" || !sites.length) && !newSiteLocationComplete) : true;
  const incompleteQuestions = questions.filter((item) => !discoveryAnswerComplete(item.id, answers[item.id])
    || (item.id === "heavy_loads" && !highPowerRatingsComplete)
    || (item.id === "site_name" && sites.length > 0 && !answers.site_id)
    || (item.id === "system_name" && combinedInitialSetup && (!answers.site_name || (sites.length > 0 && !answers.site_id) || ((answers.site_id === "__new__" || !sites.length) && !newSiteLocationComplete))));

  function returnToQuestion(questionId: string) {
    const targetIndex = questions.findIndex((item) => item.id === questionId);
    if (targetIndex >= 0) { setReturningToReview(true); setIndex(targetIndex); }
  }

  async function save(nextAnswers: DiscoveryAnswers, nextQuestionId?: string) {
    setSaving(true); setError("");
    try {
      const response = await fetch(siteDiscoveryId ? `/api/sites/${siteDiscoveryId}/discovery` : "/api/discovery/new-system", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId: discoveryDraftId, answers: nextAnswers, questionId: nextQuestionId }),
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
      if (question.id === "battery_chemistry" && value !== "custom_home_built") delete next.custom_battery_assessment;
      if (question.id === "battery_requirement" && value === "none") {
        delete next.dc_system_voltage;
        delete next.battery_chemistry;
        delete next.custom_battery_assessment;
      }
      if (question.id === "garage_conditioning" && ["none", "attached_unconditioned"].includes(String(value))) delete next.garage_floor_area;
      if (question.id === "water_heating_energy" && (!Array.isArray(value) || !value.includes("solar_thermal"))) {
        delete next.solar_hot_water_arrangement;
        delete next.solar_hot_water_storage_litres;
        delete next.solar_hot_water_pump_watts;
        delete next.solar_hot_water_pump_hours_per_day;
      }
      if (question.id === "generator_requirement" && !["include", "existing", "planned"].includes(String(value))) delete next.generator_outage_role;
      if (question.id === "solar_hot_water_arrangement" && !["pumped_shared_store", "pumped_preheat_separate_hwc"].includes(String(value))) {
        delete next.solar_hot_water_pump_watts;
        delete next.solar_hot_water_pump_hours_per_day;
      }
      return next;
    });
  }

  function openDiscoveryHelp(activeQuestion: DiscoveryQuestion) {
    if (answers[activeQuestion.id] === unknownAnswer) {
      setAnswers((current) => ({ ...current, [activeQuestion.id]: "" }));
    }
    setHelpQuestion(activeQuestion);
  }

  async function next() {
    if (!question) return;
    const nextQuestions = questionsFor(answers);
    if (returningToReview) {
      await save(answers);
      setReturningToReview(false);
      setIndex(nextQuestions.length);
      return;
    }
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
    setSaving(true); setBuildingProposal(true); setError("");
    try {
      const response = await fetch(siteDiscoveryId ? `/api/sites/${siteDiscoveryId}/discovery` : "/api/discovery/new-system", {
        method: siteDiscoveryId || existingSystemId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(siteDiscoveryId ? { answers, systemId: existingSystemId } : existingSystemId ? { projectId: existingSystemId, answers } : { draftId: discoveryDraftId, answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not complete discovery");
      router.push(body.designUrl ?? returnUrl ?? (siteDiscoveryId ? `/sites/${siteDiscoveryId}` : "/dashboard"));
      router.refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not complete discovery"); setSaving(false); setBuildingProposal(false); }
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
          <div className="mt-5 space-y-2">{discoveryStages.map((stage, position) => { const active=position===stageIndex; const done=position<stageIndex; const available=questions.some((item)=>item.stage===stage.id); return <button type="button" key={stage.id} onClick={() => goToStage(stage.id)} disabled={!available || saving} className={`w-full rounded-xl border p-3 text-left transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-45 ${active?"theme-selected-tile border-brand bg-[#edf5fd]":done?"border-[#b8ddc8] bg-[#f1faf5]":"border-line bg-white"}`}><div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${done?"bg-[#dff2e6] text-[#17603b]":active?"bg-brand text-white":"bg-[#edf1f5] text-muted"}`}>{done?<Check size={12}/>:position+1}</span><strong className="text-xs">{stage.label}</strong></div><p className="mt-2 text-[10px] leading-4 text-muted">{stage.description}</p></button>})}</div>
          <div className="mt-5"><div className="flex justify-between text-[10px] font-bold"><span>Progress</span><span>{answered}/{questions.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6edf4]"><div className="h-full rounded-full bg-[#f6c945] transition-all" style={{width:`${questions.length ? Math.round(answered/questions.length*100) : 0}%`}}/></div></div>
          {answered === questions.length && !reviewing ? <button type="button" onClick={() => { setReturningToReview(false); setIndex(questions.length); }} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-3 text-xs font-bold text-white disabled:opacity-40"><Check size={15}/>Review completed discovery</button> : null}
          {siteDiscoveryId && <button type="button" onClick={() => void deleteSite()} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#efb6a7] px-3 py-2.5 text-xs font-bold text-[#b9412b] hover:bg-[#fff1ed] disabled:opacity-40"><Trash2 size={15}/>Delete Site and discovery</button>}
        </aside>

        <main>
          {!reviewing && question ? <QuestionCard
            question={question}
            value={answers[question.id]}
            profile={profile}
            sites={sites}
            selectedSiteId={typeof answers.site_id === "string" ? answers.site_id : ""}
            siteName={typeof answers.site_name === "string" ? answers.site_name : ""}
            siteLocationAnswers={answers}
            panelLocations={Array.isArray(answers.panel_location) ? answers.panel_location : []}
            panelAreaDimensions={answers.panel_area_dimensions}
            setAnswer={setAnswer}
            setRelatedAnswer={(key, relatedValue) => setAnswers((current) => ({ ...current, [key]: relatedValue }))}
            setSite={(siteId, siteName) => setAnswers((current) => ({ ...current, site_id: siteId, site_name: siteName }))}
            setSiteLocation={(location) => setAnswers((current) => ({ ...current, ...location }))}
            onAskWattson={() => openDiscoveryHelp(question)}
          /> : <Review answers={answers} questions={questions} onSelectQuestion={returnToQuestion}/>}
          {siteDiscoveryId && <div className="mt-4 rounded-xl border border-[#f1ce71] bg-[#fff9df] p-3 text-xs leading-5 text-[#725800]">This is the complete brief for this Site, including its proposed system. Saving changes flags every proposed design at this Site for review; nothing is silently overwritten.</div>}
          {error && <div className="mt-4 rounded-xl border border-[#efb6a7] bg-[#fff1ed] p-3 text-xs text-[#9b3f2c]">{error}</div>}
          <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => returningToReview ? (setReturningToReview(false), setIndex(questions.length)) : void back()} disabled={(!returningToReview && index===0) || saving} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-xs font-bold disabled:opacity-40"><ArrowLeft size={15}/>{returningToReview ? "Back to review" : "Back"}</button>{reviewing?<button type="button" onClick={() => incompleteQuestions.length ? returnToQuestion(incompleteQuestions[0].id) : void complete()} disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-xs font-bold text-white disabled:opacity-40">{incompleteQuestions.length ? <CircleHelp size={16}/> : null}{incompleteQuestions.length ? `Complete ${incompleteQuestions.length} missing answer${incompleteQuestions.length === 1 ? "" : "s"}` : "Save and build proposal"}</button>:question?<button type="button" onClick={() => void next()} disabled={!currentAnswerComplete || (question.id==="site_name" && sites.length>0 && !answers.site_id) || (question.id==="system_name" && combinedInitialSetup && (!answers.site_name || (sites.length>0 && !answers.site_id))) || saving} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-xs font-bold text-white disabled:opacity-40">{returningToReview ? "Save answer and return to review" : "Continue"}<ArrowRight size={15}/></button>:null}</div>
        </main>
      </div>
    </div>
    {helpQuestion ? <DiscoveryHelpDialog question={helpQuestion} discoveryAnswers={answers} conversationId={discoveryConversationId} discoveryDraftId={discoveryDraftId} onConversation={setDiscoveryConversationId} onSafetyDecision={(decision) => setAnswers((current) => ({ ...current, custom_battery_assessment: decision }))} siteId={siteDiscoveryId ?? (typeof answers.site_id === "string" && answers.site_id !== "__new__" ? answers.site_id : undefined)} projectId={existingSystemId} onClose={() => setHelpQuestion(undefined)}/> : null}
    {buildingProposal ? <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#f3f6fa]/95 p-6 backdrop-blur-sm"><div className="card w-full max-w-lg p-8 text-center shadow-2xl"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#eaf2fb] text-brand"><LoaderCircle className="animate-spin" size={30}/></span><div className="eyebrow mt-6">Discovery complete</div><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em]">Building your system proposal…</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Wattson is turning your confirmed requirements into the proposed system page. Nothing is being marked as purchased or installed.</p></div></div> : null}
  </div>;
}

function QuestionCard({ question, value, profile, sites, selectedSiteId, siteName, siteLocationAnswers, panelLocations, panelAreaDimensions, setAnswer, setRelatedAnswer, setSite, setSiteLocation, onAskWattson }: { question: DiscoveryQuestion; value: string | number | string[] | undefined; profile: OnboardingAnswers; sites: Array<{ id: string; name: string }>; selectedSiteId: string; siteName: string; siteLocationAnswers: DiscoveryAnswers; panelLocations: string[]; panelAreaDimensions: string | number | string[] | undefined; setAnswer: (value: string | number | string[]) => void; setRelatedAnswer: (key: string, value: string | number | string[]) => void; setSite: (siteId: string, siteName: string) => void; setSiteLocation: (location: DiscoveryAnswers) => void; onAskWattson: () => void }) {
  const unknown = value === unknownAnswer;
  const choices = question.type === "choice" || question.type === "multi_choice";
  const needsLocalAuthorityCheck = question.id === "panel_location" && Array.isArray(value) && value.some((item) => ["ground", "fence", "wall_facade", "carport_pergola"].includes(item));
  if (question.id === "system_name") {
    return <SystemSetupQuestionCard sites={sites} selectedSiteId={selectedSiteId} siteName={siteName} defaultRegion={String(profile.location ?? "")} siteLocationAnswers={siteLocationAnswers} value={value} setAnswer={setAnswer} setSite={setSite} setSiteLocation={setSiteLocation} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "site_name" && sites.length > 0) {
    return <SiteQuestionCard question={question} profile={profile} sites={sites} selectedSiteId={selectedSiteId} value={value} setSite={setSite}/>;
  }
  if (question.id === "panel_area_dimensions") {
    return <PanelDimensionsCard question={question} profile={profile} panelLocations={panelLocations} value={value} setAnswer={setAnswer} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "orientation_and_pitch") {
    return <OrientationCard question={question} profile={profile} panelLocations={panelLocations} panelAreaDimensions={panelAreaDimensions} value={value} setAnswer={setAnswer} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "panel_area_constraints") {
    return <PanelObstructionsCard question={question} profile={profile} panelLocations={panelLocations} panelAreaDimensions={panelAreaDimensions} value={value} setAnswer={setAnswer} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "structure_condition") {
    return <StructureConditionCard question={question} profile={profile} panelLocations={panelLocations} panelAreaDimensions={panelAreaDimensions} value={value} setAnswer={setAnswer} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "generator_details") {
    return <GeneratorDetailsCard question={question} profile={profile} value={value} setAnswer={setAnswer} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "pool_heating_profile") {
    return <PoolHeaterCapacityCard question={question} profile={profile} value={value} locationLabel={String(siteLocationAnswers.site_location ?? profile.location ?? "")} setAnswer={setAnswer} setRelatedAnswer={setRelatedAnswer} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "pool_equipment_ratings") {
    return <AutoSizedPoolEquipmentLoadsCard question={question} profile={profile} value={value} equipment={Array.isArray(siteLocationAnswers.pool_equipment) ? siteLocationAnswers.pool_equipment : []} heating={Array.isArray(siteLocationAnswers.pool_heating_method) ? siteLocationAnswers.pool_heating_method.filter((item) => item !== "heat_pump") : []} setAnswer={setAnswer} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "heavy_loads") {
    return <HighPowerLoadsCard question={question} profile={profile} value={value} ratingsValue={siteLocationAnswers.household_motor_ratings} setAnswer={setAnswer} setRatings={(next) => setRelatedAnswer("household_motor_ratings", next)} onAskWattson={onAskWattson}/>;
  }
  if (question.id === "household_motor_ratings") {
    const motorKeys = ["water_pump", "septic_pump", "septic_aerator", "sump_drainage_pump", "compressor"];
    const selectedMotors = Array.isArray(siteLocationAnswers.heavy_loads) ? siteLocationAnswers.heavy_loads.filter((item) => motorKeys.includes(item)) : [];
    return <AutoSizedPoolEquipmentLoadsCard question={question} profile={profile} value={value} equipment={selectedMotors} heating={[]} setAnswer={setAnswer} onAskWattson={onAskWattson}/>;
  }
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="p-6 md:p-8">{choices?<div className="grid gap-3 sm:grid-cols-2">{question.options?.map((option)=>{const currentValues=Array.isArray(value)?value:typeof value==="string"&&value!==unknownAnswer?[value]:[];const selected=question.type==="multi_choice"?currentValues.includes(option.value):value===option.value;const nextValues=option.value==="none"?["none"]:selected?currentValues.filter((item)=>item!==option.value):[...currentValues.filter((item)=>item!=="none"),option.value];const captureExisting=option.value==="existing"&&["panel_construction_interest","architecture_preference","dc_system_voltage"].includes(question.id);const assessCustomBattery=question.id==="battery_chemistry"&&option.value==="custom_home_built";const explainModuleChoice=question.id==="module_level_electronics"&&["compare","existing_mixed"].includes(option.value);return <button key={option.value} type="button" onClick={()=>{setAnswer(question.type==="multi_choice"?nextValues:option.value);if((captureExisting||assessCustomBattery||explainModuleChoice)&&!selected)onAskWattson();}} className={`rounded-2xl border p-4 text-left transition ${selected?"theme-selected-tile border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]":"border-line bg-white hover:border-[#8ab0d2]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm">{option.label}</strong>{selected&&<Check className="text-brand" size={16}/>}</div><p className="mt-2 text-[11px] leading-5 text-muted">{option.description}</p></button>})}</div>:question.id === "pool_heating_profile" && !unknown ? <PoolHeatingCalculator embedded locationLabel={String(siteLocationAnswers.site_location ?? profile.location ?? "")} onSave={setAnswer}/>:question.type==="textarea"?<textarea rows={6} disabled={unknown} value={unknown?"":String(value??"")} onChange={(event)=>setAnswer(event.target.value)} className="field mt-0 min-h-36 py-3 disabled:bg-[#eef2f6]" placeholder={unknown?"Wattson will revisit this after the questionnaire":"Type what you know…"}/>:<div className="relative"><input type={question.type} disabled={unknown} min={question.type==="number"?0:undefined} value={unknown?"":String(value??"")} onChange={(event)=>setAnswer(question.type==="number"&&event.target.value!==""?Number(event.target.value):event.target.value)} className="field mt-0 pr-28 disabled:bg-[#eef2f6]" placeholder={unknown?"Wattson will revisit this":"Type your answer"}/>{question.unit&&<span className="absolute inset-y-0 right-4 grid place-items-center text-xs font-semibold text-muted">{question.unit}</span>}</div>}
      {needsLocalAuthorityCheck && <p className="mt-4 rounded-xl border border-[#efd98e] bg-[#fff9e3] p-3 text-[11px] leading-5 text-[#765918]">Ground, fence, wall and canopy arrays might be restricted or require planning, building or other consent. Check with the relevant local authority before purchasing equipment or starting work.</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Get help now, then return and answer this question.</span></div>
    </div>
  </section>;
}

function HighPowerLoadsCard({ question, profile, value, ratingsValue, setAnswer, setRatings, onAskWattson }: { question: DiscoveryQuestion; profile: OnboardingAnswers; value: string | number | string[] | undefined; ratingsValue: string | number | string[] | undefined; setAnswer: (value: string | number | string[]) => void; setRatings: (value: string | number | string[]) => void; onAskWattson: () => void }) {
  const currentValues = Array.isArray(value) ? value : [];
  const selectedLoads = currentValues.filter((item) => item !== "none");
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="p-6 md:p-8"><div className="grid gap-3 sm:grid-cols-2">{question.options?.map((option) => { const selected = currentValues.includes(option.value); const nextValues = option.value === "none" ? ["none"] : selected ? currentValues.filter((item) => item !== option.value) : [...currentValues.filter((item) => item !== "none"), option.value]; return <button key={option.value} type="button" onClick={() => setAnswer(nextValues)} className={`rounded-2xl border p-4 text-left transition ${selected ? "theme-selected-tile border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white hover:border-[#8ab0d2]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm">{option.label}</strong>{selected && <Check className="text-brand" size={16}/>}</div><p className="mt-2 text-[11px] leading-5 text-muted">{option.description}</p></button>; })}</div>
      {selectedLoads.length ? <div className="mt-7 border-t border-line pt-7"><div className="eyebrow">Selected load ratings</div><h2 className="mt-2 font-display text-xl font-extrabold">Add the rating for these loads</h2><p className="mt-1 text-xs leading-5 text-muted">Use electrical input for most loads. For a heat pump, enter only its advertised heating capacity.</p><div className="mt-4"><AutoSizedPoolEquipmentLoadsCard question={{ id: "household_motor_ratings", stage: "needs", title: "High-power load ratings", noviceHelp: "Use the rating shown on each equipment label. Heat pumps only need their advertised heating capacity.", type: "textarea" }} profile={profile} value={ratingsValue} equipment={selectedLoads} heating={[]} setAnswer={setRatings} onAskWattson={onAskWattson}/></div></div> : null}
      {!selectedLoads.length ? <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Get help identifying which high-power loads can overlap.</span></div> : null}
    </div>
  </section>;
}

function PoolHeaterCapacityCard({ question, profile, value, locationLabel, setAnswer, setRelatedAnswer, onAskWattson }: { question: DiscoveryQuestion; profile: OnboardingAnswers; value: string | number | string[] | undefined; locationLabel: string; setAnswer: (value: string | number | string[]) => void; setRelatedAnswer: (key: string, value: string | number | string[]) => void; onAskWattson: () => void }) {
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const displayedValue = typeof value === "number" ? String(value) : typeof value === "string" ? value.match(/[\d.]+/)?.[0] ?? "" : "";
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="p-6 md:p-8">
      <label className="text-xs font-bold">Required heater output<div className="relative mt-1.5"><input type="number" min="0" step="0.1" value={displayedValue} onChange={(event) => setAnswer(event.target.value === "" ? "" : Number(event.target.value))} className="field mt-0 pr-28" placeholder="Enter heater size"/><span className="absolute inset-y-0 right-4 grid place-items-center text-xs font-semibold text-muted">kW thermal</span></div></label>
      <button type="button" onClick={() => setCalculatorOpen((open) => !open)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-brand bg-[#edf6fd] px-4 py-3 text-left text-xs font-bold text-brand"><span className="flex items-center gap-2"><Calculator size={16}/>Don&apos;t know? Calculate it here</span><ChevronDown size={16} className={`transition-transform ${calculatorOpen ? "rotate-180" : ""}`}/></button>
      {calculatorOpen ? <PoolHeatingCalculator embedded locationLabel={locationLabel} onSave={(summary, estimateDetails) => { const estimate = Number.parseFloat(summary); if (Number.isFinite(estimate)) setAnswer(estimate); setRelatedAnswer("pool_heater_electrical_kw", Number(estimateDetails.electricalKw.toFixed(2))); setRelatedAnswer("pool_heater_cop", estimateDetails.cop); setCalculatorOpen(false); }}/>:null}
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Ask for help finding a heater rating or understanding the required output.</span></div>
    </div>
  </section>;
}

const poolLoadLabels: Record<string, string> = { filtration_pump: "Filtration or circulation pump", booster_cleaner_pump: "Booster or cleaner pump", sanitation: "Sanitation equipment", spa_jet_air_pump: "Spa jet or air pump", water_feature: "Water feature or auxiliary pump", controls: "Controls and automation", heat_pump: "Heat pump or air conditioning", resistive_electric: "Electric resistance heater", spa_inline_heater: "Built-in spa-bath heater", gas: "Gas heater controls and ignition", domestic_hot_water: "Domestic hot-water supply", water_pump: "Water, bore or pressure pump", septic_pump: "Sewage or septic pump", septic_aerator: "Septic aerator or treatment blower", sump_drainage_pump: "Sump or drainage pump", compressor: "Air compressor", welder: "Welder", saw_tools: "Large saws or workshop tools", refrigeration: "Refrigerator or upright freezer", chest_freezer: "Chest freezer", electric_water: "Electric water heating", pool_heat_pump: "Pool or spa electrical heating", ev: "EV charging", electric_oven: "Electric oven", electric_cooktop: "Electric cooktop", induction: "Induction cooktop", air_fryer: "Air fryer", microwave: "Microwave" };
type HeatPumpUnit = {
  name?: string;
  model?: string;
  electricalInputKw?: number;
  electricalInputEstimated?: boolean;
  electricalInputPending?: boolean;
  coolingCapacityKw?: number;
  heatingCapacityKw?: number;
  heatingCapacityUnit?: "kW" | "W";
  averageInputWatts?: number;
  averageInputEstimated?: boolean;
  thermalCapacityKw?: number;
  startingKw?: number;
};
type PoolLoadEntry = { quantity?: number; runningKw?: number; peakRunningKw?: number; startingKw?: number; simultaneous?: boolean; startingBasis?: "automatic" | "manufacturer"; inputAmps?: number; voltageV?: number; phase?: "single" | "three"; welderTechnology?: "inverter" | "transformer"; dutyCyclePercent?: number; inputKva?: number; units?: HeatPumpUnit[] };

function PoolEquipmentLoadsCard({ question, profile, value, equipment, heating, setAnswer, onAskWattson }: { question: DiscoveryQuestion; profile: OnboardingAnswers; value: string | number | string[] | undefined; equipment: string[]; heating: string[]; setAnswer: (value: string | number | string[]) => void; onAskWattson: () => void }) {
  let saved: Record<string, PoolLoadEntry> = {};
  if (typeof value === "string") { try { saved = JSON.parse(value) as Record<string, PoolLoadEntry>; } catch { saved = {}; } }
  const selected = Array.from(new Set([...equipment, ...heating].filter((item) => item && item !== "none")));
  const update = (key: string, field: keyof PoolLoadEntry, raw: string | boolean) => { const current = saved[key] ?? {}; const nextValue = typeof raw === "boolean" ? raw : raw === "" ? undefined : Number(raw); setAnswer(JSON.stringify({ ...saved, [key]: { ...current, [field]: nextValue } })); };
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><Bot size={17}/><p className="text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div>
    <div className="p-6 md:p-8"><textarea rows={8} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(event.target.value)} className="field mt-0" placeholder="Example: filtration pump — 1.1 kW running, 2.5 kW starting"/><div className="mt-4 flex items-center gap-3"><button type="button" onClick={onAskWattson} className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white">Ask Wattson</button><span className="text-[11px] text-muted">A clear photo of each rating label can help identify these values.</span></div></div>
  </section>;
}

function StructuredPoolEquipmentLoadsCard({ question, profile, value, equipment, heating, setAnswer, onAskWattson }: { question: DiscoveryQuestion; profile: OnboardingAnswers; value: string | number | string[] | undefined; equipment: string[]; heating: string[]; setAnswer: (value: string | number | string[]) => void; onAskWattson: () => void }) {
  let saved: Record<string, PoolLoadEntry> = {};
  if (typeof value === "string") { try { saved = JSON.parse(value) as Record<string, PoolLoadEntry>; } catch { saved = {}; } }
  const selected = Array.from(new Set([...equipment, ...heating].filter((item) => item && item !== "none")));
  const update = (key: string, field: keyof PoolLoadEntry, raw: string | boolean) => { const current = saved[key] ?? {}; const nextValue = typeof raw === "boolean" ? raw : raw === "" ? undefined : Number(raw); setAnswer(JSON.stringify({ ...saved, [key]: { ...current, [field]: nextValue } })); };
  return <section className="card overflow-hidden bg-white"><div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><Bot size={17}/><p className="text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div><div className="grid gap-4 p-6 md:grid-cols-2 md:p-8">{selected.length ? selected.map((key) => { const row = saved[key] ?? {}; return <article key={key} className="rounded-2xl border border-line bg-[#f8fbfe] p-4"><div className="flex items-start justify-between gap-3"><strong className="text-sm">{poolLoadLabels[key] ?? key.replaceAll("_", " ")}</strong><span className="rounded-full bg-[#eaf2fb] px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-brand">Electrical input</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-[11px] font-bold">Quantity<input type="number" min="1" step="1" value={row.quantity ?? 1} onChange={(event) => update(key, "quantity", event.target.value)} className="field mt-1.5"/></label><label className="text-[11px] font-bold">Running kW<input type="number" min="0" step="0.01" value={row.runningKw ?? ""} onChange={(event) => update(key, "runningKw", event.target.value)} placeholder="e.g. 1.1" className="field mt-1.5"/></label><label className="text-[11px] font-bold">Starting kW<input type="number" min="0" step="0.01" value={row.startingKw ?? ""} onChange={(event) => update(key, "startingKw", event.target.value)} placeholder="if known" className="field mt-1.5"/></label></div><label className="mt-3 flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" checked={row.simultaneous ?? true} onChange={(event) => update(key, "simultaneous", event.target.checked)} className="size-4 accent-[#23679e]"/> May run at the same time as the other selected loads</label></article>; }) : <p className="rounded-xl border border-[#efd98e] bg-[#fff9e3] p-4 text-xs leading-5 text-[#765918] md:col-span-2">Select the pool equipment first. Wattson will then show one rating card for each selected item.</p>}<div className="flex flex-wrap items-center gap-3 md:col-span-2"><button type="button" onClick={onAskWattson} className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white">Ask Wattson</button><span className="text-[11px] text-muted">A clear photo of each rating label can help identify these values.</span></div></div></section>;
}

function poolStartingMultiplier(key: string) {
  if (["filtration_pump", "booster_cleaner_pump", "spa_jet_air_pump", "water_feature", "water_pump", "septic_pump", "septic_aerator", "sump_drainage_pump", "compressor", "saw_tools", "refrigeration", "chest_freezer"].includes(key)) return 3;
  if (["heat_pump", "pool_heat_pump"].includes(key)) return 2.5;
  return 1;
}

function AutoSizedPoolEquipmentLoadsCard({ question, profile, value, equipment, heating, setAnswer, onAskWattson }: { question: DiscoveryQuestion; profile: OnboardingAnswers; value: string | number | string[] | undefined; equipment: string[]; heating: string[]; setAnswer: (value: string | number | string[]) => void; onAskWattson: () => void }) {
  let saved: Record<string, PoolLoadEntry> = {};
  if (typeof value === "string") { try { saved = JSON.parse(value) as Record<string, PoolLoadEntry>; } catch { saved = {}; } }
  const selected = Array.from(new Set([...equipment, ...heating].filter((item) => item && item !== "none")));
  const saveEntry = (key: string, changes: Partial<PoolLoadEntry>) => setAnswer(JSON.stringify({ ...saved, [key]: { quantity: 0, simultaneous: true, ...saved[key], ...changes } }));
  const numberValue = (raw: string) => raw === "" ? undefined : Number(raw);
  const updateRunning = (key: string, raw: string) => {
    const runningKw = numberValue(raw);
    const startingKw = runningKw === undefined ? undefined : Number((runningKw * poolStartingMultiplier(key)).toFixed(2));
    const quantity = runningKw !== undefined && runningKw > 0 && (saved[key]?.quantity ?? 0) === 0 ? 1 : saved[key]?.quantity;
    saveEntry(key, { runningKw, startingKw, startingBasis: "automatic", quantity });
  };
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><Bot size={17}/><p className="text-xs leading-5 text-muted">Use the rating shown on each label. For heat pumps, enter only the advertised heating capacity; PVIntell handles the planning conversion.</p></div></div>
    <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8">
      <div className="flex flex-wrap items-center gap-3 md:col-span-2"><button type="button" onClick={onAskWattson} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Photograph a label with Wattson</button><span className="text-[11px] text-muted">Wattson will read the model and the usable rating fields, and tell you if another label is needed.</span></div>
      {selected.length ? selected.map((key) => {
        const row = saved[key] ?? {};
        const multiplier = poolStartingMultiplier(key);
        const estimatedStart = row.startingKw ?? (row.runningKw ? Number((row.runningKw * multiplier).toFixed(2)) : undefined);
        return <article key={key} className="rounded-2xl border border-line bg-[#f8fbfe] p-4">
          <strong className="text-sm">{poolLoadLabels[key] ?? key.replaceAll("_", " ")}</strong>
          {key === "welder" ? <WelderRatingFields row={row} save={(changes) => saveEntry(key, changes)}/> : key === "heat_pump" ? <HeatPumpRatingFields row={row} save={(changes) => saveEntry(key, changes)}/> : <><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold">Quantity<input type="number" min="0" step="1" value={row.quantity ?? 0} onChange={(event) => saveEntry(key, { quantity: numberValue(event.target.value) })} className="field mt-1.5"/></label><label className="text-[11px] font-bold">{key === "pool_heat_pump" ? "Rated electrical input" : "Running electrical input"}<input type="number" min="0" step="0.01" value={row.runningKw ?? ""} onChange={(event) => updateRunning(key, event.target.value)} placeholder="From equipment label" className="field mt-1.5"/><span className="mt-1 block text-[9px] font-normal text-muted">kW{key === "pool_heat_pump" ? " input — not heating output capacity" : ""}</span></label></div>
          <div className="mt-3 rounded-xl border border-[#b8d7f1] bg-[#eef6fd] p-3"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-brand">{multiplier > 1 ? "Wattson startup estimate" : "Planning input"}</span><strong className="mt-1 block text-sm">{estimatedStart === undefined ? "Enter running kW" : `${estimatedStart} kW`}</strong><span className="mt-1 block text-[9px] leading-4 text-muted">{multiplier > 1 ? <>Uses a {multiplier}× planning factor for this motor or compressor load. A variable-speed drive or soft starter may reduce it.</> : "No generic motor-start multiplier is applied; confirm the manufacturer's maximum electrical input when available."}</span></div></>}
          <label className="mt-3 flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" checked={row.simultaneous ?? true} onChange={(event) => saveEntry(key, { simultaneous: event.target.checked })} className="size-4 accent-[#23679e]"/> May run with the other selected loads</label>
          {!["welder", "heat_pump"].includes(key) ? <details className="mt-3 rounded-xl border border-line bg-white p-3"><summary className="cursor-pointer text-[10px] font-bold text-brand">I have the manufacturer’s maximum or starting value</summary><label className="mt-3 block text-[10px] font-bold">Starting or maximum input (kW)<input type="number" min="0" step="0.01" value={row.startingBasis === "manufacturer" ? row.startingKw ?? "" : ""} onChange={(event) => saveEntry(key, { startingKw: numberValue(event.target.value), startingBasis: event.target.value === "" ? "automatic" : "manufacturer" })} className="field mt-1.5"/></label></details> : null}
        </article>;
      }) : <p className="rounded-xl border border-[#efd98e] bg-[#fff9e3] p-4 text-xs leading-5 text-[#765918] md:col-span-2">Select the pool equipment first. Wattson will then show one rating card for each selected item.</p>}
    </div>
  </section>;
}

function WelderRatingFields({ row, save }: { row: PoolLoadEntry; save: (changes: Partial<PoolLoadEntry>) => void }) {
  const calculate = (changes: Partial<PoolLoadEntry>) => {
    const next = { ...row, ...changes };
    const inputKva = next.inputAmps && next.voltageV ? Number((((next.phase === "three" ? Math.sqrt(3) : 1) * next.inputAmps * next.voltageV) / 1000).toFixed(2)) : undefined;
    save({ ...changes, inputKva, quantity: next.quantity && next.quantity > 0 ? next.quantity : 1 });
  };
  return <div className="mt-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold">Quantity<input type="number" min="1" step="1" value={row.quantity ?? 1} onChange={(event) => save({ quantity: Number(event.target.value) })} className="field mt-1.5"/></label><label className="text-[11px] font-bold">Welder type<select value={row.welderTechnology ?? ""} onChange={(event) => calculate({ welderTechnology: event.target.value as PoolLoadEntry["welderTechnology"] })} className="field mt-1.5"><option value="">Choose type</option><option value="inverter">Inverter welder</option><option value="transformer">Conventional transformer welder</option></select></label><label className="text-[11px] font-bold">Rated supply input current<input type="number" min="0" step="0.1" value={row.inputAmps ?? ""} onChange={(event) => calculate({ inputAmps: event.target.value === "" ? undefined : Number(event.target.value) })} className="field mt-1.5"/><span className="mt-1 block text-[9px] font-normal text-muted">A — use input current, not welding-output amps</span></label><label className="text-[11px] font-bold">Supply voltage<input type="number" min="0" step="1" value={row.voltageV ?? ""} onChange={(event) => calculate({ voltageV: event.target.value === "" ? undefined : Number(event.target.value) })} className="field mt-1.5"/><span className="mt-1 block text-[9px] font-normal text-muted">V</span></label><label className="text-[11px] font-bold">Supply phase<select value={row.phase ?? "single"} onChange={(event) => calculate({ phase: event.target.value as PoolLoadEntry["phase"] })} className="field mt-1.5"><option value="single">Single-phase</option><option value="three">Three-phase</option></select></label><label className="text-[11px] font-bold">Duty cycle <span className="font-normal text-muted">(if known)</span><input type="number" min="0" max="100" step="1" value={row.dutyCyclePercent ?? ""} onChange={(event) => save({ dutyCyclePercent: event.target.value === "" ? undefined : Number(event.target.value) })} className="field mt-1.5"/><span className="mt-1 block text-[9px] font-normal text-muted">%</span></label></div><div className="mt-3 rounded-xl border border-[#b8d7f1] bg-[#eef6fd] p-3"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-brand">Calculated apparent input</span><strong className="mt-1 block text-sm">{row.inputKva ? `${row.inputKva} kVA` : "Enter supply amps and voltage"}</strong><span className="mt-1 block text-[9px] leading-4 text-muted">This is a supply-side planning value. Wattson must still account for welder type, power factor, maximum input and duty cycle before inverter selection.</span></div></div>;
}

function HeatPumpRatingFields({ row, save }: { row: PoolLoadEntry; save: (changes: Partial<PoolLoadEntry>) => void }) {
  const units = row.units?.length ? row.units : [{ name: "Heat pump 1" }];
  const saveUnits = (next: HeatPumpUnit[]) => {
    const averageRunningKw = Number(next.reduce((sum, unit) => sum + (unit.averageInputWatts !== undefined ? unit.averageInputWatts / 1000 : unit.electricalInputKw ?? 0), 0).toFixed(2));
    save({ units: next, quantity: 1, runningKw: averageRunningKw || undefined, peakRunningKw: undefined, startingKw: undefined, startingBasis: "automatic" });
  };
  const update = (index: number, changes: Partial<HeatPumpUnit>) => saveUnits(units.map((unit, position) => position === index ? { ...unit, ...changes } : unit));
  const updateHeatingCapacity = (index: number, raw: string, unitName = units[index]?.heatingCapacityUnit ?? "kW") => {
    const labelValue = raw === "" ? undefined : Number(raw);
    const heatingCapacityKw = labelValue === undefined ? undefined : unitName === "W" ? labelValue / 1000 : labelValue;
    const current = units[index];
    const shouldEstimateAverage = !current?.averageInputWatts || current.averageInputEstimated === true;
    update(index, {
      heatingCapacityKw,
      heatingCapacityUnit: unitName,
      ...(shouldEstimateAverage ? {
        averageInputWatts: heatingCapacityKw ? Math.round((heatingCapacityKw / 5) * 1000) : undefined,
        averageInputEstimated: heatingCapacityKw !== undefined,
        electricalInputKw: heatingCapacityKw ? Number((heatingCapacityKw / 5).toFixed(2)) : undefined,
        electricalInputEstimated: heatingCapacityKw !== undefined,
        electricalInputPending: heatingCapacityKw === undefined ? current?.electricalInputPending : false,
      } : {}),
    });
  };
  return <div className="mt-4 space-y-3">
    {units.map((unit, index) => <div key={index} className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-3"><input value={unit.name ?? `Heat pump ${index + 1}`} onChange={(event) => update(index, { name: event.target.value })} aria-label={`Heat pump ${index + 1} name`} className="min-w-0 flex-1 bg-transparent text-[11px] font-bold outline-none"/>{units.length > 1 ? <button type="button" onClick={() => saveUnits(units.filter((_, position) => position !== index))} className="text-[10px] font-bold text-[#a7442d]">Remove</button> : null}</div>
      <label className="mt-3 block text-[10px] font-bold">Heating capacity<div className="flex gap-2"><input type="number" min="0" step="0.1" value={unit.heatingCapacityKw === undefined ? "" : unit.heatingCapacityUnit === "W" ? unit.heatingCapacityKw * 1000 : unit.heatingCapacityKw} onChange={(event) => updateHeatingCapacity(index, event.target.value)} className="field mt-1.5"/><select value={unit.heatingCapacityUnit ?? "kW"} onChange={(event) => { const nextUnit = event.target.value as "kW" | "W"; const shownValue = unit.heatingCapacityKw === undefined ? "" : nextUnit === "W" ? String(unit.heatingCapacityKw * 1000) : String(unit.heatingCapacityKw); updateHeatingCapacity(index, shownValue, nextUnit); }} className="field mt-1.5 w-20"><option value="kW">kW</option><option value="W">W</option></select></div></label>
    </div>)}
    <button type="button" onClick={() => saveUnits([...units, { name: `Heat pump ${units.length + 1}` }])} className="inline-flex items-center gap-2 rounded-xl border border-brand bg-white px-3 py-2 text-[10px] font-bold text-brand"><Plus size={13}/>Add another heat pump</button>
  </div>;
}

type GeneratorDetails = {
  purchaseStatus: string;
  generatorType: string;
  fuel: string;
  continuousRating: string;
  surgeRating: string;
  ratingUnit: string;
  inverterType: string;
  voltage: string;
  phase: string;
  startMethod: string;
  connectionMethod: string;
};

const emptyGeneratorDetails: GeneratorDetails = {
  purchaseStatus: "", generatorType: "", fuel: "", continuousRating: "", surgeRating: "", ratingUnit: "kW",
  inverterType: "", voltage: "", phase: "", startMethod: "", connectionMethod: "",
};

function generatorDetailsValue(value: string | number | string[] | undefined): GeneratorDetails {
  if (typeof value !== "string" || value === unknownAnswer) return emptyGeneratorDetails;
  try { return { ...emptyGeneratorDetails, ...(JSON.parse(value) as Partial<GeneratorDetails>) }; }
  catch { return emptyGeneratorDetails; }
}

function GeneratorDetailsCard({ question, profile, value, setAnswer, onAskWattson }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
  onAskWattson: () => void;
}) {
  const details = generatorDetailsValue(value);
  const update = (key: keyof GeneratorDetails, nextValue: string) => setAnswer(JSON.stringify({ ...details, [key]: nextValue }));
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="p-6 md:p-8">
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => update("purchaseStatus", "not_purchased")} className={`rounded-2xl border p-4 text-left ${details.purchaseStatus === "not_purchased" ? "border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white"}`}><strong className="text-sm">Haven&apos;t purchased one yet</strong><p className="mt-2 text-[11px] leading-5 text-muted">Continue without make, model or ratings. Wattson will carry a generator size target into the proposal and schematic for later selection.</p></button>
        <button type="button" onClick={() => update("purchaseStatus", "have_details")} className={`rounded-2xl border p-4 text-left ${details.purchaseStatus === "have_details" || (!details.purchaseStatus && details.generatorType) ? "border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white"}`}><strong className="text-sm">I have or have chosen a generator</strong><p className="mt-2 text-[11px] leading-5 text-muted">Use its rating label to record the real generator and connection requirements.</p></button>
      </div>
      {details.purchaseStatus === "not_purchased" ? <div className="mb-5 rounded-xl border border-[#9bd2ad] bg-[#f2fbf5] p-4 text-[11px] leading-5 text-[#17603b]"><strong>Generator included as a proposed item.</strong> Its continuous and surge targets will be sized from the recorded high-power loads, inverter and battery-charging needs. The exact generator still needs compatibility and connection checks before purchase.</div> : null}
      <div className="mb-5 rounded-xl border border-[#9bd2ad] bg-[#f2fbf5] p-3 text-[11px] leading-5 text-[#17603b]"><strong>Quick tip:</strong> Take a clear photo of the generator rating label. Use the label—or share the photo with Wattson where photo upload is available—to fill these fields accurately.</div>
      <div className={`${details.purchaseStatus === "not_purchased" ? "hidden" : "grid"} gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
        <GeneratorSelect label="Generator type" value={details.generatorType} onChange={(next) => update("generatorType", next)} options={[["portable", "Portable"], ["fixed_standby", "Fixed standby"], ["pto", "Tractor/PTO"], ["vehicle_mounted", "Vehicle-mounted"], ["other", "Other"]]}/>
        <GeneratorSelect label="Fuel" value={details.fuel} onChange={(next) => update("fuel", next)} options={[["petrol", "Petrol/gasoline"], ["diesel", "Diesel"], ["lpg", "LPG/propane"], ["natural_gas", "Natural gas"], ["dual_fuel", "Dual or multi-fuel"], ["other", "Other"]]}/>
        <GeneratorSelect label="Generator technology" value={details.inverterType} onChange={(next) => update("inverterType", next)} options={[["inverter", "Inverter generator"], ["conventional", "Conventional generator"]]}/>
        <label className="text-xs font-bold">Continuous rating<div className="flex gap-2"><input type="number" min="0" step="any" value={details.continuousRating} onChange={(event) => update("continuousRating", event.target.value)} className="field mt-1.5"/><select value={details.ratingUnit} onChange={(event) => update("ratingUnit", event.target.value)} className="field mt-1.5 w-24"><option value="kW">kW</option><option value="kVA">kVA</option></select></div></label>
        <label className="text-xs font-bold">Surge rating <span className="font-normal text-muted">(optional)</span><div className="relative"><input type="number" min="0" step="any" value={details.surgeRating} onChange={(event) => update("surgeRating", event.target.value)} className="field mt mt-1.5 pr pr-14"/><span className="absolute-events-none absolute inset inset inset inset-y--y--y-0 right right0 right right-3 text-[10px] font-semibold text-muted">{details.ratingUnit}</span></div></label>
        <GeneratorSelect label="Output voltage" value={details.voltage} onChange={(next) => update("voltage", next)} options={[["100", "100 V"], ["110_120", "110-120 V"], ["200_240", "200-240 V"], ["380_415", "380-415 V"], ["440_480", "440-480 V"], ["other", "Other"]]}/>
        <GeneratorSelect label="Phase" value={details.phase} onChange={(next) => update("phase", next)} options={[["single", "Single-phase"], ["split", "Split-phase"], ["three", "Three-phase"]]}/>
        <GeneratorSelect label="Starting method" value={details.startMethod} onChange={(next) => update("startMethod", next)} options={[["manual", "Manual/recoil"], ["electric", "Electric key/button"], ["automatic", "Automatic/remote start"]]}/>
        <GeneratorSelect label="Connection method" value={details.connectionMethod} onChange={(next) => update("connectionMethod", next)} options={[["changeover", "Manual changeover"], ["ats", "Automatic transfer switch"], ["inverter_input", "Generator input on inverter"], ["portable_inlet", "Portable generator inlet"], ["direct_wired", "Direct-wired connection"]]}/>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Share a rating-label photo or ask for help identifying any field.</span></div>
    </div>
  </section>;
}

function GeneratorSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="field mt-1.5"><option value="">Choose an option</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

type PanelArea = { id: string; name: string; lengthM: string; widthM: string };
type PanelOrientation = { id: string; name: string; direction: string; slope: string };
type StructureCondition = { id: string; name: string; material: string; age: string; condition: string; constructionDetail?: string };
type PanelObstruction = { id: string; areaId: string; kind: string; lengthM: string; widthM: string };

function discoveryAnswerComplete(questionId: string, value: string | number | string[] | undefined) {
  const unresolvedValues = new Set([unknownAnswer, "unknown", "not_checked", "not_decided", "undecided", "unknown_chemistry"]);
  if (typeof value === "string" && unresolvedValues.has(value)) return false;
  if (Array.isArray(value) && value.some((item) => unresolvedValues.has(item))) return false;
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return false;
  if (questionId === "panel_area_dimensions" && typeof value === "string") {
    try {
      const areas = JSON.parse(value) as PanelArea[];
      return areas.length > 0 && areas.every((area) => area.name.trim() && Number(area.lengthM) > 0 && Number(area.widthM) > 0);
    } catch { return false; }
  }
  if (questionId === "generator_details" && typeof value === "string") {
    try {
      const generator = JSON.parse(value) as GeneratorDetails;
      if (generator.purchaseStatus === "not_purchased") return true;
      return Boolean(generator.generatorType && generator.fuel && Number(generator.continuousRating) > 0 && generator.ratingUnit && generator.inverterType && generator.voltage && generator.phase && generator.startMethod && generator.connectionMethod);
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

function highPowerLoadRatingsComplete(value: string | number | string[] | undefined, selectedLoads: string[]) {
  if (!selectedLoads.length) return true;
  if (typeof value !== "string") return false;
  try {
    const ratings = JSON.parse(value) as Record<string, PoolLoadEntry>;
    return selectedLoads.every((key) => {
      const row = ratings[key];
      if (!row || Number(row.quantity) <= 0) return false;
      if (key === "welder") return Number(row.inputAmps) > 0 && Number(row.voltageV) > 0 && Boolean(row.welderTechnology);
      if (key === "heat_pump") return Boolean(row.units?.length) && row.units!.every((unit) => Number(unit.electricalInputKw) > 0 || (unit.electricalInputPending === true && Boolean(unit.model?.trim() || unit.coolingCapacityKw || unit.heatingCapacityKw || unit.thermalCapacityKw)));
      return Number(row.runningKw) > 0;
    });
  } catch { return false; }
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

function PanelDimensionsCard({ question, profile, panelLocations, value, setAnswer, onAskWattson }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  panelLocations: string[];
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
  onAskWattson: () => void;
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
        return <div key={area.id} className="theme-subtle-surface grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-xs font-bold"><span>Area name</span><input value={area.name} onChange={(event) => updateArea(area.id, "name", event.target.value)} className="field mt-0" placeholder={`Panel area ${index + 1}`}/></label>
          <label className="space-y-1.5 text-xs font-bold"><span>Usable length</span><div className="relative"><input type="number" min="0" step="0.1" value={area.lengthM} onChange={(event) => updateArea(area.id, "lengthM", event.target.value)} className="field mt-0 pr-10" placeholder="0.0"/><span className="absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">m</span></div></label>
          <label className="space-y-1.5 text-xs font-bold"><span>Usable width</span><div className="relative"><input type="number" min="0" step="0.1" value={area.widthM} onChange={(event) => updateArea(area.id, "widthM", event.target.value)} className="field mt-0 pr-10" placeholder="0.0"/><span className="absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">m</span></div></label>
          <div className="flex items-center justify-between gap-3 md:block"><span className="text-[11px] font-semibold text-muted">{areaM2 > 0 ? `${areaM2.toFixed(1)} m²` : "Area —"}</span><button type="button" disabled={areas.length === 1} onClick={() => saveAreas(areas.filter((item) => item.id !== area.id))} className="ml-3 rounded-lg border border-line p-2 text-muted disabled:opacity-30" aria-label={`Remove ${area.name}`}><Trash2 size={15}/></button></div>
        </div>;
      })}
      {!unknown && <button type="button" onClick={() => saveAreas([...areas, { id: `area-${Date.now()}`, name: `Panel area ${areas.length + 1}`, lengthM: "", widthM: "" }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-brand"><Plus size={15}/>Add another panel area</button>}
      <div className="flex flex-wrap items-center gap-3 pt-2"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text?">Wattson can help you measure or identify what a useful photo should show.</span></div>
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
  ["west", "West (270°)"], ["north_west", "North-west (315°)"], ["flat", "Flat / no facing direction"],
] as const;

const slopeOptions = [
  ["flat", "Flat (0–5°)"], ["low", "Low slope (6–20°)"], ["medium", "Medium slope (21–35°)"],
  ["steep", "Steep (36–60°)"], ["very_steep", "Very steep (61–89°)"], ["vertical", "Vertical (90°)"],
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

function OrientationCard({ question, profile, panelLocations, panelAreaDimensions, value, setAnswer, onAskWattson }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  panelLocations: string[];
  panelAreaDimensions: string | number | string[] | undefined;
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
  onAskWattson: () => void;
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
      {!unknown && orientations.map((area) => <div key={area.id} className="theme-subtle-surface grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 md:grid-cols-[1.2fr_1fr_1fr] md:items-end">
        <div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Panel area</span><div className="mt-2 text-sm font-extrabold">{area.name}</div></div>
        <label className="space-y-1.5 text-xs font-bold"><span>Facing direction</span><select value={area.direction} onChange={(event) => update(area.id, "direction", event.target.value)} className="field mt-0"><option value="">Choose direction</option>{area.id.startsWith("ground-") ? <option value="open">Open — direction can be selected or suggested</option> : null}{directionOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-bold"><span>Existing surface slope</span><select value={area.slope} onChange={(event) => update(area.id, "slope", event.target.value)} className="field mt-0"><option value="">Choose slope</option>{slopeOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
      </div>)}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Wattson can help identify direction and slope now.</span></div>
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

function PanelObstructionsCard({ question, profile, panelLocations, panelAreaDimensions, value, setAnswer, onAskWattson }: { question: DiscoveryQuestion; profile: OnboardingAnswers; panelLocations: string[]; panelAreaDimensions: string | number | string[] | undefined; value: string | number | string[] | undefined; setAnswer: (value: string | number | string[]) => void; onAskWattson: () => void }) {
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
      {!unknown && items.filter((item) => item.kind !== "none").map((item) => <div key={item.id} className="theme-subtle-surface grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 md:grid-cols-[1.2fr_1.35fr_1fr_1fr_auto] md:items-end"><label className="space-y-1.5 text-xs font-bold"><span>Panel area</span><select value={item.areaId} onChange={(event) => update(item.id, "areaId", event.target.value)} className="field mt-0">{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-bold"><span>Obstruction</span><select value={item.kind} onChange={(event) => update(item.id, "kind", event.target.value)} className="field mt-0"><option value="">Choose type</option>{obstructionTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="space-y-1.5 text-xs font-bold"><span>Length (m)</span><input type="number" min="0" step="0.1" value={item.lengthM} onChange={(event) => update(item.id, "lengthM", event.target.value)} className="field mt-0"/></label><label className="space-y-1.5 text-xs font-bold"><span>Width (m)</span><input type="number" min="0" step="0.1" value={item.widthM} onChange={(event) => update(item.id, "widthM", event.target.value)} className="field mt-0"/></label><button type="button" onClick={() => save(items.filter((entry) => entry.id !== item.id))} className="rounded-lg border border-line p-2 text-muted hover:text-[#b9412b]" aria-label="Remove obstruction"><Trash2 size={15}/></button></div>)}
      {!unknown && items.some((item) => item.kind === "none") && <div className="rounded-xl bg-[#f1faf5] p-4 text-xs font-semibold text-[#17603b]">No known obstructions recorded. This can be changed later.</div>}
      {!unknown && <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-brand"><Plus size={15}/>Add obstruction</button><button type="button" onClick={() => save([{ id: "none", areaId: "", kind: "none", lengthM: "", widthM: "" }])} className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-muted">No known obstructions</button>{total > 0 && <span className="text-xs font-semibold text-muted">Known area to exclude: {total.toFixed(1)} m²</span>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Get help identifying and measuring obstructions before continuing.</span></div>
    </div>
  </section>;
}

const structureMaterialOptions = [
  ["corrugated_metal", "Corrugated or trapezoidal metal roof"], ["standing_seam", "Standing-seam metal roof"],
  ["tile", "Tile roof"], ["shingle", "Shingle roof"], ["membrane", "Flat membrane roof"],
  ["concrete", "Concrete roof or slab"], ["timber", "Timber structure"], ["steel", "Steel structure or frame"],
  ["wall", "Wall or façade"], ["fence", "Fence or vertical screen"], ["ground", "Ground area — frame not selected"],
  ["mobile", "Vehicle, boat or movable surface"], ["other", "Other / not listed"],
] as const;

const structureAgeOptions = [
  ["new", "New or under 5 years"], ["5_15", "About 5–15 years"], ["16_30", "About 16–30 years"],
  ["over_30", "More than 30 years"], ["not_built", "Not built or not applicable"],
] as const;

const structureConditionOptions = [
  ["good", "Good — no known damage"], ["serviceable", "Weathered but serviceable"],
  ["repair_needed", "Repairs may be needed"], ["replacement_planned", "Replacement or rebuilding is planned"],
] as const;

const groundSurfaceOptions = [
  ["grass", "Grass or pasture"], ["bare_soil", "Bare soil or dirt"],
  ["gravel", "Gravel or compacted aggregate"], ["cleared", "Cleared or prepared area"],
  ["structural_slab", "Structural slab or foundation"], ["patio_drive_slab", "Patio or driveway slab"],
  ["concrete_pavers", "Concrete pavers"], ["asphalt_hardstand", "Asphalt or other hardstand"],
  ["concrete_paved", "Concrete or paved area — construction unknown"], ["rocky", "Rocky ground"],
] as const;

const groundConditionOptions = [
  ["firm_dry", "Firm and generally dry"], ["soft_wet", "Soft or wet ground"],
  ["flood_prone", "Flood-prone or poor drainage"], ["rough_obstructed", "Rough or obstructed"],
] as const;

const pavedConditionOptions = [
  ["sound_level", "Sound and generally level"], ["cracked_damaged", "Cracked or damaged"],
  ["uneven_settled", "Uneven or settled"], ["poor_drainage", "Poor drainage or water pooling"],
  ["unknown", "Condition not yet checked"],
] as const;

const hardSurfaceMaterials = new Set(["structural_slab", "patio_drive_slab", "concrete_pavers", "asphalt_hardstand", "concrete_paved"]);

function structureConditions(value: string | number | string[] | undefined, areas: PanelArea[]): StructureCondition[] {
  if (typeof value === "string" && value !== unknownAnswer) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const saved = parsed.filter((item): item is StructureCondition => Boolean(item && typeof item === "object" && "id" in item && "name" in item));
        if (saved.length) return areas.map((area) => {
          const match = saved.find((item) => item.id === area.id || item.name === area.name);
          return match ? { id: area.id, name: area.name, material: String(match.material ?? ""), age: area.id.startsWith("ground-") ? "not_applicable" : String(match.age ?? ""), condition: String(match.condition ?? ""), constructionDetail: String(match.constructionDetail ?? "") } : { id: area.id, name: area.name, material: "", age: area.id.startsWith("ground-") ? "not_applicable" : "", condition: "", constructionDetail: "" };
        });
      }
    } catch {
      // Older free-text answers are replaced by the structured selectors below.
    }
  }
  return areas.map((area) => ({ id: area.id, name: area.name, material: "", age: area.id.startsWith("ground-") ? "not_applicable" : "", condition: "", constructionDetail: "" }));
}

function StructureConditionCard({ question, profile, panelLocations, panelAreaDimensions, value, setAnswer, onAskWattson }: {
  question: DiscoveryQuestion;
  profile: OnboardingAnswers;
  panelLocations: string[];
  panelAreaDimensions: string | number | string[] | undefined;
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
  onAskWattson: () => void;
}) {
  const unknown = value === unknownAnswer;
  const areas = panelAreas(panelAreaDimensions, panelLocations);
  const structures = structureConditions(value, areas);
  const update = (id: string, field: "material" | "age" | "condition" | "constructionDetail", fieldValue: string) => setAnswer(JSON.stringify(structures.map((area) => area.id === id ? { ...area, [field]: fieldValue } : area)));
  const updateMaterial = (id: string, material: string) => setAnswer(JSON.stringify(structures.map((area) => area.id === id ? { ...area, material, condition: "", constructionDetail: "" } : area)));
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">{question.stage}</div><h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">{question.title}</h1><div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span><div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">{helpForExperience(question, profile)}</p></div></div></div>
    <div className="space-y-3 p-6 md:p-8">
      {!unknown && structures.map((area) => { const groundArea = area.id.startsWith("ground-"); const hardSurface = groundArea && hardSurfaceMaterials.has(area.material); return <div key={area.id} className={`theme-subtle-surface grid gap-3 rounded-2xl border border-line bg-[#fbfcfe] p-4 lg:items-end ${groundArea ? hardSurface ? "lg:grid-cols-[1fr_1.15fr_1.25fr_1.15fr]" : "lg:grid-cols-[1.1fr_1.4fr_1.2fr]" : "lg:grid-cols-[1.1fr_1.4fr_1fr_1.2fr]"}`}>
        <div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Possible area</span><div className="mt-2 text-sm font-extrabold">{area.name}</div></div>
        <label className="space-y-1.5 text-xs font-bold"><span>{groundArea ? "Ground surface" : "Surface or support type"}</span><select value={area.material} onChange={(event) => groundArea ? updateMaterial(area.id, event.target.value) : update(area.id, "material", event.target.value)} className="field mt-0"><option value="">Choose type</option>{(groundArea ? groundSurfaceOptions : structureMaterialOptions).map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
        {hardSurface && <label className="space-y-1.5 text-xs font-bold"><span>Construction or thickness</span><input value={area.constructionDetail ?? ""} onChange={(event) => update(area.id, "constructionDetail", event.target.value)} className="field mt-0" placeholder="e.g. 100 mm, reinforced, unknown"/></label>}
        {!groundArea && <label className="space-y-1.5 text-xs font-bold"><span>Approximate age</span><select value={area.age} onChange={(event) => update(area.id, "age", event.target.value)} className="field mt-0"><option value="">Choose age</option>{structureAgeOptions.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>}
        <label className="space-y-1.5 text-xs font-bold"><span>{groundArea ? hardSurface ? "Hard-surface condition" : "Ground condition" : "Current condition"}</span><select value={area.condition} onChange={(event) => update(area.id, "condition", event.target.value)} className="field mt-0"><option value="">Choose condition</option>{(groundArea ? hardSurface ? pavedConditionOptions : groundConditionOptions : structureConditionOptions).map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></label>
      </div>; })}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Wattson can explain what to inspect and what evidence is useful.</span></div>
    </div>
  </section>;
}

type LocationMatch = { name: string; label: string; latitude: number; longitude: number; timezone: string };

function NewSiteLocation({ siteName, defaultRegion, initial, onChange }: { siteName: string; defaultRegion: string; initial: DiscoveryAnswers; onChange: (location: DiscoveryAnswers) => void }) {
  const initialMatch = typeof initial.site_latitude === "number" && typeof initial.site_longitude === "number" ? { name: siteName || "Pinned Site", label: String(initial.site_location || siteName || "Pinned Site"), latitude: initial.site_latitude, longitude: initial.site_longitude, timezone: String(initial.site_timezone || "UTC") } : undefined;
  const [query, setQuery] = useState(initialMatch?.label ?? defaultRegion);
  const [matches, setMatches] = useState<LocationMatch[]>([]);
  const [selected, setSelected] = useState<LocationMatch | undefined>(initialMatch);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [saveToAccount, setSaveToAccount] = useState(initial.save_as_account_location === "yes");

  function updateLocation(match: LocationMatch) {
    setSelected(match); setMatches([]); setQuery(match.label); setLocationError("");
    onChange({ site_location: match.label, site_latitude: match.latitude, site_longitude: match.longitude, site_timezone: match.timezone, save_as_account_location: saveToAccount ? "yes" : "no" });
  }

  async function searchLocation() {
    if (query.trim().length < 2) return;
    setSearching(true); setLocationError("");
    try {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(query.trim())}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not search for that location.");
      setMatches(body.results ?? []);
      if (!(body.results ?? []).length) setLocationError("No matching locations were found. Try a nearby town, postcode or full address.");
    } catch (problem) { setLocationError(problem instanceof Error ? problem.message : "Could not search for that location."); }
    finally { setSearching(false); }
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) { setLocationError("Location access is not available on this device."); return; }
    setLocating(true); setLocationError("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      updateLocation({ name: siteName || "Pinned Site", label: siteName || "Pinned device location", latitude: coords.latitude, longitude: coords.longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
      setLocating(false);
    }, () => { setLocationError("PVIntell could not access this device’s location. Search for the property instead."); setLocating(false); }, { enableHighAccuracy: true, timeout: 12_000 });
  }

  function movePin(_: string, latitude: number, longitude: number) {
    if (!selected) return;
    updateLocation({ ...selected, latitude, longitude });
  }

  return <div className="theme-subtle-surface mt-4 rounded-2xl border border-line bg-[#fbfcfe] p-4">
    <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><MapPin size={17}/></span><div><strong className="text-sm">Pinpoint the new Site</strong><p className="mt-1 text-[11px] leading-5 text-muted">Search for the property or use this device, then drag the pin to the exact installation position. This sets the Site’s solar coordinates and timezone.</p></div></div>
    <div className="mt-4 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchLocation(); } }} className="field mt-0" placeholder="Address, town, postcode or region"/><button type="button" onClick={() => void searchLocation()} disabled={searching || query.trim().length < 2} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40">{searching ? <LoaderCircle className="animate-spin" size={17}/> : <Search size={17}/>}</button></div>
    <button type="button" onClick={useDeviceLocation} disabled={locating} className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold disabled:opacity-40"><LocateFixed size={14}/>{locating ? "Finding this device…" : "Use this device’s location"}</button>
    {matches.length ? <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">{matches.map((match) => <button key={`${match.latitude}:${match.longitude}`} type="button" onClick={() => updateLocation(match)} className="block w-full border-b border-line px-4 py-3 text-left text-xs last:border-0 hover:bg-[#edf5fd]"><strong>{match.name}</strong><span className="mt-1 block text-[11px] text-muted">{match.label}</span></button>)}</div> : null}
    {locationError ? <p className="mt-3 text-[11px] text-[#a9442f]">{locationError}</p> : null}
    {selected ? <><div className="relative mt-4 h-64 overflow-hidden rounded-xl border border-line bg-[#dfe9ee]"><EditableSiteMap points={[{ id: "new-site", name: siteName || selected.name, latitude: selected.latitude, longitude: selected.longitude, kind: "site" }]} activeId="new-site" center={[selected.latitude, selected.longitude]} onSelect={() => undefined} onMove={movePin}/><div className="absolute bottom-3 left-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-[10px] font-semibold shadow">Click or drag the pin to refine the position</div></div><div className="mt-3 text-[11px] text-muted"><strong className="text-ink">Pinned:</strong> {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)} · {selected.timezone}</div><label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-5"><input type="checkbox" checked={saveToAccount} onChange={(event) => { const checked = event.target.checked; setSaveToAccount(checked); onChange({ save_as_account_location: checked ? "yes" : "no" }); }} className="mt-1"/><span>Also use this as my account’s home location. Leave this off when the Site is somewhere else.</span></label></> : null}
  </div>;
}

function SystemSetupQuestionCard({ sites, selectedSiteId, siteName, defaultRegion, siteLocationAnswers, value, setAnswer, setSite, setSiteLocation, onAskWattson }: {
  sites: Array<{ id: string; name: string }>;
  selectedSiteId: string;
  siteName: string;
  defaultRegion: string;
  siteLocationAnswers: DiscoveryAnswers;
  value: string | number | string[] | undefined;
  setAnswer: (value: string | number | string[]) => void;
  setSite: (siteId: string, siteName: string) => void;
  setSiteLocation: (location: DiscoveryAnswers) => void;
  onAskWattson: () => void;
}) {
  return <section className="card overflow-hidden bg-white">
    <div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8">
      <div className="eyebrow">Discovery</div>
      <h1 className="mt-3 max-w-3xl font-display text-2xl font-extrabold tracking-[-.04em] md:text-[34px]">Let’s set up your new power system</h1>
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/80 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Bot size={17}/></span>
        <div><strong className="text-xs">Why Wattson asks</strong><p className="mt-1 text-xs leading-5 text-muted">A simple system name and its Site keep every design, equipment record and future monitoring connection attached to the right place.</p></div>
      </div>
    </div>
    <div className="space-y-6 p-6 md:p-8">
      <label className="block"><span className="text-sm font-extrabold">What should we call this power setup?</span><span className="mt-1 block text-[11px] leading-5 text-muted">For example, House solar, Main home or Workshop.</span><input type="text" value={String(value ?? "")} onChange={(event) => setAnswer(event.target.value)} className="field mt-3" placeholder="Power system name"/></label>
      <div className="border-t border-line pt-6">
        <div className="text-sm font-extrabold">Where will this power system be located?</div>
        <p className="mt-1 text-[11px] leading-5 text-muted">Choose an existing Site, or name a new Site if this is at a different property or location.</p>
        {sites.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sites.map((site) => { const selected = selectedSiteId === site.id; return <button key={site.id} type="button" onClick={() => setSite(site.id, site.name)} className={`rounded-2xl border p-4 text-left transition ${selected ? "theme-selected-tile border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white hover:border-[#8ab0d2]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm">{site.name}</strong>{selected && <Check className="text-brand" size={16}/>}</div><p className="mt-2 text-[11px] leading-5 text-muted">Add this power system to the existing Site.</p></button>; })}
          <button type="button" onClick={() => setSite("__new__", "")} className={`rounded-2xl border p-4 text-left transition ${selectedSiteId === "__new__" ? "theme-selected-tile border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white hover:border-[#8ab0d2]"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm">Create a new Site</strong>{selectedSiteId === "__new__" && <Check className="text-brand" size={16}/>}</div><p className="mt-2 text-[11px] leading-5 text-muted">Use this for a different property or location.</p></button>
        </div> : null}
        {(!sites.length || selectedSiteId === "__new__") && <><input type="text" value={siteName} onChange={(event) => setSite("__new__", event.target.value)} className="field mt-3" placeholder="Site name, e.g. River Views"/><NewSiteLocation siteName={siteName} defaultRegion={defaultRegion} initial={siteLocationAnswers} onChange={setSiteLocation}/></>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onAskWattson} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Bot size={15}/>Ask Wattson</button><span className="text-[11px] text-muted">Get help choosing clear names or deciding which Site this belongs to.</span></div>
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
          return <button key={site.id} type="button" onClick={() => setSite(site.id, site.name)} className={`rounded-2xl border p-4 text-left transition ${selected ? "theme-selected-tile border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white hover:border-[#8ab0d2]"}`}>
            <div className="flex items-start justify-between gap-3"><strong className="text-sm">{site.name}</strong>{selected && <Check className="text-brand" size={16}/>}</div>
            <p className="mt-2 text-[11px] leading-5 text-muted">Add this power system to the existing Site.</p>
          </button>;
        })}
        <button type="button" onClick={() => setSite("__new__", "")} className={`rounded-2xl border p-4 text-left transition ${selectedSiteId === "__new__" ? "theme-selected-tile border-brand bg-[#edf5fd] ring-2 ring-[#b8d7f1]" : "border-line bg-white hover:border-[#8ab0d2]"}`}>
          <div className="flex items-start justify-between gap-3"><strong className="text-sm">Create a new Site</strong>{selectedSiteId === "__new__" && <Check className="text-brand" size={16}/>}</div>
          <p className="mt-2 text-[11px] leading-5 text-muted">Use this when the system is at a different property or location.</p>
        </button>
      </div>
      {selectedSiteId === "__new__" && <input autoFocus type="text" value={String(value ?? "")} onChange={(event) => setSite("__new__", event.target.value)} className="field mt-4" placeholder="Name the new Site, e.g. River Views"/>}
    </div>
  </section>;
}

type DiscoveryHelpMessage = { role: "user" | "assistant"; content: string };

async function prepareDiscoveryPhoto(file: File) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) throw new Error("Choose a JPEG, PNG or WebP photo.");
  if (file.size <= 1_800_000) return file;
  if (typeof createImageBitmap !== "function") throw new Error("This photo is too large for this browser to resize. Choose a smaller image or camera resolution.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("This browser could not prepare the photo."); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error("This browser could not prepare the photo.");
  if (blob.size > 3_500_000) throw new Error("The resized photo is still too large. Crop closer to the rating label and try again.");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-label.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

function DiscoveryHelpDialog({ question, discoveryAnswers, conversationId: existingConversationId, discoveryDraftId, onConversation, onSafetyDecision, siteId, projectId, onClose }: { question: DiscoveryQuestion; discoveryAnswers: DiscoveryAnswers; conversationId?: string; discoveryDraftId?: string; onConversation: (conversationId: string) => void; onSafetyDecision: (decision: string) => void; siteId?: string; projectId?: string; onClose: () => void }) {
  const selectedAnswer = discoveryAnswers[question.id];
  const existingEquipment = selectedAnswer === "existing" || (Array.isArray(selectedAnswer) && selectedAnswer.includes("existing"));
  const equipmentName = question.id === "dc_system_voltage" ? "battery" : question.id === "architecture_preference" ? "inverter" : question.id === "panel_construction_interest" ? "solar panels" : "equipment";
  const customBatteryAssessment = question.id === "battery_chemistry" && selectedAnswer === "custom_home_built";
  const explainingArchitecture = question.id === "architecture_preference" && !existingEquipment;
  const compareModuleArrangements = question.id === "module_level_electronics" && Array.isArray(selectedAnswer) && selectedAnswer.includes("compare");
  const existingModuleEquipment = question.id === "module_level_electronics" && Array.isArray(selectedAnswer) && selectedAnswer.includes("existing_mixed");
  const openingMessage = compareModuleArrangements
    ? "Let’s compare the three arrangements for this Site: a standard string inverter, DC optimisers with a compatible string inverter, and microinverters. I’ll use the recorded roof directions, shading, array areas, monitoring needs, service access, expansion plans and local constraints. I’ll explain the electrical, practical, maintenance and cost trade-offs, then recommend the best fit rather than leaving the comparison open-ended."
    : existingModuleEquipment
      ? "Let’s identify the existing or mixed panel-level equipment you want considered for this build. Send the exact panel, optimiser, microinverter and main-inverter makes and models, plus label photos or manufacturer documents where available. I’ll verify voltage, current, power, connector, string or branch, communications and firmware compatibility. Nothing will be treated as compatible merely because the connectors fit or the brands appear related."
      : customBatteryAssessment
    ? "Before a custom or home-built battery can remain in this build, we need a significant evidence review. I’ll work through its source and history; exact cell chemistry and series/parallel configuration; nominal and maximum voltage; capacity; BMS, contactors, pre-charge and isolation monitoring; fusing and disconnects; enclosure, condition and thermal management; charge/discharge limits; inverter compatibility; and available test or inspection evidence. I will ask for one evidence item at a time. When the review is complete I’ll clearly recommend either retaining it or NOT using it. You make the final choice, but missing safety-critical evidence will keep it marked unverified. First: is this a purpose-built custom pack, or does it use salvaged modules or a complete pack from a vehicle or other system?"
    : explainingArchitecture
    ? "I can define every inverter arrangement shown here and compare the ones that suit this Site. In particular, a hybrid inverter is one central solar inverter with battery capability available now or later, while a modular arrangement uses separate solar controllers and inverter equipment. Tell me which options you want compared, or ask me to recommend a suitable arrangement from your discovery answers."
    : existingEquipment
    ? `Let’s identify the ${equipmentName} you want considered for this build. Send the make and model, the rating-label specifications, or a clear photo of the label. I’ll assess compatibility rather than assume it belongs in the design. If it is unsuitable or the evidence is insufficient, I’ll say so and explain why.`
    : `Let’s work only on this question: “${question.title}” If it’s something you can see, show me with a photo if you can—it may save several questions. Otherwise, tell me what you know and what you want help identifying.`;
  const [messages, setMessages] = useState<DiscoveryHelpMessage[]>([{ role: "assistant", content: openingMessage }]);
  const [conversationId, setConversationId] = useState<string | undefined>(existingConversationId);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File>();
  const [preparingAttachment, setPreparingAttachment] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    const frame = requestAnimationFrame(() => { messageList.scrollTop = messageList.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [messages, sending, error]);

  async function chooseAttachment(file?: File) {
    if (!file) return;
    setPreparingAttachment(true); setError("");
    try { setAttachment(await prepareDiscoveryPhoto(file)); }
    catch (problem) { setAttachment(undefined); setError(problem instanceof Error ? problem.message : "Could not prepare that photo."); }
    finally { setPreparingAttachment(false); }
  }

  async function send() {
    const message = input.trim() || (attachment ? "Please read this equipment label and help me answer this question." : "");
    if (!message || sending) return;
    const displayedMessage = attachment ? `${message}\n\n[Attached image: ${attachment.name}]` : message;
    const nextMessages = [...messages, { role: "user" as const, content: displayedMessage }];
    setMessages(nextMessages); setInput(""); setSending(true); setError("");
    try {
      const payload = { message, conversationId, discoveryDraftId, siteId, projectId, discoveryAnswers, question: { id: question.id, title: question.title, stage: question.stage, help: question.noviceHelp, options: question.options }, recentConversation: nextMessages.slice(-8) };
      const formData = new FormData();
      formData.set("payload", JSON.stringify(payload));
      if (attachment) formData.set("file", attachment);
      const response = await fetch("/api/wattson/discovery-help", { method: "POST", body: formData });
      const responseText = await response.text();
      let body: { error?: string; conversationId?: string; safetyDecision?: string; message?: string } = {};
      try { body = responseText ? JSON.parse(responseText) as typeof body : {}; }
      catch { body = { error: response.status === 413 ? "That photo was too large to upload. Crop closer to the rating label and try again." : `Wattson could not read the server response (${response.status}).` }; }
      if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable.");
      if (!body.conversationId) throw new Error("Wattson returned an incomplete response. Please try the photo again.");
      setConversationId(body.conversationId);
      onConversation(body.conversationId);
      if (typeof body.safetyDecision === "string") onSafetyDecision(body.safetyDecision);
      setMessages((current) => [...current, { role: "assistant", content: String(body.message) }]);
      setAttachment(undefined);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Wattson is unavailable."); }
    finally { setSending(false); }
  }

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0b2740]/55 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Discovery help: ${question.title}`}>
    <section className="flex h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-2xl sm:h-[min(720px,88dvh)] sm:rounded-3xl">
      <header className="flex items-center gap-3 border-b border-line bg-[linear-gradient(100deg,#eaf3fb,#fff6ce)] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Bot size={20}/></span><div className="min-w-0 flex-1"><div className="eyebrow">Discovery chat</div><h2 className="mt-1 truncate text-sm font-extrabold">{question.title}</h2></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl border border-line bg-white text-muted" aria-label="Close discovery help"><X size={18}/></button></header>
      <div ref={messageListRef} className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-4">{messages.map((item, index) => <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13px] leading-5 ${item.role === "user" ? "bg-brand text-white" : "border border-line bg-white"}`}><FormattedChatMessage content={item.content}/></div></div>)}{sending ? <p className="text-xs font-semibold text-muted">Wattson is thinking…</p> : null}{error ? <p className="rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">{error}</p> : null}</div>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-line bg-white p-3">
        <p className="mb-2 text-[11px] leading-4 text-muted">Show Wattson with a photo if you can. Photos can reveal useful evidence, but cannot prove structural or electrical safety.</p>
        {attachment ? <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-[#edf6fd] px-3 py-2 text-xs"><ImagePlus size={15} className="shrink-0 text-brand"/><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)} aria-label="Remove attached image"><X size={15}/></button></div> : null}
        <div className="flex items-end gap-2">
          <label className={`flex h-12 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-brand ${preparingAttachment ? "cursor-wait opacity-50" : "cursor-pointer"}`} aria-label="Take a photo or choose one from the gallery">{preparingAttachment ? <LoaderCircle className="animate-spin" size={18}/> : <ImagePlus size={18}/>}<span className="hidden sm:inline">{preparingAttachment ? "Preparing" : "Photo"}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={preparingAttachment} className="hidden" onChange={(event) => void chooseAttachment(event.target.files?.[0])}/></label>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} placeholder="Ask about the photo or this question…" className="field mt-0 min-h-12 flex-1 resize-none py-3 text-[16px]"/>
          <button disabled={(!input.trim() && !attachment) || sending || preparingAttachment} className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Send"><Send size={18}/></button>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted">JPEG, PNG or WebP. Large phone photos are reduced automatically before upload.</p>
        <button type="button" onClick={onClose} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand bg-white text-xs font-extrabold text-brand"><ArrowLeft size={15}/>Back to questions</button>
      </form>
    </section>
  </div>;
}

function Review({ answers, questions, onSelectQuestion }: { answers: DiscoveryAnswers; questions: DiscoveryQuestion[]; onSelectQuestion: (questionId: string) => void }) {
  const incomplete=questions.filter((question)=>!discoveryAnswerComplete(question.id, answers[question.id]));
  return <section className="card overflow-hidden bg-white"><div className="border-b border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-6 md:p-8"><div className="eyebrow">Review</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em]">{incomplete.length ? "Complete your discovery" : "Ready for Wattson"}</h1><p className="mt-2 text-sm leading-6 text-muted">{incomplete.length ? `${incomplete.length} visible question${incomplete.length === 1 ? " is" : "s are"} still unanswered. Select any highlighted card to complete it before Wattson prepares the design.` : "Every visible question has been answered. These confirmed answers will form the design brief."}</p></div><div className="grid gap-3 p-6 md:grid-cols-2 md:p-8">{questions.map((question)=>{const missing=!discoveryAnswerComplete(question.id, answers[question.id]);return <button type="button" key={question.id} onClick={()=>onSelectQuestion(question.id)} className={`rounded-2xl border p-4 text-left transition hover:border-brand ${missing?"border-[#e7b43b] bg-[#fff9df] ring-1 ring-[#f1ce71]":"border-line bg-white"}`}><div className={`text-[10px] font-bold uppercase tracking-[.12em] ${missing?"text-[#8a6400]":"text-muted"}`}>{question.stage}{missing?" · Answer required":""}</div><div className="mt-2 text-xs font-bold">{question.title}</div><div className={`mt-2 text-xs ${missing?"font-bold text-[#8a6400]":"text-muted"}`}>{answerLabel(question,answers[question.id])}</div></button>})}</div></section>;
}

function answerLabel(question: DiscoveryQuestion, value: string | number | string[] | undefined) {
  if (value===unknownAnswer || value==="unknown" || value==="not_checked" || value==="not_decided" || value==="undecided" || value==="unknown_chemistry") return "Answer required";
  if (value===undefined || value==="") return "Not answered";
  if (question.id === "generator_details" && typeof value === "string") {
    try {
      const generator = JSON.parse(value) as GeneratorDetails;
      if (generator.purchaseStatus === "not_purchased") return "Not purchased yet — Wattson will specify the required size";
      return `${generator.generatorType?.replaceAll("_", " ") || "Generator"}${generator.continuousRating ? ` · ${generator.continuousRating} ${generator.ratingUnit || "kW"} continuous` : ""}`;
    } catch { return "Generator details need review"; }
  }
  if (typeof value === "string" && ["pool_equipment_ratings", "household_motor_ratings"].includes(question.id)) {
    try {
      const entries = Object.values(JSON.parse(value) as Record<string, PoolLoadEntry>).filter((entry) => (entry.quantity ?? 0) > 0 && ((entry.peakRunningKw ?? entry.runningKw) ?? 0) > 0);
      if (!entries.length) return "No additional electrical load included";
      const runningTotal = entries.reduce((sum, entry) => sum + (entry.peakRunningKw ?? entry.runningKw ?? 0) * (entry.quantity ?? 0), 0);
      const simultaneousRunning = entries.reduce((sum, entry) => sum + (entry.simultaneous === false ? 0 : (entry.peakRunningKw ?? entry.runningKw ?? 0) * (entry.quantity ?? 0)), 0);
      const startupPeak = entries.reduce((peak, entry) => {
        if (entry.simultaneous === false) return peak;
        const quantity = entry.quantity ?? 0;
        const running = (entry.peakRunningKw ?? entry.runningKw ?? 0) * quantity;
        const starting = (entry.startingKw ?? entry.runningKw ?? 0) * quantity;
        return Math.max(peak, simultaneousRunning + Math.max(0, starting - running));
      }, simultaneousRunning);
      return `${Number(runningTotal.toFixed(2))} kW running total · ${Number(startupPeak.toFixed(2))} kW estimated startup peak`;
    } catch { return "Load totals need review"; }
  }
  if (typeof value === "string" && ["panel_area_dimensions", "orientation_and_pitch", "structure_condition", "panel_area_constraints"].includes(question.id)) {
    try {
      const rows = JSON.parse(value) as Array<Record<string, unknown>>;
      if (Array.isArray(rows)) return rows.map((row) => {
        const name = String(row.name ?? "Panel area");
        if (question.id === "panel_area_dimensions") return `${name}: ${String(row.lengthM ?? "?")} m × ${String(row.widthM ?? "?")} m`;
        if (question.id === "orientation_and_pitch") return `${name}: ${String(row.direction ?? "unknown direction").replaceAll("_", " ")}, ${String(row.slope ?? "unknown slope").replaceAll("_", " ")}`;
        if (question.id === "panel_area_constraints") return row.kind === "none" ? "No known obstructions" : `${String(row.kind ?? "obstruction").replaceAll("_", " ")}: ${String(row.lengthM ?? "?")} m × ${String(row.widthM ?? "?")} m`;
        if (String(row.id ?? "").startsWith("ground-")) return `${name}: ${String(row.material ?? "unknown ground surface").replaceAll("_", " ")}${row.constructionDetail ? `, ${String(row.constructionDetail)}` : ""}, ${String(row.condition ?? "unknown condition").replaceAll("_", " ")}`;
        return `${name}: ${String(row.material ?? "unknown support").replaceAll("_", " ")}, ${String(row.age ?? "unknown age").replaceAll("_", " ")}, ${String(row.condition ?? "unknown condition").replaceAll("_", " ")}`;
      }).join("; ");
    } catch { return "Needs structured details"; }
  }
  if (Array.isArray(value)) return value.map((item)=>question.options?.find((option)=>option.value===item)?.label??item).join(", ");
  return question.options?.find((option)=>option.value===value)?.label ?? `${value}${question.unit?` ${question.unit}`:""}`;
}
