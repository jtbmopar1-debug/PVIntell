export const acCableHowToGuides = [
  {
    group: "AC wiring and connections",
    id: "tps-sheathed-ac-cable",
    title: "TPS / sheathed AC cable",
    image: "/guides/ac-wiring/tps-sheathed-ac-cable.png",
    summary: "Identify and size sheathed AC cable from its actual standard and installation conditions, not its appearance or regional nickname.",
    keywords: ["TPS", "AC cable", "sheathed cable", "tough plastic sheathed", "twin and earth", "flat cable", "non-metallic sheathed", "NM", "NM-B", "Romex", "mains cable"],
    whatItIs: "Two or more insulated AC conductors contained in a protective outer sheath. TPS is common terminology in some countries; other locations use different names, constructions and standards.",
    whatItDoes: "It carries AC power between equipment, protection and loads when the exact cable construction and installation method are permitted for that circuit and location.",
    usedFor: ["Inverter AC input and output circuits", "Building final subcircuits", "Switchboard and distribution connections", "Fixed AC wiring where locally permitted"],
    types: [
      { name: "Multicore sheathed AC cable", image: "/guides/ac-wiring/tps-sheathed-ac-cable.png", description: "The supplied example contains multiple insulated copper conductors inside a common plastic sheath.", bestFor: "A fixed-wiring method where the exact cable standard, conductor count and installation conditions are accepted locally.", watchFor: "The pictured conductor colours and four-core construction are examples, not a global wiring rule." },
      { name: "International colour comparison", image: "/guides/ac-wiring/international-ac-conductor-colours-reference.png", description: "A quick visual comparison of several commonly encountered AC conductor-colour conventions.", bestFor: "Recognising why the system location and installation era must be established before interpreting colours.", watchFor: "It is incomplete and simplified. Never use the chart alone to identify, connect or prove a conductor dead." },
      { name: "110/120 V metal-clad cable", image: "/guides/ac-wiring/110-120v-metal-clad-ac-cable.png", description: "Insulated conductors enclosed by flexible interlocked metal armour, commonly known as MC cable in North America.", bestFor: "Nominal 120 V and other circuits only where the exact listed cable and fittings are permitted for the installation.", watchFor: "‘110 V’ names the nominal supply informally, not a cable specification. Armour construction, bonding path, conductor colours and location ratings must be verified." },
    ],
    questions: [
      { question: "Is TPS the same cable everywhere?", answer: "No. TPS is regional terminology. Twin-and-earth, flat cable, NM and NM-B can describe related but technically different products governed by different standards." },
      { question: "Can Wattson identify conductor function by colour?", answer: "Only after the system location, applicable standard, cable age and actual circuit are known. Colours differ by country and era and must be verified, not assumed from a photograph." },
      { question: "Can I use it outdoors, underground or in conduit?", answer: "Only if the exact cable documentation and local wiring rules permit that environment and installation method. A sheath alone does not prove UV, wet-location, burial or conduit suitability." },
    ],
    buy: ["Cable certified for the destination jurisdiction", "Correct conductor count, material and cross-sectional area", "Compatible glands, entries, supports and identification", "Protection coordinated with cable capacity and fault conditions"],
    before: ["Pin the system location and applicable wiring rules", "Record voltage, phase arrangement, load and protective device", "Calculate current capacity and voltage drop for the actual route", "Apply temperature, grouping, enclosure and thermal-insulation derating", "Confirm conductor colours and permitted installation method locally"],
    steps: ["Select the exact cable standard and construction", "Measure the complete route and service allowances", "Protect it from heat, moisture, sunlight, impact and sharp edges as required", "Maintain bend radius and support intervals", "Use suitable entries and strain relief", "Have restricted AC termination and testing completed by the authorised person where required", "Record cable marking, size, route and test results"],
    checks: ["Cable marking matches the design and jurisdiction", "Current capacity remains adequate after all derating", "Voltage drop and fault protection pass", "Conductor identification is verified at both ends", "The as-built record shows the real route and cable"],
    source: "Use the cable manufacturer's data and the electrical wiring rules, licensing requirements and conductor-identification rules applicable at the system location.",
  },
] as const;
