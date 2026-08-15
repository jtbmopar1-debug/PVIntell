import type { OnboardingAnswers } from "@/onboarding/assessment";

export const unknownAnswer = "__unknown__";
export type DiscoveryStage = "discovery" | "site" | "needs" | "design";
export type DiscoveryAnswers = Record<string, string | number | string[]>;

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

export const discoveryStages: Array<{ id: DiscoveryStage; label: string; description: string }> = [
  { id: "discovery", label: "Discovery", description: "What you want the system to achieve" },
  { id: "site", label: "Site", description: "The property and possible solar locations" },
  { id: "needs", label: "Needs", description: "Energy use, backup and heavy loads" },
  { id: "design", label: "Design", description: "Preferences, limits and future plans" },
];

export const newSystemQuestions: DiscoveryQuestion[] = [
  {
    id: "system_name", stage: "discovery", title: "What should we call this power setup?",
    noviceHelp: "A simple name is fine, such as House solar, Main home or Workshop.", type: "text",
  },
  {
    id: "utility_relationship", stage: "discovery", title: "Does this property already receive electricity from the public power network?",
    noviceHelp: "This tells us whether solar will work alongside an existing electricity connection or must supply the property by itself.",
    type: "choice", options: [
      { value: "grid_connected", label: "Yes, it already has electricity", description: "Solar will work alongside the existing public supply." },
      { value: "off_grid", label: "No public electricity supply", description: "Solar, batteries or a generator must provide the power." },
    ],
  },
  {
    id: "primary_outcome", stage: "discovery", title: "What do you mainly want solar to achieve?",
    noviceHelp: "Choose every outcome that matters. This sets the direction only; equipment and sizes are not selected yet.", type: "multi_choice", options: [
      { value: "cost", label: "Lower electricity bills", description: "Use more solar energy instead of buying electricity." },
      { value: "backup", label: "Power during outages", description: "Keep chosen items operating when public electricity fails." },
      { value: "independence", label: "Rely less on the grid", description: "Use and store more of your own energy." },
    ],
  },
  {
    id: "site_name", stage: "site", title: "What should we call this property or location?",
    noviceHelp: "A site is the physical place, such as Home, River Views or Farm. It can contain more than one separate power system.", type: "text",
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
      { value: "other", label: "Something else", description: "Describe it in the next steps." },
    ],
  },
  {
    id: "property_authority", stage: "site", title: "Who can approve changes to this property?",
    noviceHelp: "Solar may require permission from an owner, landlord, body corporate or other decision-maker.", type: "choice", options: [
      { value: "owner", label: "I own it", description: "You can usually make property decisions, subject to local requirements." },
      { value: "renter", label: "I rent it", description: "Landlord approval will normally be needed." },
      { value: "shared", label: "Shared title or body corporate", description: "Other owners or a body corporate may need to approve." },
      { value: "client", label: "I am planning for someone else", description: "The owner or client will need to confirm decisions." },
    ],
  },
  {
    id: "panel_location", stage: "site", title: "Where could solar panels possibly go?",
    noviceHelp: "Choose every possible area. This is only a starting idea; a later inspection confirms whether each location is actually suitable.", type: "multi_choice", options: [
      { value: "main_roof", label: "Main roof", description: "The roof of the main building." },
      { value: "other_roof", label: "Garage, shed or another roof", description: "A separate roof may have better space or sunlight." },
      { value: "ground", label: "On the ground", description: "A purpose-built frame located away from the building." },
    ],
  },
  {
    id: "usable_solar_space", stage: "site", title: "What do you know about the available space?",
    noviceHelp: "Rough dimensions, a simple description or a roof/site photo are enough for now. Chimneys, vents and edges reduce usable space.",
    technicalHelp: "Record approximate usable dimensions and any required setbacks or obstructions.", type: "textarea",
  },
  {
    id: "panel_area_dimensions", stage: "site", title: "Do you know the usable length and width of each possible panel area?",
    noviceHelp: "Enter rough usable dimensions for each roof face or ground area, such as ‘north roof 8 m × 4 m’. Choose ‘I don’t know’ if measurements or a photo are still needed.",
    technicalHelp: "Record usable—not total—dimensions for each mounting plane. Keep separate roof faces or orientations separate.", type: "textarea",
  },
  {
    id: "panel_area_constraints", stage: "site", title: "What takes up space or limits panel placement?",
    noviceHelp: "List chimneys, vents, skylights, ridges, roof edges, shaded sections, access paths or anything else panels must avoid. A clear photo is useful if you are unsure.",
    technicalHelp: "Record known obstructions, access zones and unverified setbacks or clearances without assuming a regulation value.", type: "textarea",
  },
  {
    id: "orientation_and_pitch", stage: "site", title: "Which way do the possible areas face, and how steep are they?",
    noviceHelp: "A compass direction such as north-east and a rough slope—flat, low, medium or steep—is enough for now. Exact azimuth and tilt can be added in the Design Calculator later.", type: "textarea",
  },
  {
    id: "shading", stage: "site", title: "How much shade reaches the possible panel area?",
    noviceHelp: "Think about trees, nearby buildings and hills during the morning, middle of the day and afternoon.", type: "choice", options: [
      { value: "little", label: "Little or no shade", description: "The area appears open for most of the day." },
      { value: "some", label: "Some shade", description: "Shade crosses part of the area during the day." },
      { value: "significant", label: "Significant shade", description: "Large areas are shaded for long periods." },
    ],
  },
  {
    id: "structure_condition", stage: "site", title: "What do you know about the roof or supporting structure?",
    noviceHelp: "Include the roof material, approximate age and whether repairs may be needed. Choose “I don’t know” if it needs inspection.", type: "textarea",
  },
  {
    id: "current_energy_use", stage: "needs", title: "How much electricity does the property currently use?",
    noviceHelp: "Look for kWh on a recent electricity bill. Enter a monthly total if available; otherwise choose “I don’t know” and Wattson can build an appliance list later.",
    technicalHelp: "Enter representative monthly consumption in kWh; seasonal history can be added during review.", type: "number", unit: "kWh/month",
    showWhen: (answers) => answers.utility_relationship === "grid_connected",
  },
  {
    id: "cooking_energy", stage: "needs", title: "How is cooking done at this property?",
    noviceHelp: "Choose every method used. Electric ovens and cooktops can be large loads, while LPG or wood cooking may use little or no electricity.", type: "multi_choice", options: [
      { value: "electric_oven", label: "Electric oven", description: "A significant electrical load, especially while heating up." },
      { value: "electric_cooktop", label: "Electric cooktop", description: "Includes ceramic and conventional electric hobs." },
      { value: "induction", label: "Induction cooktop", description: "Efficient cooking but with a potentially high peak electrical demand." },
      { value: "lpg_gas", label: "LPG or gas", description: "Cooking heat mainly comes from fuel rather than the electrical system." },
      { value: "wood", label: "Wood-fired cooking", description: "Cooking heat mainly comes from a wood stove or range." },
      { value: "other", label: "Another method", description: "Wattson will ask for the details during review." },
    ],
  },
  {
    id: "water_heating_energy", stage: "needs", title: "How is water heated?",
    noviceHelp: "Water heating is often one of a home’s largest energy uses. Choose every source that contributes.", type: "multi_choice", options: [
      { value: "electric_resistive", label: "Electric hot-water cylinder", description: "Uses an electrical heating element in a storage cylinder." },
      { value: "heat_pump", label: "Heat-pump water heater", description: "Uses electricity more efficiently but still needs to be included in the load model." },
      { value: "instant_electric", label: "Instant electric", description: "Heats water on demand and can require very high electrical power." },
      { value: "lpg_gas", label: "LPG or gas", description: "Water heat mainly comes from fuel rather than electricity." },
      { value: "solar_thermal", label: "Solar hot water", description: "Roof collectors heat water directly rather than generating electricity." },
      { value: "wood_wetback", label: "Wood fire or wetback", description: "A fire contributes heat to the hot-water system." },
      { value: "other", label: "Another method", description: "Wattson will ask for the details during review." },
    ],
  },
  {
    id: "space_heating_energy", stage: "needs", title: "How is the home or building heated?",
    noviceHelp: "Choose every method used. Electrical heating can strongly affect winter system size; wood or LPG changes that calculation.", type: "multi_choice", options: [
      { value: "heat_pump", label: "Heat pump", description: "Efficient electrical heating and often cooling as well." },
      { value: "resistive", label: "Electric heaters or underfloor", description: "Direct electrical heating with substantial winter energy use." },
      { value: "wood", label: "Wood fire", description: "Most heating energy comes from firewood." },
      { value: "lpg_gas", label: "LPG or gas", description: "Most heating energy comes from gas fuel." },
      { value: "boiler", label: "Boiler or central heating", description: "Tell Wattson its fuel and circulation requirements during review." },
      { value: "none", label: "No fixed heating", description: "There is no regular building-heating system to include." },
      { value: "other", label: "Another method", description: "Wattson will ask for the details during review." },
    ],
  },
  {
    id: "everyday_needs", stage: "needs", title: "What else must the property power day-to-day?",
    noviceHelp: "List items such as refrigeration, lighting, internet, water or sewage pumps, cooling, medical equipment and work equipment. Exact ratings can come later.", type: "textarea",
  },
  {
    id: "backup_preference", stage: "needs", title: "What should happen during a public power outage?",
    noviceHelp: "Backup requires batteries and suitable electrical separation. Supplying more of the home generally costs more.", type: "choice", options: [
      { value: "none", label: "No outage backup needed", description: "Solar is mainly for savings or daytime use." },
      { value: "essentials", label: "Keep essentials running", description: "For example refrigeration, lights, internet and a water pump." },
      { value: "most_home", label: "Run most of the home", description: "A larger backup system designed around major household loads." },
    ], showWhen: (answers) => answers.utility_relationship === "grid_connected" && (Array.isArray(answers.primary_outcome) ? answers.primary_outcome.some((value) => value !== "cost") : answers.primary_outcome !== "cost"),
  },
  {
    id: "outage_essential_loads", stage: "needs", title: "Which items must stay on in an outage?",
    noviceHelp: "Common essentials are a fridge/freezer, a few lights, internet, a water or sewage pump, medical equipment and selected outlets.", type: "textarea",
    showWhen: (answers) => answers.backup_preference === "essentials",
  },
  {
    id: "backup_duration", stage: "needs", title: "How long should backup power last?",
    noviceHelp: "A few hours covers short cuts; overnight needs more battery; one or more days needs substantially more storage.", type: "choice", options: [
      { value: "few_hours", label: "A few hours", description: "Short local outages." },
      { value: "overnight", label: "Overnight", description: "A longer outage through the night." },
      { value: "one_day", label: "About one day", description: "Essential use for roughly 24 hours." },
      { value: "multiple_days", label: "Several days", description: "Greater resilience with considerably more storage." },
    ], showWhen: (answers) => answers.utility_relationship === "off_grid" || (answers.backup_preference !== undefined && answers.backup_preference !== "none"),
  },
  {
    id: "heavy_loads", stage: "needs", title: "Which large appliances or tools might run at the same time?",
    noviceHelp: "Examples include an oven, electric water heater, heat pump, water pump, welder, large tools or EV charger. These affect inverter size.", type: "textarea",
  },
  {
    id: "future_changes", stage: "design", title: "What might be added in the future?",
    noviceHelp: "Consider an EV, extra dwelling, workshop equipment, electric water heating, more batteries or changing from gas to electricity.", type: "textarea",
  },
  {
    id: "delivery_approach", stage: "design", title: "How do you want to approach the build?",
    noviceHelp: "This changes how Wattson separates DIY tasks, equipment costs, and work that local law reserves for licensed people, inspectors or network providers.", type: "choice", options: [
      { value: "diy_led", label: "DIY-led", description: "I want to do everything I can legally and safely do, using licensed people only where required." },
      { value: "shared", label: "Shared DIY and trades", description: "I will handle practical or mechanical work and engage trades for defined specialist work." },
      { value: "turnkey", label: "Fully supplied and installed", description: "I want a contractor to manage the complete installation." },
    ],
  },
  {
    id: "architecture_preference", stage: "design", title: "Do you already have a preferred equipment arrangement?",
    noviceHelp: "You do not need to decide this now. Wattson can review your needs first and explain the suitable choices afterward.", type: "choice", options: [
      { value: "recommend", label: "Recommend one after review", description: "Wattson will compare the suitable options using your answers." },
      { value: "combined", label: "One combined hybrid unit", description: "A compact unit that can coordinate solar, batteries and the grid." },
      { value: "modular", label: "Separate modular equipment", description: "Separate charging and inverter equipment that may be easier to expand or replace in parts." },
      { value: "ac_coupled", label: "AC-coupled equipment", description: "Often considered when integrating with an existing grid-connected solar system." },
    ],
  },
];

export function visibleDiscoveryQuestions(answers: DiscoveryAnswers) {
  return newSystemQuestions.filter((question) => !question.showWhen || question.showWhen(answers));
}

export function helpForExperience(question: DiscoveryQuestion, profile: OnboardingAnswers) {
  return profile.experience === "experienced" || profile.experience === "professional"
    ? question.technicalHelp ?? question.noviceHelp
    : question.noviceHelp;
}
