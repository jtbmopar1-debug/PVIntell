"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, BarChart3, Battery, CloudSun, Fuel, Save, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Site } from "@/domain/models";
import { BrandLogo } from "./brand-logo";
import { dailyLogSummary, emptyObservation, type DailyLogEntry, type DailyObservation, type ForecastSnapshot } from "@/monitoring/daily-log";
import { fiveDaySolarOutlook, localDateKey, type SolarArrayForecastInput } from "@/weather/forecast";
import { useForecastNow, useSolarWeather } from "@/weather/use-solar-weather";

export type MonitorSystem = { id: string; name: string; phase: string; site: Site; arrays: SolarArrayForecastInput[] };
const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const number = (value: number | null | undefined, unit = "") => value == null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`;

export function DailyMonitor({ systems, initialSystemId }: { systems: MonitorSystem[]; initialSystemId?: string }) {
  const [systemId, setSystemId] = useState(initialSystemId ?? systems[0]?.id ?? "");
  const [dirty, setDirty] = useState(false);
  const system = systems.find((item) => item.id === systemId);
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between gap-4"><Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/>Dashboard</Link><BrandLogo compact/></div>
    <header className="my-7 flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow">Your system, day by day</div><h1 className="mt-2 font-display text-3xl font-extrabold">Monitor</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-muted">Record solar production, battery state of charge, generator use and grid import/export. Compare what happened with the forecast you saved.</p></div>
      {system ? <label className="min-w-60 text-xs font-bold">System<select className="field" value={systemId} onChange={(event) => { if (!dirty || window.confirm("Discard the unsaved daily entry?")) { setDirty(false); setSystemId(event.target.value); } }}>{systems.map((item) => <option key={item.id} value={item.id}>{item.site.name} · {item.name}</option>)}</select></label> : null}
    </header>
    {system ? <SystemDailyLog key={system.id} system={system} onDirty={setDirty}/> : <section className="card p-8 text-sm">Create a system first to keep its daily observations together. <Link href="/systems" className="font-bold text-brand">Open Systems</Link></section>}
  </div></main>;
}

function SystemDailyLog({ system, onDirty }: { system: MonitorSystem; onDirty: (dirty: boolean) => void }) {
  const now = useForecastNow(); const today = localDateKey(now, system.site.timezone);
  const from = shiftDay(today, -364), to = shiftDay(today, 4);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [date, setDate] = useState(today); const [range, setRange] = useState(30);
  const [error, setError] = useState(""); const [loaded, setLoaded] = useState(false); const [dirty, setDirty] = useState(false);
  const [retry, setRetry] = useState(0);
  const weather = useSolarWeather(system.site);
  const days = useMemo(() => system.arrays.length ? fiveDaySolarOutlook(weather.data?.hours ?? [], system.site.timezone, system.arrays, now, { latitude: system.site.latitude, longitude: system.site.longitude, timezone: system.site.timezone }) : [], [weather.data, system, now]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/monitor/daily?systemId=${system.id}&from=${from}&to=${to}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setEntries(body.entries); setLoaded(true); setError(""); })
      .catch((issue) => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : "Could not load daily log"); });
    return () => controller.abort();
  }, [system.id, from, to, retry]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const markDirty = (value: boolean) => { setDirty(value); onDirty(value); };
  const chooseDate = (value: string) => { if (value && (!dirty || window.confirm("Discard the unsaved daily entry?"))) { setDate(value); markDirty(false); } };
  const selected = entries.find((entry) => entry.date === date);
  const outlook = date >= today ? days.find((day) => day.dateKey === date) : undefined;
  const snapshot: ForecastSnapshot | undefined = outlook && weather.data ? { kwh: Number(outlook.expectedKwh.toFixed(2)), source: "pvintell", capturedAt: now.toISOString(), weatherFetchedAt: weather.data.fetchedAt, arrayKw: system.arrays.reduce((sum, array) => sum + array.capacityKw, 0), basis: outlook.forecastBasis } : undefined;
  const visible = entries.filter((entry) => entry.date >= shiftDay(today, 1 - range) && entry.date <= today);
  const summary = dailyLogSummary(visible);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs"><span className="text-muted">{system.site.name} · dates in {system.site.timezone}</span><Link className="font-bold text-brand" href={`/sites/${system.site.id}/systems/${system.id}?view=wattson`}>Ask Wattson</Link></div>
    {system.phase !== "monitor" ? <p className="rounded-xl border border-line bg-[#eef5fc] p-3 text-xs leading-5 text-muted">This system is still recorded as a proposal or build. Manual entries are allowed; the automatic forecast uses recorded PV arrays only, not proposed equipment.</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>Retry loading</button></p> : null}
    <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-[#eef5fc] p-5"><div><div className="eyebrow">Daily entry</div><h2 className="mt-1 font-bold">{selected ? "Review or update this day" : "What happened today?"}</h2></div><label className="text-xs font-bold">Date<input type="date" className="field" value={date} min={from} max={to} onChange={(event) => chooseDate(event.target.value)}/></label></div>
      {loaded ? <DailyEntryForm key={`${date}:${selected?.updatedAt ?? "new"}`} systemId={system.id} date={date} today={today} existing={selected} forecast={snapshot} weatherStatus={!system.arrays.length ? "Add your installed arrays to the system record for an automatic PVIntell forecast. Actual readings can still be logged." : date < today ? "No forecast was saved for this past day. It cannot be recreated from today's forecast; actual readings can still be logged." : weather.error || "Forecast loading or unavailable; actual readings can still be logged."} onDirty={markDirty} onSave={(entry) => { setEntries((previous) => [...previous.filter((item) => item.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date))); markDirty(false); }}/>
        : <p className="p-5 text-xs text-muted">{error ? "Entries cannot be saved until storage is available." : "Loading saved entries…"}</p>}
    </section>
    <section className="space-y-4"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-extrabold">History</h2><label className="text-xs font-bold">Period<select className="ml-2 rounded-lg border border-line bg-white p-2" value={range} onChange={(event) => setRange(Number(event.target.value))}>{[7, 30, 90, 365].map((value) => <option key={value} value={value}>Last {value} days</option>)}</select></label></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><Summary icon={Sun} label="Actual solar" value={summary.actualDays ? number(summary.actualKwh, " kWh") : "—"} detail={`${summary.actualDays} days reported`}/><Summary icon={CloudSun} label="Forecast comparison" value={summary.differencePercent === null ? "—" : `${summary.differencePercent > 0 ? "+" : ""}${number(summary.differencePercent, "%")}`} detail={`${summary.pairedDays} paired dates only`}/><Summary icon={Fuel} label="Generator runtime" value={summary.generatorRuntimeKnownDays ? number(summary.generatorMinutes / 60, " h") : "—"} detail={`${summary.generatorDays} run days; ${summary.generatorRuntimeKnownDays} with duration`}/><Summary icon={ArrowDownLeft} label="Grid import" value={summary.gridImportDays ? number(summary.gridImportKwh, " kWh") : "—"} detail={`${summary.gridImportDays} days reported`}/><Summary icon={ArrowUpRight} label="Grid export" value={summary.gridExportDays ? number(summary.gridExportKwh, " kWh") : "—"} detail={`${summary.gridExportDays} days reported`}/><Summary icon={Battery} label="Days logged" value={String(summary.loggedDays)} detail="Missing days are not zeros"/></div>
      <DailyLogHistory entries={visible} onEdit={chooseDate}/>
    </section>
    <p className="rounded-xl border border-line bg-[#eef5fc] p-4 text-xs leading-5 text-muted"><strong>Useful context for Wattson.</strong> Saved observations and forecast differences can inform advice for this system. They are user-reported, not live telemetry or model training, and won’t silently change your proposal. Generator charging and unusual loads can explain SOC changes; SOC alone does not measure generator energy.</p>
  </div>;
}

export function DailyEntryForm({ systemId, date, today, existing, forecast, weatherStatus, onSave, onDirty }: { systemId: string; date: string; today: string; existing?: DailyLogEntry; forecast?: ForecastSnapshot; weatherStatus: string; onSave: (entry: DailyLogEntry) => void; onDirty: (dirty: boolean) => void }) {
  const [entry, setEntry] = useState<DailyObservation>(existing ?? emptyObservation);
  const estimate = existing?.forecast ?? forecast ?? null;
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const set = (key: keyof DailyObservation, value: DailyObservation[keyof DailyObservation]) => { setEntry((previous) => ({ ...previous, [key]: value })); onDirty(true); };
  const field = (key: "actualKwh" | "gridImportKwh" | "gridExportKwh" | "socMin" | "socMax" | "socEnd" | "generatorMinutes" | "generatorStartSoc" | "generatorEndSoc", label: string, unit: string) => <label className="text-xs font-bold">{label} <span className="font-normal text-muted">({unit})</span><input className="field" type="number" min={key === "generatorMinutes" ? .1 : 0} max={unit === "%" ? 100 : key === "generatorMinutes" ? 1440 : 1000000} step="any" value={entry[key] ?? ""} placeholder="Not recorded" onChange={(event) => set(key, event.target.value === "" ? null : Number(event.target.value))}/></label>;
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/monitor/daily", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemId, date, observations: entry, forecast: estimate, expectedUpdatedAt: existing?.updatedAt ?? null }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); onSave(body.entry);
    } catch (issue) { setStatus(issue instanceof Error ? issue.message : "Could not save entry"); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-5 p-5"><fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
    <div className="rounded-xl border border-[#e7cf78] bg-[#fff9df] p-4"><h3 className="text-sm font-extrabold">PVIntell solar forecast</h3><output aria-label="Forecast solar production" className="mt-2 block text-2xl font-extrabold text-[#6a5110]">{estimate ? number(estimate.kwh, " kWh") : "Not available"}</output><p className="mt-2 text-xs leading-5 text-muted">{existing?.forecast ? `Saved forecast · captured ${new Date(existing.forecast.capturedAt).toLocaleString()}. This value is fixed; editing your readings leaves it unchanged.` : estimate ? "Automatically loaded. This forecast is saved with your daily entry and cannot be edited." : weatherStatus}</p></div>
    {date <= today ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{field("actualKwh", "Actual solar production", "kWh")}{field("socMin", "Lowest battery SOC", "%")}{field("socMax", "Highest battery SOC", "%")}{field("socEnd", "End-of-day SOC", "%")}</div><p className="text-[11px] text-muted">Enter the whole-day PV total, excluding generator and grid energy. Leave readings you don’t have blank.</p>
      <div className="rounded-xl border border-line p-4"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="size-4 accent-[#195e98]" checked={entry.generatorRan === true} onChange={(event) => { setEntry((previous) => ({ ...previous, generatorRan: event.target.checked ? true : null, ...(event.target.checked ? {} : { generatorMinutes: null, generatorStartSoc: null, generatorEndSoc: null }) })); onDirty(true); }}/>Ran generator this day</label>
        {entry.generatorRan ? <div className="mt-4"><div className="grid gap-4 sm:grid-cols-3">{field("generatorMinutes", "Total runtime", "minutes")}{field("generatorStartSoc", "SOC before first run", "%")}{field("generatorEndSoc", "SOC after last run", "%")}</div><p className="mt-3 text-[11px] leading-5 text-muted">If you ran it more than once, add the durations together and describe the runs below.</p></div> : null}
      </div>
      <div className="rounded-xl border border-line p-4"><h3 className="text-sm font-bold">Grid use <span className="font-normal text-muted">(optional)</span></h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("gridImportKwh", "Grid import / input", "kWh")}{field("gridExportKwh", "Grid export", "kWh")}</div><p className="mt-3 text-[11px] leading-5 text-muted">Import is energy taken from the public grid; export is energy sent back. Enter each day’s total, not the meter’s lifetime reading. Leave blank if off-grid or unknown; enter 0 only for a known zero. Keep solar production separate—don’t add export to it.</p></div>
      </> : <p className="text-xs text-muted">Future date: save the forecast now, then add actual readings after the day arrives.</p>}
    <label className="block text-xs font-bold">Notes<textarea className="field min-h-20" maxLength={2000} value={entry.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Cloud, unusual loads, generator runs, maintenance or anything else that affected the day…"/></label>
    <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted">{existing ? "Saved entry loaded. Changes replace observations for this date." : "One entry per system, per day."}</span><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white"><Save size={15}/>{busy ? "Saving…" : existing ? "Save changes" : "Save daily entry"}</button></div>
    </fieldset>{status ? <p role="alert" className="text-sm text-red-700">{status} {status.includes("another session") ? "Your unsaved values are still shown; reload when ready." : ""}</p> : null}</form>;
}

function Summary({ icon: Icon, label, value, detail }: { icon: typeof Sun; label: string; value: string; detail: string }) {
  return <div className="card p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-muted">{label}</span><Icon size={16} className="text-brand"/></div><p className="mt-3 text-xl font-extrabold">{value}</p><p className="mt-1 text-[11px] leading-4 text-muted">{detail}</p></div>;
}

export function DailyLogHistory({ entries, onEdit }: { entries: DailyLogEntry[]; onEdit: (date: string) => void }) {
  const [view, setView] = useState("bars"); const [metric, setMetric] = useState("solar");
  const series = metric === "solar" ? [{ label: "Actual", color: "#195e98", values: entries.map((row) => row.actualKwh) }, { label: "Forecast", color: "#c29316", values: entries.map((row) => row.forecast?.kwh ?? null) }]
    : metric === "soc" ? [{ label: "Lowest SOC", color: "#195e98", values: entries.map((row) => row.socMin) }, { label: "Highest SOC", color: "#24845b", values: entries.map((row) => row.socMax) }, { label: "End SOC", color: "#ab6719", values: entries.map((row) => row.socEnd) }]
      : metric === "grid" ? [{ label: "Grid import", color: "#195e98", values: entries.map((row) => row.gridImportKwh ?? null) }, { label: "Grid export", color: "#24845b", values: entries.map((row) => row.gridExportKwh ?? null) }]
      : [{ label: "Generator runtime", color: "#865299", values: entries.map((row) => row.generatorRan === false ? 0 : row.generatorMinutes === null ? null : row.generatorMinutes / 60) }];
  const unit = metric === "solar" || metric === "grid" ? "kWh" : metric === "soc" ? "%" : "hours";
  const max = metric === "soc" ? 100 : Math.max(1, ...series.flatMap((item) => item.values.map((value) => value ?? 0))) * 1.1;
  const first = entries.length ? Date.parse(entries[0].date) : 0;
  const spanDays = entries.length ? Math.round((Date.parse(entries.at(-1)!.date) - first) / 86400000) + 1 : 1;
  const x = (index: number) => 55 + ((Date.parse(entries[index].date) - first) / 86400000 + .5) / spanDays * 805;
  const y = (value: number) => 255 - value / max * 215;
  const width = Math.max(.8, Math.min(24, 805 / spanDays / (series.length + 1)));
  return <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div className="flex items-center gap-2"><BarChart3 size={17} className="text-brand"/><label className="text-xs font-bold">Show<select value={metric} onChange={(event) => setMetric(event.target.value)} className="ml-2 rounded-lg border border-line bg-white p-2"><option value="solar">Solar production</option><option value="soc">Battery SOC</option><option value="generator">Generator use</option><option value="grid">Grid import / export</option></select></label></div><div className="flex gap-1">{["bars", "lines", "table"].map((option) => <button type="button" key={option} aria-pressed={view === option} onClick={() => setView(option)} className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${view === option ? "bg-brand text-white" : "bg-[#eef5fc] text-brand"}`}>{option}</button>)}</div></div>
    {!entries.length ? <p className="p-8 text-center text-sm text-muted">Your first saved day will start this history.</p> : <><div className="flex flex-wrap gap-4 px-5 pt-4 text-xs">{series.map((item) => <span key={item.label} className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: item.color }}/>{item.label}</span>)}<span className="text-muted">{unit} · gaps are unrecorded</span></div>
      {view !== "table" ? <div className="overflow-x-auto px-3"><svg role="img" aria-label={`${metric} ${view} chart over ${entries.length} logged days; values available in Table view`} viewBox="0 0 900 305" className="min-w-[580px] w-full"><text x="12" y="22" fontSize="12" fill="#60748a">{unit}</text>{[0, .25, .5, .75, 1].map((step) => <g key={step}><line x1="55" x2="860" y1={y(max * step)} y2={y(max * step)} stroke="#dce6ef"/><text x="47" y={y(max * step) + 4} textAnchor="end" fontSize="11" fill="#60748a">{number(max * step)}</text></g>)}{series.map((item, seriesIndex) => <g key={item.label}>{view === "lines" ? item.values.map((value, index) => value !== null ? <g key={index}>{index > 0 && item.values[index - 1] !== null && Date.parse(entries[index].date) - Date.parse(entries[index - 1].date) === 86400000 ? <line x1={x(index - 1)} y1={y(item.values[index - 1]!)} x2={x(index)} y2={y(value)} stroke={item.color} strokeWidth="2"/> : null}<circle cx={x(index)} cy={y(value)} r="3" fill={item.color}><title>{entries[index].date}: {item.label} {number(value, ` ${unit}`)}</title></circle></g> : null) : item.values.map((value, index) => value !== null ? <rect key={index} x={x(index) + (seriesIndex - series.length / 2) * width} y={y(value)} width={width * .85} height={Math.max(1, 255 - y(value))} fill={item.color} rx="1"><title>{entries[index].date}: {item.label} {number(value, ` ${unit}`)}</title></rect> : null)}</g>)}{[...new Set([0, Math.floor((entries.length - 1) / 2), entries.length - 1])].map((index) => <text key={index} x={x(index)} y="280" textAnchor="middle" fontSize="11" fill="#60748a">{entries[index].date.slice(5)}</text>)}</svg></div> : null}
      <details open={view === "table"} className="p-4"><summary className="cursor-pointer text-xs font-bold text-brand">Daily values and edit entries</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[940px] text-left text-xs"><thead><tr className="border-b border-line text-muted">{["Date", "Actual kWh", "Forecast kWh", "SOC low / high / end", "Generator", "Gen SOC start / end", "Grid import kWh", "Grid export kWh", ""].map((title) => <th key={title} className="px-2 py-3">{title}</th>)}</tr></thead><tbody>{[...entries].reverse().map((entry) => <tr key={entry.date} className="border-b border-line"><td className="px-2 py-3">{entry.date}</td><td>{number(entry.actualKwh)}</td><td>{number(entry.forecast?.kwh)}</td><td>{number(entry.socMin)} / {number(entry.socMax)} / {number(entry.socEnd)}%</td><td>{entry.generatorRan === null ? "—" : entry.generatorRan ? entry.generatorMinutes === null ? "Ran; duration unknown" : number(entry.generatorMinutes, " min") : "No"}</td><td>{number(entry.generatorStartSoc)} / {number(entry.generatorEndSoc)}%</td><td>{number(entry.gridImportKwh)}</td><td>{number(entry.gridExportKwh)}</td><td><button type="button" onClick={() => { onEdit(entry.date); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="font-bold text-brand">Edit</button></td></tr>)}</tbody></table></div></details></>}
  </section>;
}
