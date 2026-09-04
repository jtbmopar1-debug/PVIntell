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
  forecastBasis: "array-geometry" | "horizontal-irradiance";
  rainMm: number;
  maxWind: number;
  maxCloudCover: number;
  minTemperature: number | null;
  maxTemperature: number | null;
  peak: SolarWeatherHour | undefined;
}

export interface SolarArrayForecastInput {
  capacityKw: number;
  azimuthDegrees?: number | null;
  tiltDegrees?: number | null;
}

export interface SolarForecastContext {
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export type SolarForecastInput = number | SolarArrayForecastInput[];

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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normaliseArrays(input: SolarForecastInput): SolarArrayForecastInput[] {
  if (typeof input === "number") return input > 0 ? [{ capacityKw: input }] : [];
  return input
    .map((array) => ({ ...array, capacityKw: Math.max(0, Number(array.capacityKw) || 0) }))
    .filter((array) => array.capacityKw > 0);
}

export function totalSolarArrayKw(input: SolarForecastInput) {
  return normaliseArrays(input).reduce((total, array) => total + array.capacityKw, 0);
}

function hasArrayGeometry(input: SolarForecastInput, context: SolarForecastContext) {
  return (
    typeof context.latitude === "number" &&
    typeof context.longitude === "number" &&
    Boolean(context.timezone) &&
    normaliseArrays(input).some((array) => typeof array.tiltDegrees === "number" && typeof array.azimuthDegrees === "number")
  );
}

function timezoneOffsetMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const localAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return (localAsUtc - date.getTime()) / 60_000;
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000);
}

function planeOfArrayGain(hour: SolarWeatherHour, array: SolarArrayForecastInput, context: SolarForecastContext) {
  if (
    typeof context.latitude !== "number" ||
    typeof context.longitude !== "number" ||
    !context.timezone ||
    typeof array.tiltDegrees !== "number" ||
    typeof array.azimuthDegrees !== "number"
  ) return 1;

  const date = new Date(hour.time);
  const latitude = context.latitude * Math.PI / 180;
  const tilt = clamp(array.tiltDegrees, 0, 90) * Math.PI / 180;
  if (tilt <= 0) return 1;

  const azimuth = ((array.azimuthDegrees % 360) + 360) % 360 * Math.PI / 180;
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const fractionalYear = 2 * Math.PI / 365 * (dayOfYear(date) - 1 + (utcHour - 12) / 24);
  const declination =
    0.006918 -
    0.399912 * Math.cos(fractionalYear) +
    0.070257 * Math.sin(fractionalYear) -
    0.006758 * Math.cos(2 * fractionalYear) +
    0.000907 * Math.sin(2 * fractionalYear) -
    0.002697 * Math.cos(3 * fractionalYear) +
    0.00148 * Math.sin(3 * fractionalYear);
  const equationOfTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(fractionalYear) - 0.032077 * Math.sin(fractionalYear) - 0.014615 * Math.cos(2 * fractionalYear) - 0.040849 * Math.sin(2 * fractionalYear));
  const offset = timezoneOffsetMinutes(date, context.timezone);
  const localMinutes = ((date.getUTCHours() * 60 + date.getUTCMinutes() + offset) % 1440 + 1440) % 1440;
  const trueSolarMinutes = localMinutes + equationOfTime + 4 * context.longitude - offset;
  const hourAngle = (trueSolarMinutes / 4 - 180) * Math.PI / 180;
  const cosZenith = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  if (cosZenith <= 0.02) return 0;

  const sunEast = -Math.cos(declination) * Math.sin(hourAngle);
  const sunNorth = Math.cos(latitude) * Math.sin(declination) - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const sunUp = cosZenith;
  const normalEast = Math.sin(azimuth) * Math.sin(tilt);
  const normalNorth = Math.cos(azimuth) * Math.sin(tilt);
  const normalUp = Math.cos(tilt);
  const cosIncidence = sunEast * normalEast + sunNorth * normalNorth + sunUp * normalUp;
  if (cosIncidence <= 0) return 0.15;

  const beamGain = clamp(cosIncidence / Math.max(0.08, cosZenith), 0, 1.8);
  const cloud = clamp((hour.cloudCover ?? 30) / 100, 0, 1);
  const diffuseShare = clamp(0.15 + cloud * 0.55, 0.15, 0.7);
  return clamp(diffuseShare + (1 - diffuseShare) * beamGain, 0, 1.6);
}

function solarKwhForHour(hour: SolarWeatherHour, arrays: SolarArrayForecastInput[], hoursInStep: number, performanceRatio: number, context: SolarForecastContext) {
  const irradiance = typeof hour.irradiance === "number" && Number.isFinite(hour.irradiance) ? Math.max(0, hour.irradiance) : 0;
  return arrays.reduce((total, array) => total + irradiance / 1000 * array.capacityKw * planeOfArrayGain(hour, array, context) * performanceRatio * hoursInStep, 0);
}

export function expectedSolarKwh(hours: SolarWeatherHour[], arrayInput: SolarForecastInput, performanceRatio = 0.8, context: SolarForecastContext = {}) {
  const ordered = sortedHours(hours);
  const arrays = normaliseArrays(arrayInput);
  return ordered.reduce((total, hour, index) => total + solarKwhForHour(hour, arrays, intervalHours(ordered, index), performanceRatio, context), 0);
}

function remainingSolarKwh(hours: SolarWeatherHour[], arrayInput: SolarForecastInput, now: Date, performanceRatio = 0.8, context: SolarForecastContext = {}) {
  const ordered = sortedHours(hours);
  const arrays = normaliseArrays(arrayInput);
  const cutoffMs = now.getTime();
  return ordered.reduce((total, hour, index) => {
    const startMs = Date.parse(hour.time);
    if (!Number.isFinite(startMs)) return total;
    const endMs = startMs + intervalHours(ordered, index) * 3_600_000;
    const remainingHours = Math.max(0, endMs - Math.max(startMs, cutoffMs)) / 3_600_000;
    return total + solarKwhForHour(hour, arrays, remainingHours, performanceRatio, context);
  }, 0);
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
  arrayInput: SolarForecastInput,
  now = new Date(),
  context: SolarForecastContext = {},
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
    expectedKwh: expectedSolarKwh(hours, arrayInput, 0.8, context),
    remainingKwh: remainingSolarKwh(hours, arrayInput, now, 0.8, context),
    forecastBasis: hasArrayGeometry(arrayInput, context) ? "array-geometry" : "horizontal-irradiance",
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
  arrayInput: SolarForecastInput,
  now = new Date(),
  context: SolarForecastContext = {},
) {
  const forecastContext = { ...context, timezone: context.timezone ?? timezone };
  const todayKey = localDateKey(now, timezone);
  return [...groupForecastDays(hours, timezone).entries()]
    .filter(([dateKey]) => dateKey >= todayKey)
    .slice(0, 5)
    .map(([dateKey, dayHours]) => summarizeSolarDay(dateKey, dayHours, arrayInput, now, forecastContext));
}
