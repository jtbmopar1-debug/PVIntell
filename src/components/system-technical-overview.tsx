"use client";

import { Activity, BatteryCharging, Camera, Cable, Gauge, Plus, PlugZap, Sun, Waypoints, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentSpec, Project } from "@/domain/models";

const installedPhases = new Set(["monitor", "diagnose", "maintain", "explain"]);

function componentTitle(component: ComponentSpec) {
  return [component.manufacturer, component.model].filter(Boolean).join(" ") || component.name;
}

function componentSpecLines(components: ComponentSpec[]) {
  return components.flatMap((component) => Object.entries(component.specs).map(([label, value]) => ({ label, value: String(value) }))).slice(0, 3);
}

function SummaryCard({ icon: Icon, eyebrow, value, description, facts = [] }: { icon: typeof Sun; eyebrow: string; value: string; description: string; facts?: Array<{ label: string; value: string }> }) {
  return <article className="card p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="eyebrow">{eyebrow}</div><div className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">{value}</div></div><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Icon size={17}/></span></div>
    <p className="mt-1 text-[11px] leading-4 text-muted">{description}</p>
    {facts.length ? <dl className="mt-3 space-y-1.5 border-t border-line pt-3">{facts.map((fact) => <div key={`${fact.label}:${fact.value}`} className="flex justify-between gap-3 text-[10px]"><dt className="truncate text-muted">{fact.label}</dt><dd className="max-w-[65%] text-right font-bold">{fact.value}</dd></div>)}</dl> : null}
  </article>;
}

export function SystemTechnicalOverview({ project, onAskWattson, onOpenMonitor }: { project: Project; onAskWattson: () => void; onOpenMonitor: () => void }) {
  const router = useRouter();
  const installed = installedPhases.has(project.phase);
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const arrays = project.pvArrays ?? [];
  const inverters = project.components.filter((component) => component.kind === "inverter");
  const batteries = project.components.filter((component) => component.kind === "battery");
  const otherComponents = project.components.filter((component) => !["inverter", "battery", "panel", "pv_string"].includes(component.kind));
  const totalPvWatts = arrays.reduce((total, array) => total + (array.panelWatts ?? 0) * (array.panelCount ?? 0), 0);
  const totalPanels = arrays.reduce((total, array) => total + (array.panelCount ?? 0), 0);
  const totalStrings = arrays.reduce((total, array) => total + (array.strings ?? 0), 0);
  const pvConnections = [...new Set(arrays.map((array) => String(array.specifications?.["PV connection"] ?? "")).filter(Boolean))];
  const inverterQuantity = inverters.reduce((total, component) => total + component.quantity, 0);
  const batteryQuantity = batteries.reduce((total, component) => total + component.quantity, 0);
  const pvFacts = [
    { label: "Panels", value: totalPanels ? String(totalPanels) : "Not recorded" },
    { label: "Strings", value: totalStrings ? String(totalStrings) : "Not recorded" },
    { label: "Connection", value: pvConnections.length ? pvConnections.join(" · ") : "Not recorded" },
    { label: "Array records", value: String(arrays.length) },
  ];
  const inverterFacts = [
    ...inverters.slice(0, 2).map((component) => ({ label: component.name, value: `${componentTitle(component)} · Qty ${component.quantity}` })),
    ...componentSpecLines(inverters).slice(0, Math.max(0, 3 - Math.min(inverters.length, 2))),
  ];
  const batteryFacts = [
    ...batteries.slice(0, 2).map((component) => ({ label: component.name, value: `${componentTitle(component)} · Qty ${component.quantity}` })),
    ...componentSpecLines(batteries).slice(0, Math.max(0, 3 - Math.min(batteries.length, 2))),
  ];

  return <div className="animate-rise space-y-5">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><div className="eyebrow">As-built record</div><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em]">{project.name} overview</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-muted">A concise technical summary of the installed system. Detailed equipment and connection records remain in the as-built schematic.</p></div>
      <div className="flex flex-wrap gap-2">{!installed && <button onClick={() => router.push(`${base}/design`)} className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[11px] font-bold text-brand"><Zap size={14}/>Proposed design</button>}<button onClick={() => router.push(`${base}/schematic`)} className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[11px] font-bold text-brand"><Waypoints size={14}/>As-built schematic</button><button onClick={() => router.push(`${base}/photos`)} className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[11px] font-bold"><Camera size={14}/>Photos</button>{installed && <button onClick={onOpenMonitor} className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[11px] font-bold text-brand"><Activity size={14}/>Monitor</button>}<button onClick={onAskWattson} className="flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[11px] font-bold text-white"><Zap size={14}/>Ask Wattson</button></div>
    </div>

    <section>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow">System specification</div><h2 className="mt-2 text-lg font-extrabold">Installed system at a glance</h2></div><div className="flex gap-2"><button onClick={() => router.push(`${base}/pv-strings/new`)} className="flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-[11px] font-bold text-white"><Plus size={14}/>Add PV string</button><button onClick={() => router.push(`${base}/equipment/new`)} className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[11px] font-bold"><Plus size={14}/>Add equipment</button></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Cable} eyebrow="System" value={project.systemVoltage > 0 ? `${project.systemVoltage} V` : "Voltage not recorded"} description={`${project.projectType} · ${installed ? "Installed" : project.phase}`} facts={[{ label: "Installed records", value: String(project.components.length + arrays.length) }, { label: "Connections", value: String(project.connections.length) }, { label: "Other equipment", value: String(otherComponents.length) }]}/>
        <SummaryCard icon={Sun} eyebrow="PV array" value={totalPvWatts > 0 ? `${(totalPvWatts / 1000).toFixed(2)} kW` : "Not recorded"} description={arrays.length ? arrays.map((array) => array.name).join(" · ") : "Add the installed array specification."} facts={pvFacts}/>
        <SummaryCard icon={PlugZap} eyebrow="Inverter" value={inverterQuantity ? `${inverterQuantity} installed` : "Not recorded"} description={inverters.length ? inverters.map(componentTitle).join(" · ") : "Add the installed inverter specification."} facts={inverterFacts}/>
        <SummaryCard icon={BatteryCharging} eyebrow="Battery" value={batteryQuantity ? `${batteryQuantity} installed` : "Not recorded"} description={batteries.length ? batteries.map(componentTitle).join(" · ") : "Add the installed battery-bank specification."} facts={batteryFacts}/>
      </div>
    </section>

    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#eef3f8] text-brand"><Gauge size={17}/></span><div><div className="text-xs font-bold">Technical records</div><div className="text-[10px] text-muted">Open the schematic to inspect individual equipment and connections.</div></div></div><button onClick={() => router.push(`${base}/schematic`)} className="text-[11px] font-bold text-brand">Open as-built schematic →</button></section>
  </div>;
}
