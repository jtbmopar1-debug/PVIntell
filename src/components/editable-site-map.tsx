"use client";

import L, { type DragEndEvent } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export type SiteMapPoint = { id: string; name: string; latitude: number; longitude: number; kind?: "site" | "system"; mobile?: boolean; approximate?: boolean };

function markerIcon(point: SiteMapPoint, active: boolean) {
  const classes = ["pv-map-marker", point.kind === "system" ? "is-system" : "is-site", point.mobile ? "is-mobile" : "", point.approximate ? "is-approximate" : "", active ? "is-active" : ""].filter(Boolean).join(" ");
  return L.divIcon({ className: "pv-map-marker-shell", html: `<span class="${classes}" aria-hidden="true"></span>`, iconSize: [40, 52], iconAnchor: [20, 50], tooltipAnchor: [0, -45] });
}

function MapController({ points, activeId, center }: { points: SiteMapPoint[]; activeId: string; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) map.setView(center, 14);
    else if (points.length === 1) map.setView([points[0].latitude, points[0].longitude], 16);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((point) => [point.latitude, point.longitude])), { padding: [48, 48], maxZoom: 15 });
  }, [center[0], center[1], map, points.length]);
  useEffect(() => {
    const active = points.find((point) => point.id === activeId);
    if (active) map.panTo([active.latitude, active.longitude]);
  }, [activeId, map]);
  return null;
}

function ClickToMove({ activeId, onMove }: { activeId: string; onMove: (id: string, latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => { if (activeId) onMove(activeId, event.latlng.lat, event.latlng.lng); } });
  return null;
}

function MarkerScaleController() {
  const map = useMapEvents({ zoomend: () => updateScale() });
  function updateScale() {
    const scale = Math.max(0.48, Math.min(1.05, 0.52 + (map.getZoom() - 12) * 0.09));
    map.getContainer().style.setProperty("--pv-marker-scale", scale.toFixed(2));
  }
  useEffect(() => { updateScale(); }, [map]);
  return null;
}

export default function EditableSiteMap({ points, activeId, center, onSelect, onMove }: { points: SiteMapPoint[]; activeId: string; center: [number, number]; onSelect: (id: string) => void; onMove: (id: string, latitude: number, longitude: number) => void }) {
  return <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full" aria-label="Editable system locations">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    <MapController points={points} activeId={activeId} center={center}/><MarkerScaleController/><ClickToMove activeId={activeId} onMove={onMove}/>
    {points.map((point) => { const selected = point.id === activeId; return <Marker key={point.id} position={[point.latitude, point.longitude]} icon={markerIcon(point, selected)} draggable={selected} eventHandlers={{ click: (event) => { onSelect(point.id); event.target.openTooltip(); }, dragend: (event: DragEndEvent) => { const position = event.target.getLatLng(); onMove(point.id, position.lat, position.lng); } }}><Tooltip direction="top" className={selected ? "pv-map-label is-active" : "pv-map-label"}>{point.name}{point.mobile ? " · not static" : point.approximate ? " · position needed" : ""}</Tooltip></Marker>; })}
  </MapContainer>;
}
