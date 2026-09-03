// Battery hardware and charging records for the universal How-to library.

export const batteryHardwareHowToGuides = [
  {
    group: "Batteries and charging",
    id: "battery-enclosures-racks",
    title: "Battery boxes, cabinets and racks",
    image: "/schematic-components/lifepo4-battery-bank.jpg",
    summary: "Support the battery weight, guard live terminals and preserve the exact battery's ventilation, temperature and service clearances.",
    keywords: ["battery box", "battery cabinet", "battery rack", "battery shelf", "battery enclosure", "mount battery", "battery room"],
    whatItIs: "The structure and enclosure that restrains batteries and separates their stored electrical energy from people, tools, water, heat, impact and other hazards.",
    whatItDoes: "It carries concentrated weight, prevents movement, guards terminals and organises cables while allowing the product's required cooling, venting, inspection and replacement access.",
    usedFor: ["Single mobile batteries", "Wall or floor storage batteries", "Rack modules", "Flooded lead-acid banks", "Outdoor battery systems"],
    types: [
      { name: "Vented battery box", description: "A restrained box with a lid and a designed route for any required gas ventilation.", bestFor: "A compatible low-voltage battery in a mobile, marine or small stationary installation.", watchFor: "A box is not automatically acid-proof, ignition-protected, weatherproof or adequately vented." },
      { name: "Floor or wall cabinet", description: "A purpose-built enclosure holding one or more supported modules with guarded connections.", bestFor: "A battery family expressly approved for that cabinet and orientation.", watchFor: "Wall strength, seismic/restraint loads, clearances, cooling and fire/location rules." },
      { name: "19-inch or proprietary rack", description: "A frame for slide-in battery modules, often with communications and common DC distribution.", bestFor: "Matched rack-battery product families.", watchFor: "Rack depth, rail load, module count, airflow, busbar/fuse architecture and lifting access." },
      { name: "Outdoor rated enclosure", description: "A weather-rated housing with managed heat, condensation, drainage and cable entries.", bestFor: "Products whose environmental and temperature ratings permit the exact outdoor location.", watchFor: "Sun can overheat a sealed cabinet; an IP rating alone does not solve condensation, flooding or battery ventilation." }
    ],
    questions: [
      { question: "Can I put batteries in any cupboard?", answer: "No. Confirm floor/wall load, enclosure material, battery orientation, ventilation, temperature, clearances, access, fire and local location restrictions before treating a cupboard as a battery space." },
      { question: "Can the inverter go inside the same box?", answer: "Only when the complete product/manual permits it. Chargers and inverters create heat and can be ignition sources; flooded batteries can emit gas. Keep each device's environmental and clearance rules intact." },
      { question: "How high should the battery be mounted?", answer: "There is no global height. Keep it above credible flooding where required, below structural load limits, protected from impact and unauthorised access, and reachable with a safe lifting/service method under local rules." },
      { question: "Does the enclosure need ventilation?", answer: "Use the exact battery manual. Flooded lead-acid normally needs deliberate gas management; sealed lead-acid can vent during fault; lithium and sodium products still have heat, clearance or enclosure requirements." }
    ],
    buy: ["Enclosure/rack approved for the battery family, weight and module count", "Maker-specified shelves, rails, restraints, terminal guards and blanking panels", "Approved glands, barriers and ventilation/thermal accessories", "Corrosion-resistant fixings suited to the supporting structure"],
    tools: ["Battery/module weight and dimensional drawings", "Structural fixing and load information", "Level and layout tools", "Controlled lifting equipment", "Specified torque tools and insulated terminal covers"],
    before: ["Record each battery's weight, dimensions, orientation and clearance", "Check wall/floor/rack capacity and local seismic or vehicle restraint needs", "Map cable bend radius, fuse/switch access and module replacement path", "Check gas, heat, sunlight, moisture, flood, impact and ignition exposure"],
    steps: ["Select the battery location from the product and Site requirements", "Confirm the supporting structure and fixing design", "Set out enclosure clearances and door/module removal space", "Install and level the empty rack or box", "Fit barriers, glands, ventilation and restraints", "Load batteries using the approved lifting order and weight distribution", "Secure modules and guard terminals before routing cables", "Label the enclosure and record clearances, fixings and photographs"],
    checks: ["Structure carries the full populated weight", "Every battery is restrained and removable safely", "No exposed terminal can be reached by a dropped tool", "Cooling/venting paths remain open", "Cable entries do not defeat enclosure rating or strain terminals"],
    source: "Use the exact battery and enclosure installation manuals; Victron Lithium Battery Smart installation is one product-family example.",
    sourceUrl: "https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/installation.html"
  },
  {
    group: "Batteries and charging",
    id: "existing-battery-assessment",
    title: "Identify and assess a battery you already own",
    image: "/guides/battery/agm-battery.png",
    summary: "Treat an inherited or second-hand battery as unknown until its label, chemistry, voltage, history and usable condition are established.",
    keywords: ["old battery", "used battery", "second hand battery", "battery label", "battery health", "test battery", "existing battery"],
    whatItIs: "An evidence record for an existing battery before Wattson designs equipment around it.",
    whatItDoes: "It separates what the label proves from what still needs inspection or testing, preventing an unknown battery from silently controlling the design.",
    questions: [
      { question: "Can Wattson tell battery health from a photo?", answer: "No. A photo can record identity, visible damage and printed ratings. Capacity, internal resistance, cell balance and performance require the maker's permitted inspection/test process." },
      { question: "What photos should I take?", answer: "Take the complete label square-on, the whole case, both terminals, all sides, existing wiring and any swelling, leakage, corrosion, heat damage or warning indicator." },
      { question: "Can I mix it with new batteries?", answer: "Only if the exact manufacturer permits that model, age, state and topology. Similar voltage or capacity does not prove a safe balanced bank." },
      { question: "What if the label is missing?", answer: "Keep chemistry and ratings unknown. Record dimensions, terminal arrangement and any codes, but do not select charging or protection from appearance." }
    ],
    buy: ["Nothing until the existing unit is identified", "Only maker-approved test or communication accessories", "Replacement terminal guards if the exact compatible part is available"],
    tools: ["Camera and Site Inventory label scanner", "Exact model manual and date-code reference", "Voltage-rated meter and battery test equipment appropriate to the chemistry", "PPE and spill/handling equipment required by the battery manual"],
    before: ["Do not charge a swollen, leaking, cracked, frozen, overheated or otherwise suspect battery", "Remove jewellery and control tools around exposed terminals", "Identify the legal/safe boundary for testing high-energy or high-voltage batteries"],
    steps: ["Add the battery to Site Inventory", "Photograph the label and all visible condition evidence", "Record chemistry, nominal/max voltage, Ah/kWh, model, serial/date and BMS details", "Find the exact current manual", "Compare resting readings only using an approved safe method", "Arrange chemistry-appropriate capacity/health testing where needed", "Mark the item available, needs testing, rejected or retired from evidence", "Only then check compatibility with the proposed system"],
    checks: ["Identity is supported by label/manual", "Physical condition is not inferred from voltage alone", "Unknown fields remain unknown", "No unsupported mixing or charging profile", "Test result and date are attached to the same inventory item"],
    source: "Testing and acceptance limits are battery-specific; use the exact manufacturer's inspection, storage and capacity-test instructions. Trojan's official guide library is one example.",
    sourceUrl: "https://www.trojanbattery.com/resources/guides-manuals-and-warranties"
  },
  {
    group: "Batteries and charging",
    id: "balanced-parallel-battery-wiring",
    title: "Balanced parallel battery wiring",
    image: "/schematic-components/busbar.jpg",
    summary: "Give parallel batteries deliberately equal current paths instead of attaching every system cable to the nearest unit.",
    keywords: ["parallel batteries", "balanced battery bank", "equal cable length", "diagonal connection", "battery busbar", "uneven current"],
    whatItIs: "A bank layout in which each parallel battery or string sees an equivalent resistance through cables, lugs, fuses and connection points.",
    whatItDoes: "It reduces avoidable current imbalance so one battery is not charged and discharged harder merely because its electrical path is shorter.",
    types: [
      { name: "Common busbars", description: "Equal designed positive and negative leads connect each battery/string to common distribution bars.", bestFor: "Clear, scalable banks with individual protection where required.", watchFor: "Cable, lug, fuse and terminal resistance—not length alone—forms the path." },
      { name: "Opposite-end or diagonal take-off", description: "Main positive and negative leave from opposite ends of a small parallel bank.", bestFor: "Some simple banks when the battery maker permits it.", watchFor: "It is not perfectly equal for every large bank and does not replace individual protection rules." },
      { name: "Manufacturer integrated bus system", description: "Matched modules connect through the maker's rack, busbar and communication architecture.", bestFor: "Supported modular batteries.", watchFor: "Follow module count, firmware, fuse and cable-position rules exactly." }
    ],
    questions: [
      { question: "Why not connect the inverter to the first battery?", answer: "The nearest unit can have the lowest-resistance path and carry more current. Equal path design distributes work more evenly." },
      { question: "Must every cable be exactly the same length?", answer: "Follow the chosen topology and battery manual. Equal length, cross-section, lug type, fuse path and torque are common controls, but a manufacturer bus system may define another tested arrangement." },
      { question: "Can I take 12 V from the middle of a 24 or 48 V bank?", answer: "Do not use a series midpoint as a normal lower-voltage supply. It unbalances the bank. Use a correctly designed DC-DC converter unless the battery system explicitly provides another method." }
    ],
    buy: ["Matched supported batteries", "Calculated equal-path cables and identical compatible lugs", "Rated covered busbars or maker distribution system", "Required battery/string and main protection"],
    tools: ["Approved bank schematic", "Cable measuring and controlled crimp/torque tools", "Voltage and current measurement equipment for permitted commissioning", "Cable/terminal labels"],
    before: ["Confirm series/parallel combinations are allowed", "Bring units to the maker-required state before interconnection", "Calculate all path resistance contributors", "Plan shunt and BMS communication so nothing bypasses measurement/control"],
    steps: ["Draw each physical battery and cable separately", "Choose a manufacturer-approved balanced topology", "Cut/terminate matched current paths", "Fit individual protection where required", "Connect to covered busbars or specified take-off points", "Complete BMS communications and termination", "Commission under charge and load", "Compare individual battery current/voltage and correct abnormal imbalance"],
    checks: ["No mixed unsupported batteries", "Every parallel path follows the drawing", "All high-current joints have recorded torque", "No load or charger bypasses the shunt/BMS architecture", "Commissioned currents are reasonably balanced under the product criteria"],
    source: "Victron Wiring Unlimited explains series/parallel banks, equal current paths and midpoint risks; the exact battery manual remains controlling.",
    sourceUrl: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/battery-bank-wiring.html"
  },
  {
    group: "Batteries and charging",
    id: "ac-battery-chargers",
    title: "AC battery chargers",
    image: "/schematic-components/hybrid-inverter.jpg",
    summary: "Use grid, generator or another AC source to apply the exact battery's permitted charge profile and current.",
    keywords: ["mains battery charger", "AC charger", "generator charger", "shore charger", "bulk absorption float", "lithium charger"],
    whatItIs: "A device converting AC supply into controlled DC charging. It may be standalone or built into an inverter/charger.",
    whatItDoes: "It limits voltage and current through charging stages appropriate to the exact battery and can maintain storage when its product mode permits.",
    types: [
      { name: "Portable charger", description: "Temporary charger using clamps or a removable lead.", bestFor: "A supported individual battery and controlled charging location.", watchFor: "Connection order, ventilation, unattended use, lead protection and the exact battery mode." },
      { name: "Permanently mounted charger", description: "Hardwired or fixed charger connected through designed AC and DC circuits.", bestFor: "Stationary, vehicle or marine service charging.", watchFor: "DC protection near the battery, airflow, heat, source capacity and local AC work rules." },
      { name: "Inverter/charger", description: "One unit both creates AC from the battery and charges it from an AC source.", bestFor: "Integrated backup, off-grid or mobile systems.", watchFor: "AC input limit, generator compatibility, transfer/neutral-earth behavior, BMS communication and battery current limit." }
    ],
    questions: [
      { question: "Can any 12 V charger charge any 12 V battery?", answer: "No. Nominal voltage alone is insufficient. Chemistry, absorption/float behavior, charge current, temperature compensation, BMS control and maker approval must match." },
      { question: "How large should the charger be?", answer: "Start with the battery's permitted charge current, desired recharge time, concurrent loads and available AC/generator capacity. More amps are not automatically better." },
      { question: "Where should it be mounted?", answer: "Use its required orientation, non-flammable support, airflow and environmental clearance. Do not place a charger directly above a battery or in a gas space unless the complete product instructions expressly permit it." }
    ],
    buy: ["Charger approved for battery voltage, chemistry and BMS/control method", "Correct AC supply/plug or hardwired protection", "Calculated DC cable and source-side overcurrent protection", "Temperature or voltage-sense accessories where required"],
    tools: ["Battery and charger manuals", "Cable/crimp/torque tools", "Voltage-rated commissioning meter", "Configuration app/interface where used"],
    before: ["Confirm exact battery charge voltages/current/temperature limits", "Check AC source voltage, frequency and available current", "Plan fuse/breaker close to the battery energy source", "Keep battery gas and charger heat/ignition constraints separate"],
    steps: ["Select the exact battery profile", "Mount the charger in the stated orientation and clearance", "Route calculated DC cable and protection", "Complete permitted AC connection", "Connect senses/communications", "Set current and chemistry profile", "Start using the documented sequence", "Verify battery voltage, current, temperature and BMS acceptance", "Save settings and shutdown procedure"],
    checks: ["Battery profile is exact, not generic by nominal voltage", "Charge current stays within battery and source limits", "DC cable is protected from the battery", "No blocked airflow or battery-gas exposure", "Measured operation and settings are recorded"],
    source: "Victron Blue Smart IP22 installation is one charger example; use the exact selected charger and battery manuals.",
    sourceUrl: "https://www.victronenergy.com/media/pg/Blue_Smart_IP22_Charger_230V_manual/en/installation---bsc---psc.html"
  },
  {
    group: "Batteries and charging",
    id: "dc-dc-battery-chargers",
    title: "DC-DC battery chargers and converters",
    image: "/schematic-components/mppt-charge-controller.jpg",
    summary: "Control charging between two DC systems or safely supply a different voltage without tapping the middle of a battery bank.",
    keywords: ["DC DC charger", "alternator charger", "battery to battery charger", "voltage converter", "12 to 24", "24 to 12", "isolated DC converter"],
    whatItIs: "A converter taking one DC voltage/source and producing a regulated DC output; charger models apply a battery charge profile, while power-supply models feed loads.",
    whatItDoes: "It separates voltage domains, limits charging current and can protect an alternator/source or prevent series-bank imbalance caused by midpoint loads.",
    types: [
      { name: "Battery-to-battery charger", description: "Uses an alternator or source battery to charge a service battery under controlled voltage/current.", bestFor: "Vehicle, marine and dual-battery systems.", watchFor: "Smart-alternator detection, source capacity, battery profile, heat and shutdown control." },
      { name: "Isolated DC-DC", description: "Input and output do not share a direct negative conductor inside the converter.", bestFor: "Architectures requiring galvanic separation or controlled grounding.", watchFor: "Isolation must be part of the complete earthing/bonding design; it is not automatically required." },
      { name: "Non-isolated DC-DC", description: "Input and output normally share negative while voltage is converted.", bestFor: "Compatible common-negative systems.", watchFor: "Ground loops, chassis paths and negative conductor current still require design." },
      { name: "Load converter", description: "Supplies a lower/higher DC load voltage rather than charging a battery.", bestFor: "12 V loads from a 24/48 V bank or another deliberately converted load domain.", watchFor: "Output regulation, startup current, isolation, fuse placement and continuous/peak rating." }
    ],
    questions: [
      { question: "Why not connect a 12 V load to one battery in a 24 V bank?", answer: "That unit discharges harder and the series bank becomes unbalanced. A designed DC-DC converter supplies the lower voltage from the whole bank." },
      { question: "Is a DC-DC converter automatically a battery charger?", answer: "No. A charger provides an appropriate controlled charging algorithm; a regulated power supply may not. Use the stated product mode." },
      { question: "Do both sides need fuses?", answer: "Each source and conductor path must be assessed. Input and output can both connect to energy sources depending on topology; follow the exact schematic and local protection design." }
    ],
    buy: ["Correct input/output voltage and charger or power-supply model", "Adequate continuous/peak power with temperature derating", "Required input/output protection and cable", "Remote enable, ignition or BMS-control accessories"],
    tools: ["Both source and load/battery manuals", "Cable and voltage-drop calculation", "Crimp and torque tools", "Configuration and commissioning interface"],
    before: ["Define whether the job is charging or load conversion", "Check actual minimum/maximum input and output voltage", "Check source current/alternator capability", "Choose isolated or non-isolated from the grounding architecture"],
    steps: ["Draw both DC domains and their negatives", "Select voltage/current/power and isolation type", "Mount vertically/oriented with stated cooling", "Install input/output conductors and protection", "Connect enable/ignition/BMS controls", "Set exact battery profile or output voltage before use", "Commission at low then expected load", "Verify temperature, voltage drop, source behavior and shutdown"],
    checks: ["Correct operating mode", "Both voltage windows pass", "No unprotected source conductor", "No series-bank midpoint load", "Source is not overloaded", "Temperature and voltage drop remain acceptable"],
    source: "Victron Orion-Tr Smart installation is one DC-DC charger example; use the exact selected converter and connected equipment manuals.",
    sourceUrl: "https://www.victronenergy.com/media/pg/Orion-Tr_Smart_DC-DC_Charger_-_Isolated/en/index-en.html"
  },
  {
    group: "Batteries and charging",
    id: "battery-contactors-precharge",
    title: "Battery contactors, disconnect control and pre-charge",
    image: "/schematic-components/bms-battery-management-system.jpg",
    summary: "Let the BMS control high-current connection safely and limit the first inrush into equipment capacitors where the exact architecture requires it.",
    keywords: ["battery contactor", "precharge resistor", "pre-charge", "inrush current", "BMS relay", "charge enable", "discharge enable", "main relay"],
    whatItIs: "A contactor is an electrically controlled high-current switch. A pre-charge path temporarily connects through a resistor before the main contactor closes.",
    whatItDoes: "The BMS can allow or stop charge/discharge through contactors, while pre-charge reduces damaging inrush into inverter or controller input capacitors.",
    types: [
      { name: "Charge/discharge enable signals", description: "Low-current BMS outputs instruct compatible chargers, inverters or intermediate relays.", bestFor: "Equipment designed to obey those signals or communications.", watchFor: "A signal output may not be able to drive a contactor coil directly." },
      { name: "Main contactor", description: "A rated electromagnetic switch opens or closes the battery power path.", bestFor: "BMS-controlled battery systems designed around that exact contactor.", watchFor: "DC voltage, continuous/fault current, coil voltage, economiser, polarity, arc direction and welded-contact detection." },
      { name: "Pre-charge contactor and resistor", description: "A smaller controlled path charges downstream capacitance before the main path closes.", bestFor: "Systems whose inverter/controller and BMS architecture specifies pre-charge.", watchFor: "Resistor energy/time, sequence feedback, repeated attempts and failed-precharge detection must be engineered." }
    ],
    questions: [
      { question: "Does every battery need contactors?", answer: "No. Some batteries contain switching; some use external contactors; some low-voltage products use other permitted disconnect control. Follow the complete battery/BMS/inverter design." },
      { question: "Why does the inverter spark when connected?", answer: "Input capacitors can draw a large inrush. Do not treat sparking as a normal connection method; use the manufacturer-specified pre-charge or controlled connection process." },
      { question: "Does a BMS replace the fuse?", answer: "No. BMS logic, contactors and overcurrent protection perform different jobs. A contactor may not safely interrupt the prospective short-circuit current." }
    ],
    buy: ["Only contactors approved for the BMS and real DC duty", "Calculated pre-charge resistor/relay assembly where specified", "Coil suppression/economiser and feedback wiring required by the design", "Independent correctly rated battery overcurrent protection"],
    tools: ["Exact BMS wiring/operation manual", "Contactor coil and contact datasheets", "Inverter input-capacitance/pre-charge requirements", "Controlled low-energy commissioning/test equipment"],
    before: ["Map normal, charge-only, discharge-only, sleep, fault and emergency states", "Confirm who supplies coil power when the pack is isolated", "Calculate inrush, resistor pulse energy and timeout", "Define feedback for stuck-open or welded contacts"],
    steps: ["Draw the full control and power schematic", "Select the exact supported contactors and pre-charge components", "Mount with required orientation, spacing and terminal guarding", "Wire coil control, suppression and auxiliary feedback", "Install independent fuse/isolation", "Configure BMS thresholds and sequence", "Test pre-charge with controlled conditions", "Verify main closure, timeout and fault shutdown", "Record sequence, settings and measured results"],
    checks: ["BMS output can safely drive the selected interface", "Contactor covers maximum voltage/current and DC interruption duty", "Pre-charge completes inside limits", "Failed pre-charge cannot repeatedly overheat the resistor", "Fuse remains independent", "Fault/weld feedback is tested"],
    source: "Orion BMS manuals illustrate external charge/discharge control, approved contactor constraints and optional pre-charge sequencing; use the exact battery-system design.",
    sourceUrl: "https://www.orionbms.com/manuals/pdf/orionbms2_wiring_manual.pdf"
  },
  {
    group: "Batteries and charging",
    id: "battery-temperature-management",
    title: "Battery temperature sensing, heating and cooling",
    image: "/schematic-components/bms-battery-management-system.jpg",
    summary: "Keep charging and discharging inside the battery's real temperature limits instead of assuming room-temperature performance.",
    keywords: ["battery heater", "cold charging", "battery temperature sensor", "battery cooling", "temperature compensation", "heated lithium"],
    whatItIs: "Sensors, BMS limits, ventilation, insulation, heaters or cooling used to keep a battery inside its permitted operating range.",
    whatItDoes: "It prevents prohibited charging/discharging, adjusts charge behavior where required and avoids hidden capacity/power loss or accelerated ageing from temperature extremes.",
    types: [
      { name: "Temperature-compensated lead-acid charging", description: "A sensor lets the charger adjust voltage as battery temperature changes.", bestFor: "Lead-acid products whose manual specifies compensation.", watchFor: "Sensor location and compensation slope must match the battery/charger." },
      { name: "BMS low/high-temperature limits", description: "The BMS reduces or stops charge/discharge outside programmed cell limits.", bestFor: "Compatible managed lithium or sodium battery systems.", watchFor: "A disconnect is protection, not thermal conditioning; every charge source must obey it." },
      { name: "Integrated or external battery heating", description: "A controlled heater raises cell temperature before permitted cold charging.", bestFor: "An exact product/system designed for heating.", watchFor: "Heater energy source, sensor placement, thermostat/BMS control, insulation and fire/environment rating." },
      { name: "Cabinet ventilation or active cooling", description: "Moves or rejects heat from cells and electronics.", bestFor: "Installations whose loss/ambient calculations require it.", watchFor: "Dust, salt, humidity, condensation, fan failure and uneven module temperatures." }
    ],
    questions: [
      { question: "Can LiFePO4 charge below freezing?", answer: "Only within the exact cell/battery maker's permitted temperature and BMS/heating behavior. Do not generalise from another LiFePO4 product." },
      { question: "Does insulating a battery solve cold weather?", answer: "Insulation slows heat loss but also traps heat and does not create controlled charging permission. Model ambient conditions, battery losses, heater energy and BMS limits together." },
      { question: "Where does the temperature sensor go?", answer: "At the location and attachment method specified by the battery/charger maker—not loosely in the room or against an unrelated heat source." }
    ],
    buy: ["Maker-approved temperature sensor or managed-battery interface", "Approved heater/cooling accessory where needed", "Insulation/enclosure compatible with venting and fire requirements", "Alarm or remote monitoring for unattended sites"],
    tools: ["Battery temperature-limit data", "Site minimum/maximum temperature evidence", "Temperature probes or logger", "Configuration interface and functional-test procedure"],
    before: ["Check charge and discharge limits separately", "Check cell temperature rather than weather alone", "Calculate heater/cooling energy in the power budget", "Define safe behavior if a sensor, fan, heater or communication link fails"],
    steps: ["Record Site and enclosure temperature range", "Map battery and charger/inverter limits", "Place sensors as specified", "Install approved thermal control", "Configure BMS/charger thresholds", "Test cold/hot inhibit and recovery without exceeding limits", "Monitor temperatures across modules under load/charge", "Save thresholds and baseline results"],
    checks: ["Every charge source obeys temperature limits", "Sensor reading is plausible and attached correctly", "No condensation or blocked ventilation", "Heating/cooling failure produces a safe response", "Thermal energy use is included in sizing"],
    source: "Battery temperature behavior is product-specific; Victron Lithium Battery Smart installation and technical data provide one documented example.",
    sourceUrl: "https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/installation.html"
  },
  {
    group: "Batteries and charging",
    id: "flooded-lead-acid-maintenance",
    title: "Flooded lead-acid ventilation and maintenance",
    image: "/guides/battery/flooded-lead-acid.png",
    summary: "Manage electrolyte, corrosion, charging gas and equalisation only according to the exact deep-cycle battery manual.",
    keywords: ["flooded battery", "wet battery", "battery water", "hydrogen ventilation", "equalise battery", "lead acid maintenance", "specific gravity"],
    whatItIs: "The inspection and maintenance process for serviceable liquid-electrolyte lead-acid batteries.",
    whatItDoes: "It keeps plates covered, connections clean and charge behavior controlled while managing acid and potentially explosive hydrogen/oxygen gas.",
    questions: [
      { question: "Can I add tap water?", answer: "Use only the water type and filling process stated by the battery maker—commonly distilled or deionised water. Do not add acid during routine watering unless an exact approved service procedure says otherwise." },
      { question: "When should water be added?", answer: "Follow the battery manual. Level can rise during charging, so the inspection and before/after-charge sequence matters; never expose plates or overfill." },
      { question: "Should I equalise the bank?", answer: "Only flooded batteries whose manufacturer permits it, at the specified voltage/time and with loads/equipment protected from that voltage. Never apply lead-acid equalisation to AGM, gel or lithium." },
      { question: "Is a lid enough ventilation?", answer: "No. Gas must be managed by an intentional ventilation design for the battery, enclosure, charging rate and local rules, away from ignition sources." }
    ],
    buy: ["Exact deep-cycle flooded batteries approved for the bank", "Acid-resistant restrained enclosure and designed ventilation", "Terminal guards and corrosion-control products permitted by the maker", "Approved watering/inspection equipment and spill response supplies"],
    tools: ["Battery PPE stated by the safety data/manual", "Non-sparking/insulated service tools as required", "Approved water-level or hydrometer equipment", "Ventilation and charger-setting records"],
    before: ["Remove ignition sources and control charging", "Wear required eye/skin protection", "Check case, caps, electrolyte leakage and temperature", "Know the spill/exposure response", "Never work over live unguarded terminals with metal tools"],
    steps: ["Identify the exact battery and maintenance interval", "Ventilate and isolate using the approved process", "Inspect case, caps, terminals and electrolyte level", "Clean/neutralise corrosion only by the maker's method without contaminating cells", "Add approved water at the specified point and level", "Retorque only when the manual requires it", "Charge using the correct temperature-compensated profile", "Equalise only when specifically permitted", "Record water use, readings, temperature and abnormalities"],
    checks: ["No cracked, leaking or overheated case", "Plates remain covered without overfill", "Ventilation path is clear", "Terminals are guarded and free of uncontrolled corrosion", "Charge/equalisation settings match this exact battery", "Maintenance record shows trends by individual unit"],
    source: "Use the exact flooded-battery safety, charging and maintenance manual; Trojan's official maintenance guide is one product-family example and does not override another battery's limits.",
    sourceUrl: "https://www.trojanbattery.com/resources/white-papers-and-articles/how-to-maintain-your-flooded-lead-acid-battery"
  }
] as const;
