"use client";

import { BatteryCharging, Cable, Camera, Gauge, Link2, Package, Plus, PlugZap, ShieldCheck, Sun, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentSpec, Project } from "@/domain/models";

type StarterSlot = { kind: ComponentSpec["kind"]; name: string; help: string };

const starterSlots: StarterSlot[] = [
  { kind: "inverter", name: "Main inverter", help: "AC output, DC input range, surge rating and model" },
  { kind: "battery", name: "Battery bank", help: "Voltage, amp-hours, chemistry, BMS and usable capacity" },
  { kind: "protection", name: "Battery breaker / fuse", help: "DC rating and protection between battery and inverter" },
  { kind: "cable", name: "Inverter to switchboard AC connection", help: "Cable, breaker, RCD/RCBO, isolator, connection point and changeover arrangement" },
  { kind: "cable", name: "Battery cable run", help: "Conductor size, length, lugs and polarity identification" },
  { kind: "isolator", name: "DC isolator / shutoff", help: "Location, rating and the circuit it disconnects" },
  { kind: "protection", name: "System earthing / bonding", help: "Array frames, inverter, battery enclosure, switchboard and generator earth paths" },
  { kind: "combiner", name: "PV combiner / connectors", help: "Combiner, connector type, inputs and output protection" },
  { kind: "monitoring", name: "System monitoring", help: "Shunt, meter, gateway or inverter monitoring connection" },
  { kind: "generator", name: "Generator", help: "Optional backup generator, changeover and charging details" },
];

const iconFor = (type: string) => type === "inverter" || type === "charger" ? PlugZap : type === "battery" ? BatteryCharging : type === "protection" || type === "isolator" ? ShieldCheck : type === "cable" ? Cable : type === "connector" || type === "combiner" ? Link2 : type === "meter" || type === "monitoring" ? Gauge : type === "panel" ? Sun : Package;

function slotRecorded(slot: StarterSlot, components: ComponentSpec[]) {
  return components.some((component) => {
    if (component.kind !== slot.kind) return false;
    if (slot.name.startsWith("Inverter to switchboard") && component.specs["Connection type"] === "Inverter to switchboard AC") return true;
    if (slot.kind !== "protection" && slot.kind !== "cable") return true;
    return component.name.toLowerCase().includes(slot.name.split(" ")[0].toLowerCase());
  });
}

function Mini({ label, value }: { label: string; value?: string | number }) {
  return <div className="rounded-xl bg-[#f1f4ef] p-2"><span className="block text-muted">{label}</span><strong className="block truncate">{value ?? "Not recorded"}</strong></div>;
}

export function SystemEquipmentOverview({ project, onAskWattson }: { project: Project; onAskWattson: () => void }) {
  const router = useRouter();
  const arrays = project.pvArrays ?? [];
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const missingSlots = starterSlots.filter((slot) => !slotRecorded(slot, project.components));
  const openStarter = (slot: StarterSlot) => router.push(`${base}/equipment/new?type=${encodeURIComponent(slot.kind)}&name=${encodeURIComponent(slot.name)}`);

  return <div className="animate-rise space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="eyebrow">System overview</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">{project.name} overview</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Record the system as it is built. Each card opens its complete technical record, with every PV string kept separate.</p></div>
      <div className="flex gap-2"><button onClick={() => router.push(`${base}/photos`)} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold"><Camera size={15}/>Photos</button><button onClick={onAskWattson} className="flex h-11 items-center gap-2 rounded-xl bg-[#213c30] px-5 text-xs font-bold text-white"><Zap size={15}/>Tell Wattson about equipment</button></div>
    </div>

    <section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">As-built system</div><h2 className="mt-2 text-xl font-extrabold">Installed equipment and connections</h2><p className="mt-1 text-xs text-muted">“Not recorded” cards are prompts only. Select the items that exist and enter what is installed.</p></div><div className="flex gap-2"><button onClick={() => router.push(`${base}/pv-strings/new`)} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white"><Plus size={14}/>Add PV string</button><button onClick={() => router.push(`${base}/equipment/new`)} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold"><Plus size={14}/>Add other</button></div></div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {arrays.map((array) => { const watts = (array.panelWatts ?? 0) * (array.panelCount ?? 0); return <button key={array.id} onClick={() => router.push(`${base}/pv-strings/${array.id}`)} className="card p-5 text-left hover:border-[#91ad98]"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3e9] text-brand"><Sun size={19}/></span><span className="rounded-full bg-[#e6f3e9] px-2 py-1 text-[9px] font-bold uppercase text-[#226342]">{array.confidence}</span></div><h3 className="mt-4 text-sm font-bold">{array.name}</h3><p className="mt-1 text-[10px] text-muted">{array.panelCount ?? "?"} × {array.panelWatts ?? "?"} W panels{watts ? ` · ${(watts / 1000).toFixed(2)} kW` : ""}</p><div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><Mini label="Panel type" value={array.panelType}/><Mini label="Cable" value={array.cableSizeMm2 ? `${array.cableSizeMm2} mm²` : undefined}/><Mini label="Length" value={array.cableLengthM ? `${array.cableLengthM} m` : undefined}/><Mini label="Connectors" value={array.connectorType}/></div><span className="mt-4 block text-[10px] font-bold text-brand">Open string record →</span></button>; })}

        {!arrays.length && <button onClick={() => router.push(`${base}/pv-strings/new`)} className="card min-h-44 border-dashed p-5 text-left hover:border-[#91ad98]"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3e9] text-brand"><Sun size={19}/></span><span className="rounded-full bg-[#edf0eb] px-2 py-1 text-[9px] font-bold uppercase text-muted">Not recorded</span></div><h3 className="mt-4 text-sm font-bold">PV1 string</h3><p className="mt-2 text-[10px] leading-4 text-muted">Panels, cable run, connectors, protection, direction and tilt</p><span className="mt-3 block text-[10px] font-bold text-brand">Add installed details →</span></button>}

        {project.components.map((component) => { const Icon = iconFor(component.kind); const specs = Object.entries(component.specs).slice(0, 2); return <button key={component.id} onClick={() => router.push(`${base}/equipment/${component.id}`)} className="card p-5 text-left hover:border-[#91ad98]"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3e9] text-brand"><Icon size={19}/></span><span className="rounded-full bg-[#e6f3e9] px-2 py-1 text-[9px] font-bold uppercase text-[#226342]">{component.status}</span></div><h3 className="mt-4 text-sm font-bold">{component.name}</h3><p className="mt-1 text-[10px] text-muted">{[component.manufacturer, component.model].filter(Boolean).join(" · ") || component.kind} · Qty {component.quantity}</p><div className="mt-4 space-y-1">{specs.length ? specs.map(([key, value]) => <div key={key} className="flex justify-between gap-3 text-[10px]"><span className="capitalize text-muted">{key.replace(/([A-Z])/g, " $1")}</span><strong>{value}</strong></div>) : <span className="text-[10px] text-muted">Specifications not recorded yet</span>}</div><span className="mt-4 block text-[10px] font-bold text-brand">Open technical record →</span></button>; })}

        {missingSlots.map((slot) => { const Icon = iconFor(slot.kind); return <button key={slot.name} onClick={() => openStarter(slot)} className="card min-h-44 border-dashed p-5 text-left hover:border-[#91ad98]"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3e9] text-brand"><Icon size={19}/></span><span className="rounded-full bg-[#edf0eb] px-2 py-1 text-[9px] font-bold uppercase text-muted">Not recorded</span></div><h3 className="mt-4 text-sm font-bold">{slot.name}</h3><p className="mt-2 text-[10px] leading-4 text-muted">{slot.help}</p><span className="mt-3 block text-[10px] font-bold text-brand">Add installed details →</span></button>; })}
      </div>
    </section>
  </div>;
}
