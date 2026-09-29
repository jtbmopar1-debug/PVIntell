import { highPowerOptionsForEverydayNeeds, unknownAnswer, type DiscoveryAnswers, type DiscoveryQuestion } from "./new-system";

type PanelArea = { name: string; lengthM: string; widthM: string };
type PanelOrientation = { direction: string; slope: string };
type StructureCondition = { material: string; age: string; condition: string };
type PanelObstruction = { areaId: string; kind: string; lengthM: string; widthM: string };
type ExistingPanelAnswer = { name?: string; panelType?: string; quantity?: number; arrayCount?: number; arrayCountUnknown?: boolean; watts?: number };
type ExistingPowerEquipmentEntry = { name: string; type: string; quantity?: number; ratedSize?: number; ratedUnit?: string; ratingUnknown?: boolean };
type GeneratorDetails = { purchaseStatus?: string; generatorType?: string; fuel?: string; continuousRating?: string; ratingUnit?: string; inverterType?: string; voltage?: string; phase?: string; startMethod?: string; connectionMethod?: string };
type HeatPumpUnit = { model?: string; electricalInputKw?: number; electricalInputPending?: boolean; coolingCapacityKw?: number; heatingCapacityKw?: number; thermalCapacityKw?: number };
type LoadEntry = { customPoolEquipment?: boolean; quantity?: number; runningKw?: number; runtimeMinutesPerDay?: number; longestRunMinutes?: number; scheduleMode?: string; inputAmps?: number; voltageV?: number; welderTechnology?: string; units?: HeatPumpUnit[] };

const unresolvedValues = new Set([unknownAnswer, "unknown", "not_checked", "not_decided", "undecided", "unknown_chemistry"]);
const ratedPoolHeatingMethods = new Set(["heat_pump", "resistive_electric", "spa_inline_heater", "self_contained_spa", "gas", "hybrid"]);

function poolRatingKeys(equipment: string[], heating: string[]) {
  const spaPumpInlineHeater = equipment.includes("spa_pump_inline_heater") && heating.includes("spa_inline_heater");
  return Array.from(new Set([
    ...equipment.filter((item) => item !== "none" && item !== "spa_pump_inline_heater"),
    ...heating.filter((item) => item !== "spa_inline_heater" || !spaPumpInlineHeater),
    ...(spaPumpInlineHeater ? ["spa_pump_inline_heater"] : []),
  ]));
}

function poolLoadRatingsComplete(value: DiscoveryAnswers[string], answers: DiscoveryAnswers) {
  if (typeof value !== "string") return false;
  try {
    const ratings = JSON.parse(value) as Record<string, LoadEntry>;
    const equipment = (Array.isArray(answers.pool_equipment) ? answers.pool_equipment : [answers.pool_equipment]).filter((item): item is string => typeof item === "string" && item !== "none");
    const heating = (Array.isArray(answers.pool_heating_method) ? answers.pool_heating_method : [answers.pool_heating_method]).filter((item): item is string => typeof item === "string" && ratedPoolHeatingMethods.has(item));
    const selected = poolRatingKeys(equipment, heating);
    const required = [...selected.map((key) => ratings[key]), ...Object.values(ratings).filter((row) => row.customPoolEquipment === true)];
    return required.length > 0 && required.every((row) => {
      if (!row || Number(row.quantity) <= 0 || Number(row.runningKw) <= 0) return false;
      const runtimeRequired = !["automatic", "manual"].includes(row.scheduleMode ?? "timer");
      if (runtimeRequired && Number(row.runtimeMinutesPerDay) <= 0) return false;
      return !(Number(row.longestRunMinutes) > Number(row.runtimeMinutesPerDay) && Number(row.runtimeMinutesPerDay) > 0);
    });
  } catch { return false; }
}

function highPowerLoadRatingsComplete(value: DiscoveryAnswers[string], selectedLoads: string[]) {
  if (!selectedLoads.length || typeof value !== "string") return false;
  try {
    const ratings = JSON.parse(value) as Record<string, LoadEntry>;
    if (Object.values(ratings).some((row) => Number(row.runtimeMinutesPerDay) > 0 && Number(row.longestRunMinutes) > Number(row.runtimeMinutesPerDay))) return false;
    return selectedLoads.every((key) => {
      const row = ratings[key];
      if (!row || Number(row.quantity) <= 0) return false;
      if (key === "welder") return Number(row.inputAmps) > 0 && Number(row.voltageV) > 0 && Boolean(row.welderTechnology);
      if (key === "heat_pump") return Boolean(row.units?.length) && row.units!.every((unit) => Number(unit.electricalInputKw) > 0 || (unit.electricalInputPending === true && Boolean(unit.model?.trim() || unit.coolingCapacityKw || unit.heatingCapacityKw || unit.thermalCapacityKw)));
      return Number(row.runningKw) > 0;
    });
  } catch { return false; }
}

export function discoveryAnswerComplete(questionId: string, value: DiscoveryAnswers[string], answers: DiscoveryAnswers) {
  if (typeof value === "string" && unresolvedValues.has(value)) return false;
  if (Array.isArray(value) && value.some((item) => unresolvedValues.has(item))) return false;
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return false;
  if (questionId === "ev_status") {
    return typeof answers.ev_vehicle_size === "string" && answers.ev_vehicle_size.length > 0
      && typeof answers.ev_travel_profile === "string" && answers.ev_travel_profile.length > 0
      && Array.isArray(answers.ev_charging_window) && answers.ev_charging_window.length > 0;
  }
  if (questionId === "ev_travel_profile") {
    return typeof answers.ev_available_supply === "string" && answers.ev_available_supply.length > 0
      && Array.isArray(answers.ev_charging_priority) && answers.ev_charging_priority.length > 0
      && typeof answers.ev_bidirectional_goal === "string" && answers.ev_bidirectional_goal.length > 0;
  }
  if (questionId === "pool_equipment_ratings") return poolLoadRatingsComplete(value, answers);
  if (questionId === "household_motor_ratings") return highPowerLoadRatingsComplete(value, highPowerOptionsForEverydayNeeds(answers).map((option) => option.value));
  if (questionId === "panel_area_dimensions" && typeof value === "string") {
    try { const rows = JSON.parse(value) as PanelArea[]; return rows.length > 0 && rows.every((row) => row.name.trim() && Number(row.lengthM) > 0 && Number(row.widthM) > 0); } catch { return false; }
  }
  if (questionId === "existing_panel_selection" && typeof value === "string") {
    try { const row = JSON.parse(value) as ExistingPanelAnswer; return Boolean(row.name?.trim() && row.panelType && Number(row.quantity) > 0 && (row.arrayCountUnknown === true || Number(row.arrayCount) > 0) && Number(row.watts) > 0); } catch { return false; }
  }
  if (questionId === "existing_power_equipment" && typeof value === "string") {
    try { const rows = JSON.parse(value) as ExistingPowerEquipmentEntry[]; return rows.length > 0 && rows.every((row) => row.name.trim() && row.type && Number(row.quantity) > 0 && (row.ratingUnknown === true || (Number(row.ratedSize) > 0 && row.ratedUnit))); } catch { return false; }
  }
  if (questionId === "generator_details" && typeof value === "string") {
    try { const row = JSON.parse(value) as GeneratorDetails; return row.purchaseStatus === "not_purchased" || Boolean(row.generatorType && row.fuel && Number(row.continuousRating) > 0 && row.ratingUnit && row.inverterType && row.voltage && row.phase && row.startMethod && row.connectionMethod); } catch { return false; }
  }
  if (questionId === "orientation_and_pitch" && typeof value === "string") {
    try { const rows = JSON.parse(value) as PanelOrientation[]; return rows.length > 0 && rows.every((row) => row.direction && row.slope); } catch { return false; }
  }
  if (questionId === "structure_condition" && typeof value === "string") {
    try { const rows = JSON.parse(value) as StructureCondition[]; return rows.length > 0 && rows.every((row) => row.material && row.age && row.condition); } catch { return false; }
  }
  if (questionId === "panel_area_constraints" && typeof value === "string") {
    try { const rows = JSON.parse(value) as PanelObstruction[]; return rows.length > 0 && rows.every((row) => row.kind === "none" || (row.areaId && row.kind && Number(row.lengthM) > 0 && Number(row.widthM) > 0)); } catch { return false; }
  }
  return true;
}

export function discoveryQuestionComplete(question: DiscoveryQuestion, answers: DiscoveryAnswers, context: { combinedInitialSetup: boolean }) {
  if (!discoveryAnswerComplete(question.id, answers[question.id], answers)) return false;
  if (question.id === "site_name") {
    return Boolean(answers.site_id && String(answers.system_name ?? "").trim() && typeof answers.site_latitude === "number" && typeof answers.site_longitude === "number");
  }
  if (question.id === "system_name" && context.combinedInitialSetup) return Boolean(answers.site_id);
  return true;
}
