import type { ComponentSpec, SystemConnection } from "@/domain/models";

export const COMPONENT_REGULATORY_LIBRARY_VERSION = 1;

export type RegulatoryTopic = {
  id: string;
  title: string;
  purpose: string;
  requiredFacts?: string[];
  relatedKinds?: ComponentSpec["kind"][];
  conditional?: boolean;
};

export type ManufacturerRequirement = {
  id: string;
  title: string;
  purpose: string;
};

export type ComponentRegulatoryDefinition = {
  label: string;
  topics: RegulatoryTopic[];
  manufacturerRequirements: ManufacturerRequirement[];
};

export type ResolvedRegulatoryTopic = RegulatoryTopic & {
  missingFacts: string[];
  relatedEquipment: string[];
};

export type ComponentRegulatoryBundle = {
  libraryVersion: number;
  componentKind: ComponentSpec["kind"];
  componentLabel: string;
  jurisdiction: { confirmed: boolean; label?: string };
  appliesHere: ResolvedRegulatoryTopic[];
  mayApply: ResolvedRegulatoryTopic[];
  manufacturerRequirements: ManufacturerRequirement[];
  contextNote: string;
};

const topic = (
  id: string,
  title: string,
  purpose: string,
  options: Pick<RegulatoryTopic, "requiredFacts" | "relatedKinds" | "conditional"> = {},
): RegulatoryTopic => ({ id, title, purpose, ...options });

const maker = (id: string, title: string, purpose: string): ManufacturerRequirement => ({ id, title, purpose });

const commonProduct = topic(
  "product-approval",
  "Product approval and certification",
  "Confirm the exact product and markings are accepted for this use in the Site jurisdiction.",
  { requiredFacts: ["manufacturer", "model"] },
);
const commonEnvironment = topic(
  "mounting-environment",
  "Mounting location and environment",
  "Check permitted locations, enclosure rating, weather, heat, moisture, impact, access and service clearances.",
  { requiredFacts: ["installation location"] },
);
const commonWork = topic(
  "work-inspection-documentation",
  "Installation, inspection and records",
  "Identify who may perform the work and what permits, inspections, tests, certificates and as-built records are required.",
);
const commonIdentification = topic(
  "identification-labelling",
  "Identification, warnings and shutdown information",
  "Check the labels, diagrams, warning notices and emergency information required for this equipment and its circuits.",
);
const exactInstructions = maker(
  "manufacturer-installation-instructions",
  "Installation instructions",
  "The exact manual controls orientation, support, clearances, environment, fasteners, terminals and commissioning where it is more restrictive than general guidance.",
);
const exactLimits = maker(
  "manufacturer-operating-limits",
  "Electrical and operating limits",
  "Use the exact voltage, current, temperature, duty, protection and compatibility limits from the product documentation.",
);
const exactMaintenance = maker(
  "manufacturer-inspection-maintenance",
  "Inspection and maintenance",
  "Retain required torque checks, replacement parts, service intervals, firmware notices and warranty conditions separately from legal requirements.",
);

const generic: ComponentRegulatoryDefinition = {
  label: "Electrical equipment",
  topics: [
    commonProduct,
    topic("circuit-rating", "Circuit rating and protection", "Confirm voltage, current, fault duty, conductor capacity, isolation and protective-device coordination.", { requiredFacts: ["rated voltage", "rated current"] }),
    commonEnvironment,
    topic("earthing-bonding", "Earthing, bonding and touch protection", "Resolve exposed conductive parts, protective conductors, fault paths and guarding for the actual supply arrangement."),
    commonIdentification,
    commonWork,
  ],
  manufacturerRequirements: [exactInstructions, exactLimits, exactMaintenance],
};

export const COMPONENT_REGULATORY_LIBRARY: Record<ComponentSpec["kind"], ComponentRegulatoryDefinition> = {
  panel: {
    label: "PV module or array",
    topics: [
      commonProduct,
      topic("pv-string-limits", "String voltage, current and over-current protection", "Check cold-condition maximum voltage, operating window, current, parallel-string effects and any required string protection.", { requiredFacts: ["panel Voc", "panel Vmp", "panel Isc", "panel Imp", "panels in series", "parallel strings"], relatedKinds: ["inverter", "charger", "combiner", "protection"] }),
      topic("pv-mounting-structure", "Mounting structure, wind and roof loading", "Check the mounting system, fixing zones, corrosion compatibility, wind actions, structural capacity and waterproofing.", { requiredFacts: ["installation location", "mounting system", "module dimensions"] }),
      topic("pv-setbacks-access", "Setbacks, fire access and service pathways", "Check edge, ridge, opening, fire-service and maintenance access requirements for the actual building and array position.", { requiredFacts: ["installation location", "array layout"], conditional: true }),
      topic("pv-cable-connectors", "PV cable, connectors and routing", "Check cable approvals, current capacity, voltage drop, UV and mechanical protection, connector mating, support and route segregation.", { relatedKinds: ["cable", "connector", "isolator", "combiner"] }),
      topic("pv-isolation-shutdown", "Isolation and emergency shutdown", "Resolve required isolation, disconnecting means, rapid-shutdown or emergency procedures and their accessible locations.", { relatedKinds: ["isolator", "inverter", "combiner"], conditional: true }),
      topic("pv-earthing", "Module and mounting-system earthing or bonding", "Check whether frames and rails require bonding, conductor sizing, connection methods and continuity testing.", { relatedKinds: ["cable", "connector"] }),
      commonIdentification,
      commonWork,
    ],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("module-clamping", "Clamping and support zones", "Use the module and mounting-system instructions for permitted clamp zones, orientation, fasteners and loads."), exactMaintenance],
  },
  pv_string: undefined as never,
  battery: {
    label: "Battery or battery bank",
    topics: [
      commonProduct,
      topic("battery-location", "Permitted location, separation and access", "Check habitable-space, escape-route, ignition-source, property-boundary, equipment and access restrictions for the chemistry and energy capacity.", { requiredFacts: ["installation location", "chemistry", "energy capacity"] }),
      topic("battery-enclosure", "Enclosure, weather, impact and thermal conditions", "Resolve enclosure construction, ingress protection, mechanical protection, temperature, sunlight, flooding and fire exposure.", { requiredFacts: ["installation location", "enclosure rating", "temperature limits"] }),
      topic("battery-ventilation-fire", "Ventilation, gases, thermal event and emergency response", "Check chemistry-specific ventilation, gas or thermal-event provisions, detection, separation and emergency information.", { requiredFacts: ["chemistry"], conditional: true }),
      topic("battery-fault-protection", "Fault-current protection, isolation and conductor coordination", "Check fuse or breaker class and duty, disconnect location, cable protection, busbar guarding and prospective fault current.", { requiredFacts: ["maximum continuous current", "prospective fault current"], relatedKinds: ["protection", "isolator", "cable", "connector", "inverter"] }),
      topic("battery-bms-compatibility", "BMS, inverter and communications compatibility", "Verify charge and discharge limits, contactors, pre-charge, shutdown behaviour and required communications across the exact products.", { requiredFacts: ["chemistry", "BMS model", "manufacturer", "model"], relatedKinds: ["inverter", "charger", "monitoring"] }),
      topic("battery-earthing", "Earthing, bonding and DC isolation arrangement", "Resolve enclosure bonding, grounded or floating conductors, insulation monitoring and interaction with the inverter arrangement.", { relatedKinds: ["inverter", "charger", "cable"] }),
      commonIdentification,
      commonWork,
    ],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("battery-bms-manual", "BMS and emergency instructions", "Use the exact battery and BMS documents for permitted series/parallel arrangements, communications, shutdown, reset and incident response."), exactMaintenance],
  },
  inverter: {
    label: "Inverter or inverter/charger",
    topics: [
      commonProduct,
      topic("inverter-grid-approval", "Grid connection, anti-islanding and export control", "For grid-connected equipment, check approved-product lists, network permission, protection settings, export limits and commissioning evidence.", { relatedKinds: ["meter", "protection"], conditional: true }),
      topic("inverter-location", "Mounting location, clearances and environment", "Check prohibited locations, working space, ventilation, heat, weather, combustibles, noise and access.", { requiredFacts: ["installation location", "manufacturer", "model"] }),
      topic("inverter-dc-input", "PV and battery input compatibility", "Verify every DC input voltage/current window, string arrangement, polarity, battery range, current and BMS requirements.", { relatedKinds: ["panel", "pv_string", "battery", "charger", "combiner"] }),
      topic("inverter-ac-protection", "AC isolation, protection and supply arrangement", "Check conductor sizing, over-current and residual-current protection, isolation, fault level, phase arrangement and connection point.", { requiredFacts: ["rated power"], relatedKinds: ["protection", "isolator", "cable"] }),
      topic("inverter-neutral-earth", "Neutral, earthing, bonding and backup mode", "Resolve neutral switching, protective-earth continuity, fault paths and islanded or backup-supply behaviour.", { relatedKinds: ["generator", "protection", "connector"] }),
      commonIdentification,
      commonWork,
    ],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("inverter-settings", "Required settings and firmware", "Use the approved firmware, grid profile, battery profile, export controls and commissioning sequence for the exact model."), exactMaintenance],
  },
  charger: {
    label: "Charge controller or charger",
    topics: [commonProduct, topic("charger-input", "Input source limits and protection", "Check source voltage/current, conductor protection, disconnecting means and fault duty.", { relatedKinds: ["panel", "pv_string", "generator", "protection", "isolator"] }), topic("charger-output", "Battery output, cable and protection", "Check charge current, cable capacity, protection placement and battery/BMS compatibility.", { relatedKinds: ["battery", "cable", "protection", "connector"] }), commonEnvironment, topic("charger-earthing", "Earthing, isolation and conductor arrangement", "Resolve galvanic isolation, grounded conductors, bonding and touch protection for the complete source-to-battery path."), commonIdentification, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("charger-profile", "Battery charge profile", "Use the battery-approved voltage, current, temperature compensation and communications settings."), exactMaintenance],
  },
  generator: {
    label: "Generator",
    topics: [commonProduct, topic("generator-location", "Location, exhaust, fuel, noise and weather", "Check exhaust clearances, ventilation, fire and fuel controls, noise, weather protection and safe access.", { requiredFacts: ["installation location", "fuel type"] }), topic("generator-transfer", "Transfer, interlocking and backfeed prevention", "Require a defined changeover arrangement that prevents unintended parallel sources and dangerous backfeed.", { relatedKinds: ["inverter", "protection", "isolator"] }), topic("generator-neutral-earth", "Neutral and earthing arrangement", "Resolve switched neutral, bonding point, protective conductors and fault protection in every operating mode."), topic("generator-rating", "Voltage, frequency, waveform and load duty", "Verify continuous and surge capability and compatibility with the receiving inverter, transfer equipment or switchboard.", { requiredFacts: ["rated power", "nominal voltage", "frequency"], relatedKinds: ["inverter", "load"] }), commonIdentification, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("generator-service", "Fuel, exhaust and service instructions", "Use the engine and alternator instructions for fuel storage, exhaust, maintenance, cooling and operating environment."), exactMaintenance],
  },
  protection: {
    label: "Fuse, breaker or protective device",
    topics: [commonProduct, topic("protection-device-class", "Correct AC/DC device class and utilisation", "Confirm the device is designed to interrupt the real current type, voltage, time-current duty and load.", { requiredFacts: ["AC / DC type", "rated operational voltage", "rated current", "utilisation / switching category"] }), topic("protection-fault-duty", "Breaking capacity and prospective fault current", "The interrupt rating must exceed the credible fault current from batteries, generators, grid and parallel sources.", { requiredFacts: ["breaking / interrupt rating", "prospective fault current"], relatedKinds: ["battery", "generator", "inverter"] }), topic("protection-coordination", "Cable, equipment and upstream/downstream coordination", "Check conductor capacity, equipment limits, selectivity, backup protection and all sources that can energise the circuit.", { requiredFacts: ["circuit / equipment protected", "cable / terminal capacity"], relatedKinds: ["cable", "battery", "inverter", "generator"] }), topic("protection-placement", "Required placement, accessibility and isolation", "Check how close protection must be to the source, conductor exposure before it, accessibility, guarding and safe replacement.", { requiredFacts: ["installation location", "connected from / upstream device", "connected to / downstream device"] }), commonIdentification, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("protection-coordination-data", "Time-current and coordination data", "Use the maker's curves, derating, mounting, terminal, fuse-holder and approved accessory data."), exactMaintenance],
  },
  isolator: {
    label: "Isolator or disconnect",
    topics: [commonProduct, topic("isolator-duty", "AC/DC switching duty and rating", "Confirm operational voltage, current, poles, load-break duty and utilisation category for the actual circuit.", { requiredFacts: ["AC / DC type", "rated operational voltage", "rated current", "number of poles", "utilisation / switching category"] }), topic("isolator-location", "Location, accessibility and emergency operation", "Check required proximity, line of sight, access, lockability, weather protection and emergency use.", { requiredFacts: ["installation location", "lockable in OFF position"] }), topic("isolator-conductors", "Conductors switched and circuit identification", "Resolve every live conductor that must be disconnected, neutral treatment, polarity, source direction and labels.", { requiredFacts: ["circuit / equipment isolated", "connected from / upstream device", "connected to / downstream device"] }), topic("isolator-enclosure", "Enclosure, entries and terminal capacity", "Check ingress, UV and impact ratings, gland compatibility, conductor capacity and temperature rise.", { requiredFacts: ["enclosure / IP rating", "cable / terminal capacity"] }), commonIdentification, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("isolator-switching", "Switching and lockout instructions", "Use the exact product instructions for switching frequency, lockout, polarity, mounting orientation and terminal torque."), exactMaintenance],
  },
  cable: {
    label: "Cable or conductor run",
    topics: [commonProduct, topic("cable-capacity", "Current capacity and derating", "Calculate capacity for conductor material, insulation, installation method, ambient temperature, grouping and thermal insulation.", { requiredFacts: ["conductor size", "cable type", "installation method", "route length"] }), topic("cable-voltage-drop", "Voltage drop and operating performance", "Check permitted voltage drop and the equipment's minimum/maximum operating voltage over the full route.", { requiredFacts: ["route length", "current", "nominal voltage"] }), topic("cable-fault-protection", "Fault protection and withstand", "Coordinate upstream protection, fault-loop or DC fault behaviour, short-circuit withstand and disconnection time.", { relatedKinds: ["protection", "battery", "inverter", "generator"] }), topic("cable-route", "Route, support and mechanical/environmental protection", "Check burial, support spacing, bend radius, UV, water, heat, impact, penetrations, fire stopping and access.", { requiredFacts: ["installation location", "route"] }), topic("cable-segregation", "Segregation and identification", "Keep incompatible voltage, data, safety and energy-source circuits separated or partitioned and correctly identified.", { relatedKinds: ["monitoring", "connector"] }), topic("cable-termination", "Entries, terminals and terminations", "Check glands, lugs, connector compatibility, strand preparation, conductor support and terminal capacity.", { relatedKinds: ["connector"] }), commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("cable-installation-data", "Cable installation data", "Use the cable maker's bend radius, pulling tension, support, gland, temperature and environmental data."), exactMaintenance],
  },
  connector: {
    label: "Connector, terminal or busbar",
    topics: [commonProduct, topic("connector-compatibility", "Matched connector and terminal system", "Confirm mating parts, conductor range, tools and accessories are from a documented compatible system.", { requiredFacts: ["manufacturer", "model", "conductor size"] }), topic("connector-rating", "Voltage, current, temperature and fault duty", "Check continuous current, temperature rise, voltage, short-circuit withstand and source fault current.", { requiredFacts: ["rated voltage", "rated current"], relatedKinds: ["battery", "inverter", "generator", "protection"] }), topic("connector-guarding", "Guarding, enclosure and access", "Protect live parts against touch, tools, dropped objects, moisture, contamination and unauthorised access.", { requiredFacts: ["installation location", "enclosure rating"] }), topic("connector-mounting", "Mounting, support and conductor strain", "Check secure support, spacing, polarity separation, conductor restraint, covers and service access."), topic("connector-protection", "Upstream protection and conductor coordination", "Ensure each connected source and outgoing conductor has the required protection and isolation.", { relatedKinds: ["protection", "isolator", "cable"] }), commonIdentification, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("connector-termination", "Termination and torque", "Use the exact strip length, crimp tool and die, lug, washer stack, torque, re-torque and cover instructions."), exactMaintenance],
  },
  combiner: {
    label: "PV combiner box",
    topics: [commonProduct, topic("combiner-inputs", "String inputs and over-current protection", "Check the number of parallel strings, reverse-current exposure, fuse requirements, polarity and conductor capacity.", { requiredFacts: ["number of strings", "maximum voltage", "maximum current"], relatedKinds: ["panel", "pv_string", "protection"] }), topic("combiner-isolation", "Isolation, switching and fault duty", "Check whether the enclosure incorporates or requires a load-break disconnect and the DC fault duty of every device.", { relatedKinds: ["isolator", "protection", "inverter"] }), topic("combiner-enclosure", "Enclosure, entries, drainage and environment", "Check IP rating, UV, heat, condensation, cable entries, accessibility and mounting location.", { requiredFacts: ["installation location", "enclosure rating"] }), topic("combiner-spd", "Surge protection and earthing", "Determine whether surge protection is required and coordinate its location, voltage rating, leads and earthing path.", { conditional: true }), commonIdentification, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("combiner-components", "Internal component and enclosure limits", "Use the assembled enclosure's approved device, busbar, terminal, thermal and cable-entry instructions."), exactMaintenance],
  },
  meter: {
    label: "Electrical or energy meter",
    topics: [commonProduct, topic("meter-authority", "Ownership, approval and permitted access", "Determine whether the meter is revenue, network, tenant or private equipment and who may install, seal, configure or access it.", { requiredFacts: ["meter purpose", "installation location"] }), topic("meter-connection", "Connection method and circuit rating", "Check direct-connected or CT arrangement, voltage, current, fault duty, protection and isolation.", { relatedKinds: ["protection", "cable", "connector"] }), topic("meter-ct", "CT selection, orientation and secondary safety", "Confirm CT ratio/class, conductor direction, phase mapping, shorting/test facilities and safe secondary wiring.", { conditional: true }), topic("meter-data", "Data, privacy and communications", "Check data ownership, consent, retention, communications security and utility requirements.", { relatedKinds: ["monitoring"], conditional: true }), commonIdentification, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("meter-configuration", "Meter configuration", "Use the exact wiring diagram, CT ratio, phase mapping, firmware and commissioning checks."), exactMaintenance],
  },
  monitoring: {
    label: "Monitoring or communications equipment",
    topics: [commonProduct, topic("monitoring-supply", "Power supply and circuit connection", "Check power source, isolation, over-current protection and safe connection to measured circuits.", { relatedKinds: ["protection", "meter", "cable"] }), topic("monitoring-segregation", "Electrical segregation and sensor installation", "Check CTs, voltage taps, communications cable separation, enclosure and access requirements.", { relatedKinds: ["meter", "cable"] }), topic("monitoring-data", "Data privacy, connectivity and cyber security", "Check account control, cloud region, permissions, retention, remote access, updates and loss-of-service behaviour."), commonEnvironment, commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("monitoring-platform", "Platform and firmware support", "Use supported firmware, network security settings, account ownership and documented sensor orientation."), exactMaintenance],
  },
  load: {
    label: "Electrical load or appliance",
    topics: [commonProduct, topic("load-supply", "Supply, circuit and starting duty", "Check voltage, current, phase, continuous duty, starting current and whether a dedicated circuit is required.", { requiredFacts: ["rated power", "nominal voltage"], relatedKinds: ["inverter", "generator", "protection", "cable"] }), commonEnvironment, topic("load-isolation", "Isolation and emergency switching", "Check required local isolation, emergency stopping, lockout and accessibility for fixed or hazardous loads.", { relatedKinds: ["isolator", "protection"], conditional: true }), topic("load-special-location", "Special-location requirements", "Wet, medical, agricultural, vehicle, pool, explosive or public locations can add equipment, protection and mounting rules.", { requiredFacts: ["installation location"], conditional: true }), commonWork],
    manufacturerRequirements: [exactInstructions, exactLimits, maker("load-duty", "Duty and control requirements", "Use the exact startup, operating cycle, supply quality, control and maintenance instructions."), exactMaintenance],
  },
  other: generic,
};

COMPONENT_REGULATORY_LIBRARY.pv_string = COMPONENT_REGULATORY_LIBRARY.panel;

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function componentHasFact(component: ComponentSpec, fact: string) {
  const target = normalized(fact);
  if (target === "manufacturer") return Boolean(component.manufacturer?.trim());
  if (target === "model") return Boolean(component.model?.trim());
  if (target === "installation location") return Boolean(component.location?.trim());
  const entries = Object.entries(component.specs);
  return entries.some(([key, value]) => {
    const normalizedKey = normalized(key);
    return (normalizedKey.includes(target) || target.includes(normalizedKey)) && String(value).trim().length > 0;
  });
}

export function regulatoryDefinitionForKind(kind: ComponentSpec["kind"]) {
  return COMPONENT_REGULATORY_LIBRARY[kind] ?? generic;
}

export function resolveComponentRegulatoryBundle({
  component,
  siteLocation,
  siteLocationConfirmed,
  relatedComponents = [],
  connections = [],
}: {
  component: ComponentSpec;
  siteLocation?: string;
  siteLocationConfirmed: boolean;
  relatedComponents?: ComponentSpec[];
  connections?: SystemConnection[];
}): ComponentRegulatoryBundle {
  const definition = regulatoryDefinitionForKind(component.kind);
  const connectedRefs = new Set(
    connections
      .filter((connection) => connection.sourceRef === component.id || connection.targetRef === component.id)
      .flatMap((connection) => [connection.sourceRef, connection.targetRef]),
  );
  const resolve = (candidate: RegulatoryTopic): ResolvedRegulatoryTopic => ({
    ...candidate,
    missingFacts: (candidate.requiredFacts ?? []).filter((fact) => !componentHasFact(component, fact)),
    relatedEquipment: relatedComponents
      .filter((related) => related.id !== component.id && (candidate.relatedKinds?.includes(related.kind) || connectedRefs.has(related.id)))
      .map((related) => related.name),
  });
  const resolved = definition.topics.map(resolve);
  return {
    libraryVersion: COMPONENT_REGULATORY_LIBRARY_VERSION,
    componentKind: component.kind,
    componentLabel: definition.label,
    jurisdiction: siteLocationConfirmed && siteLocation?.trim()
      ? { confirmed: true, label: siteLocation.trim() }
      : { confirmed: false },
    appliesHere: resolved.filter((candidate) => !candidate.conditional),
    mayApply: resolved.filter((candidate) => candidate.conditional),
    manufacturerRequirements: definition.manufacturerRequirements,
    contextNote: siteLocationConfirmed && siteLocation?.trim()
      ? "The library identifies the subjects to resolve. Cached jurisdiction guidance and cited official sources provide the current local detail; neither replaces the exact product instructions or an installation-specific compliance decision."
      : "No Site jurisdiction is confirmed. These are internationally neutral subjects to check; PVIntell will not select a country's rules until the Site location is confirmed.",
  };
}

export function compactRegulatoryTopicsForComponents(components: ComponentSpec[]) {
  return Array.from(new Set(components.map((component) => component.kind))).map((kind) => {
    const definition = regulatoryDefinitionForKind(kind);
    return {
      componentKind: kind,
      label: definition.label,
      topicIds: definition.topics.map((candidate) => candidate.id),
      topics: definition.topics.map((candidate) => candidate.title),
      manufacturerTopics: definition.manufacturerRequirements.map((candidate) => candidate.title),
      libraryVersion: COMPONENT_REGULATORY_LIBRARY_VERSION,
    };
  });
}

export function regulatoryJurisdictionKey(location: string) {
  return normalized(location).slice(0, 240);
}

export function regulatorySubjectKey(component: Pick<ComponentSpec, "kind" | "name" | "specs">) {
  const identity = normalized(`${component.name} ${Object.keys(component.specs).join(" ")}`);
  if (component.kind === "cable" && /\b(?:underground|buried|trench)\b/.test(identity)) return "cable:underground";
  if (component.kind === "protection" && /\bbatter/.test(identity) && /\bfuse\b/.test(identity)) return "protection:battery-fuse";
  if (component.kind === "protection" && /\bpv\b|\bsolar\b/.test(identity)) return "protection:pv";
  if (component.kind === "isolator" && /\bpv\b|\bsolar\b/.test(identity)) return "isolator:pv-dc";
  if (component.kind === "connector" && /\bbusbar\b/.test(identity)) return "connector:busbar";
  return `${component.kind}:general`;
}

export function componentKindForGuide(guide: { id: string; group: string; title: string }): ComponentSpec["kind"] {
  const identity = normalized(`${guide.id} ${guide.group} ${guide.title}`);
  if (/\b(?:isolator|disconnect)\b/.test(identity)) return "isolator";
  if (/\b(?:fuse|breaker|protection|surge|rcd)\b/.test(identity)) return "protection";
  if (/\b(?:connector|terminal|lug|busbar|crimp|gland)\b/.test(identity)) return "connector";
  if (/\b(?:combiner|string)\b/.test(identity)) return "combiner";
  if (/\b(?:cable|conductor|wiring|trench|underground)\b/.test(identity)) return "cable";
  if (/\b(?:battery|bms)\b/.test(identity)) return "battery";
  if (/\b(?:inverter|microinverter|optimiser)\b/.test(identity)) return "inverter";
  if (/\b(?:controller|charger|mppt)\b/.test(identity)) return "charger";
  if (/\bgenerator\b/.test(identity)) return "generator";
  if (/\b(?:meter|ct)\b/.test(identity)) return "meter";
  if (/\b(?:panel|module|array|mount|roof|rail|clamp)\b/.test(identity)) return "panel";
  return "other";
}
