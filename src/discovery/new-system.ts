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

function includesSolarPanels(answers: DiscoveryAnswers) {
  const locations = answers.panel_location;
  return !(locations === "none" || (Array.isArray(locations) && locations.includes("none")));
}

function hasResidentialUse(answers: DiscoveryAnswers) {
  const buildings = answers.building_type;
  const values = Array.isArray(buildings) ? buildings : [buildings];
  return values.some((value) => ["detached_house", "townhouse", "apartment", "cabin_mobile"].includes(String(value)));
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
      { value: "not_decided", label: "Not decided yet", description: "Keep this unresolved until the energy source is chosen." },
    ], showWhen: (answers) => answers.utility_relationship === "off_grid" && !includesSolarPanels(answers),
  },
  {
    id: "storage_supply_source_grid", stage: "site", title: "Without solar panels, what will supply or charge the batteries?",
    noviceHelp: "Choose every source that may charge the batteries. This is a storage-only design, so Wattson needs to know where its energy will come from.", type: "multi_choice", options: [
      { value: "grid", label: "Public electricity supply", description: "The existing electricity connection can charge the batteries." },
      { value: "generator", label: "Generator", description: "A generator is available as an additional source." },
      { value: "other_local_supply", label: "Another local energy source", description: "For example wind, hydro or an existing DC source." },
      { value: "not_decided", label: "Not decided yet", description: "Keep this unresolved until the energy source is chosen." },
    ], showWhen: (answers) => answers.utility_relationship === "grid_connected" && !includesSolarPanels(answers),
  },
  {
    id: "panel_construction_interest", stage: "site", title: "Are any panel types worth exploring for these locations?",
    noviceHelp: "Choose any that may suit the available surfaces. This does not select a product; Wattson and the Design Calculator can compare the practical trade-offs later.", type: "multi_choice", options: [
      { value: "rigid_framed", label: "Standard rigid panels", description: "Common framed glass panels for roofs, racks and ground mounts." },
      { value: "bifacial", label: "Bifacial panels", description: "Generate from both faces when the rear has useful light and clearance." },
      { value: "flexible_lightweight", label: "Flexible or lightweight panels", description: "Useful where weight, curvature or a low profile rules out standard framed panels." },
      { value: "building_integrated", label: "Building-integrated solar", description: "Solar tiles, glazing, façades or canopies that also form part of the building." },
      { value: "none", label: "No preference yet", description: "Keep every suitable option open until the site and design are better understood." },
    ], showWhen: includesSolarPanels,
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
    id: "structure_condition", stage: "site", title: "What do you know about the roof or supporting structure?",
    noviceHelp: "Choose the surface or support type, approximate age and current condition for each possible panel area. Select ‘I don’t know’ where an inspection is needed.",
    technicalHelp: "Record each possible mounting structure separately. These selections identify where structural condition or mounting compatibility still needs verification.", type: "textarea", showWhen: includesSolarPanels,
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
      { value: "none", label: "No cooking here", description: "This building does not need cooking included in its power plan." },
    ], showWhen: hasResidentialUse,
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
      { value: "none", label: "No hot water here", description: "This building does not need hot water included in its power plan." },
    ], showWhen: hasResidentialUse,
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
    id: "everyday_needs", stage: "needs", title: "What does this property need to power day-to-day?",
    noviceHelp: "Choose every regular load. Ratings and hours of use can be added later; this gives Wattson a proper starting load list.", type: "multi_choice", options: [
      { value: "lighting", label: "Lighting", description: "Indoor, outdoor or security lights." },
      { value: "general_outlets", label: "General outlets and chargers", description: "Phones, small appliances and ordinary plug-in use." },
      { value: "fridge_freezer", label: "Fridge or freezer", description: "Includes chest freezers and refrigeration." },
      { value: "internet_computers", label: "Internet, computers or TV", description: "Routers, work devices and entertainment." },
      { value: "water_pump", label: "Water, bore or pressure pump", description: "Pumps often have a high starting surge." },
      { value: "septic_pump", label: "Sewage or septic pump", description: "Include any wastewater or effluent pumping." },
      { value: "tools", label: "Workshop tools", description: "Hand tools, bench tools or battery chargers." },
      { value: "compressor", label: "Compressor, motor or welder", description: "Motors/welders can have a large startup and running needs." },
      { value: "security", label: "Security, cameras or gate", description: "Cameras, alarms, gates and communications." },
      { value: "medical", label: "Medical equipment", description: "Any essential health-related electrical equipment." },
      { value: "cooling", label: "Cooling or ventilation", description: "Fans, air conditioning or extraction." },
      { value: "none", label: "No regular loads yet", description: "The building is not yet in use or its loads are not defined." },
    ],
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
    id: "backup_duration", stage: "needs", title: "How much stored-energy reserve do you want?",
    noviceHelp: "A few hours covers short gaps; overnight needs more battery; one or more days needs substantially more storage. For an off-grid system, this is your reserve when solar or a generator is unavailable.", type: "choice", options: [
      { value: "few_hours", label: "A few hours", description: "Short local outages." },
      { value: "overnight", label: "Overnight", description: "A longer outage through the night." },
      { value: "one_day", label: "About one day", description: "Essential use for roughly 24 hours." },
      { value: "multiple_days", label: "Several days", description: "Greater resilience with considerably more storage." },
    ], showWhen: (answers) => answers.utility_relationship === "off_grid" || (answers.backup_preference !== undefined && answers.backup_preference !== "none"),
  },
  {
    id: "heavy_loads", stage: "needs", title: "Which larger loads may run at the same time?",
    noviceHelp: "Choose every likely larger load. These choices help Wattson estimate inverter size and startup surge without guessing.", type: "multi_choice", options: [
      { value: "water_pump", label: "Water or bore pump", description: "Includes pressure and irrigation pumps." },
      { value: "compressor", label: "Air compressor", description: "A motor load with a startup surge." },
      { value: "welder", label: "Welder", description: "A high-demand workshop load." },
      { value: "saw_tools", label: "Large saws or workshop tools", description: "Bench saws, planers, grinders and similar tools." },
      { value: "refrigeration", label: "Large refrigeration", description: "Chest freezer, cool room or commercial fridge." },
      { value: "heat_pump", label: "Heat pump or air conditioning", description: "Heating/cooling compressor load." },
      { value: "electric_water", label: "Electric water heating", description: "Cylinder, instant heater or heat-pump water heater." },
      { value: "ev", label: "EV charging", description: "Vehicle charging now or later." },
      { value: "none", label: "None of these", description: "No known large or high-surge loads." },
    ],
  },
  {
    id: "future_changes", stage: "design", title: "What might be added in the future?",
    noviceHelp: "Choose every realistic future addition. This keeps the proposed system expandable without pretending those loads exist today.", type: "multi_choice", options: [
      { value: "ev", label: "EV charging", description: "A vehicle charger at this Site." }, { value: "workshop", label: "More workshop tools", description: "Larger tools, motors or machinery." },
      { value: "water_pump", label: "Water or irrigation pump", description: "A future pump or water system." }, { value: "extra_dwelling", label: "Another dwelling or building", description: "A cabin, studio, shed or additional home." },
      { value: "electric_hot_water", label: "Electric hot water", description: "Changing or adding water heating." }, { value: "more_storage", label: "More battery storage", description: "Increasing reserve or self-use later." },
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
  return newSystemQuestions
    .filter((question) => !question.showWhen || question.showWhen(answers))
    .map((question) => {
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
              description: "Use battery storage supplied by a generator or another local energy source. Grid charging is not available at this Site.",
            }
          : option),
      };
    });
}

export function helpForExperience(question: DiscoveryQuestion, profile: OnboardingAnswers) {
  return profile.experience === "experienced" || profile.experience === "professional"
    ? question.technicalHelp ?? question.noviceHelp
    : question.noviceHelp;
}
