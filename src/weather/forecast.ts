export interface SolarWeatherHour {
  time: string;
  temperature: number | null;
  cloudCover: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  irradiance: number | null;
  uvIndex: number | null;
}

export interface SolarDaySummary {
  dateKey: string;
  hours: SolarWeatherHour[];
  expectedKwh: number;
  remainingKwh: number;
  rainMm: number;
  maxWind: number;
  maxCloudCover: number;
  minTemperature: number | null;
  maxTemperature: number | null;
  peak: SolarWeatherHour | undefined;
}

export function localDateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function sortedHours(hours: SolarWeatherHour[]) {
  return [...hours].sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
}

function intervalHours(hours: SolarWeatherHour[], index: number) {
  const current = Date.parse(hours[index]?.time ?? "");
  const adjacent = Date.parse(hours[index + 1]?.time ?? hours[index - 1]?.time ?? "");
  if (!Number.isFinite(current) || !Number.isFinite(adjacent)) return 1;
  const difference = index + 1 < hours.length ? adjacent - current : current - adjacent;
  return Math.max(0.25, Math.min(2, difference / 3_600_000));
}

function integrate(hours: SolarWeatherHour[], value: (hour: SolarWeatherHour) => number | null) {
  const ordered = sortedHours(hours);
  return ordered.reduce((total, hour, index) => {
    const reading = value(hour);
    return total + (typeof reading === "number" && Number.isFinite(reading) ? Math.max(0, reading) * intervalHours(ordered, index) : 0);
  }, 0);
}

function integrateAfter(hours: SolarWeatherHour[], cutoff: Date, value: (hour: SolarWeatherHour) => number | null) {
  const ordered = sortedHours(hours);
  const cutoffMs = cutoff.getTime();
  return ordered.reduce((total, hour, index) => {
    const reading = value(hour);
    const startMs = Date.parse(hour.time);
    if (typeof reading !== "number" || !Number.isFinite(reading) || !Number.isFinite(startMs)) return total;
    const endMs = startMs + intervalHours(ordered, index) * 3_600_000;
    const remainingHours = Math.max(0, endMs - Math.max(startMs, cutoffMs)) / 3_600_000;
    return total + Math.max(0, reading) * remainingHours;
  }, 0);
}

export function expectedSolarKwh(hours: SolarWeatherHour[], arrayKw: number, performanceRatio = 0.8) {
  return integrate(hours, (hour) => hour.irradiance) / 1000 * Math.max(0, arrayKw) * performanceRatio;
}

function remainingSolarKwh(hours: SolarWeatherHour[], arrayKw: number, now: Date, performanceRatio = 0.8) {
  return integrateAfter(hours, now, (hour) => hour.irradiance) / 1000 * Math.max(0, arrayKw) * performanceRatio;
}

export function latestForecastHour(hours: SolarWeatherHour[], now = new Date()) {
  const ordered = sortedHours(hours);
  const nowMs = now.getTime();
  return [...ordered].reverse().find((hour) => Date.parse(hour.time) <= nowMs) ?? ordered[0];
}

export function groupForecastDays(hours: SolarWeatherHour[], timezone: string) {
  const groups = new Map<string, SolarWeatherHour[]>();
  for (const hour of sortedHours(hours)) {
    const key = localDateKey(new Date(hour.time), timezone);
    groups.set(key, [...(groups.get(key) ?? []), hour]);
  }
  return groups;
}

export function summarizeSolarDay(
  dateKey: string,
  hours: SolarWeatherHour[],
  arrayKw: number,
  now = new Date(),
): SolarDaySummary {
  const temperatures = hours
    .map((hour) => hour.temperature)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const peak = hours.reduce<SolarWeatherHour | undefined>(
    (best, hour) => (hour.irradiance ?? 0) > (best?.irradiance ?? -1) ? hour : best,
    undefined,
  );

  return {
    dateKey,
    hours,
    expectedKwh: expectedSolarKwh(hours, arrayKw),
    remainingKwh: remainingSolarKwh(hours, arrayKw, now),
    rainMm: integrate(hours, (hour) => hour.precipitation),
    maxWind: hours.reduce((maximum, hour) => Math.max(maximum, hour.windSpeed ?? 0), 0),
    maxCloudCover: hours.reduce((maximum, hour) => Math.max(maximum, hour.cloudCover ?? 0), 0),
    minTemperature: temperatures.length ? Math.min(...temperatures) : null,
    maxTemperature: temperatures.length ? Math.max(...temperatures) : null,
    peak,
  };
}

export function fiveDaySolarOutlook(
  hours: SolarWeatherHour[],
  timezone: string,
  arrayKw: number,
  now = new Date(),
) {
  const todayKey = localDateKey(now, timezone);
  return [...groupForecastDays(hours, timezone).entries()]
    .filter(([dateKey]) => dateKey >= todayKey)
    .slice(0, 5)
    .map(([dateKey, dayHours]) => summarizeSolarDay(dateKey, dayHours, arrayKw, now));
}
