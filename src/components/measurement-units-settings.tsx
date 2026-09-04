"use client";

import { Gauge, Ruler, Scale, Thermometer, Wind } from "lucide-react";
import { metricUnitPreferences, type UnitPreferences, useUnitPreferences, usUnitPreferences } from "@/preferences/units";

const settings: Array<{
  key: keyof UnitPreferences;
  label: string;
  help: string;
  icon: typeof Thermometer;
  options: Array<{ value: string; label: string }>;
}> = [
  { key: "temperature", label: "Temperature", help: "Weather and equipment temperatures", icon: Thermometer, options: [{ value: "c", label: "Celsius (°C)" }, { value: "f", label: "Fahrenheit (°F)" }] },
  { key: "windSpeed", label: "Wind speed", help: "Forecast and safe-work wind readings", icon: Wind, options: [{ value: "ms", label: "Metres/second (m/s)" }, { value: "kmh", label: "Kilometres/hour (km/h)" }, { value: "mph", label: "Miles/hour (mph)" }, { value: "kn", label: "Knots (kn)" }] },
  { key: "rainfall", label: "Rainfall", help: "Forecast rain totals and rates", icon: Gauge, options: [{ value: "mm", label: "Millimetres (mm)" }, { value: "in", label: "Inches (in)" }] },
  { key: "distance", label: "Distance", help: "Site, route and location distances", icon: Ruler, options: [{ value: "km", label: "Kilometres (km)" }, { value: "mi", label: "Miles (mi)" }] },
  { key: "dimensions", label: "Dimensions", help: "Panel, cable-route and equipment dimensions", icon: Ruler, options: [{ value: "metric", label: "Metric (mm, cm, m)" }, { value: "us", label: "US customary (in, ft)" }] },
  { key: "weight", label: "Weight", help: "Panels, batteries and equipment", icon: Scale, options: [{ value: "kg", label: "Kilograms (kg)" }, { value: "lb", label: "Pounds (lb)" }] },
  { key: "pressure", label: "Atmospheric pressure", help: "Detailed weather readings", icon: Gauge, options: [{ value: "hpa", label: "Hectopascals (hPa)" }, { value: "inhg", label: "Inches of mercury (inHg)" }] },
];

export function MeasurementUnitsSettings() {
  const { preferences, setPreferences, setUnit } = useUnitPreferences();
  return <section className="card mt-4 overflow-hidden"><div className="border-b border-line p-4 md:p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="eyebrow">Display preferences</div><h2 className="mt-1.5 text-base font-extrabold">Measurement units</h2><p className="mt-1.5 max-w-xl text-[10px] leading-4 text-muted">Choose each measurement independently. Electrical units such as volts, amps, watts and kilowatt-hours remain universal; recorded nameplate values retain their stated units.</p></div><div className="flex shrink-0 gap-1.5"><button type="button" onClick={() => setPreferences(metricUnitPreferences)} className="rounded-lg border border-line px-2.5 py-1.5 text-[9px] font-bold">Metric defaults</button><button type="button" onClick={() => setPreferences(usUnitPreferences)} className="rounded-lg border border-line px-2.5 py-1.5 text-[9px] font-bold">US defaults</button></div></div></div><div className="divide-y divide-line">{settings.map(({ key, label, help, icon: Icon, options }) => <label key={key} className="grid gap-2 p-3 sm:grid-cols-[1fr_190px] sm:items-center md:px-5"><span className="flex items-start gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Icon size={14}/></span><span><span className="block text-[10px] font-bold">{label}</span><span className="mt-0.5 block text-[9px] text-muted">{help}</span></span></span><select value={preferences[key]} onChange={(event) => setUnit(key, event.target.value as never)} className="field mt-0">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div></section>;
}
