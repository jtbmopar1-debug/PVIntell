"use client";

import { Cable } from "lucide-react";
import { useMemo, useState } from "react";

const asNumber = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function CableProtectionCalculator() {
  const [type, setType] = useState("dc");
  const [voltage, setVoltage] = useState(0);
  const [current, setCurrent] = useState(0);
  const [length, setLength] = useState(0);
  const [cable, setCable] = useState(0);
  const [dropLimit, setDropLimit] = useState(2);
  const [calculated, setCalculated] = useState(false);
  const result = useMemo(() => {
    const factor = type === "ac_three" ? Math.sqrt(3) : 2;
    const dropV = cable ? factor * .0175 * length * current / cable : 0;
    const dropPercent = voltage ? dropV / voltage * 100 : 0;
    const allowedV = voltage * dropLimit / 100;
    const minimum = allowedV ? factor * .0175 * length * current / allowedV : 0;
    const standardSizes = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
    const recommended = standardSizes.find((size) => size >= minimum);
    return { dropV, dropPercent, minimum, recommended, protection: current * 1.25 };
  }, [type, voltage, current, length, cable, dropLimit]);
  const field = (label: string, value: number, unit: string, setValue: (value: number) => void) => <label className="space-y-1.5 text-xs font-bold"><span>{label}</span><div className="flex overflow-hidden rounded-xl border border-line bg-white"><input type="number" min="0" step="any" value={value || ""} onChange={(event) => setValue(asNumber(event.target.value))} className="h-11 min-w-0 flex-1 px-3 outline-none"/><span className="grid place-items-center border-l border-line bg-[#f5f8fb] px-3 text-[10px] text-muted">{unit}</span></div></label>;
  return <section className="card mt-5 overflow-hidden"><div className="flex items-center gap-3 border-b border-line p-5"><Cable className="text-brand" size={20}/><div><h2 className="font-extrabold">Cable size and voltage-drop calculator</h2><p className="text-[10px] text-muted">Enter the circuit details to get a minimum copper conductor size by voltage drop.</p></div></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-bold"><span>Connection type</span><select value={type} onChange={(event) => setType(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="dc">DC</option><option value="ac_single">Single-phase AC</option><option value="ac_three">Three-phase AC</option></select></label>{field("Operating voltage", voltage, "V", setVoltage)}{field("Expected current", current, "A", setCurrent)}{field("One-way cable length", length, "m", setLength)}{field("Maximum voltage drop", dropLimit, "%", setDropLimit)}{field("Optional cable size to check", cable, "mm²", setCable)}<button type="button" onClick={() => setCalculated(true)} disabled={!voltage || !current || !length || !dropLimit} className="h-11 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2">Calculate cable size</button></div>{calculated ? <div className="grid gap-3 border-t border-line bg-[#f5f8fb] p-5 sm:grid-cols-2 lg:grid-cols-4"><Result label="Use at least" value={result.recommended ? `${result.recommended} mm²` : result.minimum ? `Above ${result.minimum.toFixed(1)} mm²` : "Enter circuit details"}/><Result label="Calculated minimum" value={`${result.minimum.toFixed(1)} mm²`}/><Result label={cable ? "Chosen cable drop" : "Cable check"} value={cable ? `${result.dropV.toFixed(2)} V / ${result.dropPercent.toFixed(1)}%` : "Optional"}/><Result label="125% current reference" value={`${result.protection.toFixed(1)} A`}/></div> : null}<p className="border-t border-line px-5 py-3 text-[10px] leading-4 text-muted">The recommendation is the next common copper size above the voltage-drop minimum. Current capacity, insulation rating, installation method, temperature, grouping, fault level, equipment limits and applicable local requirements can require a larger cable.</p></section>;
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-white p-4"><span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted">{label}</span><strong className="mt-2 block text-xl">{value}</strong></div>;
}
