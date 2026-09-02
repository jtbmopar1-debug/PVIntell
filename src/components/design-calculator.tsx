"use client";

import { BatteryCharging, Cable, Calculator, CheckCircle2, Circle, Save, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DesignCalculatorState, Project, Site } from "@/domain/models";

const n = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value: number, places = 1) => Number.isFinite(value) ? value.toFixed(places) : "—";

function NumberField({ label, value, unit, max, onChange }: { label: string; value?: number; unit?: string; max?: number; onChange: (value: number) => void }) {
  return <label className="space-y-1.5 text-xs font-bold"><span>{label}</span><div className="flex overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand"><input type="number" min="0" max={max} step="any" value={value || ""} onChange={(event) => onChange(n(event.target.value))} className="h-11 min-w-0 flex-1 bg-transparent px-3 outline-none"/>{unit && <span className="grid place-items-center border-l border-line bg-[#f5f8fb] px-3 text-[10px] text-muted">{unit}</span>}</div></label>;
}

function Result({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-line bg-white p-4"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">{label}</span><strong className="mt-2 block text-2xl tracking-[-.04em]">{value}</strong><p className="mt-1 text-[10px] leading-4 text-muted">{detail}</p></div>;
}

export function DesignCalculator({ project, site }: { project: Project; site: Site }) {
  const [design, setDesign] = useState<DesignCalculatorState>(() => ({
    panelType: "bifacial", fitStatus: "unverified", peakSunHours: project.peakSunHours,
    systemEfficiencyPercent: 80, batteryQuantity: 1, usableBatteryPercent: 80,
    connectionType: "dc", maxVoltageDropPercent: 2,
    ...project.designCalculator,
  }));
  const [status, setStatus] = useState("");
  const set = <K extends keyof DesignCalculatorState>(key: K, value: DesignCalculatorState[K]) => setDesign((current) => ({ ...current, [key]: value }));
  const results = useMemo(() => {
    const pvKw = n(design.panelWatts) * n(design.panelCount) / 1000 || n(design.targetPvKw);
    const rawArea = n(design.panelLengthMm) * n(design.panelWidthMm) / 1_000_000 * n(design.panelCount);
    const totalWeight = n(design.panelWeightKg) * n(design.panelCount);
    const latitude = Math.abs(site.latitude ?? 35);
    const idealAzimuth = (site.latitude ?? -1) < 0 ? 0 : 180;
    const azimuthDifference = Math.abs((((n(design.azimuthDegrees) - idealAzimuth) + 540) % 360) - 180);
    const orientationFactor = Math.max(.55, 1 - azimuthDifference / 360 - Math.abs(n(design.tiltDegrees) - latitude) / 300);
    const dailyKwh = pvKw * n(design.peakSunHours, project.peakSunHours) * (n(design.systemEfficiencyPercent, 80) / 100) * orientationFactor;
    const nominalBattery = n(design.batteryVoltage) * n(design.batteryAh) * n(design.batteryQuantity, 1) / 1000;
    const usableBattery = nominalBattery ? nominalBattery * n(design.usableBatteryPercent, 80) / 100 : n(design.batteryUsableKwh);
    const factor = design.connectionType === "ac_three" ? Math.sqrt(3) : 2;
    const dropVolts = n(design.cableSizeMm2) ? factor * .0175 * n(design.connectionLengthM) * n(design.connectionCurrent) / n(design.cableSizeMm2) : 0;
    const dropPercent = n(design.connectionVoltage) ? dropVolts / n(design.connectionVoltage) * 100 : 0;
    const allowedDrop = n(design.connectionVoltage) * n(design.maxVoltageDropPercent, 2) / 100;
    const minimumCable = allowedDrop ? factor * .0175 * n(design.connectionLengthM) * n(design.connectionCurrent) / allowedDrop : 0;
    return { pvKw, rawArea, totalWeight, dailyKwh, orientationFactor, nominalBattery, usableBattery, dropVolts, dropPercent, minimumCable, planningBreaker: n(design.connectionCurrent) * 1.25 };
  }, [design, project.peakSunHours, site.latitude]);

  async function save(nextDesign: DesignCalculatorState = design) {
    setStatus("Saving…");
    try {
      const response = await fetch("/api/design-calculator", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, design: nextDesign }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save design");
      setStatus("Working design saved");
    } catch (problem) { setStatus(problem instanceof Error ? problem.message : "Could not save design"); }
  }

  function toggleProposedItem(id: string) {
    const nextValue = !(design.proposedChecklist?.[id] ?? false);
    const nextDesign: DesignCalculatorState = {
      ...design,
      proposedChecklist: { ...(design.proposedChecklist ?? {}), [id]: nextValue },
    };
    setDesign(nextDesign);
    void save(nextDesign);
  }

  return <div className="animate-rise space-y-6">
    <div><div className="eyebrow">Stage 2 · proposed outline</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">{project.name} proposed system outline</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Review the four main parts Wattson is proposing. Nothing here is purchased or installed.</p>{status && <p className="mt-2 text-[10px] font-bold text-brand">{status}</p>}</div>

    <ProposedPlan project={project} design={design} onToggle={toggleProposedItem}/>

    <details className="card overflow-hidden">
      <summary className="cursor-pointer list-none p-5"><div className="flex items-center justify-between gap-4"><div><div className="eyebrow">Optional details</div><h2 className="mt-2 text-base font-extrabold">Advanced planning numbers</h2><p className="mt-1 text-xs leading-5 text-muted">Most users can leave this closed. Open it only to inspect or change Wattson’s technical estimates.</p></div><span className="shrink-0 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-brand">Show details</span></div></summary>
      <div className="space-y-6 border-t border-line bg-[#f7fafc] p-5">
    {(design.startingStage || design.expansionPath || design.nextValidation) && <section className="card p-5"><div className="eyebrow">Wattson’s staged plan</div><div className="mt-4 grid gap-4 md:grid-cols-3"><div><strong className="text-sm">Start useful</strong><p className="mt-1 text-xs leading-5 text-muted">{design.startingStage || "Not proposed yet"}</p></div><div><strong className="text-sm">Expand cleanly</strong><p className="mt-1 text-xs leading-5 text-muted">{design.expansionPath || "Not proposed yet"}</p></div><div><strong className="text-sm">Validate next</strong><p className="mt-1 text-xs leading-5 text-muted">{design.nextValidation || "Not proposed yet"}</p></div></div></section>}

    <section className="card overflow-hidden"><div className="flex items-center gap-3 border-b border-line bg-[#fff8d8] p-5"><Sun className="text-[#d99b00]" size={20}/><div><h2 className="font-extrabold">Solar array and physical fit</h2><p className="text-[10px] text-muted">Panel count is not fit-confirmed until usable dimensions, gaps, setbacks and obstructions are checked.</p></div></div><div className="grid gap-6 p-5 xl:grid-cols-[1.4fr_.8fr]"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="space-y-1.5 text-xs font-bold"><span>Panel type</span><select value={design.panelType} onChange={(e) => set("panelType", e.target.value as DesignCalculatorState["panelType"])} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="bifacial">Bifacial</option><option value="monofacial">Monofacial</option><option value="other">Other</option><option value="not_selected">Not selected</option></select></label><NumberField label="Panel rating" value={design.panelWatts} unit="W" onChange={(v) => set("panelWatts", v)}/><NumberField label="Panel count" value={design.panelCount} onChange={(v) => set("panelCount", Math.round(v))}/><NumberField label="Panel length" value={design.panelLengthMm} unit="mm" onChange={(v) => set("panelLengthMm", v)}/><NumberField label="Panel width" value={design.panelWidthMm} unit="mm" onChange={(v) => set("panelWidthMm", v)}/><NumberField label="Panel weight" value={design.panelWeightKg} unit="kg" onChange={(v) => set("panelWeightKg", v)}/><NumberField label="Azimuth" value={design.azimuthDegrees} unit="°" max={360} onChange={(v) => set("azimuthDegrees", v)}/><NumberField label="Tilt" value={design.tiltDegrees} unit="°" max={90} onChange={(v) => set("tiltDegrees", v)}/><NumberField label="Peak sun hours" value={design.peakSunHours} unit="h/day" max={24} onChange={(v) => set("peakSunHours", v)}/><NumberField label="Planning efficiency" value={design.systemEfficiencyPercent} unit="%" max={100} onChange={(v) => set("systemEfficiencyPercent", v)}/><label className="space-y-1.5 text-xs font-bold sm:col-span-2"><span>Physical fit status</span><select value={design.fitStatus} onChange={(e) => set("fitStatus", e.target.value as DesignCalculatorState["fitStatus"])} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="unverified">Not checked yet</option><option value="verified">Verified against usable area</option><option value="does_not_fit">Does not fit</option></select></label></div><div className="grid grid-cols-2 gap-3"><Result label="PV rating" value={`${round(results.pvKw, 2)} kW`} detail="Panel nameplate total"/><Result label="Module area" value={`${round(results.rawArea, 1)} m²`} detail="Panels only; add mounting gaps and required clearances"/><Result label="Panel weight" value={`${round(results.totalWeight, 0)} kg`} detail="Modules only; structure and mounting still require assessment"/><Result label="Planning output" value={`${round(results.dailyKwh, 1)} kWh/day`} detail={`Illustrative yield using ${round(results.orientationFactor * 100, 0)}% orientation factor; not a production guarantee`}/></div></div>{design.panelType === "bifacial" && <p className="border-t border-line bg-[#f5f8fb] px-5 py-3 text-[10px] leading-4 text-muted">Bifacial is evaluated by default, but rear-side gain is not counted here. It depends on clearance, spacing and the surface below the panel; a flush roof can provide little extra rear yield.</p>}</section>

    <div className="grid gap-6 xl:grid-cols-2"><section className="card overflow-hidden"><div className="flex items-center gap-3 border-b border-line p-5"><BatteryCharging className="text-brand" size={20}/><h2 className="font-extrabold">Inverter and battery</h2></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-bold sm:col-span-2"><span>Equipment arrangement</span><select value={design.architecture ?? "not_decided"} onChange={(e) => set("architecture", e.target.value as DesignCalculatorState["architecture"])} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="not_decided">Not decided</option><option value="combined_hybrid_inverter">Combined hybrid inverter</option><option value="separate_solar_controller_and_inverter">Separate charge controller and inverter</option><option value="ac_coupled">AC-coupled</option></select></label><NumberField label="Inverter continuous rating" value={design.inverterKw} unit="kW" onChange={(v) => set("inverterKw", v)}/><label className="space-y-1.5 text-xs font-bold"><span>Battery chemistry</span><input value={design.batteryChemistry ?? ""} onChange={(e) => set("batteryChemistry", e.target.value)} placeholder="e.g. LiFePO₄" className="h-11 w-full rounded-xl border border-line bg-white px-3"/></label><NumberField label="Battery voltage" value={design.batteryVoltage} unit="V" onChange={(v) => set("batteryVoltage", v)}/><NumberField label="Capacity per battery" value={design.batteryAh} unit="Ah" onChange={(v) => set("batteryAh", v)}/><NumberField label="Number of batteries" value={design.batteryQuantity} onChange={(v) => set("batteryQuantity", Math.round(v))}/><NumberField label="Planning usable amount" value={design.usableBatteryPercent} unit="%" max={100} onChange={(v) => set("usableBatteryPercent", v)}/></div><div className="grid grid-cols-2 gap-3 border-t border-line bg-[#f5f8fb] p-5"><Result label="Nominal storage" value={`${round(results.nominalBattery, 1)} kWh`} detail="Voltage × amp-hours × quantity"/><Result label="Planning usable" value={`${round(results.usableBattery, 1)} kWh`} detail="Confirm the manufacturer’s allowed limits and BMS settings"/></div></section>

    <section className="card overflow-hidden"><div className="flex items-center gap-3 border-b border-line p-5"><Cable className="text-brand" size={20}/><div><h2 className="font-extrabold">Cable and protection check</h2><p className="text-[10px] text-muted">A first-pass planning check, not a final compliant cable or breaker selection.</p></div></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-bold"><span>Connection type</span><select value={design.connectionType} onChange={(e) => set("connectionType", e.target.value as DesignCalculatorState["connectionType"])} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="dc">DC</option><option value="ac_single">Single-phase AC</option><option value="ac_three">Three-phase AC</option></select></label><NumberField label="Operating voltage" value={design.connectionVoltage} unit="V" onChange={(v) => set("connectionVoltage", v)}/><NumberField label="Expected current" value={design.connectionCurrent} unit="A" onChange={(v) => set("connectionCurrent", v)}/><NumberField label="One-way cable length" value={design.connectionLengthM} unit="m" onChange={(v) => set("connectionLengthM", v)}/><NumberField label="Chosen copper cable" value={design.cableSizeMm2} unit="mm²" onChange={(v) => set("cableSizeMm2", v)}/><NumberField label="Chosen breaker / fuse" value={design.breakerAmps} unit="A" onChange={(v) => set("breakerAmps", v)}/><NumberField label="Maximum voltage drop" value={design.maxVoltageDropPercent} unit="%" max={20} onChange={(v) => set("maxVoltageDropPercent", v)}/></div><div className="grid grid-cols-2 gap-3 border-t border-line bg-[#f5f8fb] p-5"><Result label="Calculated drop" value={`${round(results.dropVolts, 2)} V / ${round(results.dropPercent, 1)}%`} detail="Basic copper-conductor calculation; temperature and installation derating not included"/><Result label="Minimum by drop only" value={`${round(results.minimumCable, 1)} mm²`} detail={`Current-carrying capacity, fault protection and local rules may require larger; 125% current reference is ${round(results.planningBreaker, 1)} A`}/></div></section></div>

    <div className="rounded-2xl border border-[#f0d57c] bg-[#fff8d8] p-4 text-xs leading-5"><Calculator className="mr-2 inline text-[#b77d00]" size={16}/><strong>Working design only.</strong> Exact PV string voltage/current limits, cable installation method, ambient temperature, fault current, breaker curves, manufacturer instructions and local electrical requirements still have to be checked before build values are accepted.</div>
    <button onClick={() => void save()} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white"><Save size={15}/>Save advanced changes</button>
      </div>
    </details>
  </div>;
}

function ProposedPlan({ project, design, onToggle }: { project: Project; design: DesignCalculatorState; onToggle: (id: string) => void }) {
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const items = [
    {
      id: "solar-array",
      title: "Solar array and mounting",
      detail: design.panelCount ? `${design.panelCount} panels are in the working design. Confirm fit, structure, access and mounting before buying.` : "No panel count is proposed yet. Wattson needs physical-fit evidence before an array can be confirmed.",
      help: "Measure the usable rectangle, subtract obstructions, then compare it with a real panel and mounting layout.",
    },
    {
      id: "inverter",
      title: "Inverter arrangement",
      detail: design.architecture === "separate_solar_controller_and_inverter" ? "Separate charge controller and inverter are proposed." : design.architecture === "combined_hybrid_inverter" ? "A combined hybrid inverter is proposed." : design.architecture === "ac_coupled" ? "An AC-coupled arrangement is proposed." : "The inverter arrangement is still to be chosen.",
      help: "Check a dry location, manufacturer clearances, ventilation and a practical cable route before selecting a model.",
    },
    {
      id: "battery",
      title: "Battery storage",
      detail: design.batteryUsableKwh ? `${design.batteryUsableKwh} kWh usable storage is a planning estimate.` : "Battery capacity is not sized yet.",
      help: "Plan a protected, accessible location and confirm the battery’s voltage, chemistry and BMS limits before purchase.",
    },
    {
      id: "protection",
      title: "Cables, isolation and protection",
      detail: "This stays proposed until the actual equipment, cable route and manufacturer requirements are known.",
      help: "Do not choose final cable or fuse sizes from this card. Wattson will help gather the equipment ratings and route details first.",
    },
  ];
  const planningComplete = items.every((item) => design.proposedChecklist?.[item.id]);
  return <section className="card overflow-hidden"><div className="border-b border-line bg-[#fff1ee] p-5"><div className="eyebrow text-[#b9412b]">Proposed system outline</div><h2 className="mt-2 text-xl font-extrabold">What Wattson is planning</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-muted">These are not installed components. A green tick means you have reviewed the planning requirements for that item — not that it has been purchased, wired or approved.</p></div><div className="grid gap-4 p-5 md:grid-cols-2">{items.map((item) => { const complete = design.proposedChecklist?.[item.id] ?? false; return <article key={item.id} className={`rounded-2xl border p-4 ${complete ? "border-[#9bd2ad] bg-[#f2fbf5]" : "border-[#ecaaa0] bg-[#fff7f5]"}`}><div className="flex items-start justify-between gap-3"><div><div className={`text-[10px] font-bold uppercase tracking-[.12em] ${complete ? "text-[#17603b]" : "text-[#b9412b]"}`}>{complete ? "Planning reviewed" : "Needs planning"}</div><h3 className="mt-2 text-sm font-extrabold">{item.title}</h3></div><button type="button" onClick={() => onToggle(item.id)} className={`grid size-9 shrink-0 place-items-center rounded-xl border ${complete ? "border-[#74bd8d] bg-white text-[#17603b]" : "border-[#e79b91] bg-white text-[#b9412b]"}`} title={complete ? "Mark planning as needing review" : "Mark planning requirements reviewed"}>{complete ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button></div><p className="mt-3 text-[11px] leading-5 text-muted">{item.detail}</p><details className="mt-3 rounded-xl bg-white/70 p-3 text-[11px] leading-5 text-muted"><summary className="cursor-pointer font-bold text-brand">What do I need to check?</summary><p className="mt-2">{item.help}</p></details><Link href={`${base}?view=wattson`} className="mt-4 inline-flex text-[11px] font-bold text-brand">Ask Wattson about this component →</Link></article>; })}</div><div className="flex flex-col justify-between gap-3 border-t border-line bg-[#f7fafc] p-5 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-muted">{planningComplete ? "Outline accepted. Next, review how these parts connect in the proposed build schematic." : "Review all four proposed components to unlock the proposed build schematic."}</p>{planningComplete ? <Link href={`${base}/design/schematic`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-xs font-bold text-white">Continue to proposed schematic →</Link> : <span className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#dce7f1] px-5 text-xs font-bold text-[#6d7f91]">Continue to proposed schematic</span>}</div></section>;
}

export function ProposedBuildSchematic({ project }: { project: Project }) {
  const router = useRouter();
  const [design, setDesign] = useState<DesignCalculatorState>(() => ({ ...project.designCalculator }));
  const [status, setStatus] = useState("");
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const outlineComplete = ["solar-array", "inverter", "battery", "protection"].every((id) => design.proposedChecklist?.[id]);
  const reviewed = design.proposedChecklist?.["proposed-schematic"] ?? false;

  async function acceptAndContinue() {
    if (reviewed) {
      router.push(`${base}?view=build`);
      return;
    }
    const nextDesign: DesignCalculatorState = {
      ...design,
      proposedChecklist: { ...(design.proposedChecklist ?? {}), "proposed-schematic": true },
      proposedAsBuiltDraft: createProposedAsBuiltDraft(design),
    };
    setStatus("Saving your reviewed layout…");
    const response = await fetch("/api/design-calculator", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, design: nextDesign }) });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Could not save the proposed schematic.");
      return;
    }
    setDesign(nextDesign);
    router.push(`${base}?view=build`);
  }

  if (!outlineComplete) return <div className="animate-rise space-y-5"><section className="card p-6"><div className="eyebrow">Proposed build schematic</div><h1 className="mt-3 text-2xl font-extrabold">Finish the system outline first</h1><p className="mt-2 text-sm leading-6 text-muted">Review the four proposed system parts before Wattson shows how they connect.</p><Link href={`${base}/design`} className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-xs font-bold text-white">Return to proposed outline</Link></section></div>;

  return <div className="animate-rise space-y-5"><div><div className="eyebrow">Stage 3 · proposed schematic</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">{project.name} proposed build schematic</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">First you accepted the parts. Now check how Wattson expects those parts to work together. Nothing shown here is installed yet.</p></div><section className="card overflow-hidden"><ProposedSchematic design={design} reviewed={reviewed} onToggle={() => void acceptAndContinue()} wattsonHref={`${base}?view=wattson`}/></section>{status && <p className="text-xs font-semibold text-brand">{status}</p>}<Link href={`${base}/design`} className="inline-flex text-xs font-bold text-brand">← Back to proposed outline</Link></div>;
}

function ProposedSchematic({ design, reviewed, onToggle, wattsonHref }: { design: DesignCalculatorState; reviewed: boolean; onToggle: () => void; wattsonHref: string }) {
  const draft = createProposedAsBuiltDraft(design);

  return <section className="border-t border-line bg-[#f6f9fc] p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="eyebrow">Proposed build schematic · easy guide</div>
        <h3 className="mt-2 text-lg font-extrabold">How your planned power system would work</h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Follow the coloured cables between the pictures to see the whole planned system. Select any picture if you want Wattson to explain that part.</p>
      </div>
      <Link href={wattsonHref} className="shrink-0 text-xs font-bold text-brand">Ask Wattson to explain this picture →</Link>
    </div>

    <DraftProposedSchematicCanvas draft={draft} wattsonHref={wattsonHref}/>

    <div className="mt-4 rounded-xl border border-[#e6cc74] bg-[#fff9df] p-3 text-[11px] leading-5 text-[#624b14]"><strong>This is a plan, not permission to wire it.</strong> The actual equipment models, cable sizes, fuses, isolators, ventilation, mounting and local rules must be checked before any work begins.</div>
    <p className="mt-4 text-[11px] leading-5 text-muted">When you review this picture, PVIntell saves it as a potential draft for the later as-built schematic. The real as-built record stays empty until you confirm the actual equipment and connections.</p>
    <button type="button" onClick={onToggle} className={`mt-5 flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs font-bold ${reviewed ? "border-[#9bd2ad] bg-[#f2fbf5] text-[#17603b]" : "border-[#8ab0d2] bg-white text-brand"}`}><span>{reviewed ? "Layout understood — continue to build plan" : "I understand this proposed layout — save it and continue to build"}</span>{reviewed ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button>
  </section>;
}

function DraftProposedSchematicCanvas({ draft, wattsonHref }: { draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>; wattsonHref: string }) {
  const nodeWidth = 140;
  const nodeCentre = 70;
  const nodes = draft.nodes ?? [];
  const connections = draft.connections ?? [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pathFor = (fromId: string, toId: string, offset = 0) => {
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) return "";
    const x1 = from.x + nodeWidth;
    const y1 = from.y + 58 + offset;
    const x2 = to.x;
    const y2 = to.y + 58 + offset;
    if (x2 >= x1) {
      const bend = Math.max(45, Math.abs(x2 - x1) * .5);
      return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    }
    const fromCentre = from.x + nodeCentre + offset;
    const toCentre = to.x + nodeCentre + offset;
    return `M ${fromCentre} ${from.y + 122} C ${fromCentre} ${from.y + 185}, ${toCentre} ${to.y - 65}, ${toCentre} ${to.y}`;
  };

  return <div className="mt-5 overflow-x-auto rounded-2xl border border-[#bad0e4] bg-white">
    <div className="flex min-w-[1120px] items-center gap-4 border-b border-line bg-[#f8fbfe] px-4 py-2 text-[9px] font-semibold text-muted"><strong className="text-brand">Draft proposed schematic</strong><span><b className="text-[#d94141]">Red + black</b> = solar or battery cable</span><span><b className="text-[#d99500]">Gold</b> = power to the building</span><span><b className="text-[#25875a]">Green</b> = safety earth</span><span className="ml-auto">Cable sizes and safety parts still need checking</span></div>
    <div className="relative h-[610px] min-w-[1120px] bg-[radial-gradient(circle,#c8d7e4_1px,transparent_1px),radial-gradient(circle_at_50%_45%,rgba(246,201,69,.12),transparent_22rem)] bg-[size:20px_20px,auto]" role="img" aria-label="Draft proposed solar power system schematic">
      <svg viewBox="0 0 1120 610" className="absolute inset-0 h-full w-full" aria-hidden>
        {connections.map((connection) => {
          if (connection.kind === "solar-dc" || connection.kind === "battery-dc") return <g key={`${connection.from}:${connection.to}`}><path d={pathFor(connection.from, connection.to, -3)} fill="none" stroke="#dc4444" strokeWidth="4"/><path d={pathFor(connection.from, connection.to, 4)} fill="none" stroke="#202d38" strokeWidth="3"/></g>;
          const colour = connection.kind === "earth" ? "#25875a" : "#d99500";
          return <path key={`${connection.from}:${connection.to}`} d={pathFor(connection.from, connection.to)} fill="none" stroke={colour} strokeWidth="4"/>;
        })}
      </svg>
      {connections.map((connection) => {
        const from = byId.get(connection.from);
        const to = byId.get(connection.to);
        if (!from || !to) return null;
        return <span key={`label:${connection.from}:${connection.to}`} className="absolute z-10 -translate-x-1/2 rounded-full border border-line bg-white/95 px-1.5 py-0.5 text-[8px] font-bold text-[#4d6176] shadow-sm" style={{ left: (from.x + nodeWidth + to.x) / 2, top: (from.y + to.y) / 2 + 48 }}>{connection.label}</span>;
      })}
      {nodes.map((node) => <Link key={node.id} href={wattsonHref} className="absolute z-20 w-[140px] text-center" style={{ left: node.x, top: node.y }} title={`Ask Wattson about ${node.label}`}>
        <span className="block overflow-hidden rounded-2xl border border-[#b8cce0] bg-white p-2 shadow-[0_8px_22px_rgba(20,60,99,.12)] transition hover:-translate-y-0.5 hover:border-brand">
          <span className="relative block h-[72px] overflow-hidden rounded-xl bg-[#f4f7fa]"><Image src={node.image} alt="" fill sizes="124px" className="object-contain p-1.5"/></span>
          <span className="mt-1.5 block text-[10px] font-extrabold text-[#102d4d]">{node.label}</span>
          <span className="mt-1 block text-[8px] leading-3 text-muted">{node.detail}</span>
          <span className="mt-1.5 inline-flex rounded-full bg-[#fff1cc] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.08em] text-[#805d00]">Proposed · ask Wattson</span>
        </span>
      </Link>)}
    </div>
  </div>;
}

function createProposedAsBuiltDraft(design: DesignCalculatorState): NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]> {
  type Draft = NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>;
  const flow = design.architecture === "separate_solar_controller_and_inverter"
    ? ["Solar panels", "Solar charge controller", "Battery storage", "Inverter", "Your lights, outlets and tools"]
    : design.architecture === "combined_hybrid_inverter"
      ? ["Solar panels", "Hybrid inverter / charger", "Your lights, outlets and tools"]
      : design.architecture === "ac_coupled"
        ? ["Solar panels", "PV inverter", "AC connection", "Your lights, outlets and tools"]
        : ["Solar panels", "Inverter / charger to be selected", "Your lights, outlets and tools"];
  const nodes: NonNullable<Draft["nodes"]> = [
    { id: "solar", label: "Solar panels", detail: design.panelCount ? `${design.panelCount} × ${design.panelWatts ?? "?"} W proposed` : "Panel count still to be checked", image: "/schematic-components/solar-panel-pv-module.jpg", x: 35, y: 30 },
    { id: "battery", label: "Battery storage", detail: design.batteryVoltage ? `${design.batteryVoltage} V storage proposed` : "Storage size still to be checked", image: "/schematic-components/lifepo4-battery-bank.jpg", x: 35, y: 345 },
    { id: "switchboard", label: "Building power board", detail: "Sends power to lights, outlets and tools", image: "/schematic-components/ac-distribution-board.jpg", x: 940, y: 180 },
    { id: "earth", label: "Safety earth", detail: "Provides a safety path into the ground", image: "/schematic-components/earth-electrode.svg", x: 940, y: 415 },
  ];
  const connections: NonNullable<Draft["connections"]> = [];
  if (design.architecture === "separate_solar_controller_and_inverter") {
    nodes.push(
      { id: "solar-safety", label: "Solar safety switch", detail: "Lets the solar panels be safely disconnected", image: "/schematic-components/dc-disconnect-isolator.jpg", x: 250, y: 30 },
      { id: "controller", label: "Solar power controller", detail: "Controls power going into the battery", image: "/schematic-components/mppt-charge-controller.jpg", x: 465, y: 30 },
      { id: "battery-safety", label: "Battery fuse and switch", detail: "Protects the battery cable and disconnects it", image: "/schematic-components/dc-fuse.jpg", x: 250, y: 345 },
      { id: "inverter", label: "Main power box", detail: design.inverterKw ? `Proposed inverter / charger: ${design.inverterKw} kW` : "Changes battery power into building power", image: "/schematic-components/hybrid-inverter.jpg", x: 545, y: 180 },
      { id: "ac-safety", label: "Building safety switch", detail: "Protects the cable feeding the building", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 745, y: 180 },
    );
    connections.push(
      { from: "solar", to: "solar-safety", label: "Power from panels", kind: "solar-dc" },
      { from: "solar-safety", to: "controller", label: "Safe solar feed", kind: "solar-dc" },
      { from: "controller", to: "battery", label: "Power charging battery", kind: "battery-dc" },
      { from: "battery", to: "battery-safety", label: "Stored battery power", kind: "battery-dc" },
      { from: "battery-safety", to: "inverter", label: "Safe battery feed", kind: "battery-dc" },
      { from: "inverter", to: "ac-safety", label: "Building power", kind: "ac" },
      { from: "ac-safety", to: "switchboard", label: "To power board", kind: "ac" },
      { from: "switchboard", to: "earth", label: "Safety earth wire", kind: "earth" },
    );
  } else if (design.architecture === "ac_coupled") {
    nodes.push(
      { id: "solar-safety", label: "Solar safety switch", detail: "Lets the solar panels be safely disconnected", image: "/schematic-components/dc-disconnect-isolator.jpg", x: 240, y: 30 },
      { id: "pv-inverter", label: "Solar power box", detail: "Changes panel power into building power", image: "/schematic-components/string-inverter.jpg", x: 445, y: 30 },
      { id: "battery-safety", label: "Battery fuse and switch", detail: "Protects and disconnects the battery", image: "/schematic-components/dc-fuse.jpg", x: 240, y: 345 },
      { id: "battery-inverter", label: "Battery power box", detail: "Controls charging and stored power", image: "/schematic-components/hybrid-inverter.jpg", x: 445, y: 345 },
      { id: "ac-safety", label: "Building safety switch", detail: "Protects the cable feeding the building", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 745, y: 180 },
    );
    connections.push(
      { from: "solar", to: "solar-safety", label: "Power from panels", kind: "solar-dc" },
      { from: "solar-safety", to: "pv-inverter", label: "Safe solar feed", kind: "solar-dc" },
      { from: "pv-inverter", to: "ac-safety", label: "Solar power for building", kind: "ac" },
      { from: "battery", to: "battery-safety", label: "Stored battery power", kind: "battery-dc" },
      { from: "battery-safety", to: "battery-inverter", label: "Safe battery feed", kind: "battery-dc" },
      { from: "battery-inverter", to: "ac-safety", label: "Battery power for building", kind: "ac" },
      { from: "ac-safety", to: "switchboard", label: "To power board", kind: "ac" },
      { from: "switchboard", to: "earth", label: "Safety earth wire", kind: "earth" },
    );
  } else {
    nodes.push(
      { id: "solar-safety", label: "Solar safety switch", detail: "Lets the solar panels be safely disconnected", image: "/schematic-components/dc-disconnect-isolator.jpg", x: 250, y: 30 },
      { id: "battery-safety", label: "Battery fuse and switch", detail: "Protects and disconnects the battery", image: "/schematic-components/dc-fuse.jpg", x: 250, y: 345 },
      { id: "inverter", label: "Main power box", detail: design.inverterKw ? `Proposed inverter / charger: ${design.inverterKw} kW` : "Manages solar, battery and building power", image: "/schematic-components/hybrid-inverter.jpg", x: 545, y: 180 },
      { id: "ac-safety", label: "Building safety switch", detail: "Protects the cable feeding the building", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 745, y: 180 },
    );
    connections.push(
      { from: "solar", to: "solar-safety", label: "Power from panels", kind: "solar-dc" },
      { from: "solar-safety", to: "inverter", label: "Safe solar feed", kind: "solar-dc" },
      { from: "battery", to: "battery-safety", label: "Stored battery power", kind: "battery-dc" },
      { from: "battery-safety", to: "inverter", label: "Safe battery feed", kind: "battery-dc" },
      { from: "inverter", to: "ac-safety", label: "Building power", kind: "ac" },
      { from: "ac-safety", to: "switchboard", label: "To power board", kind: "ac" },
      { from: "switchboard", to: "earth", label: "Safety earth wire", kind: "earth" },
    );
  }
  return { createdAt: new Date().toISOString(), architecture: design.architecture, flow, nodes, connections, panelCount: design.panelCount, panelWatts: design.panelWatts, batteryVoltage: design.batteryVoltage, batteryAh: design.batteryAh, batteryQuantity: design.batteryQuantity, inverterKw: design.inverterKw };
}
