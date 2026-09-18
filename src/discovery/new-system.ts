import type { OnboardingAnswers } from "@/onboarding/assessment";

export const unknownAnswer = "__unknown__";
export type DiscoveryStage = "discovery" | "site" | "needs" | "design";
export type DiscoveryAnswers = Record<string, string | number | string[]>;

/** The system topology produced by a completed discovery. */
export function discoveryProjectType(answers: DiscoveryAnswers) {
  if (answers.utility_relationship === "off_grid" || answers.target_grid_role === "replace_grid") return "off-grid" as const;
  const outcomes = Array.isArray(answers.primary_outcome) ? answers.primary_outcome : [answers.primary_outcome];
  return outcomes.length === 1 && outcomes[0] === "cost" ? "grid-tied" as const : "hybrid" as const;
}

export interface DiscoveryQuestion {
  id: string;
  stage: DiscoveryStage;
  title: string;
  noviceHelp: string;
  technicalHelp?: string;
  type: "choice" | "multi_choice" | "text" | "textarea" | "number";
  unit?: string;
  options?: Array<{ value: string; label: string; description: string }>;
  showWhen?: (answers: DiscoveryAnswers) => boolean;
}

export const evVehicleSizeOptions = [
  { value: "small", label: "Small EV", description: "Hatchbacks and other smaller electric vehicles." },
  { value: "medium", label: "Medium EV", description: "Sedans, crossovers and smaller SUVs." },
  { value: "large", label: "Large EV", description: "Large SUVs, utility vehicles and pickups." },
];

export const evChargingWindowOptions = [
  { value: "overnight", label: "Plug in overnight", description: "Use the longer overnight charging window." },
  { value: "daytime", label: "Plug in during the day", description: "Use available daytime solar while the vehicle is parked." },
];

export const evChargingPriorityOptions = [
  { value: "solar_surplus", label: "Use spare solar first", description: "Vary charging around measured solar that the property is not using." },
  { value: "departure_target", label: "Be ready by departure", description: "Permit another source when necessary to reach the required energy by a chosen time." },
  { value: "low_tariff", label: "Use lower-price periods", description: "Schedule grid charging where a real time tariff supports it." },
  { value: "protect_site_capacity", label: "Never overload the property", description: "Dynamically reduce EV current as other loads rise." },
  { value: "preserve_backup", label: "Preserve home-battery reserve", description: "Do not silently drain outage or off-grid reserve into the vehicle." },
];

export const evAvailableSupplyOptions = [
  { value: "portable_outlet", label: "Portable charger and outlet", description: "The outlet, circuit, plug temperature and continuous-load suitability still need checking." },
  { value: "fixed_single_phase", label: "Fixed single-phase wallbox", description: "Its real model, circuit and configured current still need confirmation." },
  { value: "fixed_three_phase", label: "Fixed three-phase wallbox", description: "Vehicle, Site and charging equipment must all support the intended arrangement." },
  { value: "no_supply", label: "No charging supply available", description: "Plan the parking position, cable route, circuit and power management from scratch." },
];

export const evBidirectionalOptions = [
  { value: "no", label: "Normal charging only", description: "The vehicle receives energy but is not planned as a property power source." },
  { value: "v2l", label: "Vehicle-to-load interests me", description: "Use the vehicle’s supported outlet for compatible individual loads." },
  { value: "consider_v2h", label: "Keep V2H/V2G possible", description: "Check the complete vehicle, bidirectional charger, transfer/export and local approval ecosystem." },
  { value: "existing_supported", label: "I already have supported V2X equipment", description: "Capture every exact model and commissioned connection before treating it as available." },
];

export const evPlanningPowerBands: Record<string, string> = {
  up_to_3_6_kw: "Up to 3.6 kW",
  "3_7_to_7_4_kw": "3.7–7.4 kW",
  "7_5_to_11_kw": "7.5–11 kW",
  "11_to_22_kw": "11–22 kW",
};

export function evPlanningPowerBand(answers: DiscoveryAnswers) {
  const efficiencyKwhPerKm: Record<string, number> = { small: 0.17, medium: 0.2, large: 0.24 };
  const distanceKm: Record<string, number> = { short: 30, average: 50, long: 100 };
  const sizeEfficiency = efficiencyKwhPerKm[String(answers.ev_vehicle_size)];
  const distance = distanceKm[String(answers.ev_travel_profile)];
  const windowHours = answerValues(answers.ev_charging_window).includes("daytime") ? 6 : 8;
  if (!sizeEfficiency || !distance || !answerValues(answers.ev_charging_window).length) return undefined;
  const requiredKw = distance * sizeEfficiency * 1.1 / windowHours;
  if (requiredKw <= 3.6) return "up_to_3_6_kw";
  if (requiredKw <= 7.4) return "3_7_to_7_4_kw";
  if (requiredKw <= 11) return "7_5_to_11_kw";
  return "11_to_22_kw";
}

function includesSolarPanels(answers: DiscoveryAnswers) {
  const locations = answers.panel_location;
  return !(locations === "none" || (Array.isArray(locations) && locations.includes("none")));
}

function hasExistingPanelInterest(answers: DiscoveryAnswers) {
  return answerValues(answers.panel_construction_interest).includes("existing");
}

function needsShadeDetail(answers: DiscoveryAnswers) {
  return answers.shading === "some" || answers.shading === "significant";
}

function hasResidentialUse(answers: DiscoveryAnswers) {
  const buildings = answers.building_type;
  const values = Array.isArray(buildings) ? buildings : [buildings];
  return values.some((value) => ["detached_house", "townhouse", "apartment", "cabin_mobile"].includes(String(value)));
}

function hasPoolUse(answers: DiscoveryAnswers) {
  const uses = Array.isArray(answers.pool_or_spa) ? answers.pool_or_spa : [answers.pool_or_spa];
  return answerValues(answers.building_type).includes("pool_spa") || uses.some((value) => ["outdoor_pool_spa", "existing", "indoor_spa_bath", "planned"].includes(String(value)));
}

function hasPoolEquipmentToRate(answers: DiscoveryAnswers) {
  return answerValues(answers.pool_equipment).some((value) => value !== "none")
    || answerValues(answers.pool_heating_method).some((value) => ["heat_pump", "resistive_electric", "spa_inline_heater", "self_contained_spa", "gas", "hybrid"].includes(value));
}

function hasHouseholdMotorLoads(answers: DiscoveryAnswers) {
  return highPowerOptionsForEverydayNeeds(answers).length > 0;
}

function isPoolOnly(answers: DiscoveryAnswers) {
  const buildings = answerValues(answers.building_type);
  return buildings.length === 1 && buildings[0] === "pool_spa";
}

function requestsOutagePlanning(answers: DiscoveryAnswers) {
  const outcomes = answerValues(answers.primary_outcome);
  return outcomes.some((value) => value !== "cost");
}

function replacesGrid(answers: DiscoveryAnswers) {
  return answers.utility_relationship === "off_grid" || answers.target_grid_role === "replace_grid";
}

function hasGarageArea(answers: DiscoveryAnswers) {
  return ["attached_conditioned", "attached_intermittent", "detached_conditioned"].includes(String(answers.garage_conditioning));
}

function hasEvUse(answers: DiscoveryAnswers) {
  const selected = [answers.everyday_needs, answers.heavy_loads]
    .flatMap((value) => Array.isArray(value) ? value : [value]);
  return selected.includes("ev");
}

function answerValues(value: string | number | string[] | undefined) {
  return (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(String);
}

export function highPowerOptionsForEverydayNeeds(answers: DiscoveryAnswers): NonNullable<DiscoveryQuestion["options"]> {
  const everyday = new Set(answerValues(answers.everyday_needs));
  const options: NonNullable<DiscoveryQuestion["options"]> = [];
  const add = (value: string, label: string, description: string) => options.push({ value, label, description });
  if (everyday.has("water_pump")) add("water_pump", "Water, bore or pressure pump", "A selected day-to-day pump load that may start automatically.");
  if (everyday.has("septic_pump")) add("septic_pump", "Sewage or septic pump", "A selected day-to-day wastewater pump load.");
  if (everyday.has("septic_aerator")) add("septic_aerator", "Septic aerator or treatment blower", "A selected day-to-day motor load.");
  if (everyday.has("sump_drainage_pump")) add("sump_drainage_pump", "Sump or drainage pump", "A selected day-to-day drainage pump load.");
  if (everyday.has("tools")) add("saw_tools", "Workshop tools", "The workshop tools selected in the day-to-day load list.");
  if (everyday.has("compressor")) add("compressor", "Compressor, motor or welder", "The motor, compressor or welder category selected in the day-to-day load list.");
  if (everyday.has("fridge_freezer")) add("refrigeration", "Fridge or upright freezer", "The refrigeration load selected in the day-to-day load list.");
  if (everyday.has("chest_freezer")) add("chest_freezer", "Chest freezer", "The chest freezer selected in the day-to-day load list.");
  if (everyday.has("cooling")) add("heat_pump", "Cooling or ventilation", "The cooling or ventilation load selected in the day-to-day load list.");
  return options;
}

function hasLargeLoadCandidates(answers: DiscoveryAnswers) {
  return highPowerOptionsForEverydayNeeds(answers).length > 0;
}

function hasGeneratorRequirement(answers: DiscoveryAnswers) {
  return ["include", "existing", "planned", "provision_only"].includes(String(answers.generator_requirement));
}

function hasBatteryBus(answers: DiscoveryAnswers) {
  return shouldIncludeBattery(answers) && answers.dc_system_voltage !== undefined;
}

function shouldIncludeBattery(answers: DiscoveryAnswers) {
  if (answers.battery_requirement === "none") return false;
  if (answers.battery_requirement === "include") return true;
  return answers.backup_preference !== undefined && answers.backup_preference !== "none";
}

function needsModuleElectronicsCompatibility(answers: DiscoveryAnswers) {
  return ["optimiser_string", "microinverters", "existing"].includes(String(answers.architecture_preference))
    || answerValues(answers.module_level_electronics).some((value) => ["optimisers", "microinverters", "existing_mixed"].includes(value));
}

export const discoveryStages: Array<{ id: DiscoveryStage; label: string; description: string }> = [
  { id: "discovery", label: "Discovery", description: "What you want the system to achieve" },
  { id: "site", label: "Site", description: "The property and possible solar locations" },
  { id: "needs", label: "Needs", description: "Energy use, backup and heavy loads" },
  { id: "design", label: "Design", description: "Preferences, limits and future plans" },
];

export function hasReliableMeasuredEnergyUse(answers: DiscoveryAnswers) {
  const monthly = Number(answers.current_energy_use);
  const daily = Number(answers.off_grid_daily_energy_use);
  return (Number.isFinite(monthly) && monthly > 0) || (Number.isFinite(daily) && daily > 0);
}

export function sequentialDiscoveryStageProgress(questions: DiscoveryQuestion[], completedQuestionIds: ReadonlySet<string>) {
  let precedingStagesComplete = true;

  return discoveryStages.map((stage) => {
    const stageQuestions = questions.filter((question) => question.stage === stage.id);
    const available = stageQuestions.length > 0;
    const complete = available && stageQuestions.every((question) => completedQuestionIds.has(question.id));
    const unlocked = available && precedingStagesComplete;

    if (available) precedingStagesComplete = precedingStagesComplete && complete;
    return { ...stage, available, complete, unlocked };
  });
}

export const newSystemQuestions: DiscoveryQuestion[] = [
  {
    id: "existing_system_status", stage: "discovery", title: "Is a system or part-system installed at this Site?",
    noviceHelp: "Choose Yes when any solar, battery or related equipment is physically installed, even when it is incomplete or you know very little about it.",
    technicalHelp: "Installed and partly installed equipment establishes an as-built baseline. The next question records the user’s knowledge separately from the physical state of the system.",
    type: "choice", options: [
      { value: "installed", label: "Yes — a system or part-system is installed", description: "Continue in Discovery and tell us how much you know about it." },
      { value: "none", label: "No — nothing is installed", description: "Continue to the panels and parts question." },
    ],
  },
  {
    id: "installed_system_knowledge", stage: "discovery", title: "Do you know enough about this installed system to record it?",
    noviceHelp: "Answer for this particular system. Knowing solar generally does not mean you know what was installed here, and uncertainty will never be treated as a confirmed fact.",
    technicalHelp: "Route by the user’s ability to describe this as-built system from reliable evidence, not by ownership or general technical experience.",
    type: "choice", options: [
      { value: "know_well", label: "Yes — I know the system very well", description: "Open System Capture and document the installed equipment and connections." },
      { value: "know_main", label: "Yes — I know the main equipment and connections", description: "Open System Capture, enter the known baseline and leave unsupported details unconfirmed." },
      { value: "know_little", label: "I know a few details but need help", description: "Stay in guided Discovery so PVIntell can establish what you know and what still needs checking." },
      { value: "know_nothing", label: "I know little or nothing about it", description: "Stay in guided Discovery with explanations and no assumed system details." },
    ], showWhen: (answers) => answers.existing_system_status === "installed",
  },
  {
    id: "existing_proposal_status", stage: "discovery", title: "Do you have panels or other parts you want to use?",
    noviceHelp: "Choose Yes for panels, batteries, an inverter, a controller or other equipment you already have or have selected. Equipment here is proposed—not installed—until the installed record says otherwise.",
    technicalHelp: "Route known candidate equipment through proposal intake so model, quantity and compatibility constraints are recorded before PVIntell builds the design.",
    type: "choice", options: [
      { value: "yes", label: "Yes — I have panels or parts", description: "Open the yellow proposal intake and record the equipment you want the proposal to use." },
      { value: "no", label: "No — choose everything for me", description: "Continue through Discovery and let PVIntell calculate the proposal from your needs." },
    ], showWhen: (answers) => answers.existing_system_status === "none",
  },
  {
    id: "system_name", stage: "discovery", title: "What should we call this power setup?",
    noviceHelp: "A simple name is fine, such as House solar, Main home or Workshop.", type: "text",
  },
  {
    id: "utility_relationship", stage: "discovery", title: "Does this property already receive electricity from the public power network?",
    noviceHelp: "This records what is physically present today. The next question separately decides whether the finished system will use, reserve or replace that supply.",
    type: "choice", options: [
      { value: "grid_connected", label: "Yes, it already has electricity", description: "Solar will work alongside the existing public supply." },
      { value: "off_grid", label: "No public electricity supply", description: "Solar, batteries or a generator must provide the power." },
    ],
  },
  {
    id: "target_grid_role", stage: "discovery", title: "What role should the public grid have in the finished system?",
    noviceHelp: "A property can have grid power today while the new system is designed to replace it. This choice controls the proposed power flow, battery reserve and whether grid equipment appears in the schematic.",
    technicalHelp: "Distinguish existing Site infrastructure from the proposed operating topology. Grid replacement is a standalone solar-battery supply with generator support only when explicitly selected; it must not be modelled as grid-parallel operation.",
    type: "choice", options: [
      { value: "normal_supply", label: "Work alongside the grid", description: "Keep the public supply as a normal source while solar and storage reduce imported energy." },
      { value: "emergency_fallback", label: "Grid for emergency fallback only", description: "Normally run from solar and batteries, but retain a deliberately controlled grid recovery path." },
      { value: "replace_grid", label: "Replace the grid", description: "Design a standalone solar-battery supply; use a generator, if selected, when solar and battery reserve are insufficient." },
    ], showWhen: (answers) => answers.utility_relationship === "grid_connected",
  },
  {
    id: "ac_phase_arrangement", stage: "discovery", title: "What type of AC power will this system use?",
    noviceHelp: "Choose the AC phase arrangement the inverter will supply to the property or planned loads. If the system will supply DC loads only, choose the DC-only option.",
    technicalHelp: "Record the Site supply or required inverter-output topology from reliable evidence. Never infer phase count from breaker or switch-toggle count. Confirm conductor arrangement, phase-to-neutral and phase-to-phase voltage later where appropriate.",
    type: "choice", options: [
      { value: "single_phase", label: "Single-phase", description: "One AC phase supplies the property or planned loads." },
      { value: "split_phase", label: "Split-phase", description: "Two opposing AC legs are available, commonly with both line-to-neutral and line-to-line loads." },
      { value: "three_phase", label: "Three-phase", description: "Three AC phases supply the Site; phase balance and equipment compatibility must be considered." },
      { value: "dc_only", label: "DC only — no AC planned", description: "The system is intended to supply DC loads without an AC inverter output." },
    ],
  },
  {
    id: "nominal_ac_voltage", stage: "discovery", title: "What is the nominal AC supply or output voltage?",
    noviceHelp: "Voltage varies globally and must match the appliances and inverter. Use a label or supply document where possible; do not measure inside a switchboard yourself.",
    technicalHelp: "Record whether the stated value is line-to-neutral or line-to-line where relevant, and later confirm voltage tolerance and frequency for the exact Site and equipment.",
    type: "choice", options: [
      { value: "100", label: "100 V", description: "Used by some regional appliance and supply systems." },
      { value: "110_120", label: "110–120 V", description: "Common nominal range for single-phase or line-to-neutral loads in some regions." },
      { value: "200_240", label: "200–240 V", description: "Includes common 220, 230 and 240 V nominal supplies and outputs." },
      { value: "380_415", label: "380–415 V", description: "Common line-to-line range for three-phase systems with lower line-to-neutral voltage." },
      { value: "440_480", label: "440–480 V", description: "A higher three-phase range used by some commercial and industrial systems." },
      { value: "other", label: "Another voltage", description: "Record the exact supported value with Wattson during design." },
    ], showWhen: (answers) => answers.ac_phase_arrangement !== "dc_only",
  },
  {
    id: "primary_outcome", stage: "discovery", title: "What do you mainly want solar to achieve?",
    noviceHelp: "Choose every outcome that matters. This sets the direction only; equipment and sizes are not selected yet.", type: "multi_choice", options: [
      { value: "off_grid_supply", label: "Power a place with no grid supply", description: "Create a complete independent power supply for a new or unconnected property." },
      { value: "cost", label: "Lower electricity bills", description: "Use more solar energy instead of buying electricity." },
      { value: "backup", label: "Power during outages", description: "Keep chosen items operating when public electricity fails." },
      { value: "independence", label: "Rely less on the grid", description: "Use and store more of your own energy." },
    ],
  },
  {
    id: "site_name", stage: "site", title: "Where will this power system be located?",
    noviceHelp: "Choose an existing Site when this system is at the same physical property, or create a new Site for a different location. One Site can contain several power systems, such as a house and shed.", type: "text",
  },
  {
    id: "building_type", stage: "site", title: "What kind of building or property is this?",
    noviceHelp: "Choose every building that belongs to this site. Building type affects roof access, mounting choices and who may need to approve the work.", type: "multi_choice", options: [
      { value: "detached_house", label: "Detached house", description: "A standalone home on its own property." },
      { value: "townhouse", label: "Townhouse or shared-title home", description: "Walls, roofs or property rules may be shared." },
      { value: "apartment", label: "Apartment or unit", description: "Roof and electrical areas may be shared." },
      { value: "shed_workshop", label: "Shed or workshop", description: "A separate working or storage building." },
      { value: "farm_building", label: "Farm or rural building", description: "May include pumps, machinery or long cable runs." },
      { value: "cabin_mobile", label: "Cabin, tiny home or mobile setup", description: "A small or potentially movable installation." },
      { value: "pool_spa", label: "Pool, spa or jacuzzi", description: "A pool or spa area with pumps, heating and wet-area electrical constraints." },
      { value: "vehicle_boat", label: "Vehicle or boat", description: "A motorhome, caravan, campervan, work vehicle or marine installation." },
      { value: "other", label: "Something else", description: "Describe it in the next steps." },
    ],
  },
  {
    id: "property_authority", stage: "site", title: "Who can approve changes to this property?",
    noviceHelp: "Solar may require permission from an owner, landlord, body corporate or other decision-maker.", type: "choice", options: [
      { value: "owner", label: "I own it", description: "You can usually make property decisions, subject to local requirements." },
      { value: "renter", label: "I rent it", description: "Landlord approval will normally be needed." },
      { value: "shared", label: "Shared title or body corporate", description: "Other owners or a body corporate may need to approve." },
      { value: "contractor_adviser", label: "I’m a contractor or adviser", description: "You are assessing options for a client or property owner, who must approve the work." },
      { value: "client", label: "I am planning for someone else", description: "The owner or client will need to confirm decisions." },
    ],
  },
  {
    id: "panel_location", stage: "site", title: "Where could solar panels possibly go?",
    noviceHelp: "Choose every possible area. This is only a starting idea; a later inspection confirms whether each location is actually suitable.", type: "multi_choice", options: [
      { value: "main_roof", label: "Main roof", description: "The roof of the main building." },
      { value: "other_roof", label: "Garage, shed or another roof", description: "A separate roof may have better space or sunlight." },
      { value: "ground", label: "On the ground", description: "A purpose-built frame located away from the building." },
      { value: "fence", label: "Fence or vertical screen", description: "Panels can form or mount to a fence; vertical bifacial panels may suit some sites." },
      { value: "wall_facade", label: "Wall or building façade", description: "A clear exterior wall may support a vertical or building-integrated array." },
      { value: "carport_pergola", label: "Carport, pergola or canopy", description: "Panels can provide both shade or shelter and electricity." },
      { value: "curved_lightweight", label: "Curved or weight-limited surface", description: "A lightweight roof or curved surface may need flexible or lightweight panels." },
      { value: "mobile", label: "Vehicle, boat or movable structure", description: "A caravan, boat, trailer or other mobile surface may need a specialised mounting method." },
      { value: "none", label: "No solar panels — storage only", description: "Use batteries charged from an available source without adding panels here." },
    ],
  },
  {
    id: "storage_supply_source_off_grid", stage: "site", title: "Without solar panels, what will supply or charge the batteries?",
    noviceHelp: "An off-grid battery still needs an energy source. Choose every source that is available or planned; Wattson will not assume a public electricity connection.", type: "multi_choice", options: [
      { value: "generator", label: "Generator", description: "A generator can run loads and recharge batteries when needed." },
      { value: "wind_hydro", label: "Wind, hydro or another renewable source", description: "Another local generation source will supply the system." },
      { value: "existing_local_supply", label: "Existing local supply or charger", description: "There is already another non-grid source available." },
    ], showWhen: (answers) => answers.utility_relationship === "off_grid" && !includesSolarPanels(answers),
  },
  {
    id: "storage_supply_source_grid", stage: "site", title: "Without solar panels, what will supply or charge the batteries?",
    noviceHelp: "Choose every source that may charge the batteries. This is a storage-only design, so Wattson needs to know where its energy will come from.", type: "multi_choice", options: [
      { value: "grid", label: "Public electricity supply", description: "The existing electricity connection can charge the batteries." },
      { value: "generator", label: "Generator", description: "A generator is available as an additional source." },
      { value: "other_local_supply", label: "Another local energy source", description: "For example wind, hydro or an existing DC source." },
    ], showWhen: (answers) => answers.utility_relationship === "grid_connected" && !includesSolarPanels(answers),
  },
  {
    id: "panel_construction_interest", stage: "site", title: "Are any panel types worth exploring for these locations?",
    noviceHelp: "Choose any that may suit the available surfaces. This does not select a product; Wattson and the Design Calculator can compare the practical trade-offs later.", type: "multi_choice", options: [
      { value: "existing", label: "Use panels I already have", description: "Identify existing panels and assess whether they can be incorporated into this build." },
      { value: "rigid_framed", label: "Standard rigid panels", description: "Common framed glass panels for roofs, racks and ground mounts." },
      { value: "bifacial", label: "Bifacial panels", description: "Generate from both faces when the rear has useful light and clearance." },
      { value: "flexible_lightweight", label: "Flexible or lightweight panels", description: "Useful where weight, curvature or a low profile rules out standard framed panels." },
      { value: "building_integrated", label: "Building-integrated solar", description: "Solar tiles, glazing, façades or canopies that also form part of the building." },
    ], showWhen: includesSolarPanels,
  },
  {
    id: "existing_panel_selection", stage: "site", title: "What existing panels do you have?",
    noviceHelp: "Enter the total number of panels. If you know how they are divided, also enter the number of separate arrays or panel groups; otherwise choose ‘I don’t know’ for that layout detail. Discovery will decide how many are suitable for this proposal later.",
    technicalHelp: "Record the inventory total and known array or homogeneous module-group count without asking the user to allocate a proposal quantity. Exact model, voltage, current, temperature, condition and compatibility evidence remain required before string design.",
    type: "textarea", showWhen: hasExistingPanelInterest,
  },
  {
    id: "panel_area_dimensions", stage: "site", title: "How much usable space is available for panels?",
    noviceHelp: "Enter the usable length and width of each separate roof face, fence, wall or ground area. Measure only the clear area where panels could actually fit.",
    technicalHelp: "Record usable—not total—dimensions for each mounting plane. Keep separate faces, orientations or mounting areas on separate rows.", type: "textarea", showWhen: includesSolarPanels,
  },
  {
    id: "panel_area_constraints", stage: "site", title: "What takes up space or limits panel placement?",
    noviceHelp: "Add known chimneys, skylights, vents or access areas and their approximate length and width. Wattson subtracts only the space you record; it will not invent a regulatory clearance.",
    technicalHelp: "Record known obstructions and access zones by mounting area. Enter only measured or estimated exclusion areas; regulatory setbacks remain unverified until separately confirmed.", type: "textarea", showWhen: includesSolarPanels,
  },
  {
    id: "orientation_and_pitch", stage: "site", title: "Which way do the possible mounting areas face, and how steep are the surfaces?",
    noviceHelp: "Choose the closest compass direction and surface slope for each possible area. This describes the roof, ground, wall or fence—not panels that have not been selected yet.",
    technicalHelp: "Record each existing mounting surface separately. Its direction and approximate slope are enough for discovery; panel angle is decided later during design.", type: "textarea", showWhen: includesSolarPanels,
  },
  {
    id: "shading", stage: "site", title: "How much shade reaches the possible panel area?",
    noviceHelp: "Think about trees, nearby buildings and hills during the morning, middle of the day and afternoon.", type: "choice", options: [
      { value: "little", label: "Little or no shade", description: "The area appears open for most of the day." },
      { value: "some", label: "Some shade", description: "Shade crosses part of the area during the day." },
      { value: "significant", label: "Significant shade", description: "Large areas are shaded for long periods." },
    ], showWhen: includesSolarPanels,
  },
  {
    id: "shade_affected_areas", stage: "site", title: "Which possible panel areas are affected by shade?",
    noviceHelp: "Select each recorded mounting area that receives shade. If you are unsure, choose that option rather than guessing.",
    technicalHelp: "Identify every affected mounting plane so its production can later be modelled separately from unshaded planes.",
    type: "multi_choice", options: [], showWhen: needsShadeDetail,
  },
  {
    id: "shade_time_windows", stage: "site", title: "When during the day does the shade usually occur?",
    noviceHelp: "Select every period that is commonly affected. The same amount of shade can have a different impact depending on when it crosses the panels.",
    technicalHelp: "Record the observed shade windows. A later assessment should resolve their actual solar-time boundaries for each mounting plane.",
    type: "multi_choice", options: [
      { value: "morning", label: "Morning", description: "Shade mainly affects early production." },
      { value: "midday", label: "Middle of the day", description: "Shade affects the usually stronger production period." },
      { value: "afternoon", label: "Afternoon", description: "Shade mainly affects later production." },
      { value: "none", label: "Not sure yet", description: "Record that the daily shade window still needs assessment." },
    ], showWhen: needsShadeDetail,
  },
  {
    id: "shade_seasonality", stage: "site", title: "When is the shade likely to be most significant?",
    noviceHelp: "The sun follows a different path through the year, and deciduous trees can also change with the seasons.",
    technicalHelp: "Record the observed or expected seasonal pattern; do not convert it to an annual loss without a monthly or interval shade assessment.",
    type: "choice", options: [
      { value: "winter", label: "Mostly winter", description: "Lower winter sun creates the greatest shade effect." },
      { value: "summer", label: "Mostly summer", description: "Summer vegetation or another seasonal cause creates the greatest effect." },
      { value: "year_round", label: "Similar year-round", description: "The obstruction appears to affect the area throughout the year." },
      { value: "not_assessed", label: "Not sure yet", description: "A seasonal observation or shade assessment is still needed." },
    ], showWhen: needsShadeDetail,
  },
  {
    id: "shade_extent", stage: "site", title: "At its worst, roughly how much of the panel area is shaded?",
    noviceHelp: "Use the largest portion you commonly see shaded at one time. This records scale only; PVIntell will not treat it as an exact energy-loss percentage.",
    technicalHelp: "Record maximum observed spatial coverage separately from duration and season. Shaded area is not directly equivalent to energy loss.",
    type: "choice", options: [
      { value: "under_quarter", label: "Less than one quarter", description: "A smaller portion of the possible panel area is affected." },
      { value: "quarter_to_half", label: "About one quarter to half", description: "A substantial portion is affected at the worst time." },
      { value: "over_half", label: "More than half", description: "Most of the possible panel area can be affected." },
      { value: "not_assessed", label: "Not sure yet", description: "Photos or a shade assessment are needed to establish the extent." },
    ], showWhen: needsShadeDetail,
  },
  {
    id: "structure_condition", stage: "site", title: "What do you know about the roof or supporting structure?",
    noviceHelp: "Choose the surface or support type, approximate age and current condition for each possible panel area. If an inspection is needed, gather that evidence before completing discovery.",
    technicalHelp: "Record each possible mounting structure separately. These selections identify where structural condition or mounting compatibility still needs verification.", type: "textarea", showWhen: includesSolarPanels,
  },
  {
    id: "existing_power_equipment_status", stage: "site", title: "Is there an inverter, charge controller or similar equipment you want to include?",
    noviceHelp: "This is a final equipment check. Choose Yes for an inverter, inverter/charger, solar charge controller, microinverters, optimisers, DC-DC charger or similar equipment you already have and want assessed with this system.",
    technicalHelp: "Treat user-owned power-conversion equipment as an in-scope candidate until its exact ratings, condition, firmware, topology and compatibility are verified.",
    type: "choice", options: [
      { value: "yes", label: "Yes — I have equipment to include", description: "List each item and record the identifying and rating information you know." },
      { value: "no", label: "No — continue without existing equipment", description: "Continue to the battery-storage question." },
    ],
  },
  {
    id: "existing_power_equipment", stage: "site", title: "What inverter or control equipment do you have?",
    noviceHelp: "Give each item a clear name, choose its type, and copy the make, model and rating from its label when available. Use ‘I don’t know the rating’ instead of guessing.",
    technicalHelp: "Record each candidate separately. Nameplate power or current is discovery evidence only; input windows, MPPT limits, battery voltage, surge duty, phase, communications and supported operating modes still require exact documentation.",
    type: "textarea", showWhen: (answers) => answers.existing_power_equipment_status === "yes",
  },
  {
    id: "battery_requirement", stage: "needs", title: "Should this system design include battery storage?",
    noviceHelp: "Battery storage can increase solar self-use without providing outage backup. Choose whether storage belongs in the proposed system; outage operation is handled separately.",
    technicalHelp: "Record the storage requirement independently from backup/islanding scope. A non-backup battery may still provide self-consumption, tariff or export-control functions.",
    type: "choice", options: [
      { value: "include", label: "Include battery storage", description: "Design suitable storage for the recorded energy goals and operating limits." },
      { value: "none", label: "No battery storage", description: "Keep the proposed system battery-free." },
    ], showWhen: (answers) => !isPoolOnly(answers) && (
      replacesGrid(answers)
      || (answers.utility_relationship === "grid_connected" && (answers.backup_preference === "none" || !requestsOutagePlanning(answers)))
    ),
  },
  {
    id: "current_energy_use", stage: "needs", title: "How much electricity does the property currently use?",
    noviceHelp: "You do not need to understand kWh. Choose the description that sounds most like the way electricity is used here, use the monthly total from a recent bill if you have one, or ask Wattson to work through the appliances with you.",
    technicalHelp: "Choose an indicative monthly energy band or enter representative measured consumption in kWh/month. Seasonal history can be added during review.", type: "number", unit: "kWh/month",
    showWhen: (answers) => answers.utility_relationship === "grid_connected" && !isPoolOnly(answers),
  },
  {
    id: "off_grid_daily_energy_use", stage: "needs", title: "How much electricity will you use on an average day?",
    noviceHelp: "You do not need to understand kWh. Choose the description that sounds most like the life you expect to live here, or ask Wattson to work through the appliances with you.",
    technicalHelp: "Choose an indicative daily energy band or enter a representative measured average in kWh/day. Wattson will refine an estimate before proposing exact capacity.",
    type: "number", unit: "kWh/day", showWhen: (answers) => answers.utility_relationship === "off_grid" && !isPoolOnly(answers),
  },
  {
    id: "served_floor_area", stage: "needs", title: "How much indoor floor area will this system serve?",
    noviceHelp: "Enter the approximate occupied or conditioned floor area that will use power. Wattson uses this only as a fallback when reliable measured electricity use is not available.",
    technicalHelp: "Record the approximate served floor area, not the total land, garage or unconditioned outbuilding area. Floor area is contextual evidence and must not be used as a standalone load calculation.", type: "number", unit: "m²", showWhen: (answers) => hasResidentialUse(answers) && !hasReliableMeasuredEnergyUse(answers),
  },
  {
    id: "garage_conditioning", stage: "needs", title: "Is there a garage area to include?",
    noviceHelp: "An attached garage can change the building's heating and cooling boundary, while a heated workshop or detached garage can add its own loads. Record it separately from the occupied house floor area.", type: "choice", options: [
      { value: "none", label: "No garage area", description: "There is no garage to include in this system's building or load model." },
      { value: "attached_unconditioned", label: "Attached and not heated or cooled", description: "Treat it as an adjacent unconditioned space, not occupied floor area." },
      { value: "attached_conditioned", label: "Attached and continuously conditioned", description: "Include regular garage heating or cooling while keeping its area separate." },
      { value: "attached_intermittent", label: "Attached and occasionally conditioned", description: "Heating or cooling is used only for selected work or weather conditions." },
      { value: "detached_conditioned", label: "Detached garage or conditioned workshop", description: "Model it as a separate building load rather than part of the house envelope." },
    ], showWhen: hasResidentialUse,
  },
  {
    id: "garage_floor_area", stage: "needs", title: "What is the approximate garage floor area?",
    noviceHelp: "Enter the garage area separately. Wattson will use whether it is attached and conditioned to interpret its effect rather than automatically treating every square metre like occupied living space.", type: "number", unit: "m²", showWhen: hasGarageArea,
  },
  {
    id: "cooking_energy", stage: "needs", title: "How is cooking done at this property?",
    noviceHelp: "Choose every method used. Wattson later confirms appliance power and the highest combination you realistically use together—for example two cooking appliances while a water pump starts—before calculating the system. Electric ovens and cooktops can be large loads, while LPG or wood cooking may use little or no electricity.", type: "multi_choice", options: [
      { value: "electric_oven", label: "Electric oven", description: "A significant electrical load, especially while heating up." },
      { value: "electric_cooktop", label: "Electric cooktop", description: "Includes ceramic and conventional electric hobs." },
      { value: "induction", label: "Induction cooktop", description: "Efficient cooking but with a potentially high peak electrical demand." },
      { value: "air_fryer", label: "Air fryer", description: "Typically draws about 700–2,000 W while heating; use the appliance input rating when known." },
      { value: "microwave", label: "Microwave", description: "Typically draws about 700–2,000 W; the electrical input can be higher than the advertised cooking output." },
      { value: "lpg_gas", label: "LPG or gas", description: "Cooking heat mainly comes from fuel rather than the electrical system." },
      { value: "wood", label: "Wood-fired cooking", description: "Cooking heat mainly comes from a wood stove or range." },
      { value: "none", label: "No cooking here", description: "This building does not need cooking included in its power plan." },
    ], showWhen: hasResidentialUse,
  },
  {
    id: "water_heating_energy", stage: "needs", title: "How is water heated?",
    noviceHelp: "Water heating is often one of a home’s largest energy uses. Choose every source that contributes.", type: "multi_choice", options: [
      { value: "electric_resistive", label: "Electric hot-water cylinder / geyser", description: "Also called an HWC, storage water heater or electric geyser in different regions; it uses an electrical element to heat stored water." },
      { value: "heat_pump", label: "Heat-pump water heater", description: "Uses electricity more efficiently but still needs to be included in the load model." },
      { value: "instant_electric", label: "Instant electric", description: "Heats water on demand and can require very high electrical power." },
      { value: "lpg_gas", label: "LPG or gas", description: "Water heat mainly comes from fuel rather than electricity." },
      { value: "solar_thermal", label: "Solar hot water", description: "Roof collectors heat water directly rather than generating electricity." },
      { value: "wood_wetback", label: "Wood fire or wetback", description: "A fire contributes heat to the hot-water system." },
      { value: "none", label: "No hot water here", description: "This building does not need hot water included in its power plan." },
    ], showWhen: hasResidentialUse,
  },
  {
    id: "solar_hot_water_arrangement", stage: "needs", title: "How is the solar hot-water system arranged?",
    noviceHelp: "Solar hot water may use a circulation pump, or it may move water naturally by thermosiphon. It may share one boosted tank or preheat a separate indoor cylinder.",
    technicalHelp: "Distinguish pumped and thermosiphon circulation, and a shared boosted store from a solar preheat store feeding a separate HWC. This controls pump demand and prevents storage/recovery energy being counted twice.",
    type: "choice", options: [
      { value: "pumped_shared_store", label: "Pumped system with one shared tank", description: "Collectors use a circulation pump and the same store has electric, gas or another backup heat source." },
      { value: "pumped_preheat_separate_hwc", label: "Solar preheat tank plus separate HWC", description: "A pumped solar store preheats water before it enters a separate indoor cylinder." },
      { value: "thermosiphon_shared_store", label: "Thermosiphon / roof tank", description: "Natural circulation is used, normally without a solar circulation pump." },
      { value: "not_sure", label: "Not sure yet", description: "Keep the arrangement open for label, pipework or installer-document review." },
    ], showWhen: (answers) => answerValues(answers.water_heating_energy).includes("solar_thermal"),
  },
  {
    id: "solar_hot_water_storage_litres", stage: "needs", title: "How much water does the solar hot-water store hold?",
    noviceHelp: "Enter the solar tank or roof-cylinder capacity from its label. This is kept separate from an indoor HWC so solar contribution and backup recovery are not mixed together.",
    technicalHelp: "Record the solar-thermal store volume independently. If it is the one shared boosted tank, do not duplicate that volume as a separate indoor HWC.",
    type: "number", unit: "L", showWhen: (answers) => answerValues(answers.water_heating_energy).includes("solar_thermal"),
  },
  {
    id: "hot_water_storage_litres", stage: "needs", title: "What is the indoor HWC or separate storage volume?",
    noviceHelp: "Enter the separate indoor cylinder, geyser or heat-pump-water-heater tank capacity. Do not repeat the solar tank volume when both heat sources share one physical store.",
    technicalHelp: "Record this store separately from solar-thermal storage. Later calculations must use inlet and set temperatures, draw profile, standing loss and recovery input without double-counting a shared tank.",
    type: "number", unit: "L", showWhen: (answers) => answerValues(answers.water_heating_energy).some((value) => ["electric_resistive", "heat_pump", "wood_wetback"].includes(value)) && !["pumped_shared_store", "thermosiphon_shared_store"].includes(String(answers.solar_hot_water_arrangement)),
  },
  {
    id: "solar_hot_water_pump_watts", stage: "needs", title: "What power does the solar hot-water circulation pump use?",
    noviceHelp: "Enter the electrical input in watts from the circulation-pump label. This is a small load, but it can run for many hours when solar heat is available.",
    technicalHelp: "Record pump electrical input rather than hydraulic output. Include controller power separately later if it is material.",
    type: "number", unit: "W", showWhen: (answers) => ["pumped_shared_store", "pumped_preheat_separate_hwc"].includes(String(answers.solar_hot_water_arrangement)),
  },
  {
    id: "solar_hot_water_pump_hours_per_day", stage: "needs", title: "About how long does that circulation pump run on a useful solar day?",
    noviceHelp: "Use monitoring or the controller history if available. A reasonable seasonal estimate can be refined later.",
    technicalHelp: "Record representative daily runtime and retain seasonal variation; pump energy equals electrical input multiplied by operating hours.",
    type: "number", unit: "h/day", showWhen: (answers) => ["pumped_shared_store", "pumped_preheat_separate_hwc"].includes(String(answers.solar_hot_water_arrangement)),
  },
  {
    id: "space_heating_energy", stage: "needs", title: "How is the home or building heated?",
    noviceHelp: "Choose every method used. Electrical heating can strongly affect winter system size; wood or LPG changes that calculation.", type: "multi_choice", options: [
      { value: "heat_pump", label: "Heat pump", description: "Efficient electrical heating and often cooling as well." },
      { value: "resistive", label: "Electric heaters or underfloor", description: "Direct electrical heating with substantial winter energy use." },
      { value: "wood", label: "Wood fire", description: "Most heating energy comes from firewood." },
      { value: "lpg_gas", label: "LPG or gas", description: "Most heating energy comes from gas fuel." },
      { value: "boiler", label: "Boiler or central heating", description: "Its fuel source and any electrical pumps or controls need to be included." },
      { value: "none", label: "No fixed heating", description: "There is no regular building-heating system to include." },
    ], showWhen: (answers) => !isPoolOnly(answers),
  },
  {
    id: "pool_or_spa", stage: "needs", title: "Which pool or spa loads should this system support?",
    noviceHelp: "Select every pool or spa load the proposed power system must support. Installation or ownership status is recorded separately and does not change the design requirement.", type: "multi_choice", options: [
      { value: "outdoor_pool_spa", label: "Pool or outdoor spa", description: "Include its circulation, filtration, sanitation and heating equipment." },
      { value: "indoor_spa_bath", label: "Indoor spa bath", description: "Include its intermittent jet or air pump, controls and any built-in heater." },
      { value: "none", label: "None of these", description: "Do not include pool or spa equipment in this Site's energy plan." },
    ], showWhen: (answers) => !isPoolOnly(answers),
  },
  {
    id: "pool_equipment", stage: "needs", title: "Which pool or spa equipment should be included?",
    noviceHelp: "Select every item the proposed system must power. Recording pumps and controls separately lets Wattson identify their running schedule, startup demand and opportunities to use solar directly.", type: "multi_choice", options: [
      { value: "filtration_pump", label: "Filtration or circulation pump", description: "Include fixed-speed or variable-speed pumps and their normal daily schedule." },
      { value: "booster_cleaner_pump", label: "Booster or cleaner pump", description: "A separate pump for cleaning, pressure-side equipment or another water circuit." },
      { value: "sanitation", label: "Sanitation equipment", description: "Salt chlorinator, ozone, UV, dosing or similar water-treatment equipment." },
      { value: "spa_jet_air_pump", label: "Spa jet or air pump", description: "Intermittent pumps or blowers used during spa operation." },
      { value: "water_feature", label: "Water feature or auxiliary pump", description: "Fountains, waterfalls, swim jets, covers or other powered pool equipment." },
      { value: "controls", label: "Controls and automation", description: "Timers, controllers, sensors and communications that remain powered." },
      { value: "none", label: "No separate equipment to include", description: "Only use this when the pool or spa has no electrical equipment in scope." },
    ], showWhen: hasPoolUse,
  },
  {
    id: "pool_heating_method", stage: "needs", title: "How is the pool or spa heated?",
    noviceHelp: "Choose every heat source being considered. An indoor spa bath may be filled from the household hot-water supply and also use a built-in inline heater to maintain temperature during use—select both when applicable. Solar pool collectors heat water directly; a heat pump or electric heater becomes an electrical load; gas mainly adds circulation and control power.", type: "multi_choice", options: [
      { value: "none", label: "No pool heating", description: "Only circulation, filtration, sanitation and controls need power." },
      { value: "solar_thermal", label: "Solar pool-heating collectors", description: "Roof or ground collectors heat pool water directly through a circulation loop." },
      { value: "heat_pump", label: "Pool heat pump", description: "Efficient electric heating, but often a substantial seasonal load with compressor startup demand." },
      { value: "resistive_electric", label: "Electric resistance heater", description: "Direct electric heating with high power demand." },
      { value: "domestic_hot_water", label: "Filled from domestic hot water", description: "Common for an indoor spa bath; include the energy needed for the household cylinder, geyser or other water heater to recover after filling." },
      { value: "spa_inline_heater", label: "Built-in spa-bath heater", description: "Maintains water temperature during use. Record its electrical input rating alongside the jet or air-pump load." },
      { value: "self_contained_spa", label: "Self-contained spa / hot tub / jacuzzi", description: "A packaged spa with an electric heater and circulation or jet pumps. Record the heater and each pump separately because they may run together." },
      { value: "gas", label: "Gas heater", description: "Heat comes mainly from gas; pumps, ignition and controls still use electricity." },
      { value: "hybrid", label: "More than one method", description: "For example solar collectors with heat-pump or gas backup." },
    ], showWhen: hasPoolUse,
  },
  {
    id: "pool_heating_profile", stage: "needs", title: "What heating capacity does this pool or spa need?",
    noviceHelp: "Enter the required heater output if you already know it. If not, open the optional calculator and its result will fill this field for you.", technicalHelp: "Record required thermal output in kW. The optional calculator estimates initial water-heating energy from volume and temperature rise, then applies the selected planning allowance and heat-up period. Confirm seasonal losses, circulation flow/head and manufacturer output at the actual ambient and water temperatures before equipment selection.", type: "number", unit: "kW thermal", showWhen: hasPoolUse,
  },
  {
    id: "pool_equipment_ratings", stage: "needs", title: "What electrical load will each pool or spa component place on the system?",
    noviceHelp: "Enter the electrical input shown on each equipment label and how long it normally runs each day. Add its timer times when known. Running power and overlap size the supply; daily runtime sizes the energy the solar system must produce.", technicalHelp: "Record quantity, continuous electrical input, starting/maximum input, schedule and daily runtime for every selected pump, heater and auxiliary load. Keep thermal heater output separate from electrical input, and confirm which loads can overlap. A daylight schedule improves direct-solar opportunity but is not treated as guaranteed production.", type: "textarea", showWhen: hasPoolEquipmentToRate,
  },
  {
    id: "everyday_needs", stage: "needs", title: "What does this property need to power day-to-day?",
    noviceHelp: "Choose every regular load. Ratings and hours of use can be added later; this gives Wattson a proper starting load list.", type: "multi_choice", options: [
      { value: "lighting", label: "Lighting", description: "Indoor, outdoor or security lights." },
      { value: "general_outlets", label: "General outlets and chargers", description: "Phones, small appliances and ordinary plug-in use." },
      { value: "fridge_freezer", label: "Fridge or upright freezer", description: "A cycling refrigeration load with compressor startup demand." },
      { value: "chest_freezer", label: "Chest freezer", description: "Record separately when it may start at the same time as the fridge or another compressor." },
      { value: "internet_computers", label: "Internet, computers or TV", description: "Routers, work devices and entertainment." },
      { value: "water_pump", label: "Water, bore or pressure pump", description: "Pumps often have a high starting surge." },
      { value: "septic_pump", label: "Sewage or septic pump", description: "Include any wastewater or effluent pumping." },
      { value: "septic_aerator", label: "Septic aerator or treatment blower", description: "A small motor that may run for long periods and still has a startup demand." },
      { value: "sump_drainage_pump", label: "Sump or drainage pump", description: "An automatic pump that may start while other household loads are running." },
      { value: "tools", label: "Workshop tools", description: "Hand tools, bench tools or battery chargers." },
      { value: "compressor", label: "Compressor, motor or welder", description: "Motors/welders can have a large startup and running needs." },
      { value: "security", label: "Security, cameras or gate", description: "Cameras, alarms, gates and communications." },
      { value: "medical", label: "Medical equipment", description: "Any essential health-related electrical equipment." },
      { value: "cooling", label: "Cooling or ventilation", description: "Fans, air conditioning or extraction." },
      { value: "ev", label: "Electric-vehicle charging", description: "A vehicle that regularly charges at this property." },
      { value: "none", label: "No regular loads yet", description: "The building is not yet in use or its loads are not defined." },
    ], showWhen: (answers) => !isPoolOnly(answers),
  },
  {
    id: "household_motor_ratings", stage: "needs", title: "What electrical input do the selected high-power loads use?",
    noviceHelp: "This follows your day-to-day load selection. Enter the normal electrical input shown on each selected equipment label. Wattson estimates startup demand for motor and compressor loads; use a manufacturer maximum value when available.",
    technicalHelp: "Record quantity and continuous electrical input for every selected day-to-day high-power load. Apply equipment-specific starting demand only to motor/compressor loads, and use the welder's rated input and duty-cycle evidence rather than treating its output rating as supply demand.",
    type: "textarea", showWhen: hasHouseholdMotorLoads,
  },
  {
    id: "heavy_loads", stage: "needs", title: "Which high-power loads could operate together?",
    noviceHelp: "Select the loads that could realistically be on at the same time. This helps Wattson plan inverter peak power and motor-starting surge; it does not calculate daily energy use.", type: "multi_choice", options: [
      { value: "water_pump", label: "Water or bore pump", description: "Includes pressure and irrigation pumps." },
      { value: "compressor", label: "Air compressor", description: "A motor load with a startup surge." },
      { value: "welder", label: "Welder", description: "A high-demand workshop load." },
      { value: "saw_tools", label: "Large saws or workshop tools", description: "Bench saws, planers, grinders and similar tools." },
      { value: "refrigeration", label: "Refrigerator or upright freezer", description: "A household refrigeration compressor that may start automatically." },
      { value: "chest_freezer", label: "Chest freezer", description: "A separate compressor load that can start while the refrigerator or other loads are running." },
      { value: "heat_pump", label: "Heat pump or air conditioning", description: "Heating/cooling compressor load." },
      { value: "electric_water", label: "Electric water heating", description: "Cylinder, instant heater or heat-pump water heater." },
      { value: "pool_heat_pump", label: "Pool or spa heat pump", description: "A seasonal compressor load that may run for many hours." },
      { value: "ev", label: "EV charging", description: "Vehicle charging currently used or being added as part of this system." },
      { value: "none", label: "None of these", description: "No known large or high-surge loads." },
    ], showWhen: hasLargeLoadCandidates,
  },
  {
    id: "backup_preference", stage: "needs", title: "What should happen during a public power outage?",
    noviceHelp: "Backup requires batteries and suitable electrical separation. Supplying more of the home generally costs more.", type: "choice", options: [
      { value: "none", label: "No outage backup needed", description: "Solar is mainly for savings or daytime use." },
      { value: "essentials", label: "Keep essentials running", description: "For example refrigeration, lights, internet and a water pump." },
      { value: "most_home", label: "Run most of the home", description: "A larger backup system designed around major household loads." },
    ], showWhen: (answers) => !isPoolOnly(answers) && answers.utility_relationship === "grid_connected" && answers.target_grid_role !== "replace_grid" && requestsOutagePlanning(answers),
  },
  {
    id: "outage_essential_loads", stage: "needs", title: "Which items must stay on in an outage?",
    noviceHelp: "Common essentials are a fridge/freezer, a few lights, internet, a water or sewage pump, medical equipment and selected outlets.", type: "textarea",
    showWhen: (answers) => answers.backup_preference === "essentials",
  },
  {
    id: "generator_requirement", stage: "needs", title: "Should this system design include generator supply?",
    noviceHelp: "Choose whether the proposed system must integrate a generator, only provide a future-ready connection, or exclude generator supply. Ownership and installation status are recorded separately.",
    technicalHelp: "Define full generator integration, provision-only or no generator. Compatibility, source transfer, neutral/earth arrangement, start controls and accepted voltage/frequency remain separate design checks.",
    type: "choice", options: [
      { value: "include", label: "Include generator supply", description: "Design the system around the generator specifications and required operating arrangement." },
      { value: "provision_only", label: "Provide a generator-ready connection", description: "Allow a safe connection path without including generator operation in the initial system." },
      { value: "none", label: "No generator", description: "Do not include generator supply or generator operation in the design." },
    ],
  },
  {
    id: "generator_details", stage: "needs", title: "What should Wattson know about the generator supply?",
    noviceHelp: "Add what is known: make/model, petrol/diesel/LPG, rated and surge power, output voltage and phase, manual or electric start, and whether it has an ATS/start-control connection. A label photo is useful.",
    technicalHelp: "Record continuous and surge kVA/kW, voltage, frequency, phase, waveform/THD where specified, neutral-earth arrangement, protection, inlet/changeover method, two-wire or maker-specific start interface, fuel and duty limits.",
    type: "textarea", showWhen: hasGeneratorRequirement,
  },
  {
    id: "generator_outage_role", stage: "needs", title: "What should the generator do when grid power is out?",
    noviceHelp: "Choose every intended role. A generator may recharge the batteries, carry high-power loads such as a welder, supply the backed-up circuits, or do more than one of these through a compatible inverter/transfer arrangement.",
    technicalHelp: "Define the intended source path before sizing: inverter/charger AC input, transferred generator bus, dedicated heavy-load circuit or combined operation. Confirm transfer interlocking, neutral/earth arrangement, generator waveform and frequency, charger demand, load steps and start controls.",
    type: "multi_choice", options: [
      { value: "battery_recharge", label: "Charge the batteries", description: "Use the generator to recharge the batteries during a long power cut." },
      { value: "high_power_loads", label: "Run large appliances", description: "Power selected items such as a welder, compressor, pump or large heater." },
      { value: "backup_circuits", label: "Keep essential circuits on", description: "Power the lights, fridge, internet and other circuits chosen for backup." },
      { value: "automatic_low_reserve", label: "Start when batteries get low", description: "Start the generator automatically when the batteries reach the chosen level." },
    ], showWhen: (answers) => ["include", "existing", "planned"].includes(String(answers.generator_requirement))
      && (!replacesGrid(answers) || ["include", "none"].includes(String(answers.battery_requirement))),
  },
  {
    id: "backup_duration", stage: "needs", title: "How long should the system keep running without the grid?",
    noviceHelp: "This is the outage target for the whole system. Solar, battery storage and any selected generator are assessed together; it is not automatically the amount of energy the battery must store.", type: "choice", options: [
      { value: "few_hours", label: "A few hours", description: "Short local outages." },
      { value: "overnight", label: "Overnight", description: "A longer outage through the night." },
      { value: "one_day", label: "About one day", description: "Essential use for roughly 24 hours." },
      { value: "multiple_days", label: "Several days", description: "Solar, storage and any selected generator must work together through the extended outage." },
    ], showWhen: (answers) => replacesGrid(answers)
      ? answers.battery_requirement === "include" || ["include", "existing", "planned"].includes(String(answers.generator_requirement))
      : answers.backup_preference !== undefined && answers.backup_preference !== "none",
  },
  {
    id: "ev_status", stage: "needs", title: "What EV charging setup do you have or plan?",
    noviceHelp: "Four simple choices establish how much daily EV charging the system should accommodate. No electrical details are required.", type: "choice", options: [
      { value: "have_ev", label: "I already have an EV", description: "Plan around a vehicle used now." },
      { value: "planned_ev", label: "I plan to get an EV soon", description: "Include a realistic near-term charging requirement." },
      { value: "future_ev", label: "Just thinking about the future", description: "Leave sensible capacity for EV charging later." },
    ], showWhen: hasEvUse,
  },
  {
    id: "ev_travel_profile", stage: "needs", title: "What EV charging equipment is available or planned?",
    noviceHelp: "Choose the charging equipment at the parking position and what it needs to do. PVIntell combines this with the first page to show the charging power the system should accommodate.",
    type: "choice", options: [
      { value: "short", label: "Short daily driving", description: "About 30 km / 18 mi on a normal day." },
      { value: "average", label: "Average daily driving", description: "About 40–50 km / 25–30 mi on a normal day." },
      { value: "long", label: "Longer daily driving", description: "About 70–100 km / 43–62 mi on a normal day." },
    ], showWhen: hasEvUse,
  },
  {
    id: "future_changes", stage: "design", title: "What might be added in the future?",
    noviceHelp: "Choose every realistic future addition. This keeps the proposed system expandable without pretending those loads exist today.", type: "multi_choice", options: [
      { value: "ev", label: "EV charging", description: "A vehicle charger at this Site." }, { value: "workshop", label: "More workshop tools", description: "Larger tools, motors or machinery." },
      { value: "water_pump", label: "Water or irrigation pump", description: "A future pump or water system." }, { value: "extra_dwelling", label: "Another dwelling or building", description: "A cabin, studio, shed or additional home." },
      { value: "heat_pump_ac", label: "Heat pump or air conditioning", description: "Future electric space heating, cooling or both." }, { value: "electric_hot_water", label: "Electric hot water", description: "Changing or adding water heating." },
      { value: "more_storage", label: "More battery storage", description: "Increasing reserve or self-use later." },
      { value: "heated_pool", label: "Pool, spa or pool heating", description: "Future circulation, solar-thermal collectors, heat pump or another heating method." },
      { value: "more_pv", label: "More solar panels", description: "Expanding the array later." }, { value: "none", label: "Nothing planned yet", description: "Keep the design focused on current needs." },
    ],
  },
  {
    id: "delivery_approach", stage: "design", title: "How do you want to approach the build?",
    noviceHelp: "This changes how Wattson explains each task and highlights checks or specialist help you choose.", type: "choice", options: [
      { value: "diy_led", label: "DIY-led", description: "I want to understand and complete as much of the project as I can, getting help where I decide it is needed." },
      { value: "shared", label: "Shared DIY and trades", description: "I will handle practical or mechanical work and choose help for defined specialist work." },
    ],
  },
  {
    id: "architecture_preference", stage: "design", title: "Which solar and inverter arrangement should Wattson consider?",
    noviceHelp: "Choose how the panels should convert and deliver power. This choice is independent of whether a battery is included now. Microinverters perform the panel-level inverter function, while DC optimisers still feed a compatible string or hybrid inverter.", type: "choice", options: [
      { value: "existing", label: "Assess a specific inverter I have", description: "Treat it as a candidate and include it only if its documented limits suit the design." },
      { value: "string_inverter", label: "Solar-only string inverter", description: "Panels connect in DC strings to one central inverter. Unlike a hybrid inverter, it has no direct battery connection." },
      { value: "combined", label: "Hybrid solar inverter", description: "A central solar inverter with battery-ready or integrated battery-control capability; it can still be assessed when no battery is included now." },
      { value: "optimiser_string", label: "DC optimisers with string inverter", description: "Panel-level DC optimisers feed a specifically compatible central inverter." },
      { value: "microinverters", label: "Microinverters", description: "Panel-level inverters produce AC from each module or small module group." },
      { value: "modular", label: "Separate inverter and solar controllers", description: "Separate MPPT solar controllers and inverter or inverter-charger equipment designed to work together." },
    ], showWhen: includesSolarPanels,
  },
  {
    id: "dc_system_voltage", stage: "design", title: "What battery or DC voltage should Wattson work with?",
    noviceHelp: "If you already have a battery, simply choose that option here. Its label, model and condition are captured later in Site Inventory. If you do not have one, you do not need to know the voltage yet. Higher voltage usually means less current for the same power, but it changes which batteries, inverters, controllers, fuses, switches and safety rules apply.",
    technicalHelp: "Record both nominal voltage and the real maximum charge/operating voltage. Compare load current, voltage drop, conductor/protection duty, BMS topology, inverter/controller ecosystem, series/parallel battery rules and local voltage-class boundaries. Do not assume 48 V.",
    type: "choice", options: [
      { value: "existing", label: "Use a battery I already have", description: "Identify the existing battery and assess whether it can be incorporated into this build." },
      { value: "12", label: "12 V nominal", description: "Common for smaller vehicle, marine and compact systems; high-power loads draw high current." },
      { value: "24", label: "24 V nominal", description: "Reduces current compared with 12 V and is common in larger mobile or modest off-grid systems." },
      { value: "36", label: "36 V nominal", description: "A specialist option used by some battery and mobility equipment ecosystems." },
      { value: "48", label: "48 V nominal", description: "Common for larger stationary/off-grid systems, but not automatically the right choice." },
      { value: "60", label: "60 V nominal", description: "Used by some specialist systems; component availability and local voltage boundaries need checking." },
      { value: "high_voltage", label: "Manufacturer high-voltage battery", description: "An integrated battery/inverter platform operating above common 12–60 V nominal systems." },
    ], showWhen: shouldIncludeBattery,
  },
  {
    id: "battery_chemistry", stage: "design", title: "Which battery chemistry should the design use?",
    noviceHelp: "Battery chemistry changes usable capacity, charging limits, temperature behaviour, expected life, protection and compatibility. A specific battery the user owns remains a candidate until its label, condition and compatibility have been assessed.",
    technicalHelp: "Confirm chemistry, nominal and maximum voltage, series/parallel rules, BMS or balancing requirements, charge profile, continuous and peak current, low-temperature charging limits, ventilation and manufacturer compatibility. Do not infer chemistry from nominal voltage.",
    type: "choice", options: [
      { value: "lifepo4", label: "Lithium iron phosphate (LiFePO₄/LFP)", description: "Common stationary and mobile lithium chemistry with an appropriate BMS and charge profile." },
      { value: "other_lithium_ion", label: "Other lithium-ion", description: "For NMC, NCA or another identified lithium chemistry; exact manufacturer limits are essential." },
      { value: "lto", label: "Lithium titanate (LTO)", description: "A specialist lithium chemistry with different cell voltage and charging characteristics." },
      { value: "flooded_lead_acid", label: "Flooded lead-acid", description: "Vented serviceable batteries requiring the correct charging, ventilation and maintenance provisions." },
      { value: "agm", label: "AGM lead-acid", description: "Sealed valve-regulated lead-acid batteries with manufacturer-specific charge limits." },
      { value: "gel", label: "Gel lead-acid", description: "Valve-regulated lead-acid chemistry that can be damaged by an unsuitable charge profile." },
      { value: "sodium_ion", label: "Sodium-ion", description: "An emerging chemistry whose exact BMS, voltage and equipment compatibility must be verified." },
      { value: "manufacturer_system", label: "Manufacturer battery system", description: "A proprietary low- or high-voltage battery platform identified by its exact make and model." },
      { value: "custom_home_built", label: "Custom or home-built battery", description: "Record its chemistry, configuration, BMS, limits and test evidence so Wattson can assess it without providing cell-level construction instructions." },
    ], showWhen: hasBatteryBus,
  },
  {
    id: "module_electronics_compatibility", stage: "design", title: "What equipment must the optimisers or microinverters work with?",
    noviceHelp: "Add any panel, optimiser, microinverter or main-inverter make/model you already own or are considering. A label photo is useful. Wattson must check current, voltage, power, connector and string/branch limits before recommending that combination.", technicalHelp: "Record module Voc, Vmp, Isc and Imp; optimiser or microinverter maximum input voltage/current/Isc/power and output limits; inverter MPPT voltage range, maximum input current and maximum short-circuit current per MPPT; string/branch count and parallel inputs. Attach the manufacturer's compatibility evidence where available.", type: "textarea", showWhen: needsModuleElectronicsCompatibility,
  },
];

export function visibleDiscoveryQuestions(answers: DiscoveryAnswers) {
  const proposalEquipment = new Set(answerValues(answers.proposal_intake_equipment));
  const yellowEquipmentQuestions = new Set([
    ...(proposalEquipment.size ? ["existing_power_equipment_status", "existing_power_equipment"] : []),
    ...(proposalEquipment.has("panels") ? ["panel_construction_interest", "existing_panel_selection"] : []),
    ...(proposalEquipment.has("inverter") ? ["architecture_preference"] : []),
    ...(proposalEquipment.has("battery") ? ["battery_requirement", "battery_chemistry"] : []),
    ...(proposalEquipment.has("generator") ? ["generator_requirement", "generator_details"] : []),
  ]);
  return newSystemQuestions
    .filter((question) => !yellowEquipmentQuestions.has(question.id) && (!question.showWhen || question.showWhen(answers)))
    .map((question) => {
      if (question.id === "shade_affected_areas") {
        let areas: Array<{ id?: unknown; name?: unknown }> = [];
        try {
          const parsed = typeof answers.panel_area_dimensions === "string" ? JSON.parse(answers.panel_area_dimensions) : [];
          if (Array.isArray(parsed)) areas = parsed;
        } catch { /* The fallback below keeps the question answerable. */ }
        const options = areas
          .filter((area) => area.id)
          .map((area) => ({ value: String(area.id), label: String(area.name || "Panel area"), description: "Include this recorded mounting area in the shade assessment." }));
        options.push({ value: "none", label: "Not sure which area", description: "Record that the affected mounting area still needs to be identified." });
        return { ...question, options };
      }
      if (question.id === "future_changes") {
        const everyday = new Set(answerValues(answers.everyday_needs));
        const buildings = new Set(answerValues(answers.building_type));
        const overlapping = new Set(answerValues(answers.heavy_loads));
        const future = new Set(answerValues(answers.future_changes));
        const workshopRelevant = everyday.has("tools")
          || everyday.has("compressor")
          || buildings.has("shed_workshop")
          || buildings.has("farm_building")
          || ["compressor", "welder", "saw_tools"].some((value) => overlapping.has(value))
          || future.has("workshop");
        return { ...question, options: question.options?.filter((option) => option.value !== "workshop" || workshopRelevant) };
      }
      if (question.id === "heavy_loads") {
        const options = highPowerOptionsForEverydayNeeds(answers);
        options.push({ value: "none", label: "None of these overlap", description: "The listed larger loads are not expected to run at the same time." });
        const batteryFreeGenerator = replacesGrid(answers)
          && answers.battery_requirement === "none"
          && ["include", "existing", "planned"].includes(String(answers.generator_requirement));
        return { ...question, noviceHelp: batteryFreeGenerator
          ? "Select every listed load that could realistically operate together. Wattson uses their running and startup demand to check the generator, PV/inverter arrangement and whichever source path will actually supply them. Their individual runtimes are recorded separately for workday energy."
          : "Select every listed load that could realistically be operating at the same time. Wattson uses this for inverter peak-power and startup-surge planning; their individual runtimes are recorded separately for workday energy.", options };
      }
      if (question.id === "architecture_preference" && replacesGrid(answers) && answers.battery_requirement === "none") {
        return {
          ...question,
          noviceHelp: `${question.noviceHelp} Note: some hybrid and off-grid inverters require a battery. Check that the model selected supports battery-free operation and the planned generator connection.`,
          technicalHelp: "Confirm the selected inverter's documented battery-free operating support and generator input or transfer compatibility where applicable.",
        };
      }
      if (question.id === "backup_duration" && answers.utility_relationship === "grid_connected") {
        return {
          ...question,
          title: "How long should the system keep running without the grid?",
          noviceHelp: "Choose the complete outage-survival target. Solar can recharge the battery during the outage, and a generator is counted only if you select one. Wattson must calculate the sources together rather than multiplying the whole bill by the number of days.",
          technicalHelp: "Treat this as a system-autonomy target. Verify it with a time-series energy balance covering backed-up load energy, solar recovery, battery limits and any explicitly selected generator dispatch; do not equate outage days with battery-only days.",
        };
      }
      if (question.id === "backup_duration" && answers.utility_relationship === "off_grid") {
        const batteryIncluded = answers.battery_requirement === "include";
        return {
          ...question,
          title: "How long should the system cover periods without enough solar?",
          noviceHelp: `Choose the complete low-solar operating target. Solar, ${batteryIncluded ? "the selected battery storage and " : ""}any generator or other supply selected later must be assessed together; this answer does not assume either source.`,
          technicalHelp: `Treat this as a standalone system-autonomy target. Verify chronological load and solar operation${batteryIncluded ? ", battery limits and recharge time" : ""}, plus any generator or other source explicitly selected later; do not infer an unselected source.`,
        };
      }
      if (question.id === "battery_requirement" && replacesGrid(answers)) {
        return {
          ...question,
          noviceHelp: "An off-grid system does not automatically require a battery or a generator. Record the battery decision here; a later question separately records whether generator supply is included and what it should power.",
          options: question.options?.map((option) => option.value === "none"
            ? { ...option, label: "No battery storage", description: "Keep the proposal battery-free. Later questions establish whether a generator or another source supplies loads when solar is insufficient, or whether those loads may stop." }
            : option),
        };
      }
      if (question.id === "generator_outage_role" && replacesGrid(answers)) {
        const batteryIncluded = answers.battery_requirement === "include";
        return {
          ...question,
          title: "What should the generator do when extra power is needed?",
          noviceHelp: batteryIncluded
            ? "Choose every intended role. The generator may recharge the batteries, carry high-power loads, supply selected circuits, or combine compatible roles when solar and stored energy are insufficient."
            : "Choose every intended role. In this battery-free design, the generator may carry high-power loads, supply selected circuits, or do both through a compatible and safely controlled power arrangement.",
          technicalHelp: batteryIncluded
            ? "Define the generator source path, charger demand, transferred circuits, load steps, start controls, interlocking and neutral/earth arrangement for low-solar or low-reserve operation."
            : "Define the generator source path, transferred circuits, PV interaction, load steps, interlocking and neutral/earth arrangement. Confirm the selected equipment supports stable battery-free operation and prevents unsafe source interconnection.",
          options: question.options
            ?.filter((option) => batteryIncluded || !["battery_recharge", "automatic_low_reserve"].includes(option.value))
            .map((option) => option.value === "backup_circuits"
              ? { ...option, label: "Supply selected circuits", description: "Power the lights, tools and other circuits selected for generator supply." }
              : option),
        };
      }
      if (question.id === "pool_heating_method") {
        const savedSources = Array.isArray(answers.water_heating_energy) ? answers.water_heating_energy : answers.water_heating_energy ? [answers.water_heating_energy] : [];
        const householdHotWaterQuestion = newSystemQuestions.find((item) => item.id === "water_heating_energy");
        const sourceLabels = savedSources.map((source) => householdHotWaterQuestion?.options?.find((option) => option.value === source)?.label ?? String(source));
        const sourceSummary = sourceLabels.length ? sourceLabels.join(", ") : "not yet recorded";
        return {
          ...question,
          noviceHelp: `${question.noviceHelp} Household hot-water source already recorded: ${sourceSummary}.`,
          technicalHelp: `${question.technicalHelp ?? question.noviceHelp} Household hot-water source already recorded: ${sourceSummary}.`,
          options: question.options?.map((option) => option.value === "domestic_hot_water"
            ? { ...option, description: `Filled using the household hot-water system already recorded as: ${sourceSummary}. Select any separate built-in heater as well.` }
            : option),
        };
      }
      // A public-grid option makes no sense once the user has told us this is
      // an off-grid Site. Keep the legitimate generator/other-source path,
      // but say exactly what it means in that context.
      if (question.id !== "panel_location" || answers.utility_relationship !== "off_grid") return question;
      return {
        ...question,
        options: question.options?.map((option) => option.value === "none"
          ? {
              value: "none",
              label: "No solar panels — generator or other source",
              description: answers.battery_requirement === "none"
                ? "Use a generator or another local source directly. No public-grid charging or battery storage is assumed."
                : "Use battery storage supplied by a generator or another local energy source. Grid charging is not available at this Site.",
            }
          : option),
      };
    })
    .filter((question) => question.id !== "heavy_loads" || (question.options?.filter((option) => option.value !== "none").length ?? 0) >= 2);
}

export function helpForExperience(question: DiscoveryQuestion, profile: OnboardingAnswers) {
  return profile.experience === "experienced" || profile.experience === "professional"
    ? question.technicalHelp ?? question.noviceHelp
    : question.noviceHelp;
}
