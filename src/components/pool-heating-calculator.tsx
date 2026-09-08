"use client";

import { ArrowLeft, Calculator, Check, LoaderCircle, MapPin, Pencil, Search, Waves } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const RESULT_KEY = "pvintell:pool-heating-result";
type LocationMatch = { name: string; label: string; latitude: number; longitude: number; timezone: string };
type ClimateMonth = { month: number; meanC: number | null; minC: number | null; maxC: number | null; solarKwhM2Day: number | null };

export function PoolHeatingCalculator({ locationLabel: initialLocationLabel, returnTo, embedded = false, onSave }: { locationLabel: string; returnTo?: string; embedded?: boolean; onSave?: (summary: string, estimate: { thermalKw: number; electricalKw: number; cop: number }) => void }) {
  const router = useRouter();
  const [locationLabel, setLocationLabel] = useState(initialLocationLabel);
  const [locationMatches, setLocationMatches] = useState<LocationMatch[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationMatch>();
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [climateMonths, setClimateMonths] = useState<ClimateMonth[]>([]);
  const [climatePeriod, setClimatePeriod] = useState("");
  const [loadingClimate, setLoadingClimate] = useState(false);
  const [volumeLitres, setVolumeLitres] = useState("40000");
  const [startingTemperature, setStartingTemperature] = useState("18");
  const [targetTemperature, setTargetTemperature] = useState("28");
  const [heatUpHours, setHeatUpHours] = useState("24");
  const [allowancePercent, setAllowancePercent] = useState("25");
  const [coverUse, setCoverUse] = useState("usually_covered");
  const [poolSetting, setPoolSetting] = useState("outdoor_open");
  const [operatingSeason, setOperatingSeason] = useState("year_round");
  const [waterType, setWaterType] = useState("fresh_chlorinated");
  const [cop, setCop] = useState("5");
  const [estimateSaved, setEstimateSaved] = useState(false);

  const result = useMemo(() => {
    const volume = Math.max(0, Number(volumeLitres) || 0);
    const delta = Math.max(0, (Number(targetTemperature) || 0) - (Number(startingTemperature) || 0));
    const hours = Math.max(0.1, Number(heatUpHours) || 0.1);
    const allowance = Math.max(0, Number(allowancePercent) || 0) / 100;
    const heatPumpCop = Math.max(1, Number(cop) || 1);
    const waterEnergyKwh = volume * delta * 0.001163;
    const thermalKw = waterEnergyKwh / hours * (1 + allowance);
    return { delta, waterEnergyKwh, thermalKw, electricalKw: thermalKw / heatPumpCop };
  }, [allowancePercent, cop, heatUpHours, startingTemperature, targetTemperature, volumeLitres]);

  const calculatorReady = Boolean(selectedLocation && climateMonths.length);
  const summary = `${result.thermalKw.toFixed(1)} kW thermal`;

  async function searchLocation() {
    if (locationLabel.trim().length < 2) return;
    setSearchingLocation(true); setLocationError(""); setLocationMatches([]);
    try {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(locationLabel.trim())}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not search for that location.");
      const matches = (body.results ?? []) as LocationMatch[];
      setLocationMatches(matches);
      if (!matches.length) setLocationError("No matching locations found. Try a nearby town, region or postcode.");
    } catch (problem) {
      setLocationError(problem instanceof Error ? problem.message : "Could not search for that location.");
    } finally {
      setSearchingLocation(false);
    }
  }

  async function chooseLocation(match: LocationMatch) {
    setSelectedLocation(match); setLocationLabel(match.label); setLocationMatches([]); setLocationError("");
    setLoadingClimate(true); setClimateMonths([]);
    try {
      const response = await fetch(`/api/weather/climate?latitude=${match.latitude}&longitude=${match.longitude}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load climate averages.");
      setClimateMonths(body.months ?? []); setClimatePeriod(body.period ?? "");
    } catch (problem) {
      setLocationError(problem instanceof Error ? problem.message : "Could not load climate averages.");
    } finally { setLoadingClimate(false); }
  }

  function saveAndReturn() {
    onSave?.(summary, { thermalKw: result.thermalKw, electricalKw: result.electricalKw, cop: Math.max(1, Number(cop) || 1) });
    setEstimateSaved(true);
    if (returnTo) {
      sessionStorage.setItem(RESULT_KEY, summary);
      router.push(returnTo);
    }
  }

  return <section id="pool-heating" className={`${embedded ? "mt-5 rounded-2xl border border-line" : "card mt-4"} overflow-hidden`}>
    <div className="flex items-center gap-2.5 border-b border-line p-3 sm:px-4"><span className="grid size-8 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Waves size={16}/></span><div><div className="eyebrow">Water heating</div><h2 className="mt-1 text-base font-extrabold">Pool and spa heater calculator</h2></div></div>
    <div className={`grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 ${calculatorReady ? "" : "pool-calculator-locked"}`}>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3"><label className="text-xs font-bold" htmlFor="pool-location">Climate region</label><div className="flex gap-2"><input id="pool-location" value={locationLabel} onChange={(event) => { setLocationLabel(event.target.value); setSelectedLocation(undefined); setLocationMatches([]); setClimateMonths([]); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchLocation(); } }} className="field mt-0 flex-1" placeholder="Region or nearest town"/><button type="button" onClick={() => void searchLocation()} disabled={searchingLocation || locationLabel.trim().length < 2} className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Search climate region">{searchingLocation ? <LoaderCircle className="animate-spin" size={16}/> : <Search size={16}/>}</button></div>{locationMatches.length ? <div className="overflow-hidden rounded-xl border border-line bg-white">{locationMatches.map((match) => <button key={`${match.latitude}:${match.longitude}`} type="button" onClick={() => void chooseLocation(match)} className="flex w-full items-start gap-2 border-b border-line px-3 py-2 text-left text-[11px] last:border-0 hover:bg-[#edf5fd]"><MapPin className="mt-0.5 shrink-0 text-brand" size={13}/><span><strong className="block">{match.name}</strong><span className="text-muted">{match.label}</span></span></button>)}</div> : null}{selectedLocation ? <span className="block text-[10px] font-semibold text-brand">Selected region: {selectedLocation.label} · {selectedLocation.timezone}</span> : null}{loadingClimate ? <span className="block text-[10px] text-muted">Loading regional climate averages…</span> : null}{locationError ? <span className="block text-[10px] text-[#a9442f]">{locationError}</span> : null}<span className="block text-[10px] leading-4 text-muted">A broad region or nearest town is enough—no street address is required. It provides climate context for seasonal performance checks.</span></div>
      {climateMonths.length ? <div className="theme-subtle-surface grid gap-2 rounded-xl border border-line p-3 sm:col-span-2 lg:col-span-3 sm:grid-cols-3"><ClimateSummary label="Coldest month" month={climateMonths.reduce((best, item) => (item.meanC ?? 999) < (best.meanC ?? 999) ? item : best)}/><ClimateSummary label="Warmest month" month={climateMonths.reduce((best, item) => (item.meanC ?? -999) > (best.meanC ?? -999) ? item : best)}/><ClimateSummary label="Lowest-solar month" month={climateMonths.reduce((best, item) => (item.solarKwhM2Day ?? 999) < (best.solarKwhM2Day ?? 999) ? item : best)} solar/><span className="text-[9px] text-muted sm:col-span-3">Regional historical averages, {climatePeriod}. These expose seasonal differences; final heater output still requires pool heat-loss and manufacturer performance data.</span></div> : null}
      <label className="space-y-1.5 text-xs font-bold"><span>Pool setting</span><select value={poolSetting} onChange={(event) => setPoolSetting(event.target.value)} className="field mt-0"><option value="outdoor_open">Outdoor — open exposure</option><option value="outdoor_screened">Outdoor — screened or roofed enclosure</option><option value="indoor_unconditioned">Indoor — unconditioned enclosure</option><option value="indoor_conditioned">Indoor — conditioned space</option></select></label>
      <label className="space-y-1.5 text-xs font-bold"><span>Operating season</span><select value={operatingSeason} onChange={(event) => setOperatingSeason(event.target.value)} className="field mt-0"><option value="year_round">Used year-round</option><option value="warm_months">Warmer months only</option><option value="cool_months">Cooler months only</option><option value="selected_months">Selected months or occasional use</option></select></label>
      <label className="space-y-1.5 text-xs font-bold"><span>Water system</span><select value={waterType} onChange={(event) => setWaterType(event.target.value)} className="field mt-0"><option value="fresh_chlorinated">Fresh/chlorinated water</option><option value="salt_chlorinated">Salt-chlorinated water</option><option value="mineral">Mineral system</option><option value="other">Other or not confirmed</option></select><span className="block text-[10px] font-normal leading-4 text-muted">Recorded for corrosion, heat-exchanger and manufacturer compatibility; it does not materially change this planning heat-load result.</span></label>
      <NumberField label="Water volume" value={volumeLitres} unit="L" onChange={setVolumeLitres}/>
      <label className="space-y-1.5 text-xs font-bold"><span>Water-surface cover</span><select value={coverUse} onChange={(event) => { const next = event.target.value; setCoverUse(next); setAllowancePercent(next === "always_covered" ? "15" : next === "usually_covered" ? "25" : next === "sometimes_covered" ? "35" : "45"); }} className="field mt-0"><option value="always_covered">Covered whenever not in use</option><option value="usually_covered">Usually covered</option><option value="sometimes_covered">Sometimes covered</option><option value="uncovered">Normally uncovered</option></select><span className="block text-[10px] font-normal leading-4 text-muted">A screened or roofed pool area is recorded separately above; it is not the same as a cover on the water.</span></label>
      <NumberField label="Starting water temperature" value={startingTemperature} unit="°C" onChange={setStartingTemperature}/>
      <NumberField label="Target water temperature" value={targetTemperature} unit="°C" onChange={setTargetTemperature}/>
      <NumberField label="Desired heat-up time" value={heatUpHours} unit="hours" onChange={setHeatUpHours}/>
      <NumberField label="Heat-loss allowance" value={allowancePercent} unit="%" onChange={setAllowancePercent}/>
      <label className="space-y-1.5 text-xs font-bold"><span>Heat-pump efficiency (COP)</span><div className="relative"><input type="number" min="1" step="0.1" value={cop} onChange={(event) => setCop(event.target.value)} className="field mt-0 pr-14"/><span className="absolute inset-y-0 right-3 grid place-items-center text-[10px] font-semibold text-muted">COP</span></div><span className="block text-[10px] font-normal leading-4 text-muted">Coefficient of performance: heat delivered ÷ electricity used. COP 5 means about 5 kW of heat from 1 kW of electrical input under the stated test conditions.</span></label>
    </div>
    <div className={`theme-subtle-surface gap-3 border-t border-line bg-[#f5f8fb] p-4 sm:grid-cols-3 ${calculatorReady ? "grid" : "hidden"}`}>
      <Result label="Water heating energy" value={`${result.waterEnergyKwh.toFixed(1)} kWh`} detail={`${result.delta.toFixed(1)}°C temperature rise`}/>
      <Result label="Planning heater output" value={`${result.thermalKw.toFixed(1)} kW thermal`} detail={`Includes ${allowancePercent || "0"}% allowance`}/>
      <Result label="Heat-pump electrical input" value={`${result.electricalKw.toFixed(1)} kW`} detail={`At COP ${cop || "?"}`}/>
    </div>
    <p className="border-t border-line px-4 py-3 text-[10px] leading-4 text-muted">This estimates initial warm-up from water volume. Ongoing heat loss also depends on cover use, exposed water area, wind, ambient conditions and operating schedule. Manufacturer output at the Site’s actual air and water temperatures must be checked.</p>
    {embedded ? <div className="flex justify-end gap-2 border-t border-line p-4">{estimateSaved ? <><span role="status" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#77b98a] bg-[#e8f6ec] px-4 text-xs font-bold textfill-[#236438]"><Check size={16}/>Estimate added to discovery</span><button type="button" onClick={() => setEstimateSaved(false)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold"><Pencil size={14}/>Edit</button></> : <button type="button" disabled={!calculatorReady} onClick={saveAndReturn} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Calculator size={15}/>Use estimate in discovery</button>}</div> : returnTo ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4"><button type="button" onClick={() => router.push(returnTo)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold"><ArrowLeft size={15}/>Return without saving</button><button type="button" disabled={!calculatorReady} onClick={saveAndReturn} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand pxnahme-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Calculator size={15}/>Save estimate and return</button></div> : null}
  </section>;
}

function NumberField({ label, value, unit, onChange }: { label: string; value: string; unit: string; onChange: (value: string) => void }) {
  return <label className="space-y-1.5 text-xs font-bold"><span>{label}</span><div className="relative"><input type="number" min="0" step="any" value={value} onChange={(event) => onChange(event.target.value)} className="field mt-0 pr-14"/><span className="absolute inset-y-0 right-3 grid place-items-center text-[10px] font-semibold text-muted">{unit}</span></div></label>;
}

function Result({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-line bg-white p-3"><span className="text-[9px] font-bold uppercase tracking-[.08em] text-muted">{label}</span><strong className="mt-1 block text-base">{value}</strong><span className="mt-1 block text-[10px] text-muted">{detail}</span></div>;
}

function ClimateSummary({ label, month, solar = false }: { label: string; month: ClimateMonth; solar?: boolean }) {
  const name = new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(2024, month.month - 1, 1));
  return <div><span className="text-[9px] font-bold uppercase tracking-[.08em] text-muted">{label}</span><strong className="mt-1 block text-sm">{name} · {solar ? `${(month.solarKwhM2Day ?? 0).toFixed(1)} kWh/m²/day` : `${(month.meanC ?? 0).toFixed(1)}°C mean`}</strong></div>;
}
