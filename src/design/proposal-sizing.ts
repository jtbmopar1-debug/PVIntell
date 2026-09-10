import { answerList, generatorFromDiscovery, proposalIncludesSolar } from "./proposal-inputs";
import { assessPanelSurfaces } from "./panel-surfaces";

export type ProposalSizingInput = {
  mode: string;
  peakSunHours?: number;
  autonomyDays?: number;
  discovery?: Record<string, unknown>;
  representativePanelWatts?: number;
  /** The panel count currently selected in the editable proposal. When set,
   * dependent production and storage evidence is recalculated from this plan
   * while the independently calculated energy target remains available. */
  selectedPanelCount?: number;
  representativePanelLengthMm?: number;
  representativePanelWidthMm?: number;
  solarResource?: {
    basis?: unknown;
    source?: unknown;
    period?: unknown;
    monthlyPeakSunHours?: unknown;
    latitude?: number;
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
  startupLoadName?: string;
  scheduledLoadEnergyKwh?: number;
  batteryUsableKwh?: number;
  batteryOnlyDays?: number;
  batterySizingBasis?: "no_sun_autonomy" | "solar_assisted_typical_winter" | "daily_energy_fraction";
  weakestMonthPvKwh?: number;
  assumedNonSolarLoadKwh?: number;
  assumptions: string[];
  warnings: string[];
};

type LoadRating = {
  source?: "household" | "pool";
  name?: unknown;
  baseType?: unknown;
  quantity?: unknown;
  runningKw?: unknown;
  peakRunningKw?: unknown;
  startingKw?: unknown;
  inputKva?: unknown;
  simultaneous?: unknown;
  runtimeMinutesPerDay?: unknown;
  longestRunMinutes?: unknown;
  startingBasis?: unknown;
};

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
  const amount = finitePositive(normalized.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/)?.[0]);
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
      if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, LoadRating>).filter(([, rating]) => rating && typeof rating === "object" && !Array.isArray(rating));
        if (key === "household_motor_ratings") {
          // Guided discovery persists this answer under
          // `heavy_or_surge_loads`; retain the legacy key for older records.
          const selectedLoadsValue = discoveryValue(discovery, "heavy_or_surge_loads")
            ?? discoveryValue(discovery, "heavy_loads");
          const selectedLoadsRecorded = selectedLoadsValue !== undefined && String(selectedLoadsValue).trim() !== "";
          const selectedLoads = new Set(String(selectedLoadsValue ?? "").split(",").map((item) => item.trim()).filter((item) => item && item !== "none"));
          ratings.push(...entries.filter(([entryKey, rating]) => !selectedLoadsRecorded || selectedLoads.has(String(rating.baseType ?? entryKey.split("__")[0]))).map(([entryKey, rating]) => ({ ...rating, baseType: rating.baseType ?? entryKey.split("__")[0] })));
        } else {
          const equipment = discoveryValue(discovery, "pool_equipment");
          const heating = discoveryValue(discovery, "pool_heating_method");
          const selected = new Set([...answerList(equipment), ...answerList(heating)]);
          const recorded = equipment !== undefined || heating !== undefined;
          ratings.push(...entries.filter(([key, rating]) => !recorded || selected.has(String(rating.baseType ?? key)))
            .map(([key, rating]) => ({ ...rating, source: "pool" as const, baseType: rating.baseType ?? key })));
        }
      }
    } catch { /* Free-text ratings are evidence notes, not numeric sizing inputs. */ }
  }
  const poolHeaterKw = finitePositive(discoveryValue(discovery, "pool_heater_electrical_kw"));
  const heatingSelection = discoveryValue(discovery, "pool_heating_method");
  const hasElectricPoolHeat = heatingSelection === undefined || answerList(heatingSelection).some((value) => ["heat_pump", "pool_heat_pump", "resistive_electric", "spa_inline_heater", "hybrid"].includes(value));
  if (poolHeaterKw && hasElectricPoolHeat && !ratings.some((rating) => rating.source === "pool" && ["heat_pump", "pool_heat_pump", "resistive_electric", "spa_inline_heater"].includes(String(rating.baseType))))
    ratings.push({ quantity: 1, runningKw: poolHeaterKw, simultaneous: true });
  return ratings;
}

function loadEnvelope(discovery: Record<string, unknown>) {
  const ratings = parsedRatings(discovery);
  if (!ratings.length) return undefined;
  let overlappingContinuousKw = 0;
  let overlappingLargestStartIncrementKw = 0;
  let standaloneContinuousKw = 0;
  let standaloneStartupKw = 0;
  let overlappingStartupLoadName = "";
  let standaloneStartupLoadName = "";
  let scheduledDailyEnergyKwh = 0;
  const warnings: string[] = [];
  for (const rating of ratings) {
    if (rating.quantity !== undefined && Number(rating.quantity) <= 0) continue;
    const quantity = Math.max(1, finitePositive(rating.quantity) ?? 1);
    const realRunningKw = finitePositive(rating.runningKw);
    const apparentInputKva = finitePositive(rating.inputKva);
    const runningKw = finitePositive(rating.peakRunningKw) ?? realRunningKw ?? apparentInputKva ?? 0;
    const motorType = String(rating.baseType);
    const multiplier = ["compressor", "saw_tools", "filtration_pump", "booster_cleaner_pump", "spa_jet_air_pump", "water_feature", "water_pump", "septic_pump", "septic_aerator", "sump_drainage_pump", "refrigeration", "chest_freezer"].includes(motorType) ? 3
      : ["heat_pump", "pool_heat_pump"].includes(motorType) ? 2.5 : 1;
    const startingKw = finitePositive(rating.startingKw) ?? runningKw * multiplier;
    const runtimeMinutesPerDay = finitePositive(rating.runtimeMinutesPerDay) ?? 0;
    if (realRunningKw) scheduledDailyEnergyKwh += realRunningKw * quantity * runtimeMinutesPerDay / 60;
    if (apparentInputKva && !realRunningKw) warnings.push(`${String(rating.name ?? rating.baseType ?? "Load")}: kVA is used only as a conservative power-screening envelope. Real kW/power factor is needed for its workday kWh; it is not included in that subtotal.`);
    if (runtimeMinutesPerDay > 1440 || Number(rating.longestRunMinutes) > runtimeMinutesPerDay && runtimeMinutesPerDay > 0) warnings.push(`${String(rating.name ?? rating.baseType ?? "Load")}: reconcile the total daily runtime and longest run before relying on its energy estimate.`);
    const entryContinuousKw = runningKw * quantity;
    const entryStartupKw = startingKw + runningKw * Math.max(0, quantity - 1);
    const loadName = String(rating.name ?? rating.baseType ?? "largest motor").replaceAll("_", " ").trim();
    if (rating.simultaneous === false) {
      standaloneContinuousKw = Math.max(standaloneContinuousKw, entryContinuousKw);
      if (entryStartupKw > standaloneStartupKw) {
        standaloneStartupKw = entryStartupKw;
        standaloneStartupLoadName = loadName;
      }
      continue;
    }
    overlappingContinuousKw += entryContinuousKw;
    const startIncrementKw = Math.max(0, startingKw - runningKw);
    if (startIncrementKw > overlappingLargestStartIncrementKw) {
      overlappingLargestStartIncrementKw = startIncrementKw;
      overlappingStartupLoadName = loadName;
    }
  }
  const continuousKw = Math.max(overlappingContinuousKw, standaloneContinuousKw);
  if (!continuousKw) return undefined;
  const overlappingStartupKw = overlappingContinuousKw + overlappingLargestStartIncrementKw;
  const standaloneSetsPeak = standaloneStartupKw > overlappingStartupKw;
  return {
    continuousKw,
    startupPeakKw: Math.max(overlappingStartupKw, standaloneStartupKw),
    startupLoadName: standaloneSetsPeak ? standaloneStartupLoadName : overlappingStartupLoadName,
    scheduledDailyEnergyKwh: rounded(scheduledDailyEnergyKwh),
    warnings,
  };
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
  const generatorRoles = generatorFromDiscovery(discovery).outageRole.toLowerCase();
  const generatorRechargesBattery = /battery_recharge|automatic_low_reserve|recharge.{0,20}batter|charge.{0,20}batter/.test(generatorRoles);
  if (generatorRechargesBattery) return Math.min(outageDays, .6);
  // A multi-day goal is a complete source-balance requirement, not a request
  // to multiply daily demand by the outage length. Use one day of storage as
  // a planning buffer while PV supplies daytime energy; the warning below
  // keeps the time-series validation visible.
  return outageDays <= 1 ? outageDays : 1;
}

const commonInverterRatingsKw = [
  .5, .8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100,
];

/** Select a searchable, commonly marketed equipment class at or above the
 * calculated minimum. Final availability remains market and region specific. */
export function nextCommonInverterRatingKw(minimumKw: number) {
  return commonInverterRatingsKw.find((rating) => rating >= minimumKw - 1e-9)
    ?? Math.ceil(minimumKw / 25) * 25;
}

export function solarFirstPowerAlternative(input: {
  panelCount?: number;
  panelWatts?: number;
  inverterKw?: number;
  startupPeakKw?: number;
}) {
  const panelCount = finitePositive(input.panelCount);
  const panelWatts = finitePositive(input.panelWatts);
  const inverterKw = finitePositive(input.inverterKw);
  const startupPeakKw = finitePositive(input.startupPeakKw);
  if (!panelCount || !panelWatts || !inverterKw || !startupPeakKw || startupPeakKw <= inverterKw) return undefined;
  const proposedInverterKw = nextCommonInverterRatingKw(startupPeakKw);
  // Reuse the 1.2 DC-to-AC planning ratio instead of presenting an array
  // whose nameplate capacity only just equals the intended AC output.
  const targetPvKw = proposedInverterKw * 1.2;
  const totalPanelCount = Math.ceil(targetPvKw * 1000 / panelWatts);
  return {
    inverterKw: proposedInverterKw,
    targetPvKw: rounded(totalPanelCount * panelWatts / 1000),
    totalPanelCount,
    additionalPanelCount: Math.max(0, totalPanelCount - panelCount),
  };
}

/**
 * Split an existing array from any extra capacity the design requires.
 * Capacity is the rule; module wattage is only a replaceable planning option.
 * This avoids treating the user's existing module as the universal module for
 * a second MPPT/string, while still allowing a buildable example to be shown.
 */
export function supplementaryArrayPlan(input: {
  targetPvKw: number;
  existingPanelCount: number;
  existingPanelWatts: number;
  planningModuleWatts?: number;
}) {
  const targetPvKw = finitePositive(input.targetPvKw) ?? 0;
  const existingPanelCount = Math.max(0, Math.floor(finitePositive(input.existingPanelCount) ?? 0));
  const existingPanelWatts = finitePositive(input.existingPanelWatts) ?? 0;
  const existingPvKw = rounded(existingPanelCount * existingPanelWatts / 1000);
  const requiredCapacityKw = rounded(Math.max(0, targetPvKw - existingPvKw));
  const planningModuleWatts = finitePositive(input.planningModuleWatts);
  const planningCount = requiredCapacityKw > 0 && planningModuleWatts
    ? Math.ceil(requiredCapacityKw * 1000 / planningModuleWatts - 1e-9)
    : undefined;
  const plannedCapacityKw = planningCount && planningModuleWatts
    ? rounded(planningCount * planningModuleWatts / 1000)
    : requiredCapacityKw;
  return {
    existingPvKw,
    requiredCapacityKw,
    planningModuleWatts,
    planningCount,
    plannedCapacityKw,
    totalPlannedPvKw: rounded(existingPvKw + plannedCapacityKw),
  };
}
const rounded = (value: number, places = 2) => Number(value.toFixed(places));

export function deriveProposalSizing(input: ProposalSizingInput): ProposalSizingResult {
  const discovery = input.discovery ?? {};
  const includesSolar = proposalIncludesSolar(discovery);
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
  const surfaceAssessment = assessPanelSurfaces(discovery, {
    panelLengthMm: input.representativePanelLengthMm,
    panelWidthMm: input.representativePanelWidthMm,
  }, input.solarResource?.latitude);
  const panelCapacity = surfaceAssessment.capacity;
  warnings.push(...surfaceAssessment.warnings);
  let fitLimited = false;

  if (!energy) warnings.push("PV and battery size withheld: representative daily energy is not recorded.");
  if (includesSolar && !peakSunHours) warnings.push("PV size withheld: peak sun hours are not available.");
  if (peakSunHours && !input.solarResource?.source) warnings.push("Solar-resource provenance is missing; refresh discovery to replace the legacy planning value with Site climatology.");
  const shading = String(discoveryValue(discovery, "shading") ?? "").toLowerCase();
  if (shading === "some" || shading === "significant") {
    const shadeDetail = [
      discoveryValue(discovery, "shade_time_windows"),
      discoveryValue(discovery, "shade_seasonality"),
      discoveryValue(discovery, "shade_extent"),
    ].map((value) => String(value ?? "").replaceAll("_", " ").trim()).filter(Boolean).join("; ");
    warnings.push(`${shading === "significant" ? "Significant" : "Some"} local shade is recorded${shadeDetail ? ` (${shadeDetail})` : ""}. No numerical shade loss has been applied; production remains unverified until the affected mounting areas are assessed by time of day and season.`);
  }
  if (includesSolar && energy && peakSunHours) {
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

  const selectedPanelCount = finitePositive(input.selectedPanelCount);
  if (includesSolar && selectedPanelCount && panelWatts) {
    panelCount = Math.max(1, Math.round(selectedPanelCount));
    pvKw = rounded(panelCount * panelWatts / 1000);
    fitLimited = panelCapacity !== undefined ? panelCount > panelCapacity : false;
    assumptions.push(`Current editable proposal uses ${panelCount} × ${panelWatts} W modules (${pvKw} kW); this may differ from the calculated annual-energy baseline.`);
    if (panelCapacity !== undefined && panelCount > panelCapacity) {
      warnings.push(`The current ${panelCount}-module proposal exceeds the recorded planning capacity of about ${panelCapacity} modules.`);
    }
  }

  const scope = backupScope(discovery);
  const wholePropertyBackup = /most_home|most of (?:the )?home|whole|entire|all/.test(scope);
  const standaloneBackup = Boolean(scope && !/^(?:none|no outage backup)$/.test(scope));
  const batteryRequirement = String(discoveryValue(discovery, "battery_requirement") ?? "").toLowerCase();
  const batteryExplicitlyExcluded = /^(?:none|no battery storage)$/.test(batteryRequirement);
  const includeBattery = !batteryExplicitlyExcluded && (mode === "off_grid" || /include|battery storage/.test(batteryRequirement) || standaloneBackup);
  const generatorRequirement = String(discoveryValue(discovery, "generator_requirement") ?? "").toLowerCase();
  if (mode === "off_grid" && batteryExplicitlyExcluded) {
    warnings.push(/include|existing|planned/.test(generatorRequirement)
      ? "Battery-free off-grid PV and generator operation is topology-dependent: confirm which source forms the AC supply, how PV output is controlled, when the generator must run, and whether the selected equipment permits the two sources to operate together."
      : "Battery-free off-grid operation has no stored-energy reserve; confirm whether loads may stop when solar is insufficient or record another compatible supply source.");
  }
  const days = batteryOnlyDays(input, discovery);
  const backupDuration = String(discoveryValue(discovery, "backup_duration") ?? "").toLowerCase();
  const generatorRoles = generatorFromDiscovery(discovery).outageRole.toLowerCase();
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
  warnings.push(...(loads?.warnings ?? []));
  if (loads?.scheduledDailyEnergyKwh) {
    assumptions.push(`Entered intermittent-load ratings and runtimes imply about ${loads.scheduledDailyEnergyKwh} kWh per workday. This is an unverified consumption subtotal, not a storage or generator-energy requirement; loads still add in kWh when they run at different times.`);
    if (energy && loads.scheduledDailyEnergyKwh > energy.dailyKwh) warnings.push(/high_power_loads|large_appliances/.test(generatorRoles)
      ? `The entered high-power tool runtimes imply about ${loads.scheduledDailyEnergyKwh} kWh/workday. Because the generator is explicitly assigned those loads, that subtotal informs generator operation and fuel planning rather than automatically increasing PV or storage; direct solar contribution is not relied upon.`
      : `The entered tool runtimes imply about ${loads.scheduledDailyEnergyKwh} kWh/workday, above the ${rounded(energy.dailyKwh)} kWh/day whole-system answer currently used for PV sizing. Reconcile the estimates and record operating times before assigning the demand between direct solar and generator or storage.`);
  }
  const needsStandaloneLoadSupport = mode === "off_grid" || standaloneBackup;
  let inverterKw: number | undefined;
  if (mode === "grid_tied" && pvKw && !standaloneBackup) {
    const minimumInverterKw = pvKw / 1.2;
    inverterKw = nextCommonInverterRatingKw(minimumInverterKw);
    assumptions.push(`1.2 DC-to-AC planning ratio gives ${rounded(minimumInverterKw, 2)} kW minimum; rounded up to the common ${inverterKw} kW inverter class.`);
  } else if (needsStandaloneLoadSupport && loads && (mode === "off_grid" || wholePropertyBackup)) {
    const continuousWithMargin = loads.continuousKw * 1.15;
    const minimumInverterKw = Math.max(continuousWithMargin, pvKw ? pvKw / 1.2 : 0);
    inverterKw = nextCommonInverterRatingKw(minimumInverterKw);
    assumptions.push(`15% continuous-power margin gives ${rounded(minimumInverterKw, 2)} kW minimum; rounded up to the common ${inverterKw} kW inverter class.`);
  } else if (pvKw && !needsStandaloneLoadSupport) {
    const minimumInverterKw = pvKw / 1.2;
    inverterKw = nextCommonInverterRatingKw(minimumInverterKw);
    assumptions.push(`1.2 DC-to-AC planning ratio gives ${rounded(minimumInverterKw, 2)} kW minimum; rounded up to the common ${inverterKw} kW inverter class while public supply carries demand above PV output.`);
  } else {
    if (pvKw) {
      const minimumInverterKw = pvKw / 1.2;
      inverterKw = nextCommonInverterRatingKw(minimumInverterKw);
      assumptions.push(`PV gives a provisional ${rounded(minimumInverterKw, 2)} kW inverter minimum; rounded up to the common ${inverterKw} kW class because the standalone simultaneous-load envelope is incomplete.`);
      warnings.push("Verify inverter continuous and surge capacity against the complete standalone load schedule before equipment selection.");
    } else warnings.push("Inverter size withheld: the relevant simultaneous-load evidence is incomplete.");
  }
  if (pvKw) warnings.push(mode === "off_grid"
    ? "PV capacity is a planning baseline; validate it against the worst design month and consecutive poor-solar periods."
    : "PV capacity is an annual-energy baseline; validate monthly yield, orientation, shading and export limits.");
  if (loads) warnings.push(`Selected inverter surge capability must be checked against the ${rounded(loads.startupPeakKw, 1)} kW recorded startup envelope.`);
  if (loads && /high_power_loads|large_appliances/.test(generatorRoles)) warnings.push(`The generator is assigned high-power loads and must provide at least ${rounded(loads.continuousKw, 1)} kW while running and demonstrate motor-start performance for the ${rounded(loads.startupPeakKw, 1)} kW startup envelope; do not assume PV and generator ratings add together.`);

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
    startupLoadName: loads?.startupLoadName || undefined,
    scheduledLoadEnergyKwh: loads?.scheduledDailyEnergyKwh,
    batteryUsableKwh,
    batteryOnlyDays: days,
    batterySizingBasis,
    weakestMonthPvKwh: weakestMonthPvKwh === undefined ? undefined : rounded(weakestMonthPvKwh, 1),
    assumedNonSolarLoadKwh: assumedNonSolarLoadKwh === undefined ? undefined : rounded(assumedNonSolarLoadKwh, 1),
    assumptions,
    warnings,
  };
}
