import { evPlanningPowerBand, highPowerOptionsForEverydayNeeds, newSystemQuestions, visibleDiscoveryQuestions, type DiscoveryAnswers } from "./new-system";

const panelLocations = ["main_roof", "other_roof", "ground", "fence", "wall_facade", "carport_pergola", "curved_lightweight", "mobile"];
const locationLabels: Record<string, string> = { main_roof: "Main roof", other_roof: "Garage, shed or another roof", ground: "Ground area", fence: "Fence or vertical screen", wall_facade: "Wall or façade", carport_pergola: "Carport, pergola or canopy", curved_lightweight: "Curved or weight-limited surface", mobile: "Vehicle, boat or movable structure" };
const surfaceDependentKeys = ["panel_area_dimensions", "panel_area_constraints", "orientation_and_pitch", "structure_condition", "shade_affected_areas"] as const;

const values = (value: DiscoveryAnswers[string] | undefined) => (Array.isArray(value) ? value : value === undefined ? [] : [String(value)]).filter((item) => item !== "none");
const sameValues = (left: string[], right: string[]) => left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);

function rows(value: DiscoveryAnswers[string]) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : undefined;
  } catch { return undefined; }
}

function clearSurfaceAnswers(answers: DiscoveryAnswers) {
  for (const key of surfaceDependentKeys) delete answers[key];
}

function pruneHiddenAnswers(answers: DiscoveryAnswers) {
  let changed = true;
  while (changed) {
    changed = false;
    const visible = new Set(visibleDiscoveryQuestions(answers).map((question) => question.id));
    for (const question of newSystemQuestions) {
      if (visible.has(question.id) || answers[question.id] === undefined) continue;
      delete answers[question.id];
      changed = true;
    }
  }
  return answers;
}

function knownLocationForId(id: string) {
  return panelLocations.find((location) => id.startsWith(`${location}-`));
}

/** Keeps dynamic panel-surface answers aligned with the selected locations. */
export function reconcileDiscoveryDependencies(input: DiscoveryAnswers, previous?: DiscoveryAnswers) {
  const answers = { ...input };
  if (["partly_installed", "installed_change_planned"].includes(String(answers.existing_system_status))) answers.existing_system_status = "installed";
  if (answers.installed_system_knowledge === "known") answers.installed_system_knowledge = "know_well";
  if (answers.installed_system_knowledge === "unknown") answers.installed_system_knowledge = "know_nothing";
  if (answers.existing_system_status !== "installed") delete answers.installed_system_knowledge;
  if (values(answers.panel_construction_interest).includes("existing")) answers.panel_construction_interest = ["existing"];
  if (answers.architecture_preference === "compare") delete answers.architecture_preference;
  if (answers.existing_power_equipment_status === "yes" && answers.architecture_preference === undefined) answers.architecture_preference = "existing";
  else if (answers.architecture_preference === "existing") delete answers.architecture_preference;
  const evKeys = ["ev_status", "ev_vehicle_details", "ev_vehicle_size", "ev_travel_profile", "ev_charging_window", "ev_charging_priority", "ev_available_supply", "ev_bidirectional_goal", "ev_planning_power_band"] as const;
  if (!values(answers.everyday_needs).includes("ev")) evKeys.forEach((key) => delete answers[key]);
  else {
    const planningBand = evPlanningPowerBand(answers);
    if (planningBand) answers.ev_planning_power_band = planningBand;
    else delete answers.ev_planning_power_band;
  }
  const allowedHeavyLoads = new Set(highPowerOptionsForEverydayNeeds(answers).map((option) => option.value));
  const selectedHeavyLoads = Array.isArray(answers.heavy_loads)
    ? answers.heavy_loads.map(String)
    : answers.heavy_loads === undefined ? [] : [String(answers.heavy_loads)];
  const retainedHeavyLoads = allowedHeavyLoads.size
    ? selectedHeavyLoads.filter((load) => load === "none" || allowedHeavyLoads.has(load))
    : [];
  if (retainedHeavyLoads.length) answers.heavy_loads = retainedHeavyLoads;
  else delete answers.heavy_loads;
  if (typeof answers.household_motor_ratings === "string") {
    try {
      const ratings = JSON.parse(answers.household_motor_ratings) as Record<string, { baseType?: string }>;
      const retainedRatings = Object.fromEntries(Object.entries(ratings).filter(([key, rating]) => allowedHeavyLoads.has(rating.baseType ?? key.split("__")[0])));
      if (Object.keys(retainedRatings).length) answers.household_motor_ratings = JSON.stringify(retainedRatings);
      else delete answers.household_motor_ratings;
    } catch {
      delete answers.household_motor_ratings;
    }
  }
  const selected = values(answers.panel_location);
  const prior = values(previous?.panel_location);
  if (!selected.length) {
    clearSurfaceAnswers(answers);
    return pruneHiddenAnswers(answers);
  }

  const dimensions = rows(answers.panel_area_dimensions);
  const parentChanged = Boolean(previous) && !sameValues(selected, prior);
  const staleRows = dimensions?.filter((row) => {
    const source = knownLocationForId(String(row.id ?? ""));
    return source && !selected.includes(source);
  }) ?? [];
  if (!parentChanged && !staleRows.length) return pruneHiddenAnswers(answers);

  // A one-surface replacement is unambiguous: preserve its measurements and
  // orientation, but discard construction facts tied to the former surface.
  if (selected.length === 1 && dimensions?.length === 1) {
    const oldId = String(dimensions[0].id ?? "");
    const newId = `${selected[0]}-0`;
    const oldDefaultName = locationLabels[knownLocationForId(oldId) ?? ""];
    const currentName = String(dimensions[0].name ?? "");
    const newName = !currentName || currentName === oldDefaultName ? locationLabels[selected[0]] ?? currentName : currentName;
    answers.panel_area_dimensions = JSON.stringify([{ ...dimensions[0], id: newId, name: newName }]);

    const orientations = rows(answers.orientation_and_pitch);
    if (orientations?.length === 1) answers.orientation_and_pitch = JSON.stringify([{ ...orientations[0], id: newId, name: newName }]);
    else delete answers.orientation_and_pitch;

    const constraints = rows(answers.panel_area_constraints);
    if (constraints) answers.panel_area_constraints = JSON.stringify(constraints.map((row) => row.kind === "none" ? row : { ...row, areaId: String(row.areaId ?? "") === oldId ? newId : row.areaId }));
    delete answers.structure_condition;
    delete answers.shade_affected_areas;
    return pruneHiddenAnswers(answers);
  }

  clearSurfaceAnswers(answers);
  return pruneHiddenAnswers(answers);
}
