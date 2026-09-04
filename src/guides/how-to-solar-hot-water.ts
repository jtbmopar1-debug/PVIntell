// Solar hot-water education is separate from PV electrical generation. The
// exact plumbing, structural, electrical and consent path follows the Site.

export const solarHotWaterHowToGuides = [
  {
    group: "Solar hot water",
    id: "solar-hot-water-systems",
    title: "Solar hot-water systems, collectors and controls",
    image: "/guides/solar-hot-water/system-overview.svg",
    summary: "Recognise solar-thermal collectors, cylinders, pumps and controls—and distinguish them from PV panels powering an ordinary heater or heat pump.",
    aliases: ["solar water heater", "solar thermal", "solar geyser", "sun-heated water", "thermosiphon", "evacuated tubes", "flat-plate collector"],
    keywords: ["hot water cylinder", "solar collector", "heat-transfer fluid", "glycol loop", "differential controller", "circulation pump", "tempering valve", "legionella", "freeze protection", "stagnation", "PV diverter"],
    whatItIs: "A solar-thermal water heater captures heat directly in a roof- or ground-mounted collector and transfers it into stored water. It is not a photovoltaic module: the collector contains waterways or a heat-transfer circuit rather than cells and DC cables.",
    whatItDoes: "It reduces the energy required from an electric element, gas burner, boiler, wetback or heat pump. A complete system must still store water safely, control excessive temperature and pressure, protect against freezing and stagnation, and provide reliable backup heat.",
    usedFor: ["Domestic hot water", "Preheating an existing cylinder", "Homes with high daytime hot-water demand", "Solar-assisted commercial hot water", "Pool heating with purpose-made unglazed collectors", "Comparing solar thermal with PV-powered water heating"],
    types: [
      {
        name: "Flat-plate solar-thermal collector",
        image: "/guides/solar-hot-water/flat-plate-collector.svg",
        description: "A glazed insulated box contains a dark absorber plate and fluid waterways. From a distance it can resemble a PV panel but normally has insulated plumbing connections rather than electrical leads.",
        bestFor: "A matched pumped or thermosiphon system designed for the climate, roof and required water volume.",
        watchFor: "Collector weight, wind fixing, roof penetrations, pipe insulation, corrosion compatibility, overheating, frost strategy and access for servicing.",
      },
      {
        name: "Evacuated-tube collector",
        image: "/guides/solar-hot-water/evacuated-tube-collector.svg",
        description: "A row of glass vacuum tubes reduces heat loss; heat pipes or fluid passages transfer collected heat into a manifold.",
        bestFor: "A compatible system where cold-weather performance, available area or the selected product supports this collector type.",
        watchFor: "Fragile tubes, very high stagnation temperatures, correct manifold/tube engagement, replacement access, hail/product rating and exact mounting angle.",
      },
      {
        name: "Close-coupled thermosiphon system",
        image: "/guides/solar-hot-water/thermosiphon-system.svg",
        description: "The storage tank sits above or immediately beside the collector so warming fluid rises naturally without a circulation pump.",
        bestFor: "A climate, roof structure and plumbing arrangement explicitly supported by the complete packaged system.",
        watchFor: "The roof carries both collector and full tank mass. Freeze exposure, appearance, wind/seismic loads, pressure arrangement and safe roof access can rule it out.",
      },
      {
        name: "Pumped split solar-thermal system",
        image: "/guides/solar-hot-water/pumped-split-system.svg",
        description: "Collectors are separate from the cylinder. A differential controller runs a pump when useful collector heat is available; systems may be direct/open-loop or use a heat exchanger and separate fluid loop.",
        bestFor: "Keeping the heavy cylinder at ground/floor level and controlling circulation, freeze protection and backup heat deliberately.",
        watchFor: "Sensor placement, pump direction, air removal, non-return flow, expansion, pressure/temperature relief, heat-transfer-fluid condition and controller failure behaviour.",
      },
      {
        name: "PV-powered water heating",
        image: "/guides/solar-hot-water/pv-water-heating.svg",
        description: "Photovoltaic panels generate electricity used by a cylinder element, diverter/controller or heat-pump water heater. No solar-heated fluid travels down from the panels.",
        bestFor: "A Site where flexible electrical generation, simpler roof services or sharing PV with other loads is more useful than a dedicated thermal collector.",
        watchFor: "A grid-export diverter, dedicated DC element and ordinary AC/heat-pump water heating are different systems. Match voltage, controls, protection and permitted connection method exactly.",
      },
    ],
    questions: [
      { question: "Is that dark roof panel photovoltaic or solar hot water?", answer: "Look for the connections. PV modules have electrical junction boxes and cables; solar-thermal collectors have insulated fluid pipes or a close-coupled water tank. Record the label and both connection types rather than deciding by colour alone." },
      { question: "Do I still need backup heating?", answer: "Usually yes. Solar input changes with season, weather, shading and water use. The complete design defines the auxiliary element, heat pump, gas or other backup source and prevents it from unnecessarily heating the solar storage zone." },
      { question: "Can it overheat on a sunny day?", answer: "Yes. Low water use, power failure or a stopped pump can produce stagnation and very high collector temperatures. The exact system needs compatible expansion, pressure/temperature relief, tempering, pipework, fluid and a documented overheat strategy." },
      { question: "What happens in a frost?", answer: "That depends on the certified system: drainback, a closed antifreeze loop, controlled circulation or another manufacturer-approved method may be used. Pipe insulation alone is not reliable freeze protection." },
      { question: "Is solar thermal automatically better than adding PV?", answer: "No. Compare roof area and shade, existing cylinder, household hot-water profile, climate, maintenance, backup energy, installed cost and what else PV electricity could supply. Keep the two options visible rather than treating the word solar as one technology." },
      { question: "Can Wattson identify my existing system from a photo?", answer: "A collector, cylinder label, controller display, pump station and pipework photos can establish a likely type and add it to inventory, but concealed plumbing, valve functions and safety compliance remain unverified until traced and inspected." },
    ],
    buy: ["Nothing until the existing cylinder, water pressure arrangement, roof structure, collector location, climate exposure and backup source are confirmed", "A complete compatible collector, storage, controller/pump or thermosiphon package rather than unrelated parts", "Specified insulated solar-rated pipework, valves, expansion and relief components", "Tempering and potable-water components approved for the Site country", "Monitoring that shows collector, cylinder and backup-heating behaviour clearly"],
    tools: ["Photos of collector front/back, plumbing connections, cylinder, controller, pump and every rating label", "Roof dimensions, shade observations and structural information", "Existing hot-water energy and approximate daily demand", "Collector/system installation manual and hydraulic schematic", "Qualified plumbing, electrical and structural assessment where required"],
    before: ["Identify whether the proposal is solar thermal or PV-powered water heating", "Record cylinder volume, material, pressure type, heat-exchanger coils, element positions and backup source", "Check collector orientation, inclination, shading, wind exposure, mass and roof fixing", "Choose and document freeze, stagnation, expansion, pressure relief, tempering and legionella-control strategies", "Confirm plumbing, electrical, roof-weathertightness and consent requirements for the saved Site"],
    steps: ["Photograph and label the proposed or existing energy and water paths", "Draw collector, flow/return pipes, pump and sensors, heat exchanger, cylinder, backup heat, cold supply, tempering and hot outlets", "Match the system to the climate and household hot-water demand", "Verify roof structure, mounting and every penetration before installation", "Install the complete hydraulic and control arrangement to the selected system instructions", "Commission flow, sensor readings, pump/controller operation, relief paths, tempering and backup heat", "Record normal temperatures and energy use so poor circulation or unnecessary backup heating becomes visible", "Schedule inspection of fluid, insulation, valves, anodes and collector/mounting condition as required by the product"],
    checks: ["Collector and storage are structurally supported and weather-tight", "Flow direction, sensors, pump and heat exchanger match the hydraulic schematic", "Freeze and stagnation strategies work without relying on guesswork", "Relief discharge is safe and cannot be isolated", "Delivered water is temperature-controlled while stored water hygiene is maintained", "Backup heating works but does not mask a failed solar circuit", "The inventory distinguishes solar thermal from PV-powered water heating"],
    source: "New Zealand Building Performance solar water-heater guidance and current G12/AS2 framework; use the current Site-country requirements and exact system manual.",
    sourceUrl: "https://www.building.govt.nz/building-code-compliance/g-services-and-facilities/g12-water-supplies/building-code-solution-for-installing-solar-water-heaters",
  },
] as const;
