"use client";

import { useCallback, useEffect, useState } from "react";
import type { Site } from "@/domain/models";
import { localDateKey } from "@/weather/forecast";
import type { SolarWeatherHour } from "@/weather/forecast";
export { localDateKey } from "@/weather/forecast";
export type { SolarWeatherHour } from "@/weather/forecast";

export interface SolarWeatherPayload {
  hours: SolarWeatherHour[];
  fetchedAt: string;
  site: { location: string; timezone: string };
}

interface CacheEntry {
  version: 2;
  localDate: string;
  timezone: string;
  latitude: number;
  longitude: number;
  payload: SolarWeatherPayload;
}

const cachePrefix = "pvintell:solar-weather:v2:";
const requests = new Map<string, Promise<SolarWeatherPayload>>();

export function useForecastNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function storageKey(siteId: string) {
  return `${cachePrefix}${siteId}`;
}

function readCache(
  siteId: string,
  timezone: string,
  latitude?: number,
  longitude?: number,
): SolarWeatherPayload | undefined {
  try {
    const raw = localStorage.getItem(storageKey(siteId));
    if (!raw) return;
    const entry = JSON.parse(raw) as CacheEntry;
    if (
      entry.version !== 2 ||
      entry.latitude !== latitude ||
      entry.longitude !== longitude ||
      entry.timezone !== timezone ||
      entry.localDate !== localDateKey(new Date(), timezone) ||
      !Array.isArray(entry.payload?.hours)
    )
      return;
    return entry.payload;
  } catch {
    return;
  }
}

async function fetchAndCache(
  siteId: string,
  timezone: string,
  latitude: number,
  longitude: number,
) {
  const requestKey = `${siteId}:${latitude}:${longitude}:${timezone}:${localDateKey(new Date(), timezone)}`;
  const existing = requests.get(requestKey);
  if (existing) return existing;
  const pending = (async () => {
    const response = await fetch(`/api/weather/solar?siteId=${siteId}`);
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? "Could not load solar weather");
    const payload = body as SolarWeatherPayload;
    const resolvedTimezone = payload.site?.timezone || timezone;
    const entry: CacheEntry = {
      version: 2,
      localDate: localDateKey(new Date(), resolvedTimezone),
      timezone: resolvedTimezone,
      latitude,
      longitude,
      payload,
    };
    localStorage.setItem(storageKey(siteId), JSON.stringify(entry));
    return payload;
  })();
  requests.set(requestKey, pending);
  try {
    return await pending;
  } finally {
    requests.delete(requestKey);
  }
}

export function useSolarWeather(site: Site) {
  const hasLocation =
    typeof site.latitude === "number" && typeof site.longitude === "number";
  const [data, setData] = useState<SolarWeatherPayload>();
  const [loading, setLoading] = useState(hasLocation);
  const [error, setError] = useState("");
  const loadDaily = useCallback(async () => {
    await Promise.resolve();
    if (!hasLocation) {
      setLoading(false);
      return;
    }
    const cached = readCache(
      site.id,
      site.timezone,
      site.latitude,
      site.longitude,
    );
    if (cached) {
      setData(cached);
      setError("");
      setLoading(false);
      return;
    }
    setData(undefined);
    setLoading(true);
    setError("");
    try {
      setData(
        await fetchAndCache(
          site.id,
          site.timezone,
          site.latitude as number,
          site.longitude as number,
        ),
      );
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not load solar weather",
      );
    } finally {
      setLoading(false);
    }
  }, [hasLocation, site.id, site.latitude, site.longitude, site.timezone]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDaily(), 0);
    const midnightWatcher = window.setInterval(() => {
      if (!readCache(site.id, site.timezone, site.latitude, site.longitude))
        void loadDaily();
    }, 60_000);
    const syncTabs = (event: StorageEvent) => {
      if (event.key !== storageKey(site.id)) return;
      const cached = readCache(
        site.id,
        site.timezone,
        site.latitude,
        site.longitude,
      );
      if (cached) {
        setData(cached);
        setError("");
        setLoading(false);
      }
    };
    window.addEventListener("storage", syncTabs);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(midnightWatcher);
      window.removeEventListener("storage", syncTabs);
    };
  }, [loadDaily, site.id, site.latitude, site.longitude, site.timezone]);

  return { data, loading, error, hasLocation, loadDaily };
}
