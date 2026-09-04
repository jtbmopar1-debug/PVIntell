"use client";

import { useCallback, useEffect, useState } from "react";

export type UnitPreferences = {
  temperature: "c" | "f";
  windSpeed: "ms" | "kmh" | "mph" | "kn";
  rainfall: "mm" | "in";
  distance: "km" | "mi";
  dimensions: "metric" | "us";
  weight: "kg" | "lb";
  pressure: "hpa" | "inhg";
};

export const metricUnitPreferences: UnitPreferences = {
  temperature: "c",
  windSpeed: "ms",
  rainfall: "mm",
  distance: "km",
  dimensions: "metric",
  weight: "kg",
  pressure: "hpa",
};

export const usUnitPreferences: UnitPreferences = {
  temperature: "f",
  windSpeed: "mph",
  rainfall: "in",
  distance: "mi",
  dimensions: "us",
  weight: "lb",
  pressure: "inhg",
};

const storageKey = "pvintell:unit-preferences:v1";
const changeEvent = "pvintell:unit-preferences-changed";

function readPreferences(): UnitPreferences {
  if (typeof window === "undefined") return metricUnitPreferences;
  try {
    return { ...metricUnitPreferences, ...JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") };
  } catch {
    return metricUnitPreferences;
  }
}

export function useUnitPreferences() {
  const [preferences, setPreferencesState] = useState<UnitPreferences>(metricUnitPreferences);
  useEffect(() => {
    const sync = () => setPreferencesState(readPreferences());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(changeEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(changeEvent, sync);
    };
  }, []);
  const setPreferences = useCallback((next: UnitPreferences) => {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setPreferencesState(next);
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  const setUnit = useCallback(<Key extends keyof UnitPreferences>(key: Key, value: UnitPreferences[Key]) => {
    setPreferences({ ...readPreferences(), [key]: value });
  }, [setPreferences]);
  return { preferences, setPreferences, setUnit };
}

const fixed = (value: number, digits: number) => value.toFixed(digits);

export function formatTemperature(celsius: number | null | undefined, units: UnitPreferences, digits = 0) {
  if (typeof celsius !== "number") return "—";
  return units.temperature === "f" ? `${fixed(celsius * 9 / 5 + 32, digits)} °F` : `${fixed(celsius, digits)} °C`;
}

export function formatWindSpeed(metresPerSecond: number | null | undefined, units: UnitPreferences, digits = 1) {
  if (typeof metresPerSecond !== "number") return "—";
  if (units.windSpeed === "kmh") return `${fixed(metresPerSecond * 3.6, digits)} km/h`;
  if (units.windSpeed === "mph") return `${fixed(metresPerSecond * 2.236936, digits)} mph`;
  if (units.windSpeed === "kn") return `${fixed(metresPerSecond * 1.943844, digits)} kn`;
  return `${fixed(metresPerSecond, digits)} m/s`;
}

export function formatRainfall(millimetres: number | null | undefined, units: UnitPreferences, digits = 1) {
  if (typeof millimetres !== "number") return "—";
  return units.rainfall === "in" ? `${fixed(millimetres / 25.4, Math.max(2, digits))} in` : `${fixed(millimetres, digits)} mm`;
}
