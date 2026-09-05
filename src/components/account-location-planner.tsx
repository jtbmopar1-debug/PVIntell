"use client";

import { Compass, LocateFixed, MapPin, Mountain, Save, SunMedium } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { SiteMapPoint } from "@/components/editable-site-map";

const EditableSiteMap = dynamic(() => import("@/components/editable-site-map"), { ssr: false });
type PlanningSystem = { id: string; name: string; latitude: number | null; longitude: number | null; locationMode: "static" | "mobile"; updatedAt: string | null };
export type PlanningSite = { id: string; name: string; location: string; latitude: number | null; longitude: number | null; timezone: string; systems: PlanningSystem[]; arrays: Array<{ name: string; azimuth: number | null; tilt: number | null }> };
type Position = { latitude: number; longitude: number };
const siteKey = (id: string) => `site:${id}`;
const systemKey = (id: string) => `system:${id}`;
function clamp(value: number) { return Math.max(0, Math.min(70, Math.round(value))); }
function offsetPosition(position: Position, index: number): Position { const angle = (index * 137.5 * Math.PI) / 180; return { latitude: position.latitude + Math.sin(angle) * 0.00045, longitude: position.longitude + Math.cos(angle) * 0.00055 }; }

export function AccountLocationPlanner({ sites }: { sites: PlanningSite[] }) {
  const router = useRouter();
  const located = sites.filter((site): site is PlanningSite & { latitude: number; longitude: number } => site.latitude != null && site.longitude != null);
  const firstSite = located[0] ?? sites[0];
  const [siteId, setSiteId] = useState(firstSite?.id ?? "");
  const [activePointId, setActivePointId] = useState(firstSite?.systems[0] ? systemKey(firstSite.systems[0].id) : "");
  const [positions, setPositions] = useState<Record<string, Position>>(() => {
    const entries: Array<[string, Position]> = [];
    located.forEach((site) => {
      const base = { latitude: site.latitude, longitude: site.longitude };
      entries.push([siteKey(site.id), base]);
      site.systems.forEach((system, index) => entries.push([systemKey(system.id), system.latitude != null && system.longitude != null ? { latitude: system.latitude, longitude: system.longitude } : offsetPosition(base, index + 1)]));
    });
    return Object.fromEntries(entries);
  });
  const [modes, setModes] = useState<Record<string, "static" | "mobile">>(() => Object.fromEntries(sites.flatMap((site) => site.systems.map((system) => [system.id, system.locationMode]))));
  const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  const site = sites.find((item) => item.id === siteId) ?? sites[0];
  const sitePosition = site ? positions[siteKey(site.id)] : undefined;
  const activeSystem = site?.systems.find((system) => systemKey(system.id) === activePointId);
  const activePosition = positions[activePointId];
  const guidance = useMemo(() => { if (!sitePosition) return null; const latitude = Math.abs(sitePosition.latitude); return { direction: sitePosition.latitude < 0 ? "true north" : "true south", azimuth: sitePosition.latitude < 0 ? 0 : 180, annual: clamp(latitude), summer: clamp(latitude - 15), winter: clamp(latitude + 15) }; }, [sitePosition]);
  const mapPoints: SiteMapPoint[] = site && sitePosition ? site.systems.map((system) => ({ id: systemKey(system.id), name: system.name, ...positions[systemKey(system.id)], kind: "system" as const, mobile: modes[system.id] === "mobile", approximate: system.latitude == null || system.longitude == null })) : [];
  const originalPosition = activeSystem ? (activeSystem.latitude != null && activeSystem.longitude != null ? { latitude: activeSystem.latitude, longitude: activeSystem.longitude } : null) : null;
  const positionChanged = Boolean(activePosition && (!originalPosition || Math.abs(activePosition.latitude - originalPosition.latitude) > 0.0000001 || Math.abs(activePosition.longitude - originalPosition.longitude) > 0.0000001));
  const modeChanged = Boolean(activeSystem && modes[activeSystem.id] !== activeSystem.locationMode);

  function selectSite(id: string) { const next = sites.find((item) => item.id === id); setSiteId(id); setActivePointId(next?.systems[0] ? systemKey(next.systems[0].id) : ""); setNotice(""); }
  function selectPoint(id: string) { setActivePointId(id); setNotice(""); }
  function moveMarker(id: string, latitude: number, longitude: number) { setPositions((current) => ({ ...current, [id]: { latitude, longitude } })); setActivePointId(id); setNotice(""); }
  function useDeviceLocation() {
    if (!activePointId || !navigator.geolocation) return setNotice("Location access is not available on this device.");
    navigator.geolocation.getCurrentPosition(({ coords }) => moveMarker(activePointId, coords.latitude, coords.longitude), () => setNotice("PVIntell could not access this device’s location."), { enableHighAccuracy: true, timeout: 12000 });
  }
  async function saveLocation() {
    if (!site || !activeSystem || !activePosition) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/projects/${activeSystem.id}/map-location`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...activePosition, locationMode: modes[activeSystem.id] }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "The corrected location could not be saved.");
      setNotice(`System position saved.${modes[activeSystem.id] === "mobile" ? " Wattson will treat it as a guide, not a permanent location." : ""}`); router.refresh();
    } catch (problem) { setNotice(problem instanceof Error ? problem.message : "The corrected location could not be saved."); } finally { setSaving(false); }
  }

  return <section className="card mt-4 overflow-hidden">
    <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="eyebrow">Location and solar geometry</div><h2 className="mt-1.5 text-base font-extrabold">Planning map</h2></div>{sites.length > 1 ? <select value={site?.id ?? ""} onChange={(event) => selectSite(event.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-bold text-brand" aria-label="Planning site">{sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}</div>
    {site && sitePosition && guidance ? <>
      <div className="relative h-64 bg-[#dfe9ee] sm:h-80"><EditableSiteMap points={mapPoints} activeId={activePointId} center={[sitePosition.latitude, sitePosition.longitude]} onSelect={selectPoint} onMove={moveMarker}/><div className="absolute bottom-3 left-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-lg bg-white/95 px-3 py-2 text-[11px] font-semibold shadow">Showing {site.name} systems only. Hover or tap a pin to identify it; select it before moving.</div></div>
      <div className="flex flex-col gap-2 border-b border-line bg-[#fbfcfd] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">{activeSystem && activePosition ? <><div className="text-[11px] text-muted"><strong className="text-ink">{activeSystem.name}</strong> · {activePosition.latitude.toFixed(6)}, {activePosition.longitude.toFixed(6)}<span className="ml-2">{modes[activeSystem.id] === "mobile" ? "Mobile · guide position" : "Static system"}</span>{notice ? <span className="mt-1 block text-brand">{notice}</span> : null}</div><div className="flex flex-wrap gap-2"><select value={modes[activeSystem.id]} onChange={(event) => setModes((current) => ({ ...current, [activeSystem.id]: event.target.value as "static" | "mobile" }))} className="h-9 rounded-lg border border-line bg-white px-2 text-[11px] font-bold"><option value="static">Static system</option><option value="mobile">Mobile / not static</option></select><button type="button" onClick={useDeviceLocation} className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[11px] font-bold"><LocateFixed size={14}/>Use device</button><button type="button" onClick={saveLocation} disabled={(!positionChanged && !modeChanged) || saving} className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[11px] font-bold text-white disabled:opacity-40"><Save size={14}/>{saving ? "Saving…" : "Save position"}</button></div></> : <p className="text-[11px] text-muted">No systems are recorded at this Site yet.</p>}</div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4"><PlanningFact icon={Compass} label="Equator-facing" value={`${guidance.direction} · ${guidance.azimuth}°`}/><PlanningFact icon={SunMedium} label="Annual starting tilt" value={`about ${guidance.annual}°`}/><PlanningFact icon={SunMedium} label="Summer starting tilt" value={`about ${guidance.summer}°`}/><PlanningFact icon={Mountain} label="Winter starting tilt" value={`about ${guidance.winter}°`}/></div>
      <div className="border-t border-line px-4 py-3 text-[12px] leading-5 text-muted">System pins without a confirmed position are offset near the Site pin until you place and save them. Orange pins are mobile; their saved position is context for Wattson rather than a permanent installation location.</div>
      {site.arrays.length ? <div className="border-t border-line p-4"><div className="text-xs font-extrabold">Recorded arrays at {site.name}</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{site.arrays.map((array, index) => <div key={`${array.name}:${array.azimuth ?? "na"}:${array.tilt ?? "na"}:${index}`} className="rounded-lg bg-[#f1f5f8] px-3 py-2 text-[12px]"><strong>{array.name}</strong><span className="ml-2 text-muted">Azimuth {array.azimuth == null ? "not recorded" : `${array.azimuth}°`} · tilt {array.tilt == null ? "not recorded" : `${array.tilt}°`}</span></div>)}</div></div> : null}
    </> : <div className="grid min-h-48 place-items-center p-6 text-center"><div><MapPin className="mx-auto text-brand"/><h3 className="mt-3 text-sm font-extrabold">No mapped site yet</h3><p className="mt-1 text-xs text-muted">Add coordinates from a Site’s Solar weather page to unlock its planning map and seasonal tilt guide.</p></div></div>}
    <div className="border-t border-line bg-[#fbfcfd] px-4 py-2 text-[10px] text-muted">The Site selector filters both the map and system pins. Map data © OpenStreetMap contributors.</div>
  </section>;
}

function PlanningFact({ icon: Icon, label, value }: { icon: typeof Compass; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl bg-[#eef5fb] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-brand"><Icon size={17}/></span><div><div className="text-[11px] text-muted">{label}</div><strong className="text-[13px]">{value}</strong></div></div>; }
