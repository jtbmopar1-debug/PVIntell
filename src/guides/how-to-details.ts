// Component-specific novice questions layered over older guide records. Keeping
// these separate lets the catalogue be audited and expanded without duplicating
// installation sequences or source links.

export const howToGuideDetails = {
  mc4: {
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
    whatItIs: "A photovoltaic module is a sealed assembly of solar cells, glass or polymer layers, frame or flexible backing, junction box, bypass diodes and factory leads.",
    whatItDoes: "It converts light into DC electricity. Its label values and temperature behaviour determine how it may be connected to controllers, optimisers, microinverters or string inverters.",
    usedFor: ["Roof arrays", "Ground arrays", "Carports and canopies", "Vehicles and boats", "Building-integrated surfaces"],
    types: [
      { name: "Rigid framed monofacial", description: "Glass-front module producing mainly from the front face.", bestFor: "Most conventional roof and ground arrays.", watchFor: "Frame clamp zones, weight, wind loads and rear cable support." },
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
    usedFor: ["Charging a battery from PV", "Off-grid systems", "DC-coupled solar-plus-storage", "Vehicles, boats and remote systems"],
    types: [
      { name: "MPPT controller", description: "Tracks panel operating voltage and converts it to controlled battery charge voltage/current.", bestFor: "Most larger systems and higher-voltage PV strings.", watchFor: "Cold Voc, MPPT range, PV short-circuit current, output current and battery/BMS limits." },
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
    usedFor: ["Night-time solar use", "Outage backup", "Off-grid energy storage", "Peak-load support", "Mobile and remote systems"],
    types: [
      { name: "Lithium iron phosphate (LFP/LiFePO4)", description: "Common stationary/mobile lithium chemistry with a required BMS and specific charge/temperature limits.", bestFor: "Deep cycling where the approved system provides suitable controls.", watchFor: "Low-temperature charging, BMS/inverter compatibility, fault current and installation/fire requirements." },
      { name: "Lead-acid flooded", description: "Serviceable liquid-electrolyte batteries that can emit gas and require maintenance.", bestFor: "Some established off-grid applications with suitable ventilation and maintenance.", watchFor: "Ventilation, acid, orientation, water maintenance and reduced usable depth of discharge." },
      { name: "AGM or gel lead-acid", description: "Valve-regulated sealed lead-acid variants with different charge settings.", bestFor: "Some backup/mobile installations.", watchFor: "Do not treat AGM and gel charge profiles as interchangeable." },
      { name: "High-voltage battery system", description: "Series cell/modules operating at hazardous DC voltage with proprietary controls.", bestFor: "A specifically matched certified inverter/battery platform.", watchFor: "Not a generic DIY assembly; use trained/authorised installation and exact compatibility." }
    ],
    questions: [
      { question: "How many batteries do I need?", answer: "Start with required usable kWh and maximum kW, then account for permitted depth of discharge, temperature, efficiency, ageing and backup reserve. A count without those values is meaningless." },
      { question: "Can I add more later?", answer: "Only if the battery maker permits that model, age/state, series/parallel count and BMS topology to be expanded. Record the allowed window before buying stage one." },
      { question: "Where should batteries be mounted?", answer: "Use the maker's allowed indoor/outdoor, orientation, temperature, ventilation, clearance, fire, flood and impact conditions. Keep protected service access and comply with local battery-location rules." },
      { question: "Do batteries need a fuse and switch?", answer: "High-energy battery conductors normally need designed overcurrent protection and isolation, but the exact device/location comes from the battery, inverter and local design." }
    ]
  },
  inverter: {
    usedFor: ["Turning battery/PV DC into usable AC", "Grid connection", "Backup supply", "Off-grid supply", "Battery charging from AC"],
    types: [
      { name: "Grid-tied string inverter", description: "Converts one or more PV strings to grid-synchronised AC.", bestFor: "Conventional grid solar.", watchFor: "Normally stops in a blackout unless a separate approved backup architecture exists." },
      { name: "Hybrid inverter", description: "Combines PV, battery and grid functions in one platform.", bestFor: "Supported solar-plus-storage designs.", watchFor: "Hybrid does not guarantee every battery, zero-export mode or whole-home backup." },
      { name: "Battery inverter/charger", description: "Creates AC from a battery and charges it from an AC source; PV may use a separate controller or AC-coupled inverter.", bestFor: "Off-grid, backup, marine/mobile and AC-coupled systems.", watchFor: "Transfer, neutral/earth, generator and battery compatibility." },
      { name: "Microinverter", description: "Converts DC to AC at each module or small module group.", bestFor: "Module-level conversion and some complex roof layouts.", watchFor: "AC branch limits, rooftop service access and battery/backup architecture." }
    ],
    questions: [
      { question: "How large should the inverter be?", answer: "Use simultaneous continuous loads, motor/start surges, phase balance, temperature derating and future loads—not daily kWh alone." },
      { question: "Does any inverter work with any battery?", answer: "No. Check battery voltage, current, BMS communication, firmware and the manufacturer's supported compatibility list." },
      { question: "Where should it be mounted?", answer: "On a structure that carries its weight, in the required orientation with stated airflow/clearance, environmental protection, noise consideration and safe access. Local rules may restrict battery/electrical equipment locations." },
      { question: "Will it power the home when the grid fails?", answer: "Only if it supports backup/grid-forming operation and the transfer, protection, neutral/earth and selected-load arrangement is designed for that mode." }
    ]
  },
  protection: {
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
