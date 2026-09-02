// Component-specific novice questions layered over older guide records. Keeping
// these separate lets the catalogue be audited and expanded without duplicating
// installation sequences or source links.

export const howToGuideDetails = {
  mc4: {
    aliases: ["PV connector", "Solar connector", "Module connector", "MC4-style connector"],
    whatItIs: "A weather-sealed, touch-protected plug-and-socket connector family for PV DC cable. 'MC4' is a Stäubli product family; many similar-looking connectors are not approved mates.",
    whatItDoes: "It joins module leads and solar cable into a durable DC circuit while maintaining contact pressure, insulation and environmental sealing when the exact cable, contacts, tools and mating pair match.",
    usedFor: ["Module-to-module string links", "PV extension leads", "Array homeruns", "Approved branch connections"],
    types: [
      { name: "Original crimp connector", description: "A metal contact is crimped to a stated cable size, locked into its housing and sealed by the gland.", bestFor: "Conventional field-made PV leads using the exact maker's tooling.", watchFor: "Strip length, die, locator, cable diameter, gland torque and mating family all matter." },
      { name: "Factory-fitted module connector", description: "Supplied on the module lead and normally preserves the tested module assembly.", bestFor: "Direct approved mating or an approved transition lead.", watchFor: "Do not cut it off merely because another plug looks compatible; check module warranty and approved mates." },
      { name: "Branch or Y connector", description: "A purpose-built connector combines compatible PV branches in parallel.", bestFor: "A specifically calculated parallel arrangement.", watchFor: "Parallel current, reverse-current protection, connector rating and inverter input limits must be checked." },
      { name: "Crimp-free product family", description: "Some current products use a manufacturer-designed spring connection instead of a crimp.", bestFor: "Only its stated cable range and certified mating family.", watchFor: "Crimp-free does not make generic brands interchangeable." }
    ],
    questions: [
      { question: "Can I plug together connectors that fit?", answer: "No. A physical click is not compatibility evidence. Use the same approved manufacturer/type pairing or a specifically approved transition assembly." },
      { question: "Crimp or solder?", answer: "Use the termination method in the exact connector assembly instruction. Conventional MC4 contacts are crimped with the specified tool; do not add solder unless that exact maker explicitly requires it." },
      { question: "Do cable size and outer diameter matter?", answer: "Yes. The metal contact fits a conductor range and the seal fits an outer-diameter range. Both must pass." },
      { question: "Where should connectors sit?", answer: "Supported beneath the module or in the designed protected route, clear of standing water, roof contact, sharp edges, tension and direct physical damage. They must remain accessible as the mounting design requires." },
      { question: "Can they be unplugged in sunlight?", answer: "Do not disconnect a PV connector while it is carrying current. Follow the system's shutdown/isolation procedure and the connector manual; PV modules remain voltage sources in light." }
    ]
  },
  panels: {
    aliases: ["PV module", "Solar module", "Solar panel", "Photovoltaic panel"],
    whatItIs: "A photovoltaic module is a sealed assembly of solar cells, glass or polymer layers, frame or flexible backing, junction box, bypass diodes and factory leads.",
    whatItDoes: "It converts light into DC electricity. Its label values and temperature behaviour determine how it may be connected to controllers, optimisers, microinverters or string inverters.",
    usedFor: ["Roof arrays", "Ground arrays", "Carports and canopies", "Vehicles and boats", "Building-integrated surfaces"],
    types: [
      { name: "Rigid framed monofacial", image: "/schematic-components/solar-panel-pv-module.jpg", description: "Glass-front module producing mainly from the front face.", bestFor: "Most conventional roof and ground arrays.", watchFor: "Frame clamp zones, weight, wind loads and rear cable support." },
      { name: "Bifacial glass/glass", description: "Can also use light reaching the rear face.", bestFor: "Elevated or reflective sites with useful rear exposure.", watchFor: "Higher current assumptions, glass handling and avoidable rear shading." },
      { name: "Flexible or semi-flexible", description: "Thin module bonded or mechanically fixed to a compatible surface.", bestFor: "Some curved or weight-limited applications.", watchFor: "Heat, adhesive system, walking damage, fire rating, expansion and difficult replacement." }
    ],
    questions: [
      { question: "Can I mix different panels?", answer: "Only after checking voltage, current, power, temperature and string/MPPT behaviour. Similar wattage is not enough." },
      { question: "Does panel size matter beyond watts?", answer: "Yes. Dimensions, weight, clamp zones, wind area, connector leads and roof usable area all affect the design." },
      { question: "Where can a panel be clamped?", answer: "Only inside the exact module manual's permitted clamp zones using the selected mounting system's compatible clamp and torque." },
      { question: "Do panels work during a blackout?", answer: "Only if the complete inverter/storage/control architecture is designed to form and protect a backup supply. Ordinary grid-following solar normally shuts down with the grid." }
    ]
  },
  controller: {
    aliases: ["Solar regulator", "Charge regulator", "MPPT controller", "Solar charge controller"],
    usedFor: ["Charging a battery from PV", "Off-grid systems", "DC-coupled solar-plus-storage", "Vehicles, boats and remote systems"],
    types: [
      { name: "MPPT controller", image: "/schematic-components/mppt-charge-controller.jpg", description: "Tracks panel operating voltage and converts it to controlled battery charge voltage/current.", bestFor: "Most larger systems and higher-voltage PV strings.", watchFor: "Cold Voc, MPPT range, PV short-circuit current, output current and battery/BMS limits." },
      { name: "PWM controller", description: "Switches the array toward battery voltage using a simpler method.", bestFor: "Some small, deliberately matched low-voltage systems.", watchFor: "PV voltage must suit the battery arrangement and energy harvest may be lower." },
      { name: "Controller built into a hybrid inverter", description: "PV inputs and battery charging are inside the main inverter enclosure.", bestFor: "A supported integrated design.", watchFor: "Each MPPT still has separate voltage/current/string limits." }
    ],
    questions: [
      { question: "Do I need a separate controller?", answer: "Only when PV is charging a battery and the selected inverter/charger does not already provide the required compatible PV input. The system schematic decides." },
      { question: "Does controller size matter?", answer: "Yes. Check maximum PV voltage at the coldest design temperature, input current/Isc, usable PV power, output charging current, battery voltage and BMS charge limit." },
      { question: "Where should it be mounted?", answer: "In the orientation, ventilation and environmental conditions stated by its manual, normally close enough to the battery distribution to control voltage drop while keeping PV and battery protection accessible." }
    ]
  },
  battery: {
    aliases: ["Battery bank", "Energy storage", "House battery", "ESS battery", "Deep-cycle battery", "LFP battery", "LiFePO4 battery", "AGM battery", "Gel battery", "Sodium-ion battery", "Na-ion battery", "Na2 battery"],
    whatItIs: "A battery stores DC energy chemically. Most users will begin with a battery they already own, so its label, exact model, condition and manual come before any assumption about chemistry or voltage.",
    whatItDoes: "It keeps energy for later and can deliver power when solar, grid or a generator is unavailable. It does not make energy, and the printed amp-hours alone do not describe usable storage or output power.",
    usedFor: ["Night-time solar use", "Outage backup", "Off-grid energy storage", "Peak-load support", "Mobile and remote systems", "Starting and control circuits"],
    buy: ["First check whether the existing battery can be safely identified and reused—do not buy around an assumed chemistry or voltage", "Nothing new until required usable energy (kWh), output power (kW), nominal voltage and installation location are known", "One exact supported battery/BMS family with its current datasheet, safety manual and inverter/charger compatibility evidence", "The maker-required battery links, communications, terminators, protection, isolation, enclosure or rack", "A documented path for later expansion if staged purchasing is important"],
    tools: ["The exact battery and BMS manuals", "Insulated tools and torque equipment specified by the maker", "A voltage-rated meter and PPE appropriate to the system and permitted work", "Battery lifting/handling equipment suitable for the recorded unit weight", "Labels, terminal covers and barriers required by the proposed layout"],
    before: ["Photograph all sides of every existing battery, including the full label, terminals, damage, swelling, corrosion and current cable arrangement", "Record age, history and whether its condition/capacity has been tested; ownership does not prove suitability", "Confirm chemistry from the model label and datasheet—not case colour or appearance", "Confirm nominal and maximum charge/operating voltage, continuous and surge current, usable depth of discharge and temperature limits", "Check inverter/charger/BMS model and firmware compatibility", "Check whether series, parallel or later expansion is expressly permitted", "Choose a location that meets weight, orientation, ventilation, temperature, clearance, fire, flood, impact and access requirements", "Place battery fault protection, isolation, shunt and cable routes on the proposed schematic"],
    types: [
      { name: "Lithium iron phosphate (LFP/LiFePO4)", image: "/schematic-components/lifepo4-battery-bank.jpg", description: "Common stationary/mobile lithium chemistry with a required BMS and specific charge/temperature limits.", bestFor: "Deep cycling where the approved system provides suitable controls.", watchFor: "Low-temperature charging, BMS/inverter compatibility, fault current and installation/fire requirements." },
      { name: "Flooded lead-acid (wet cell)", image: "/guides/battery/flooded-lead-acid.png", description: "Liquid-electrolyte cells, often with service caps. Deep-cycle products can be maintained and equalised only as their maker permits.", bestFor: "Established off-grid or industrial systems with a suitable ventilated battery area and a maintenance plan.", watchFor: "Hydrogen gas, acid, upright orientation, water level, corrosion, temperature compensation and a usually shallower planned depth of discharge." },
      { name: "AGM lead-acid", image: "/guides/battery/agm-battery.png", description: "Valve-regulated lead-acid with electrolyte held in absorbent glass mat; normally sealed and not watered by the user.", bestFor: "Some backup, mobile and high-current applications where its exact cycle and charge specification fits.", watchFor: "Sealed does not mean impossible to vent. Overcharge, heat and the wrong absorption/float settings shorten life." },
      { name: "Gel lead-acid", image: "/schematic-components/lead-acid-battery.jpg", description: "Valve-regulated lead-acid with immobilised gel electrolyte. It is a separate type from AGM.", bestFor: "Some cyclic or standby systems chosen around the exact manufacturer's charge profile.", watchFor: "Charge-current and voltage limits can differ from AGM; a generic lead-acid setting may permanently damage it." },
      { name: "Sodium-ion (Na-ion)", description: "An emerging rechargeable battery family using sodium-based cell chemistry. Products differ in voltage window, BMS, enclosure and intended use. PVIntell also recognises the informal search term 'Na2', but does not present it as the chemistry's technical abbreviation.", bestFor: "Only a commercially supported stationary or mobile platform whose complete datasheet and compatibility have been checked.", watchFor: "Do not infer settings from the name or substitute lithium/lead-acid profiles. Confirm the exact battery, BMS, charger and inverter support." },
      { name: "Other lithium-ion chemistry", description: "Lithium batteries such as NMC or LTO have different voltage, thermal and control characteristics from LiFePO4.", bestFor: "A complete supported product or engineered system designed for that exact chemistry.", watchFor: "The word lithium is not a charge profile; cell chemistry, BMS limits and fire/installation requirements must be confirmed." },
      { name: "High-voltage battery system", description: "Series cell/modules operating at hazardous DC voltage with proprietary controls.", bestFor: "A specifically matched certified inverter/battery platform.", watchFor: "Not a generic DIY assembly; use trained/authorised installation and exact compatibility." }
    ],
    questions: [
      { question: "I already have a battery—where do I start?", answer: "Add it to Site equipment and photograph its complete label and current installation. Wattson should identify the exact model, voltage, chemistry, capacity, age/condition, BMS and permitted charging before proposing anything that connects to it." },
      { question: "Will Wattson design around what I already own?", answer: "Yes when it can form a safe compatible system. If an existing battery is unknown, damaged, unsuitable for cycling, too small, outside supported voltage or incompatible with the inverter/charger, Wattson should explain that plainly rather than force it into the proposal." },
      { question: "Which battery type should I use?", answer: "Compare required usable kWh and kW, cycle frequency, temperature, space and weight, maintenance, ventilation, product support, future expansion, BMS/inverter compatibility, local installation rules and whole-life cost. Wattson should explain viable complete systems, not choose from chemistry alone." },
      { question: "Are flooded, AGM and gel all the same because they are lead-acid?", answer: "No. They share lead-acid chemistry but differ in electrolyte construction, maintenance, gas behaviour and permitted charge settings. Use the exact battery datasheet and charger profile." },
      { question: "Is sodium-ion just a drop-in lithium replacement?", answer: "No. Sodium-ion is a product family, not a universal voltage or charge profile. Use it only when the exact battery's BMS, inverter/charger, protection and installation requirements form a supported system." },
      { question: "Can I identify chemistry by the case or colour?", answer: "No. Similar enclosures can contain different cells. Read the durable label, model datasheet and safety manual; if those cannot be confirmed, treat the battery as unknown." },
      { question: "How many batteries do I need?", answer: "Start with required usable kWh and maximum kW, then account for permitted depth of discharge, temperature, efficiency, ageing and backup reserve. A count without those values is meaningless." },
      { question: "Can I add more later?", answer: "Only if the battery maker permits that model, age/state, series/parallel count and BMS topology to be expanded. Record the allowed window before buying stage one." },
      { question: "Can I mix battery types, brands, ages or capacities?", answer: "Do not assume so. Different batteries can charge and discharge unevenly or require incompatible controls. Only use an arrangement expressly permitted by every battery and system manufacturer or produced by a competent engineered design." },
      { question: "Does the system voltage change the battery choice?", answer: "Yes. 12, 24, 36, 48, 60 V and manufacturer high-voltage systems require a matching bank topology, inverter, charger, controller, BMS and protection. Nominal voltage is not the maximum charged voltage." },
      { question: "Where should batteries be mounted?", answer: "Use the maker's allowed indoor/outdoor, orientation, temperature, ventilation, clearance, fire, flood and impact conditions. Keep protected service access and comply with local battery-location rules." },
      { question: "Do sealed batteries need ventilation?", answer: "Sealed batteries can still have relief paths, temperature and clearance rules. Flooded lead-acid has deliberate gassing concerns; AGM, gel, lithium and sodium products each use their own manual. Never turn 'sealed' into a universal no-ventilation assumption." },
      { question: "Do batteries need a fuse and switch?", answer: "High-energy battery conductors normally need designed overcurrent protection and isolation, but the exact device/location comes from the battery, inverter and local design." }
    ],
    steps: ["Read and save the exact battery, BMS and compatible inverter/charger documents", "Record chemistry, model, serial, date, nominal voltage, maximum voltage, Ah, kWh, continuous/surge current and temperature limits", "Draw every battery, link, fuse, switch, busbar, shunt, earth/bond and communication cable", "Verify bank series/parallel topology and balanced current paths", "Prepare the approved support, enclosure, clearances and ventilation without energising conductors", "Install and secure units in the maker's orientation using controlled lifting and terminal protection", "Make connections only in the stated safe sequence with polarity checks, specified torque and required authorised work", "Configure the exact charge profile, BMS protocol and current/temperature limits", "Commission, test shutdown/alarms and save baseline readings with the as-built record"],
    checks: ["Chemistry and exact model are confirmed", "No mixed or unsupported bank combination", "Every device covers real minimum/maximum battery voltage and current", "BMS communication and independent overcurrent protection are both present where required", "Ventilation, temperature, clearance and access match the product and Site rules", "Terminal torque, polarity, protection and labels are recorded"],
    source: "Official Victron GEL/AGM and LiFePO4 manuals and CATL sodium-ion product information are chemistry examples only. Final selection and installation must use the exact current battery, BMS, inverter/charger and local requirements.",
    sourceUrl: "https://www.victronenergy.com/upload/documents/Datasheet-GEL-and-AGM-Batteries-EN.pdf"
  },
  inverter: {
    aliases: ["Power inverter", "Inverter/charger", "Hybrid inverter", "Power conversion unit"],
    usedFor: ["Turning battery/PV DC into usable AC", "Grid connection", "Backup supply", "Off-grid supply", "Battery charging from AC"],
    types: [
      { name: "Grid-tied string inverter", image: "/schematic-components/string-inverter.jpg", description: "Converts one or more PV strings to grid-synchronised AC.", bestFor: "Conventional grid solar.", watchFor: "Normally stops in a blackout unless a separate approved backup architecture exists." },
      { name: "Hybrid inverter", image: "/schematic-components/hybrid-inverter.jpg", description: "Combines PV, battery and grid functions in one platform.", bestFor: "Supported solar-plus-storage designs.", watchFor: "Hybrid does not guarantee every battery, zero-export mode or whole-home backup." },
      { name: "Battery inverter/charger", image: "/schematic-components/hybrid-inverter.jpg", description: "Creates AC from a battery and charges it from an AC source; PV may use a separate controller or AC-coupled inverter.", bestFor: "Off-grid, backup, marine/mobile and AC-coupled systems.", watchFor: "Transfer, neutral/earth, generator and battery compatibility." },
      { name: "Microinverter", image: "/schematic-components/microinverter.jpg", description: "Converts DC to AC at each module or small module group.", bestFor: "Module-level conversion and some complex roof layouts.", watchFor: "AC branch limits, rooftop service access and battery/backup architecture." }
    ],
    questions: [
      { question: "How large should the inverter be?", answer: "Use simultaneous continuous loads, motor/start surges, phase balance, temperature derating and future loads—not daily kWh alone." },
      { question: "Does any inverter work with any battery?", answer: "No. Check battery voltage, current, BMS communication, firmware and the manufacturer's supported compatibility list." },
      { question: "Where should it be mounted?", answer: "On a structure that carries its weight, in the required orientation with stated airflow/clearance, environmental protection, noise consideration and safe access. Local rules may restrict battery/electrical equipment locations." },
      { question: "Will it power the home when the grid fails?", answer: "Only if it supports backup/grid-forming operation and the transfer, protection, neutral/earth and selected-load arrangement is designed for that mode." }
    ]
  },
  protection: {
    aliases: ["Safety devices", "Disconnects", "Shut-offs", "Overcurrent protection"],
    usedFor: ["Protecting PV-string cable", "Protecting battery conductors", "Providing shutdown points", "Limiting surge damage"],
    types: [
      { name: "Fuse", description: "Sacrificial overcurrent device with a specified voltage, current, class and interrupt rating.", bestFor: "Fast, compact protection when correctly coordinated.", watchFor: "Holder compatibility, DC rating, replacement class and safe isolation before replacement." },
      { name: "Circuit breaker", description: "Resettable overcurrent device; some are also rated for switching/isolation.", bestFor: "Circuits using an expressly suitable DC or AC breaker.", watchFor: "Voltage, polarity, interrupt rating, trip curve and switching category." },
      { name: "Isolator/disconnect", description: "Provides a defined switching/isolation point but may not provide overcurrent protection.", bestFor: "Planned shutdown zones.", watchFor: "Load-break duty, DC poles/polarity and accessible placement." },
      { name: "Surge protective device", description: "Diverts transient overvoltage into the designed earthing path.", bestFor: "Coordinated AC or DC surge zones.", watchFor: "Topology, continuous voltage, backup protection and very short connection path." }
    ],
    questions: [
      { question: "Do I need all of these?", answer: "Not automatically. Each circuit needs a protection and isolation design based on its sources, conductors, equipment and local rules. One combination device may perform multiple expressly stated jobs." },
      { question: "Can I use an AC breaker on DC?", answer: "Only if the device is explicitly rated for that exact DC voltage, polarity and interrupt duty. Never assume an AC marking is enough." },
      { question: "Where should protection be mounted?", answer: "Where it protects the cable from the intended source, remains safely accessible for shutdown/service and sits in a suitable enclosure. Battery protection is commonly required close to the source as the approved design defines." }
    ]
  },
  switchboard: {
    aliases: ["Distribution board", "Breaker panel", "Fuse box", "Consumer unit", "Electrical panel"],
    usedFor: ["Distributing inverter AC", "Essential-load circuits", "Grid interconnection", "Circuit protection and isolation"],
    types: [
      { name: "Main distribution board", description: "Receives supply and distributes protected final circuits.", bestFor: "The building's primary electrical distribution.", watchFor: "Grid, generation, neutral/earth and local service rules." },
      { name: "Essential or backup-loads board", description: "Contains selected circuits supplied during an outage.", bestFor: "Keeping backup demand within inverter capability.", watchFor: "Transfer/interlock and neutral/earth behaviour in every supply mode." },
      { name: "PV or inverter sub-board", description: "Groups dedicated generation, inverter or protection circuits.", bestFor: "Clear separation and service access where the design requires it.", watchFor: "Labelling, upstream coordination, enclosure rating and authorised connection." }
    ],
    questions: [
      { question: "Can I connect the inverter straight to the house?", answer: "The connection requires a designed circuit, protection, isolation, earthing/neutral arrangement, board capacity, testing and any grid approval. It is not simply a plug-and-play cable." },
      { question: "Where can a board be mounted?", answer: "Local electrical/building rules govern accessibility, height, wet areas, escape paths, fire conditions and clear working space. Use the Site location and an approved enclosure/location design." },
      { question: "Do I need a separate backup board?", answer: "Not always, but it is often the clearest way to limit outage loads. Some approved whole-home systems use another arrangement; the inverter and transfer design decides." }
    ]
  }
} as const;
