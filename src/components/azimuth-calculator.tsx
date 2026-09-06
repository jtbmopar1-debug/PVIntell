"use client";

import { Compass, LocateFixed, MapPin, Sun } from "lucide-react";
import { useMemo, useState } from "react";

type Location = { latitude: number; longitude: number; label: string };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function AzimuthCalculator({ initialLocation }: { initialLocation: Location }) {
  const [location, setLocation] = useState(initialLocation);
  const [latitude, setLatitude] = useState(String(initialLocation.latitude));
  const [longitude, setLongitude] = useState(String(initialLocation.longitude));
  const [error, setError] = useState("");
  const result = useMemo(() => {
    const lat = clamp(Number(latitude) || 0, -90, 90);
    const azimuth = lat < 0 ? 0 : 180;
    return { azimuth, direction: lat < 0 ? "true north" : "true south", tilt: Math.round(Math.abs(lat)), summerTilt: Math.round(Math.max(5, Math.abs(lat) - 15)), winterTilt: Math.round(Math.min(80, Math.abs(lat) + 15)) };
  }, [latitude]);

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
  </div>;
}
