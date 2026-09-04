// Education-only wind records. These guides explain and screen the idea but
// are deliberately not inputs to PVIntell discovery, design or build flows.

export const windGenerationHowToGuides = [
  {
    group: "Wind generation",
    id: "small-wind-site-reality-check",
    title: "Can I use a small wind generator here?",
    image: "/guides/wind/small-wind-reality-check.svg",
    summary: "Usually, do not spend money yet. Small wind needs strong, clean wind at real tower height, ample clear space and a site-specific assessment; a breezy garden or roof is not enough.",
    aliases: ["home wind turbine", "wind generator", "small wind", "domestic turbine", "roof turbine", "windmill", "micro wind"],
    keywords: ["can I install wind", "wind turbine at home", "rooftop wind", "vertical axis turbine", "VAWT", "HAWT", "wind and solar hybrid"],
    whatItIs: "A small wind system uses a rotor and generator on a tower or other engineered support, plus controls, protection and compatible power-conversion equipment. Its advertised wattage is not its normal output.",
    whatItDoes: "It converts moving air into variable electrical power. Useful annual energy depends heavily on the measured wind-speed distribution at rotor height, unobstructed exposure, swept area, the turbine power curve, losses and downtime.",
    usedFor: ["Remote exposed rural sites", "Farms and open land", "Wind-solar hybrid systems", "Locations where a long grid extension is uneconomic", "Education before paying for a turbine"],
    types: [
      {
        name: "Ground-mounted horizontal-axis turbine",
        image: "/guides/wind/tower-horizontal-axis.svg",
        description: "A propeller-style rotor faces the wind from a purpose-designed freestanding, guyed or tilt-down tower.",
        bestFor: "Open rural sites with verified wind at hub height, space for setbacks/guy wires and a maintainable tower.",
        watchFor: "Tower engineering, foundations, overspeed control, noise, shadow, neighbours, aviation/planning limits, lowering or climbing access and cable losses.",
      },
      {
        name: "Rooftop turbine",
        image: "/guides/wind/rooftop-turbine.svg",
        description: "A small turbine attached to a building where the roof and nearby obstacles disturb the airflow.",
        bestFor: "Rare specialist cases supported by measured wind and structural/acoustic engineering—not an ordinary suburban default.",
        watchFor: "Buildings create turbulence that cuts output and increases fatigue, vibration and noise. Added structure and access costs commonly make rooftop small wind poor value.",
      },
      {
        name: "Vertical-axis turbine (VAWT)",
        image: "/guides/wind/vertical-axis.svg",
        description: "A rotor turns around a vertical axis; common shapes include helical, Darrieus and scoop-like Savonius designs.",
        bestFor: "A documented niche application where the exact certified turbine power curve and measured site resource support it.",
        watchFor: "Claims that it works in any turbulent wind do not prove useful annual energy. Check certified performance, swept area, starting behaviour, fatigue, noise and service history.",
      },
      {
        name: "Remote wind-solar hybrid",
        image: "/guides/wind/wind-solar-hybrid.svg",
        description: "A tower turbine and solar array feed a coordinated off-grid power system through their own compatible controls.",
        bestFor: "Remote exposed sites where wind genuinely complements seasonal or overnight solar and fuel/grid extension is costly.",
        watchFor: "Wind does not connect casually to a spare solar input. Controller topology, diversion/dump loads, braking, battery limits, inverter compatibility and safe shutdown are product-specific.",
      },
    ],
    questions: [
      {
        question: "It feels windy here—why not install one?",
        answer: "Human impressions, a phone forecast and a nearby airport reading do not describe clean wind at the proposed rotor height. Trees, ridges and buildings can make the flow turbulent; a turbine may spin visibly while producing little useful annual energy.",
      },
      {
        question: "Is a rooftop turbine a good way to supplement solar?",
        answer: "Usually no. The roof is commonly inside disturbed airflow, while vibration, structure, noise and difficult maintenance add cost. A tall ground-based tower in verified clear wind is the arrangement worth assessing first.",
      },
      {
        question: "How much power will a 1 kW turbine make?",
        answer: "One kilowatt is normally a rated output at a specified wind speed, not continuous production. Compare annual energy in kWh from the exact certified power curve and the site's wind-speed distribution at hub height, after turbulence, availability and electrical losses.",
      },
      {
        question: "When is small wind genuinely worth investigating?",
        answer: "Typically when the property is open and exposed, has room and permission for a tall tower, has a strong wind resource at that height, can support installation and maintenance, and the resulting annual-energy estimate competes with efficiency, more solar, storage or a grid extension.",
      },
      {
        question: "Will PVIntell add wind to my proposed solar build?",
        answer: "No. This category is educational only. PVIntell will not silently count wind energy, add turbine hardware or alter a solar build. A separate qualified wind-site assessment and engineered design would be needed.",
      },
    ],
    buy: ["Nothing until the site passes a wind-resource, planning, structural, acoustic and economic screen", "If it passes, obtain a complete supported turbine-and-tower system with a certified power curve and documented controls", "Use only compatible braking, diversion, protection, inverter/battery and interconnection equipment from the engineered design"],
    tools: ["Hub-height wind-resource map for preliminary screening only", "Site plan showing buildings, trees, terrain, boundaries, roads and possible tower/setback area", "Preferably a correctly sited anemometer/data logger and a sufficiently representative measurement period", "Exact turbine certified power curve and annual-energy calculation", "Planning, noise, structural, electrical and grid-connection requirements for the Site"],
    before: ["Treat vendor wattage and a spinning demonstration as insufficient evidence", "Screen obstacles, prevailing directions, turbulence and feasible tower height", "Check whether a tower, guy radius, setbacks and service access are allowed", "Estimate annual kWh—not peak watts—and compare whole-life cost with more solar, efficiency or storage", "Stop if the proposal relies on a low rooftop position or unverified performance claims"],
    steps: ["Mark the proposed rotor position and height on a scaled Site plan", "Screen the wind resource at approximately that height; do not substitute ground-level weather", "Map obstacles and terrain in every important wind direction", "Ask the local authority about tower height, setbacks, noise, visual, aviation and consent requirements", "Obtain measured or professionally modelled hub-height wind data when the preliminary screen remains promising", "Apply the exact turbine power curve and realistic turbulence, availability and electrical losses to estimate annual kWh", "Price the complete tower, foundation, controls, wiring, access, inspection, maintenance and eventual removal", "Compare cost per useful annual kWh against efficiency, additional solar, storage and grid/generator alternatives", "Proceed only through a specialist assessment and engineered design if the evidence still supports it"],
    checks: ["The decision uses annual energy rather than nameplate watts", "Wind evidence represents the proposed hub height and local terrain", "Tower, foundation, setbacks, noise and maintenance access are feasible", "The turbine has credible certified performance and support", "No wind output has been added to the PVIntell solar design or build schedule"],
    source: "US Department of Energy Small Wind Guidebook and NREL Small Wind Site Assessment; use local planning, structural, electrical and grid rules for the actual Site.",
    sourceUrl: "https://www.energy.gov/cmei/systems/windexchange/small-wind-guidebook",
  },
] as const;
