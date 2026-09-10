"use client";

import { Compass, LocateFixed, MapPin, Ruler, Smartphone, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Location = { latitude: number; longitude: number; label: string };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function AzimuthCalculator({ initialLocation }: { initialLocation: Location }) {
  const [location, setLocation] = useState(initialLocation);
  const [latitude, setLatitude] = useState(String(initialLocation.latitude));
  const [longitude, setLongitude] = useState(String(initialLocation.longitude));
  const [error, setError] = useState("");
  const [sensorActive, setSensorActive] = useState(false);
  const [sensorError, setSensorError] = useState("");
  const [heading, setHeading] = useState<number>();
  const [measuredTilt, setMeasuredTilt] = useState<number>();
  const result = useMemo(() => {
    const lat = clamp(Number(latitude) || 0, -90, 90);
    const azimuth = lat < 0 ? 0 : 180;
    return { azimuth, direction: lat < 0 ? "true north" : "true south", tilt: Math.round(Math.abs(lat)), summerTilt: Math.round(Math.max(5, Math.abs(lat) - 15)), winterTilt: Math.round(Math.min(80, Math.abs(lat) + 15)) };
  }, [latitude]);

  useEffect(() => {
    if (!sensorActive) return;
    const handleOrientation = (rawEvent: DeviceOrientationEvent) => {
      const event = rawEvent as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const screenAngle = Number(window.screen.orientation?.angle ?? 0);
      const nextHeading = typeof event.webkitCompassHeading === "number"
        ? event.webkitCompassHeading
        : typeof event.alpha === "number" ? (360 - event.alpha + screenAngle + 360) % 360 : undefined;
      if (nextHeading !== undefined && Number.isFinite(nextHeading)) setHeading(nextHeading);
      if (typeof event.beta === "number" && typeof event.gamma === "number") {
        const beta = event.beta * Math.PI / 180;
        const gamma = event.gamma * Math.PI / 180;
        const vertical = clamp(Math.abs(Math.cos(beta) * Math.cos(gamma)), 0, 1);
        setMeasuredTilt(Math.acos(vertical) * 180 / Math.PI);
      }
      setSensorError("");
    };
    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [sensorActive]);

  async function enableOrientationTool() {
    if (!("DeviceOrientationEvent" in window)) { setSensorError("This browser does not expose phone orientation sensors."); return; }
    if (!window.isSecureContext) { setSensorError("Phone sensors require PVIntell to be opened over HTTPS."); return; }
    try {
      const OrientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
      if (typeof OrientationEvent.requestPermission === "function") {
        const permission = await OrientationEvent.requestPermission();
        if (permission !== "granted") { setSensorError("Motion and orientation permission was not granted."); return; }
      }
      setSensorError("");
      setSensorActive(true);
    } catch {
      setSensorError("PVIntell could not start the phone compass. Check browser sensor permissions and try again.");
    }
  }

  const headingLabel = heading === undefined ? "Waiting for heading…" : `${Math.round(heading)}° ${["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(heading / 45) % 8]}`;

  function updateCoordinates(nextLat: string, nextLong: string, label = "Custom coordinates") {
    setLatitude(nextLat); setLongitude(nextLong);
    const lat = Number(nextLat); const lng = Number(nextLong);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setLocation({ latitude: lat, longitude: lng, label }); setError("");
    } else setError("Enter a latitude from −90 to 90 and longitude from −180 to 180.");
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) { setError("Location is not available in this browser."); return; }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const lat = coords.latitude.toFixed(6); const lng = coords.longitude.toFixed(6); setLatitude(lat); setLongitude(lng); setLocation({ latitude: coords.latitude, longitude: coords.longitude, label: "Device location" }); },
      () => setError("Location permission was not granted. You can enter coordinates instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section className="card p-5">
      <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#fff1ac] text-brand"><MapPin size={19}/></span><div><div className="eyebrow">Location input</div><h2 className="mt-1 text-base font-extrabold">{location.label}</h2></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-[10px] font-bold text-muted">Latitude<input className="field" type="number" min="-90" max="90" step="0.000001" value={latitude} onChange={(e) => updateCoordinates(e.target.value, longitude)}/></label>
        <label className="text-[10px] font-bold text-muted">Longitude<input className="field" type="number" min="-180" max="180" step="0.000001" value={longitude} onChange={(e) => updateCoordinates(latitude, e.target.value)}/></label>
      </div>
      <button type="button" onClick={useDeviceLocation} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[11px] font-bold text-brand"><LocateFixed size={15}/>Use my current location</button>
      {error ? <p className="mt-3 rounded-xl bg-[#fff0eb] p-3 text-[11px] text-[#913e31]">{error}</p> : null}
      <div className="mt-5 rounded-xl bg-[#f4f7fa] p-4 text-[11px] leading-5 text-muted"><strong className="text-ink">Azimuth convention:</strong> 0° is true north, 90° east, 180° true south and 270° west. A compass may need local magnetic-declination correction to indicate true north.</div>
    </section>
    <section className="card overflow-hidden">
      <div className="bg-[linear-gradient(135deg,#fff3b7,#edf6ff)] p-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Annual starting point</div><div className="mt-2 text-4xl font-extrabold tracking-[-.05em]">{result.azimuth}°</div><p className="mt-1 text-xs font-bold">Face {result.direction}</p></div><Compass size={54} className="text-brand"/></div></div>
      <div className="grid grid-cols-3 gap-px bg-line"><div className="bg-white p-3 text-center"><Sun size={15} className="mx-auto text-[#c58e00]"/><strong className="mt-1 block text-sm">{result.tilt}°</strong><span className="text-[9px] text-muted">Year-round tilt</span></div><div className="bg-white p-3 text-center"><strong className="block text-sm">{result.summerTilt}°</strong><span className="text-[9px] text-muted">Summer tilt</span></div><div className="bg-white p-3 text-center"><strong className="block text-sm">{result.winterTilt}°</strong><span className="text-[9px] text-muted">Winter tilt</span></div></div>
      <p className="p-4 text-[10px] leading-5 text-muted">This is a location-based rule of thumb for a fixed array. Shade, roof planes, wind loading, local weather and time-of-use tariffs can make another direction better.</p>
    </section>
    <section className="card overflow-hidden lg:col-span-2">
      <div className="flex items-start justify-between gap-3 border-b border-line bg-[#eef5fc] p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><Smartphone size={17}/></span><div><div className="eyebrow">Phone measurement</div><h2 className="mt-1 text-base font-extrabold">Live compass and surface tilt</h2><p className="mt-1 text-[10px] leading-4 text-muted">Use your phone to check which way a panel surface faces and its angle from level.</p></div></div>{sensorActive ? <button type="button" onClick={() => setSensorActive(false)} className="h-9 shrink-0 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand">Stop</button> : null}</div>
      <div className="grid gap-5 p-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
        <div className="mx-auto">
          <div className="relative size-48 rounded-full border-[10px] border-[#dce8f3] bg-[radial-gradient(circle,#fff_48%,#eef5fc)] shadow-inner" role="img" aria-label={`Phone compass ${headingLabel}`}>
            <span className="absolute left-1/2 top-2 -translate-x-1/2 text-xs font-black text-[#c14335]">N</span><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-brand">E</span><span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-black text-brand">S</span><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-brand">W</span>
            <span className="absolute left-1/2 top-1/2 h-[68px] w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-[#d3483b] transition-transform duration-150" style={{ transform: `translate(-50%, -100%) rotate(${heading ?? 0}deg)` }}/>
            <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow"/>
          </div>
          <div className="mt-3 text-center text-lg font-extrabold text-brand">{headingLabel}</div>
        </div>
        <div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-line bg-[#f7fafc] p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-muted"><Compass size={14}/>Measured azimuth</div><strong className="mt-2 block text-2xl">{heading === undefined ? "—" : `${Math.round(heading)}°`}</strong><span className="text-[10px] text-muted">Top of phone points in the direction the panels face</span></div><div className="rounded-xl border border-line bg-[#f7fafc] p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-muted"><Ruler size={14}/>Measured tilt</div><strong className="mt-2 block text-2xl">{measuredTilt === undefined ? "—" : `${Math.round(measuredTilt)}°`}</strong><span className="text-[10px] text-muted">0° is level; 90° is vertical</span></div></div>
          {!sensorActive ? <button type="button" onClick={() => void enableOrientationTool()} className="mt-4 h-11 w-full rounded-xl bg-brand px-4 text-xs font-extrabold text-white">Enable phone compass and tilt</button> : <p className="mt-4 rounded-xl bg-[#edf8f1] p-3 text-[11px] font-semibold leading-5 text-[#17603b]">Lay the phone flat with its screen facing up and its top edge pointing down the panel slope. Hold still for a few seconds.</p>}
          {sensorError ? <p className="mt-3 rounded-xl bg-[#fff0eb] p-3 text-[11px] text-[#913e31]">{sensorError}</p> : null}
          <p className="mt-3 text-[10px] leading-5 text-muted"><strong>Planning aid only:</strong> phone headings are normally magnetic while proposal azimuths use true north. Metal roofing, cases and nearby wiring can distort the compass—calibrate with a figure-eight movement and confirm important measurements from a map, survey or dedicated instrument. Tilt is usually more dependable but should still be checked.</p>
        </div>
      </div>
    </section>
  </div>;
}
