export type ProposalSizingInput = {
  mode: string;
  peakSunHours?: number;
  autonomyDays?: number;
  discovery?: Record<string, unknown>;
  representativePanelWatts?: number;
  representativePanelLengthMm?: number;
  representativePanelWidthMm?: number;
  solarResource?: {
    basis?: unknown;
    source?: unknown;
    period?: unknown;
    monthlyPeakSunHours?: unknown;
  };
};

export type ProposalSizingResult = {
  method: "deterministic-v1";
  dailyEnergyKwh?: number;
  dailyEnergySource?: "off_grid_daily_energy_use" | "current_energy_use";
  peakSunHours?: number;
  weakestMonthPeakSunHours?: number;
  strongestMonthPeakSunHours?: number;
  solarResourceBasis?: string;
  solarResourceSource?: string;
  solarResourcePeriod?: string;
  systemEfficiency: number;
  pvKw?: number;
  panelCount?: number;
  energyTargetPvKw?: number;
  energyTargetPanelCount?: number;
  planningPanelCapacity?: number;
  fitLimited?: boolean;
  panelWatts?: number;
  inverterKw?: number;
  simultaneousLoadKw?: number;
  startupPeakKw?: number;
  batteryUsableKwh?: number;
  batteryOnlyDays?: number;
  batterySizingBasis?: "no_sun_autonomy" | "solar_assisted_typical_winter" | "daily_energy_fraction";
  weakestMonthPvKwh?: number;
  assumedNonSolarLoadKwh?: number;
  assumptions: string[];
  warnings: string[];
};

type LoadRating = {
  quantity?: unknown;
  runningKw?: unknown;
  peakRunningKw?: unknown;
  startingKw?: unknown;
  inputKva?: unknown;
  simultaneous?: unknown;
};

type PanelArea = { id?: unknown; lengthM?: unknown; widthM?: unknown };
type PanelObstruction = { areaId?: unknown; kind?: unknown; lengthM?: unknown; widthM?: unknown };

const finitePositive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

function discoveryValue(discovery: Record<string, unknown>, key: string) {
  const entry = discovery[key];
  if (entry && typeof entry === "object" && "value" in entry)
    return (entry as Record<string, unknown>).value;
  return entry;
}

function energyAsDailyKwh(value: unknown, defaultPeriod: "day" | "month") {
  if (typeof value === "number")
    return finitePositive(value) && (defaultPeriod === "month" ? value / 30.4 : value);
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase().replace(/(?<=\d),(?=\d)/g, "");
  if (!normalized || /\b(?:no|none|unknown|unpowered|without)\b/.test(normalized)) return undefined;
  // A kW nameplate is power, not energy. Reject it unless the text explicitly
  // supplies an energy unit as well.
  if (/\bkw\b/.test(normalized) && !/\bkwh\b/.test(normalized)) return undefined;
  const amount = finitePositive(normalized.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!amount) return undefined;
  const kwh = /\bmwh\b/.test(normalized) ? amount * 1000
    : /\bwh\b/.test(normalized) && !/\bkwh\b/.test(normalized) ? amount / 1000
    : amount;
  if (/\b(?:year|annual|annually|yr)\b/.test(normalized)) return kwh / 365;
  if (/\b(?:month|monthly)\b/.test(normalized)) return kwh / 30.4;
  if (/\b(?:week|weekly)\b/.test(normalized)) return kwh / 7;
  if (/\b(?:day|daily)\b/.test(normalized)) return kwh;
  return defaultPeriod === "month" ? kwh / 30.4 : kwh;
}

export function normalizedDailyEnergy(discovery: Record<string, unknown>) {
  const offGrid = energyAsDailyKwh(discoveryValue(discovery, "off_grid_daily_energy_use"), "day");
  if (offGrid) return { dailyKwh: offGrid, source: "off_grid_daily_energy_use" as const };
  const current = energyAsDailyKwh(discoveryValue(discovery, "current_energy_use"), "month");
  return current ? { dailyKwh: current, source: "current_energy_use" as const } : undefined;
}

function parsedRatings(discovery: Record<string, unknown>) {
  const ratings: LoadRating[] = [];
  for (const key of ["household_motor_ratings", "pool_equipment_ratings"]) {
    const raw = discoveryValue(discovery, key);
    try {
      const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (value && typeof value === "object") ratings.push(...Object.values(value as Record<string, LoadRating>));
    } catch { /* Free-text ratings are evidence notes, not numeric sizing inputs. */ }
  }
  const poolHeaterKw = finitePositive(discoveryValue(discovery, "pool_heater_electrical_kw"));
  if (poolHeaterKw) ratings.push({ quantity: 1, runningKw: poolHeaterKw, simultaneous: true });
  return ratings;
}

function parsedArray<T>(value: unknown): T[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch { return []; }
}

function planningPanelCapacity(input: ProposalSizingInput, discovery: Record<string, unknown>) {
  const panelLengthM = finitePositive(input.representativePanelLengthMm) && Number(input.representativePanelLengthMm) / 1000;
  const panelWidthM = finitePositive(input.representativePanelWidthMm) && Number(input.representativePanelWidthMm) / 1000;
  if (!panelLengthM || !panelWidthM) return undefined;
  const areas = parsedArray<PanelArea>(discoveryValue(discovery, "panel_area_dimensions"));
  if (!areas.length) return undefined;
  const obstructions = parsedArray<PanelObstruction>(discoveryValue(discovery, "panel_area_constraints"));
  const gapM = .02;
  const moduleAreaM2 = panelLengthM * panelWidthM;
  let total = 0;
  for (const area of areas) {
    const lengthM = finitePositive(area.lengthM);
    const widthM = finitePositive(area.widthM);
    if (!lengthM || !widthM) continue;
    const portrait = Math.floor((lengthM + gapM) / (panelLengthM + gapM)) * Math.floor((widthM + gapM) / (panelWidthM + gapM));
    const landscape = Math.floor((lengthM + gapM) / (panelWidthM + gapM)) * Math.floor((widthM + gapM) / (panelLengthM + gapM));
    const obstructionAreaM2 = obstructions
      .filter((item) => String(item.kind) !== "none" && String(item.areaId) === String(area.id))
      .reduce((sum, item) => sum + (finitePositive(item.lengthM) ?? 0) * (finitePositive(item.widthM) ?? 0), 0);
    total += Math.max(0, Math.max(portrait, landscape) - Math.ceil(obstructionAreaM2 / moduleAreaM2));
  }
  return total > 0 ? total : 0;
}

function loadEnvelope(discovery: Record<string, unknown>) {
  const ratings = parsedRatings(discovery).filter((rating) => rating.simultaneous !== false);
  if (!ratings.length) return undefined;
  let continuousKw = 0;
  let largestStartIncrementKw = 0;
  for (const rating of ratings) {
    const quantity = Math.max(1, finitePositive(rating.quantity) ?? 1);
    const runningKw = finitePositive(rating.peakRunningKw ?? rating.runningKw ?? rating.inputKva) ?? 0;
    const startingKw = finitePositive(rating.startingKw) ?? runningKw;
    continuousKw += runningKw * quantity;
    largestStartIncrementKw = Math.max(largestStartIncrementKw, Math.max(0, startingKw - runningKw));
  }
  if (!continuousKw) return undefined;
  return { continuousKw, startupPeakKw: continuousKw + largestStartIncrementKw };
}

function normalizedMode(mode: string) {
  return mode.toLowerCase().replaceAll("-", "_");
}

function backupScope(discovery: Record<string, unknown>) {
  return String(discoveryValue(discovery, "backup_preference") ?? "").toLowerCase();
}

function batteryOnlyDays(input: ProposalSizingInput, discovery: Record<string, unknown>) {
  const duration = String(discoveryValue(discovery, "backup_duration") ?? "").toLowerCase();
  const outageDays = duration.includes("few_hours") ? .25
    : duration.includes("overnight") ? .5
    : duration.includes("one_day") ? 1
    : duration.includes("multiple_days") ? 3
    : undefined;
  if (!outageDays) return undefined;
  const generatorRoles = String(discoveryValue(discovery, "generator_outage_role") ?? "").toLowerCase();
  const generatorRechargesBattery = /battery_recharge|automatic_low_reserve|recharge.{0,20}batter|charge.{0,20}batter/.test(generatorRoles);
  if (generatorRechargesBattery) return Math.min(outageDays, .6);
  // A multi-day goal is a complete source-balance requirement, not a request
  // to multiply daily demand by the outage length. Use one day of storage as
  // a planning buffer while PV supplies daytime energy; the warning below
  // keeps the time-series validation visible.
  return outageDays <= 1 ? outageDays : 1;
}

const roundedUpHalfKw = (value: number) => Math.ceil(value * 2 - 1e-9) / 2;
const rounded = (value: number, places = 2) => Number(value.toFixed(places));

export function deriveProposalSizing(input: ProposalSizingInput): ProposalSizingResult {
  const discovery = input.discovery ?? {};
  const mode = normalizedMode(input.mode);
  const energy = normalizedDailyEnergy(discovery);
  const peakSunHours = finitePositive(input.peakSunHours);
  const monthlySolar = Array.isArray(input.solarResource?.monthlyPeakSunHours)
    ? input.solarResource.monthlyPeakSunHours.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const panelWatts = finitePositive(input.representativePanelWatts);
  const systemEfficiency = .8;
  const assumptions: string[] = [];
  const warnings: string[] = [];
  let pvKw: number | undefined;
  let panelCount: number | undefined;
  let energyTargetPvKw: number | undefined;
  let energyTargetPanelCount: number | undefined;
  const panelCapacity = planningPanelCapacity(input, discovery);
  let fitLimited = false;

  if (!energy) warnings.push("PV and battery size withheld: representative daily energy is not recorded.");
  if (!peakSunHours) warnings.push("PV size withheld: peak sun hours are not available.");
  if (peakSunHours && !input.solarResource?.source) warnings.push("Solar-resource provenance is missing; refresh discovery to replace the legacy planning value with Site climatology.");
  if (energy && peakSunHours) {
    const offGridRecoveryMargin = mode === "off_grid" ? 1.2 : 1;
    const requiredPvKw = energy.dailyKwh * offGridRecoveryMargin / (peakSunHours * systemEfficiency);
    energyTargetPvKw = rounded(requiredPvKw);
    assumptions.push(`${Math.round(systemEfficiency * 100)}% planning conversion/system efficiency.`);
    const basisLabel = input.solarResource?.basis === "weakest_month" ? "weakest design month" : "day-weighted annual average";
    assumptions.push(`${peakSunHours} equivalent peak-sun-hours/day from ${String(input.solarResource?.source ?? "an explicitly entered planning value")} (${basisLabel}${input.solarResource?.period ? `, ${String(input.solarResource.period)}` : ""}).`);
    if (mode === "off_grid") assumptions.push("20% off-grid generation and recovery margin.");
    if (panelWatts) {
      energyTargetPanelCount = Math.ceil(requiredPvKw * 1000 / panelWatts - 1e-9);
      panelCount = panelCapacity === undefined ? energyTargetPanelCount : Math.min(energyTargetPanelCount, panelCapacity);
      pvKw = rounded(panelCount * panelWatts / 1000);
      assumptions.push(`${panelWatts} W representative module for panel count; replace with the selected module datasheet.`);
      if (panelCapacity !== undefined) {
        assumptions.push(`${panelCapacity}-module planning capacity from the recorded usable rectangles, 20 mm inter-module gaps and recorded obstruction areas; portrait and landscape layouts were compared.`);
        if (panelCapacity < energyTargetPanelCount) {
          fitLimited = true;
          warnings.push(`The recorded panel areas hold about ${panelCapacity} modules, below the ${energyTargetPanelCount}-module annual-energy target; use another surface or accept lower solar coverage.`);
        } else {
          warnings.push("The energy-target module count fits the recorded rectangles in the planning grid; verify exact setbacks, access paths, fixing zones and obstruction positions before purchase.");
        }
      } else {
        warnings.push("Physical fit is not included in the panel count because usable panel-area rectangles are not recorded in a machine-readable form.");
      }
    } else {
      pvKw = rounded(requiredPvKw);
      warnings.push("Panel count withheld: no representative module rating is selected.");
    }
  }

  const scope = backupScope(discovery);
  const wholePropertyBackup = /most_home|most of (?:the )?home|whole|entire|all/.test(scope);
  const standaloneBackup = Boolean(scope && !/^(?:none|no outage backup)$/.test(scope));
  const batteryRequirement = String(discoveryValue(discovery, "battery_requirement") ?? "").toLowerCase();
  const includeBattery = mode === "off_grid" || /include|battery storage/.test(batteryRequirement) || standaloneBackup;
  const days = batteryOnlyDays(input, discovery);
  const backupDuration = String(discoveryValue(discovery, "backup_duration") ?? "").toLowerCase();
  const generatorRoles = String(discoveryValue(discovery, "generator_outage_role") ?? "").toLowerCase();
  const multiDayWithoutRechargeModel = backupDuration.includes("multiple_days")
    && !/battery_recharge|automatic_low_reserve/.test(generatorRoles);
  let batteryUsableKwh: number | undefined;
  let batterySizingBasis: ProposalSizingResult["batterySizingBasis"];
  let weakestMonthPvKwh: number | undefined;
  let assumedNonSolarLoadKwh: number | undefined;
  if (includeBattery && energy && multiDayWithoutRechargeModel) {
    warnings.push("Battery size withheld for the multi-day target: a chronological PV, load and generator dispatch simulation is required rather than multiplying daily energy or inventing a one-day buffer.");
  } else if (includeBattery && energy) {
    const storageFraction = mode === "off_grid" || wholePropertyBackup ? 1 : .4;
    const storageDays = days ?? 1;
    const noSunBaselineKwh = energy.dailyKwh * storageDays * storageFraction;
    const weakestMonthPeakSunHours = monthlySolar.length === 12 ? Math.min(...monthlySolar) : undefined;
    if (mode !== "off_grid" && wholePropertyBackup && storageDays === 1
      && pvKw !== undefined && weakestMonthPeakSunHours !== undefined) {
      // A functioning hybrid system carries daytime load and charges storage
      // from PV. Size for the larger of the assumed non-solar window and the
      // weakest typical month's net energy deficit. This deliberately does
      // not claim a full no-sun day; public supply or generator is fallback.
      const nonSolarLoadFraction = .55;
      assumedNonSolarLoadKwh = energy.dailyKwh * nonSolarLoadFraction;
      weakestMonthPvKwh = pvKw * weakestMonthPeakSunHours * systemEfficiency;
      const weakestMonthDeficitKwh = Math.max(0, energy.dailyKwh - weakestMonthPvKwh);
      batteryUsableKwh = rounded(Math.max(assumedNonSolarLoadKwh, weakestMonthDeficitKwh), 1);
      batterySizingBasis = "solar_assisted_typical_winter";
      assumptions.push(`${batteryUsableKwh} kWh usable solar-assisted storage: the greater of ${rounded(assumedNonSolarLoadKwh, 1)} kWh assumed outside the solar window (55% of daily use) and the ${rounded(weakestMonthDeficitKwh, 1)} kWh weakest-month daily shortfall after ${rounded(weakestMonthPvKwh, 1)} kWh of planned PV production.`);
      warnings.push("Solar-assisted storage is not a full no-sun-day guarantee; public supply or a generator is the fallback during unusually poor solar weather.");
    } else {
      batteryUsableKwh = rounded(noSunBaselineKwh, 1);
      batterySizingBasis = storageFraction === 1 ? "no_sun_autonomy" : "daily_energy_fraction";
      assumptions.push(`${storageDays} battery-only day equivalent and ${Math.round(storageFraction * 100)}% of recorded daily energy; usable rather than nominal storage.`);
    }
    warnings.push("Battery capacity is a planning baseline; validate load, solar and generator timing with a time-series model.");
    if (standaloneBackup && !wholePropertyBackup && mode !== "off_grid") warnings.push("Essentials-only storage uses a 40% daily-energy planning allowance; replace it with the backed-up circuit energy profile.");
    if (!standaloneBackup && mode !== "off_grid") warnings.push("Grid-connected storage uses a 40% daily-energy shifting allowance; replace it with interval load and tariff objectives.");
  }

  const loads = loadEnvelope(discovery);
  const needsStandaloneLoadSupport = mode === "off_grid" || standaloneBackup;
  let inverterKw: number | undefined;
  if (mode === "grid_tied" && pvKw && !standaloneBackup) {
    inverterKw = roundedUpHalfKw(pvKw / 1.2);
    assumptions.push("1.2 DC-to-AC planning ratio for a grid-tied PV inverter.");
  } else if (needsStandaloneLoadSupport && loads && (mode === "off_grid" || wholePropertyBackup)) {
    const continuousWithMargin = loads.continuousKw * 1.15;
    inverterKw = roundedUpHalfKw(Math.max(continuousWithMargin, pvKw ? pvKw / 1.2 : 0));
    assumptions.push("15% continuous-power margin over the recorded simultaneous load envelope.");
  } else if (pvKw && !needsStandaloneLoadSupport) {
    inverterKw = roundedUpHalfKw(pvKw / 1.2);
    assumptions.push("1.2 DC-to-AC planning ratio; public supply carries demand above PV output.");
  } else {
    if (pvKw) {
      inverterKw = roundedUpHalfKw(pvKw / 1.2);
      assumptions.push("PV-based inverter rating is used as the provisional minimum because the standalone simultaneous-load envelope is incomplete.");
      warnings.push("Verify inverter continuous and surge capacity against the complete standalone load schedule before equipment selection.");
    } else warnings.push("Inverter size withheld: the relevant simultaneous-load evidence is incomplete.");
  }
  if (pvKw) warnings.push(mode === "off_grid"
    ? "PV capacity is a planning baseline; validate it against the worst design month and consecutive poor-solar periods."
    : "PV capacity is an annual-energy baseline; validate monthly yield, orientation, shading and export limits.");
  if (loads) warnings.push(`Selected inverter surge capability must be checked against the ${rounded(loads.startupPeakKw, 1)} kW recorded startup envelope.`);

  return {
    method: "deterministic-v1",
    dailyEnergyKwh: energy?.dailyKwh,
    dailyEnergySource: energy?.source,
    peakSunHours,
    weakestMonthPeakSunHours: monthlySolar.length === 12 ? Math.min(...monthlySolar) : undefined,
    strongestMonthPeakSunHours: monthlySolar.length === 12 ? Math.max(...monthlySolar) : undefined,
    solarResourceBasis: typeof input.solarResource?.basis === "string" ? input.solarResource.basis : undefined,
    solarResourceSource: typeof input.solarResource?.source === "string" ? input.solarResource.source : undefined,
    solarResourcePeriod: typeof input.solarResource?.period === "string" ? input.solarResource.period : undefined,
    systemEfficiency,
    pvKw,
    panelCount,
    energyTargetPvKw,
    energyTargetPanelCount,
    planningPanelCapacity: panelCapacity,
    fitLimited,
    panelWatts,
    inverterKw,
    simultaneousLoadKw: loads?.continuousKw,
    startupPeakKw: loads?.startupPeakKw,
    batteryUsableKwh,
    batteryOnlyDays: days,
    batterySizingBasis,
    weakestMonthPvKwh: weakestMonthPvKwh === undefined ? undefined : rounded(weakestMonthPvKwh, 1),
    assumedNonSolarLoadKwh: assumedNonSolarLoadKwh === undefined ? undefined : rounded(assumedNonSolarLoadKwh, 1),
    assumptions,
    warnings,
  };
}
