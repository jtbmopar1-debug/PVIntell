"use client";

import { BatteryCharging, Cable, Camera, Gauge, Link2, Package, Plus, PlugZap, ShieldCheck, Sun, Waypoints, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import type { Project } from "@/domain/models";

const iconFor = (type: string) => type === "inverter" || type === "charger" ? PlugZap : type === "battery" ? BatteryCharging : type === "protection" || type === "isolator" ? ShieldCheck : type === "cable" ? Cable : type === "connector" || type === "combiner" ? Link2 : type === "meter" || type === "monitoring" ? Gauge : type === "panel" ? Sun : Package;

function Mini({ label, value }: { label: string; value?: string | number }) {
  return <div className="rounded-xl bg-[#eef3f8] p-2"><span className="block text-muted">{label}</span><strong className="block truncate">{value ?? "Not recorded"}</strong></div>;
}

export function SystemEquipmentOverview({ project, onAskWattson }: { project: Project; onAskWattson: () => void }) {
  const router = useRouter();
  const installed = ["monitor", "diagnose", "maintain", "explain"].includes(project.phase);
  const arrays = (project.pvArrays ?? []).filter((array) => array.confidence === "confirmed");
  const components = project.components.filter((component) => component.status === "confirmed");
  const connections = project.connections.filter((connection) => connection.confidence === "confirmed");
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const naturalCardRefs = [
    ...arrays.map((array) => `pv:${array.id}`),
    ...components.map((component) => `component:${component.id}`),
    ...connections.map((connection) => `connection:${connection.id}`),
  ];
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = [...project.overviewCardOrder]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.nodeRef)
      .filter((nodeRef) => naturalCardRefs.includes(nodeRef));
    return [...saved, ...naturalCardRefs.filter((nodeRef) => !saved.includes(nodeRef))];
  });
  const [draggedCard, setDraggedCard] = useState<string>();
  const [orderMessage, setOrderMessage] = useState("");

  async function moveCard(targetRef: string) {
    if (!draggedCard || draggedCard === targetRef) return;
    const next = cardOrder.filter((nodeRef) => nodeRef !== draggedCard);
    const targetIndex = next.indexOf(targetRef);
    next.splice(targetIndex < 0 ? next.length : targetIndex, 0, draggedCard);
    setCardOrder(next);
    setDraggedCard(undefined);
    setOrderMessage("Saving card order…");
    try {
      const response = await fetch("/api/overview-card-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, nodeRefs: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save card order");
      setOrderMessage("Card order saved");
    } catch (problem) {
      setOrderMessage(problem instanceof Error ? problem.message : "Could not save card order");
    }
  }

  function dragProps(nodeRef: string) {
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLButtonElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/pvintell-overview-card", nodeRef);
        setDraggedCard(nodeRef);
      },
      onDragOver: (event: DragEvent<HTMLButtonElement>) => event.preventDefault(),
      onDrop: (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        void moveCard(nodeRef);
      },
      onDragEnd: () => setDraggedCard(undefined),
      style: {
        order: cardOrder.indexOf(nodeRef),
        opacity: draggedCard === nodeRef ? 0.55 : 1,
      },
    };
  }

  return <div className="animate-rise space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="eyebrow">Installed system record</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">{project.name} System Overview</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">The commissioned system’s actual equipment and as-built records.</p></div>
      <div className="flex flex-wrap gap-2">{!installed && <button onClick={() => router.push(`${base}/design`)} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand"><Zap size={15}/>Proposed design</button>}<button onClick={() => router.push(`${base}/schematic`)} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand"><Waypoints size={15}/>As-built schematic</button><button onClick={() => router.push(`${base}/photos`)} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold"><Camera size={15}/>Photos</button><button onClick={onAskWattson} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white"><Zap size={15}/>Tell Wattson about equipment</button></div>
    </div>

    {!installed && project.designCalculator?.proposedAsBuiltDraft && <section className="rounded-2xl border border-[#8ab0d2] bg-[#f2f8fe] p-4 text-xs leading-5 text-[#143c63]"><strong>Reviewed proposed schematic saved as a draft.</strong> It can guide this future as-built record, but it has not added or confirmed any equipment or connections.</section>}

    <section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">As-built system</div><h2 className="mt-2 text-xl font-extrabold">Confirmed installed equipment</h2><p className="mt-1 text-xs text-muted">Only confirmed equipment is shown. Drag cards to arrange the record.</p>{orderMessage && <p className="mt-2 text-[10px] font-semibold text-brand">{orderMessage}</p>}</div><div className="flex gap-2"><button onClick={() => router.push(`${base}/pv-strings/new`)} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Plus size={14}/>Add PV string</button><button onClick={() => router.push(`${base}/equipment/new`)} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold"><Plus size={14}/>Add other</button></div></div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {arrays.map((array) => { const watts = (array.panelWatts ?? 0) * (array.panelCount ?? 0); return <button key={array.id} {...dragProps(`pv:${array.id}`)} onClick={() => router.push(`${base}/pv-strings/${array.id}`)} className="card cursor-grab p-5 text-left hover:border-[#7aa6d1] active:cursor-grabbing"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Sun size={19}/></span><span className="rounded-full bg-[#e7f0fb] px-2 py-1 text-[9px] font-bold uppercase text-[#175a96]">Confirmed</span></div><h3 className="mt-4 text-sm font-bold">{array.name}</h3><p className="mt-1 text-[10px] text-muted">{array.panelCount ?? "?"} × {array.panelWatts ?? "?"} W panels{watts ? ` · ${(watts / 1000).toFixed(2)} kW` : ""}</p><div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><Mini label="PV connection" value={String(array.specifications?.["PV connection"] ?? "") || undefined}/><Mini label="Panel type" value={array.panelType}/><Mini label="Cable" value={array.cableSizeMm2 ? `${array.cableSizeMm2} mm²` : undefined}/><Mini label="Length" value={array.cableLengthM ? `${array.cableLengthM} m` : undefined}/><Mini label="Connectors" value={array.connectorType}/></div><span className="mt-4 block text-[10px] font-bold text-brand">Open string record →</span></button>; })}

        {components.map((component) => { const Icon = iconFor(component.kind); const specs = Object.entries(component.specs).slice(0, 2); return <button key={component.id} {...dragProps(`component:${component.id}`)} onClick={() => router.push(`${base}/equipment/${component.id}`)} className="card cursor-grab p-5 text-left hover:border-[#7aa6d1] active:cursor-grabbing"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Icon size={19}/></span><span className="rounded-full bg-[#e7f0fb] px-2 py-1 text-[9px] font-bold uppercase text-[#175a96]">Confirmed</span></div><h3 className="mt-4 text-sm font-bold">{component.name}</h3><p className="mt-1 text-[10px] text-muted">{[component.manufacturer, component.model].filter(Boolean).join(" · ") || component.kind} · Qty {component.quantity}</p><div className="mt-4 space-y-1">{specs.length ? specs.map(([key, value]) => <div key={key} className="flex justify-between gap-3 text-[10px]"><span className="capitalize text-muted">{key.replace(/([A-Z])/g, " $1")}</span><strong>{value}</strong></div>) : <span className="text-[10px] text-muted">Specifications not recorded yet</span>}</div><span className="mt-4 block text-[10px] font-bold text-brand">Open technical record →</span></button>; })}
        {connections.map((connection) => <button key={connection.id} {...dragProps(`connection:${connection.id}`)} onClick={() => router.push(`${base}/schematic?connection=${connection.id}`)} className="card cursor-grab p-5 text-left hover:border-[#7aa6d1] active:cursor-grabbing"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Cable size={19}/></span><span className="rounded-full bg-[#e7f0fb] px-2 py-1 text-[9px] font-bold uppercase text-[#175a96]">Confirmed</span></div><h3 className="mt-4 text-sm font-bold">{connection.name}</h3><p className="mt-1 text-[10px] text-muted">{connection.connectionType.toUpperCase()} connection</p><div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><Mini label="Cable" value={connection.cableSize}/><Mini label="Length" value={connection.cableLength}/><Mini label="Fuse" value={connection.fuseSize}/><Mini label="Breaker" value={connection.breakerSize}/><Mini label="Isolation" value={connection.isolator}/><Mini label="Route" value={connection.route}/></div><span className="mt-4 block text-[10px] font-bold text-brand">Open connection on schematic →</span></button>)}
        {!arrays.length && !components.length && !connections.length ? <div className="card p-5 text-xs text-muted">No confirmed installed equipment or connection records yet.</div> : null}
      </div>
    </section>
  </div>;
}
