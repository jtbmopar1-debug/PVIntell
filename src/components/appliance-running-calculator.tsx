"use client";

import { Plus, PlugZap, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type Appliance = { id: string; name: string; watts: string; quantity: string; hours: string };

const newAppliance = (): Appliance => ({ id: crypto.randomUUID(), name: "", watts: "", quantity: "1", hours: "" });

export function ApplianceRunningCalculator() {
  const [rows, setRows] = useState<Appliance[]>(() => [newAppliance()]);
  const dailyWh = useMemo(() => rows.reduce((total, row) => total + (Number(row.watts) || 0) * (Number(row.quantity) || 0) * (Number(row.hours) || 0), 0), [rows]);
  const update = (id: string, field: keyof Omit<Appliance, "id">, value: string) => setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));

  return <section className="card mt-4 overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b border-line p-3 sm:px-4"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><PlugZap size={15}/></span><div><div className="eyebrow">Energy use</div><h2 className="mt-1 text-base font-extrabold">Appliance running calculator</h2></div></div><button type="button" onClick={() => setRows((current) => [...current, newAppliance()])} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[10px] font-bold text-white"><Plus size={13}/>Add appliance</button></div>
    <div className="overflow-x-auto"><div className="min-w-[620px]"><div className="grid grid-cols-[minmax(150px,1fr)_100px_80px_100px_110px_32px] gap-2 border-b border-line bg-[#f5f8fb] px-3 py-2 text-[8px] font-extrabold uppercase tracking-[.08em] text-muted"><span>Appliance</span><span>Watts</span><span>Qty</span><span>Hours/day</span><span>Daily use</span><span/></div>{rows.map((row) => { const rowWh = (Number(row.watts) || 0) * (Number(row.quantity) || 0) * (Number(row.hours) || 0); return <div key={row.id} className="grid grid-cols-[minmax(150px,1fr)_100px_80px_100px_110px_32px] items-center gap-2 border-b border-line px-3 py-2 last:border-b-0"><input aria-label="Appliance name" className="field !mt-0 !h-8" placeholder="Fridge, pump, lights…" value={row.name} onChange={(event) => update(row.id, "name", event.target.value)}/><input aria-label="Wattage" className="field !mt-0 !h-8" type="number" min="0" step="any" placeholder="W" value={row.watts} onChange={(event) => update(row.id, "watts", event.target.value)}/><input aria-label="Quantity" className="field !mt-0 !h-8" type="number" min="0" step="1" value={row.quantity} onChange={(event) => update(row.id, "quantity", event.target.value)}/><input aria-label="Hours per day" className="field !mt-0 !h-8" type="number" min="0" max="24" step="any" placeholder="hrs" value={row.hours} onChange={(event) => update(row.id, "hours", event.target.value)}/><strong className="text-[11px]">{rowWh >= 1000 ? `${(rowWh / 1000).toFixed(2)} kWh` : `${rowWh.toFixed(0)} Wh`}</strong><button type="button" aria-label={`Remove ${row.name || "appliance"}`} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="grid size-7 place-items-center rounded-md text-muted hover:bg-[#fff0eb] hover:text-[#a7442d] disabled:opacity-25"><Trash2 size={13}/></button></div>;})}</div></div>
    <div className="flex items-baseline justify-between border-t border-line bg-[#eef5fb] px-4 py-3"><span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-brand">Combined daily use</span><strong className="text-lg tracking-[-.03em]">{dailyWh >= 1000 ? `${(dailyWh / 1000).toFixed(2)} kWh/day` : `${dailyWh.toFixed(0)} Wh/day`}</strong></div>
  </section>;
}
