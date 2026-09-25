"use client";

import { ArrowLeft, ArrowRight, BatteryCharging, Bot, CheckCircle2, ChevronDown, Gauge, Plus, Sun, Trash2, TriangleAlert, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ProposedArray = { id: string; name: string; manufacturer: string; model: string; panelType: "monofacial" | "bifacial" | "thin-film" | "flexible" | "other" | "unknown"; panelCount: number; panelWatts: number; strings?: number; panelsPerString?: number; vmp?: number; voc?: number; imp?: number; isc?: number; mount: string; location: string; tilt?: number; orientation?: number };
type ProposedComponent = { id: string; type: "inverter" | "battery" | "generator"; name: string; manufacturer: string; model: string; quantity: number; rating?: number; batteryKwh?: number; batteryAh?: number; capacityInputBasis?: "kWh" | "Ah"; batteryType?: string; bmsCompatibility?: string; voltage?: number; batteryVoltageMin?: number; batteryVoltageMax?: number; inverterType?: "hybrid" | "grid_tied_string" | "off_grid_inverter_charger" | "battery_inverter" | "microinverter" | "other"; generatorFuelType?: "petrol" | "diesel" | "lpg" | "natural_gas" | "dual_fuel" | "other"; mpptInputs?: number; mpptMin?: number; mpptMax?: number; maxPvVoltage?: number; maxInputCurrent?: number; notes: string };
type Issue = { severity: "blocker" | "warning"; text: string };
export type ProposalIntakeInitial = { systemId: string; siteId: string; systemName: string; projectType: "off-grid" | "grid-tied" | "hybrid"; arrays: ProposedArray[]; components: ProposedComponent[] };

const blankArray = (position: number): ProposedArray => ({ id: crypto.randomUUID(), name: `PV array ${position}`, manufacturer: "", model: "", panelType: "unknown", panelCount: 1, panelWatts: 0, mount: "", location: "" });
const blankComponent = (type: ProposedComponent["type"]): ProposedComponent => ({ id: crypto.randomUUID(), type, name: type === "inverter" ? "Inverter" : type === "battery" ? "Battery storage" : "Generator", manufacturer: "", model: "", quantity: type === "generator" ? 1 : 0, notes: "" });
const numberValue = (value: string) => value === "" ? undefined : Number(value);
const hasComponentDetails = (component: ProposedComponent) => Boolean(component.manufacturer.trim() || component.model.trim() || component.rating || component.batteryKwh || component.batteryAh || component.batteryType || component.bmsCompatibility || component.voltage || component.batteryVoltageMin || component.batteryVoltageMax || component.inverterType || component.generatorFuelType || component.mpptInputs || component.mpptMin || component.mpptMax || component.maxPvVoltage || component.maxInputCurrent || component.notes.trim());
export function ProposalIntake({ sites, initialSiteId, initialSystemName, initialProposal, discoveryContext }: { sites: Array<{ id: string; name: string; location: string | null }>; initialSiteId?: string; initialSystemName?: string; initialProposal?: ProposalIntakeInitial; discoveryContext?: { draftId?: string } }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(initialProposal?.siteId ?? (initialSiteId && sites.some((site) => site.id === initialSiteId) ? initialSiteId : sites[0]?.id ?? "__new__"));
  const [siteName, setSiteName] = useState("");
  const [systemName, setSystemName] = useState(initialProposal?.systemName ?? initialSystemName ?? "My proposed system");
  const [projectType, setProjectType] = useState<"off-grid" | "grid-tied" | "hybrid">(initialProposal?.projectType ?? "hybrid");
  const [arrays, setArrays] = useState<ProposedArray[]>(initialProposal?.arrays ?? []);
  const [components, setComponents] = useState<ProposedComponent[]>(initialProposal?.components ?? []);
  const [openId, setOpenId] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState("");
  const [assessmentError, setAssessmentError] = useState("");
  const [assessmentConversationId, setAssessmentConversationId] = useState<string>();
  const [assessmentMessages, setAssessmentMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [assessmentInput, setAssessmentInput] = useState("");

  const enteredComponents = useMemo(() => components.filter((component) => initialProposal?.components.some((saved) => saved.id === component.id) || hasComponentDetails(component)), [components, initialProposal]);
  const issues = useMemo(() => localIssues(arrays, enteredComponents), [arrays, enteredComponents]);
  const hasEnteredEquipment = arrays.length + enteredComponents.length > 0;
  const clearIssues = () => { setWarnings([]); setBlockers([]); setError(""); };
  const updateArray = (id: string, change: Partial<ProposedArray>) => { clearIssues(); setArrays((current) => current.map((item) => item.id === id ? { ...item, ...change } : item)); };
  const updateComponent = (id: string, change: Partial<ProposedComponent>) => { clearIssues(); setComponents((current) => current.map((item) => item.id === id ? { ...item, ...change } : item)); };
  const addArray = () => { const item = blankArray(arrays.length + 1); setArrays((current) => [...current, item]); setOpenId(item.id); setWarnings([]); setBlockers([]); };
  const addComponent = (type: ProposedComponent["type"]) => { const item = blankComponent(type); setComponents((current) => [...current, item]); setOpenId(item.id); setWarnings([]); setBlockers([]); };

  async function assessWithWattson() {
    if (assessing) return;
    setAssessing(true); setAssessment(""); setAssessmentError("");
    const formSnapshot = JSON.stringify({ projectType, arrays, components: enteredComponents });
    try {
      const response = await fetch("/api/wattson/discovery-help", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        message: `Check this equipment form and give me a very short, simple checklist of anything I must fix before continuing. Current form: ${formSnapshot.slice(0, 2200)}`,
        conversationId: assessmentConversationId,
        requestId: crypto.randomUUID(),
        discoveryDraftId: discoveryContext?.draftId,
        siteId: siteId !== "__new__" ? siteId : undefined,
        projectId: initialProposal?.systemId,
        discoveryAnswers: { system_name: systemName, grid_relationship: projectType },
        question: { id: "proposal_intake_assessment", title: "Proposed equipment form", stage: "Discovery", help: "Use only the unsaved form snapshot in the user's message. Ignore equipment types that are absent; they are optional and must never be called missing. Required basics for cards present: array—name, count, watts, mounting; inverter—name, manufacturer, model, quantity, type, rating, AC output voltage, MPPT count; battery—name, quantity, kWh and Ah capacity, nominal DC voltage, chemistry (manufacturer and model are optional; entering either capacity calculates the other once voltage is present); generator—name, quantity, rating, AC output voltage, fuel type (manufacturer and model are optional). Use very plain language. Start with 'Ready to continue' if complete; otherwise start with 'Finish these items:' and give at most five short bullets, one sentence each. Do not use markdown bold, technical commentary, a conclusion, or mention optional fields unless an entered value clearly conflicts. Never change or save the form." },
        recentConversation: [],
      }) });
      const body = await response.json() as { error?: string; message?: string; conversationId?: string };
      if (!response.ok) throw new Error(body.error ?? "Wattson could not assess this form.");
      if (body.conversationId) setAssessmentConversationId(body.conversationId);
      const reply = body.message ?? "Wattson returned no assessment.";
      setAssessment(reply); setAssessmentMessages([{ role: "assistant", content: reply }]);
    } catch (problem) { setAssessmentError(problem instanceof Error ? problem.message : "Wattson could not assess this form."); }
    finally { setAssessing(false); }
  }

  async function sendAssessmentMessage() {
    const message = assessmentInput.trim();
    if (!message || assessing) return;
    const nextMessages = [...assessmentMessages, { role: "user" as const, content: message }];
    setAssessmentMessages(nextMessages); setAssessmentInput(""); setAssessing(true); setAssessmentError("");
    try {
      const response = await fetch("/api/wattson/discovery-help", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        message, conversationId: assessmentConversationId, requestId: crypto.randomUUID(), discoveryDraftId: discoveryContext?.draftId,
        siteId: siteId !== "__new__" ? siteId : undefined, projectId: initialProposal?.systemId,
        discoveryAnswers: { system_name: systemName, grid_relationship: projectType },
        question: { id: "proposal_intake_assessment", title: "Proposed equipment form", stage: "Discovery", help: "Help the user complete the equipment form in very plain language. Answer only their current question. Keep the answer brief and never change or save the form." },
        recentConversation: nextMessages.slice(-8),
      }) });
      const body = await response.json() as { error?: string; message?: string; conversationId?: string };
      if (!response.ok) throw new Error(body.error ?? "Wattson could not answer.");
      if (body.conversationId) setAssessmentConversationId(body.conversationId);
      setAssessmentMessages((current) => [...current, { role: "assistant", content: body.message ?? "Wattson returned no answer." }]);
    } catch (problem) { setAssessmentError(problem instanceof Error ? problem.message : "Wattson could not answer."); }
    finally { setAssessing(false); }
  }

  async function savePlan(destination: "schematic" | "discovery" = "schematic") {
    setError(""); setWarnings([]); setBlockers([]);
    const relevantIssues = discoveryContext && destination === "discovery" ? basicDiscoveryIssues(arrays, enteredComponents) : issues;
    const localBlockers = relevantIssues.filter((issue) => issue.severity === "blocker").map((issue) => issue.text);
    const localWarnings = relevantIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.text);
    if (localBlockers.length) { setBlockers(localBlockers); return; }
    if (localWarnings.length) setWarnings(localWarnings);
    setSaving(true);
    try {
      const response = await fetch("/api/systems/proposed", { method: initialProposal ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemId: initialProposal?.systemId, siteId, siteName: siteId === "__new__" ? siteName : undefined, systemName, projectType, arrays, components: enteredComponents, removedArrayIds: initialProposal?.arrays.map((item) => item.id).filter((id) => !arrays.some((item) => item.id === id)) ?? [], removedComponentIds: initialProposal?.components.map((item) => item.id).filter((id) => !components.some((item) => item.id === id)) ?? [], discoveryContext: discoveryContext ? { draftId: discoveryContext.draftId, continueDiscovery: destination === "discovery" } : undefined }) });
      const body = await response.json();
      if (Array.isArray(body.blockers)) setBlockers(body.blockers);
      if (Array.isArray(body.warnings)) setWarnings(body.warnings);
      if (!response.ok) throw new Error(body.error ?? "Could not build the proposed schematic.");
      router.push(body.url);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not build the proposed schematic."); setSaving(false); }
  }

  return <main className="min-h-screen bg-[#edf3f7] p-4 text-ink md:p-8"><div className="mx-auto max-w-5xl">
    <Link href={discoveryContext ? initialProposal ? `/discovery/new-system?edit=${initialProposal.systemId}` : discoveryContext.draftId ? `/discovery/new-system?draft=${discoveryContext.draftId}` : "/discovery/new-system" : initialProposal ? `/systems?site=${initialProposal.siteId}` : "/dashboard"} className="inline-flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/>Back to {discoveryContext ? "Discovery" : initialProposal ? "systems" : "dashboard"}</Link>
    <section className="mt-4 overflow-hidden rounded-3xl border border-[#dfbd42] bg-white shadow-sm"><header className="relative bg-[linear-gradient(110deg,#fff1a8,#fffaf0)] p-6 md:p-8"><button type="button" onClick={() => void assessWithWattson()} disabled={assessing} className="mb-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-[11px] font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50 md:absolute md:right-8 md:top-8 md:mb-0"><Bot size={16}/>{assessing ? "Wattson is checking…" : "Ask Wattson"}</button><div className="eyebrow text-[#805d00]">Proposed system intake</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em]">Specify what you want first</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:pr-36">Add each proposed item and complete its technical card. Keep physically separate PV arrays separate. PVIntell checks the recorded limits before it creates the schematic. Nothing here is marked purchased, installed or commissioned.</p></header>
      {!discoveryContext ? <div className="grid gap-4 border-b border-line p-5 md:grid-cols-3 md:p-6"><Field label="Site"><select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="field"><option value="__new__">Create a new Site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>{siteId === "__new__" ? <Field label="New Site name"><input value={siteName} onChange={(event) => setSiteName(event.target.value)} className="field" placeholder="e.g. Home"/></Field> : null}<Field label="Proposed system name"><input value={systemName} onChange={(event) => setSystemName(event.target.value)} className="field"/></Field><Field label="Grid relationship"><select value={projectType} onChange={(event) => setProjectType(event.target.value as typeof projectType)} className="field"><option value="hybrid">Hybrid / grid with storage</option><option value="grid-tied">Grid-tied</option><option value="off-grid">Off-grid / standalone</option></select></Field></div> : null}
      <div className="p-5 md:p-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Chooser icon={<Sun size={22}/>} title="Panels / array" detail="Panel model, quantity, strings and mounting" onClick={addArray}/><Chooser icon={<Zap size={22}/>} title="Inverter" detail="Rating and PV/battery input limits" onClick={() => addComponent("inverter")}/><Chooser icon={<BatteryCharging size={22}/>} title="Battery" detail="Model, quantity, voltage and capacity" onClick={() => addComponent("battery")}/><Chooser icon={<Gauge size={22}/>} title="Generator" detail="Model, rating, voltage and role" onClick={() => addComponent("generator")}/></div>
        <div className="mt-6 space-y-3">{arrays.map((array) => <ItemShell key={array.id} open={openId === array.id} title={array.name} summary={`${array.panelCount || 0} × ${array.panelWatts || 0} W · ${array.mount || "mount not entered"}`} onToggle={() => setOpenId(openId === array.id ? undefined : array.id)} onRemove={() => setArrays((current) => current.filter((item) => item.id !== array.id))}><ArrayFields array={array} update={(change) => updateArray(array.id, change)}/><button type="button" onClick={addArray} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-brand px-4 text-xs font-bold text-brand"><Plus size={14}/>Add another array</button></ItemShell>)}{components.map((component) => <ItemShell key={component.id} open={openId === component.id} title={component.name} summary={`${component.type} · ${component.manufacturer || "manufacturer TBC"} ${component.model}`.trim()} onToggle={() => setOpenId(openId === component.id ? undefined : component.id)} onRemove={() => setComponents((current) => current.filter((item) => item.id !== component.id))}><ComponentFields component={component} update={(change) => updateComponent(component.id, change)}/></ItemShell>)}</div>
        {!arrays.length && !components.length ? <div className="mt-6 rounded-2xl border border-dashed border-[#c6d5e3] bg-[#f7fafc] p-8 text-center text-sm text-muted">Choose a category above to add the first proposed item.</div> : null}
        {(blockers.length || warnings.length) ? <section className={`mt-6 rounded-2xl border p-4 ${blockers.length ? "border-[#e49a8d] bg-[#fff0ed]" : "border-[#e5c45e] bg-[#fff8d8]"}`}><div className="flex gap-3"><TriangleAlert className={blockers.length ? "text-[#b63f2d]" : "text-[#8a6500]"} size={20}/><div><strong className="text-sm">{blockers.length ? discoveryContext ? "Complete the missing fields" : "Compatibility failures must be corrected" : discoveryContext ? "More information is required" : "Compatibility is not fully proven"}</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">{[...blockers, ...warnings].map((item) => <li key={item}>{item}</li>)}</ul>{!blockers.length ? <p className="mt-3 text-xs font-semibold">{discoveryContext ? "Discovery can continue. Missing details will remain TBC and can be completed later." : "The schematic can still be built. Incomplete items will remain provisional until their specifications are confirmed."}</p> : null}</div></div></section> : null}
        {error ? <p className="mt-4 rounded-xl border border-[#e49a8d] bg-[#fff0ed] p-3 text-xs text-[#9b3f2c]">{error}</p> : null}
        {discoveryContext ? <section className="mt-7 rounded-2xl border border-[#d5e1ec] bg-[#f7fafc] p-4 md:p-5"><h2 className="text-base font-extrabold">Continue with Discovery</h2><p className="mt-1 text-xs leading-5 text-muted">Save this equipment and continue answering questions about the Site, energy use, backup and future needs.</p><button type="button" onClick={() => void savePlan("discovery")} disabled={saving || !systemName.trim() || siteId === "__new__" || !hasEnteredEquipment} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[#76abd0] bg-[#eaf4fc] p-4 text-left transition hover:border-brand disabled:opacity-40"><span><span className="block text-sm font-extrabold text-brand">Continue Discovery</span><span className="mt-1 block text-[11px] leading-5 text-muted">Your entered equipment will be included in the proposed system.</span></span><ArrowRight size={18} className="shrink-0 text-brand"/></button>{saving ? <p className="mt-3 text-xs font-bold text-brand">Saving your proposed equipment…</p> : null}</section> : <div className="mt-7 flex justify-end"><button type="button" onClick={() => void savePlan()} disabled={saving || !systemName.trim() || (siteId === "__new__" && !siteName.trim()) || !hasEnteredEquipment} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-extrabold text-white disabled:opacity-40"><CheckCircle2 size={17}/>{saving ? "Building proposed schematic…" : initialProposal ? "Save and rebuild proposed schematic" : "Check and build proposed schematic"}</button></div>}
      </div>
    </section>
    {assessment || assessmentError || assessing ? <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0b2740]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="wattson-assessment-title">
      <section className="flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line bg-[linear-gradient(100deg,#eaf3fb,#fff6ce)] p-4"><span className="grid size-11 place-items-center rounded-2xl bg-brand text-white"><Bot size={20}/></span><div className="min-w-0 flex-1"><div className="eyebrow">Wattson</div><h2 id="wattson-assessment-title" className="mt-1 text-sm font-extrabold">Equipment form help</h2></div><button type="button" onClick={() => { setAssessment(""); setAssessmentError(""); setAssessmentMessages([]); }} disabled={assessing} className="grid size-10 place-items-center rounded-xl border border-line bg-white text-muted" aria-label="Close Wattson chat"><X size={18}/></button></header>
        <div className="min-h-48 flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-4">{assessmentMessages.map((item, index) => <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13px] leading-5 ${item.role === "user" ? "bg-brand text-white" : "border border-line bg-white"}`}>{item.content}</div></div>)}{assessing ? <p className="text-xs font-semibold text-muted">Wattson is checking…</p> : null}{assessmentError ? <p className="rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">{assessmentError}</p> : null}</div>
        <form onSubmit={(event) => { event.preventDefault(); void sendAssessmentMessage(); }} className="flex gap-2 border-t border-line bg-white p-3"><textarea value={assessmentInput} onChange={(event) => setAssessmentInput(event.target.value)} rows={2} placeholder="Ask about a field or value…" className="field mt-0 min-h-12 flex-1 resize-none py-3 text-[16px]"/><button disabled={!assessmentInput.trim() || assessing} className="rounded-xl bg-brand px-4 text-xs font-extrabold text-white disabled:opacity-40">Send</button></form>
      </section>
    </div> : null}
  </div></main>;
}

function localIssues(arrays: ProposedArray[], components: ProposedComponent[]): Issue[] {
  const issues: Issue[] = [];
  arrays.forEach((array) => {
    if (!array.name.trim() || array.panelCount < 1 || array.panelWatts <= 0 || !array.mount) issues.push({ severity: "blocker", text: `${array.name || "PV array"}: enter a name, panel quantity, panel wattage and mounting option.` });
    if (array.strings && array.panelsPerString && array.strings * array.panelsPerString !== array.panelCount) issues.push({ severity: "blocker", text: `${array.name}: strings × panels per string does not equal ${array.panelCount} panels.` });
    const missing = [!array.manufacturer && "manufacturer", !array.model && "exact model", array.panelType === "unknown" && "panel type", !array.voc && "Voc", !array.vmp && "Vmp", !array.isc && "Isc", !array.imp && "Imp"].filter(Boolean);
    if (missing.length) issues.push({ severity: "warning", text: `${array.name}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} incomplete.` });
  });
  const inverters = components.filter((item) => item.type === "inverter");
  const batteries = components.filter((item) => item.type === "battery");
  if (arrays.length && !inverters.length) issues.push({ severity: "warning", text: "No inverter or controller is recorded for the PV arrays." });
  inverters.forEach((inverter) => {
    const missing = [!inverter.manufacturer && "manufacturer", !inverter.model && "exact model", !inverter.maxPvVoltage && "maximum PV voltage", !inverter.mpptMin && "MPPT minimum", !inverter.mpptMax && "MPPT maximum", !inverter.maxInputCurrent && "maximum PV input current", batteries.length > 0 && !inverter.batteryVoltageMin && "battery voltage minimum", batteries.length > 0 && !inverter.batteryVoltageMax && "battery voltage maximum"].filter(Boolean);
    if (missing.length) issues.push({ severity: "warning", text: `${inverter.name}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} incomplete.` });
    arrays.forEach((array) => { if (!array.panelsPerString) return; const parallel = array.strings ?? 1; if (array.voc && inverter.maxPvVoltage && array.voc * array.panelsPerString > inverter.maxPvVoltage) issues.push({ severity: "blocker", text: `${array.name} exceeds ${inverter.name}'s maximum PV voltage before cold correction.` }); if (array.vmp && inverter.mpptMin && array.vmp * array.panelsPerString < inverter.mpptMin) issues.push({ severity: "blocker", text: `${array.name} string Vmp is below ${inverter.name}'s MPPT range.` }); if (array.vmp && inverter.mpptMax && array.vmp * array.panelsPerString > inverter.mpptMax) issues.push({ severity: "blocker", text: `${array.name} string Vmp is above ${inverter.name}'s MPPT range.` }); if (array.isc && inverter.maxInputCurrent && array.isc * parallel > inverter.maxInputCurrent) issues.push({ severity: "blocker", text: `${array.name} exceeds ${inverter.name}'s recorded PV input-current limit.` }); });
  });
  batteries.forEach((battery) => {
    const missing = [!battery.model && "exact model", !battery.batteryType && "battery type", !battery.voltage && "nominal voltage", !battery.bmsCompatibility && "BMS compatibility"].filter(Boolean);
    if (missing.length) issues.push({ severity: "warning", text: `${battery.name}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} incomplete.` });
    inverters.forEach((inverter) => { if (battery.voltage && inverter.batteryVoltageMin && battery.voltage < inverter.batteryVoltageMin) issues.push({ severity: "blocker", text: `${battery.name}'s voltage is below ${inverter.name}'s battery range.` }); if (battery.voltage && inverter.batteryVoltageMax && battery.voltage > inverter.batteryVoltageMax) issues.push({ severity: "blocker", text: `${battery.name}'s voltage is above ${inverter.name}'s battery range.` }); });
  });
  return issues;
}

function basicDiscoveryIssues(arrays: ProposedArray[], components: ProposedComponent[]): Issue[] {
  const issues: Issue[] = [];
  arrays.forEach((array) => {
    const missing = [!array.name.trim() && "name", array.panelCount < 1 && "panel quantity", array.panelWatts <= 0 && "panel wattage", !array.mount && "mounting option"].filter(Boolean);
    if (missing.length) issues.push({ severity: "blocker", text: `${array.name || "PV array"}: enter ${missing.join(", ")}.` });
  });
  components.forEach((component) => {
    const missing = [!component.name.trim() && "name", component.type === "inverter" && !component.manufacturer.trim() && "manufacturer", component.type === "inverter" && !component.model.trim() && "model", component.quantity < 1 && "quantity"];
    if (component.type === "inverter") missing.push(!component.inverterType && "inverter type", !component.rating && "continuous rating", !component.voltage && "AC output voltage", !component.mpptInputs && "number of MPPT inputs");
    if (component.type === "battery") missing.push(!component.batteryKwh && "capacity in kWh", !component.batteryAh && "capacity in Ah", !component.voltage && "nominal voltage", !component.batteryType && "battery type / chemistry");
    if (component.type === "generator") missing.push(!component.rating && "continuous rating", !component.voltage && "AC output voltage", !component.generatorFuelType && "fuel type");
    const fields = missing.filter(Boolean);
    if (fields.length) issues.push({ severity: "blocker", text: `${component.name || component.type}: enter ${fields.join(", ")}.` });
  });
  return issues;
}

function Chooser({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-2xl border border-[#dfbd42] bg-[#fff8d8] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><span className="text-brand">{icon}</span><strong className="mt-3 block text-sm">{title}</strong><span className="mt-1 block text-[10px] leading-4 text-muted">{detail}</span><span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-brand"><Plus size={12}/>Add and specify</span></button>; }
function ItemShell({ open, title, summary, onToggle, onRemove, children }: { open: boolean; title: string; summary: string; onToggle: () => void; onRemove: () => void; children: React.ReactNode }) { return <article className="overflow-hidden rounded-2xl border border-line bg-white"><div className="flex items-center gap-2 p-4"><button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"><span className="min-w-0"><strong className="block truncate text-sm">{title}</strong><span className="mt-1 block truncate text-[10px] text-muted">{summary}</span></span><ChevronDown size={16} className={`shrink-0 transition ${open ? "rotate-180" : ""}`}/></button><button type="button" onClick={onRemove} className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#efb6a7] text-[#ad432f]" aria-label={`Remove ${title}`}><Trash2 size={14}/></button></div>{open ? <div className="border-t border-line bg-[#f8fafc] p-4 md:p-5">{children}</div> : null}</article>; }
function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const isRequired = required || ["Array name", "Panels in this array", "Panel rating (W)", "Mounting option"].includes(label);
  return <label className="block text-xs font-bold"><span>{label}{isRequired ? <span className="ml-1 text-[#b63f2d]" aria-hidden="true">*</span> : null}</span>{children}</label>;
}
function ArrayFields({ array, update }: { array: ProposedArray; update: (change: Partial<ProposedArray>) => void }) { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Array name"><input value={array.name} onChange={(e) => update({ name: e.target.value })} className="field"/></Field><Field label="Panel manufacturer"><input value={array.manufacturer} onChange={(e) => update({ manufacturer: e.target.value })} className="field"/></Field><Field label="Panel model"><input value={array.model} onChange={(e) => update({ model: e.target.value })} className="field"/></Field><Field label="Panel type"><select value={array.panelType} onChange={(e) => update({ panelType: e.target.value as ProposedArray["panelType"] })} className="field"><option value="unknown">Unknown / not selected</option><option value="monofacial">Monofacial</option><option value="bifacial">Bifacial</option><option value="thin-film">Thin-film</option><option value="flexible">Flexible</option><option value="other">Other</option></select></Field><Field label="Panels in this array"><input type="number" min="1" value={array.panelCount} onChange={(e) => update({ panelCount: Number(e.target.value) })} className="field"/></Field><Field label="Panel rating (W)"><input type="number" min="1" value={array.panelWatts || ""} onChange={(e) => update({ panelWatts: Number(e.target.value) })} className="field"/></Field><Field label="Mounting option"><select value={array.mount} onChange={(e) => update({ mount: e.target.value })} className="field"><option value="">Choose mounting</option><option value="roof_flush">Roof — flush mounted</option><option value="roof_tilted">Roof — tilted frame</option><option value="ground_fixed">Ground — fixed frame</option><option value="ground_tracking">Ground — tracking</option><option value="pole">Pole mount</option><option value="building_integrated">Building integrated</option><option value="other">Other / specialist</option></select></Field><Field label="Mounting area / location"><input value={array.location} onChange={(e) => update({ location: e.target.value })} className="field" placeholder="e.g. garage north roof"/></Field><Field label="Number of strings"><input type="number" min="1" value={array.strings ?? ""} onChange={(e) => update({ strings: numberValue(e.target.value) })} className="field"/></Field><Field label="Panels per string"><input type="number" min="1" value={array.panelsPerString ?? ""} onChange={(e) => update({ panelsPerString: numberValue(e.target.value) })} className="field"/></Field>{(["vmp","voc","imp","isc"] as const).map((key) => <Field key={key} label={`${key.toUpperCase()} per panel (${key === "vmp" || key === "voc" ? "V" : "A"})`}><input type="number" step="any" min="0" value={array[key] ?? ""} onChange={(e) => update({ [key]: numberValue(e.target.value) })} className="field"/></Field>)}<Field label="Tilt (degrees)"><input type="number" min="0" max="90" value={array.tilt ?? ""} onChange={(e) => update({ tilt: numberValue(e.target.value) })} className="field"/></Field><Field label="Azimuth (degrees)"><input type="number" min="0" max="360" value={array.orientation ?? ""} onChange={(e) => update({ orientation: numberValue(e.target.value) })} className="field"/></Field></div>; }
function ComponentFields({ component, update }: { component: ProposedComponent; update: (change: Partial<ProposedComponent>) => void }) {
  const updateVoltage = (value: string) => {
    const voltage = numberValue(value);
    if (component.type !== "battery" || !voltage) return update({ voltage });
    if (component.capacityInputBasis === "Ah" && component.batteryAh) return update({ voltage, batteryKwh: Number((component.batteryAh * voltage / 1000).toFixed(3)) });
    if (component.batteryKwh) return update({ voltage, batteryAh: Number((component.batteryKwh * 1000 / voltage).toFixed(2)) });
    update({ voltage });
  };
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Field label="Display name" required><input value={component.name} onChange={(e) => update({ name: e.target.value })} className="field"/></Field>
    <Field label="Manufacturer" required={component.type === "inverter"}><input value={component.manufacturer} onChange={(e) => update({ manufacturer: e.target.value })} className="field"/></Field>
    <Field label="Model" required={component.type === "inverter"}><input value={component.model} onChange={(e) => update({ model: e.target.value })} className="field"/></Field>
    <Field label="Quantity" required><input type="number" min="1" value={component.quantity || ""} onChange={(e) => update({ quantity: Number(e.target.value) })} className="field"/></Field>
    {component.type === "inverter" ? <Field label="Inverter type" required><select value={component.inverterType ?? ""} onChange={(e) => update({ inverterType: e.target.value as ProposedComponent["inverterType"] || undefined })} className="field"><option value="">Choose inverter type</option><option value="hybrid">Hybrid inverter</option><option value="grid_tied_string">Grid-tied / string inverter</option><option value="off_grid_inverter_charger">Off-grid inverter-charger</option><option value="battery_inverter">Battery inverter / AC-coupled</option><option value="microinverter">Microinverter</option><option value="other">Other / specialist</option></select></Field> : null}
    {component.type === "battery" ? <>
      <Field label="Nominal battery voltage (V DC)" required><input type="number" min="0" value={component.voltage ?? ""} onChange={(e) => updateVoltage(e.target.value)} className="field"/></Field>
      <BatteryCapacityFields component={component} update={update}/>
    </> : <>
      <Field label={component.type === "inverter" ? "Continuous rating (kW)" : "Continuous rating (W)"} required><input type="number" step="any" min="0" value={component.rating ?? ""} onChange={(e) => update({ rating: numberValue(e.target.value) })} className="field"/></Field>
      <Field label="AC output voltage (V)" required><input type="number" min="0" value={component.voltage ?? ""} onChange={(e) => updateVoltage(e.target.value)} className="field"/></Field>
    </>}
    {component.type === "battery" ? <>
      <Field label="Battery type / chemistry" required><select value={component.batteryType ?? ""} onChange={(e) => update({ batteryType: e.target.value || undefined })} className="field"><option value="">Select battery type</option><option value="lifepo4">Lithium iron phosphate (LFP/LiFePO4)</option><option value="other_lithium">Other lithium-ion</option><option value="lto">Lithium titanate (LTO)</option><option value="flooded_lead_acid">Flooded lead-acid</option><option value="agm">AGM lead-acid</option><option value="gel">Gel lead-acid</option><option value="sodium_ion">Sodium-ion</option><option value="manufacturer_system">Manufacturer battery system</option><option value="other">Other / custom</option></select></Field>
      <Field label="BMS compatibility"><select value={component.bmsCompatibility ?? ""} onChange={(e) => update({ bmsCompatibility: e.target.value || undefined })} className="field"><option value="">Select compatibility status</option><option value="confirmed">Confirmed compatible with inverter</option><option value="integrated">Integrated manufacturer system</option><option value="standalone">Standalone BMS / no communications required</option><option value="not_checked">Not checked yet</option></select></Field>
    </> : null}
    {component.type === "generator" ? <Field label="Fuel type" required><select value={component.generatorFuelType ?? ""} onChange={(e) => update({ generatorFuelType: e.target.value as ProposedComponent["generatorFuelType"] || undefined })} className="field"><option value="">Choose fuel type</option><option value="petrol">Petrol / gasoline</option><option value="diesel">Diesel</option><option value="lpg">LPG / propane</option><option value="natural_gas">Natural gas</option><option value="dual_fuel">Dual fuel</option><option value="other">Other</option></select></Field> : null}
    {component.type === "inverter" ? <>
      <Field label="Number of MPPT inputs" required><input type="number" min="1" value={component.mpptInputs ?? ""} onChange={(e) => update({ mpptInputs: numberValue(e.target.value) })} className="field"/></Field>
      <Field label="Maximum PV voltage (V)"><input type="number" min="0" value={component.maxPvVoltage ?? ""} onChange={(e) => update({ maxPvVoltage: numberValue(e.target.value) })} className="field"/></Field>
      <Field label="MPPT minimum (V)"><input type="number" min="0" value={component.mpptMin ?? ""} onChange={(e) => update({ mpptMin: numberValue(e.target.value) })} className="field"/></Field>
      <Field label="MPPT maximum (V)"><input type="number" min="0" value={component.mpptMax ?? ""} onChange={(e) => update({ mpptMax: numberValue(e.target.value) })} className="field"/></Field>
      <Field label="Maximum PV input current (A)"><input type="number" min="0" value={component.maxInputCurrent ?? ""} onChange={(e) => update({ maxInputCurrent: numberValue(e.target.value) })} className="field"/></Field>
      <Field label="Battery voltage minimum (V)"><input type="number" min="0" value={component.batteryVoltageMin ?? ""} onChange={(e) => update({ batteryVoltageMin: numberValue(e.target.value) })} className="field"/></Field>
      <Field label="Battery voltage maximum (V)"><input type="number" min="0" value={component.batteryVoltageMax ?? ""} onChange={(e) => update({ batteryVoltageMax: numberValue(e.target.value) })} className="field"/></Field>
    </> : null}
    <Field label="Notes"><textarea value={component.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} className="field py-3"/></Field>
  </div>;
}

function BatteryCapacityFields({ component, update }: { component: ProposedComponent; update: (change: Partial<ProposedComponent>) => void }) {
  const setKwh = (value: string) => {
    const batteryKwh = numberValue(value);
    update({ batteryKwh, capacityInputBasis: "kWh", batteryAh: batteryKwh ? component.voltage ? Number((batteryKwh * 1000 / component.voltage).toFixed(2)) : component.batteryAh : undefined });
  };
  const setAh = (value: string) => {
    const batteryAh = numberValue(value);
    update({ batteryAh, capacityInputBasis: "Ah", batteryKwh: batteryAh ? component.voltage ? Number((batteryAh * component.voltage / 1000).toFixed(3)) : component.batteryKwh : undefined });
  };
  return <><Field label="Battery capacity (kWh) — enter either" required><input type="number" step="any" min="0" value={component.batteryKwh ?? ""} onChange={(event) => setKwh(event.target.value)} className="field"/></Field><Field label="Battery capacity (Ah) — enter either" required><input type="number" step="any" min="0" value={component.batteryAh ?? ""} onChange={(event) => setAh(event.target.value)} className="field"/></Field></>;
}
