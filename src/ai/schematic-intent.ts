const schematicSubject = /\b(?:schematic|wiring diagram|connection diagram)\b/i;
const createVerb = /\b(?:build|create|draw|make|provide|generate|give|show)\b/i;
const directNeed = /\b(?:i|we)\s+(?:need|want|would like)\b/i;
const missingCorrection = /\b(?:you (?:have not|haven't|did not|didn't) (?:build|built|create|created|make|made)|where is|no (?:schematic|diagram)|build one now|build one)\b/i;

export function requestsSchematicCreation(message: string, priorAssistantMessage = "") {
  const directRequest = schematicSubject.test(message) && (createVerb.test(message) || directNeed.test(message));
  const correction = missingCorrection.test(message) && schematicSubject.test(`${message} ${priorAssistantMessage}`);
  return directRequest || correction;
}

export function requestsCreatedSchematicLink(message: string) {
  return /^(?:can\s+i\s+have\s+the\s+)?(?:link|open(?:\s+it)?|show(?:\s+me)?|take\s+me\s+there)(?:\s+please)?[?.!]*$/i.test(message.trim())
    || /\b(?:give|send|share|show|post|provide)\b[\s\S]{0,50}\b(?:me\s+)?(?:the\s+)?(?:schematic\s+)?link\b/i.test(message)
    || /\b(?:open|view|go\s+to|take\s+me\s+to)\b[\s\S]{0,40}\b(?:created|saved|proposed|that|the|my)?\s*schematic\b/i.test(message)
    || /\b(?:link|page|schematic)\b[\s\S]{0,40}\b(?:does(?:n['’]?t| not) exist|not found|won['’]?t open|is broken|does(?:n['’]?t| not) work)\b/i.test(message);
}

export function nextNumberedName(prefix: "Site" | "System", names: string[]) {
  const used = new Set(names.map((name) => name.trim().toLocaleLowerCase()));
  let number = 1;
  while (used.has(`${prefix}${number}`.toLocaleLowerCase())) number += 1;
  return `${prefix}${number}`;
}

export function nextWattsonSchematicName(names: string[]) {
  const used = new Set(names.map((name) => name.trim().toLocaleLowerCase()));
  let number = 1;
  while (used.has(`wattson proposed schematic ${number}`)) number += 1;
  return `Wattson proposed schematic ${number}`;
}

export function conceptualPvArrays(text: string) {
  const arrayMatrix = text.match(/\b(\d{1,2})\s*[x×]\s*(\d{1,3})\s*(?:panels?\s*)?arrays?\b/i);
  if (arrayMatrix) {
    const arrayCount = Number(arrayMatrix[1]);
    const panelsPerArray = Number(arrayMatrix[2]);
    return { arrayCount, panelsPerArray, totalPanels: arrayCount * panelsPerArray };
  }
  const totalPanels = Number(text.match(/\b(\d{1,4})(?:\s*[x×]\s*\d{2,4}\s*w(?:att)?s?)?\s+(?:solar\s+)?panels?\b/i)?.[1] ?? 0) || undefined;
  const seriesParallel = text.match(/\b(\d+)S(\d+)P\b/i);
  if (seriesParallel) return { arrayCount: Number(seriesParallel[2]), panelsPerArray: Number(seriesParallel[1]), totalPanels };
  const parallelSeries = text.match(/\b(\d+)P(\d+)S\b/i);
  // Wattson's user-facing shorthand is "panels per string x string count".
  // The letters are retained because users commonly include them, but the
  // first number is the panels in each displayed string and the second is the
  // number of strings (for example 4P2S => two strings of four panels).
  if (parallelSeries) return { arrayCount: Number(parallelSeries[2]), panelsPerArray: Number(parallelSeries[1]), totalPanels };
  return { arrayCount: 1, panelsPerArray: totalPanels, totalPanels };
}

const quantityWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function requestedSchematicComponents(text: string) {
  const requested: Array<{ type: string; displayName: string; quantity: number }> = [];
  const add = (type: string, displayName: string, pattern: RegExp) => {
    const match = text.match(pattern);
    if (!match) return;
    const rawQuantity = match[1]?.toLocaleLowerCase();
    requested.push({ type, displayName, quantity: Number(rawQuantity) || quantityWords[rawQuantity] || 1 });
  };
  add("inverter", "Inverter", /\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?inverters?\b/i);
  add("battery", "Battery", /\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?batter(?:y|ies|ys|yes)\b/i);
  add("charger", "Solar charge controller", /\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(?:solar\s+)?(?:charge\s+)?controllers?\b/i);
  add("generator", "Generator", /\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?generators?\b/i);
  add("switchboard", "Switchboard", /\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?switchboards?\b/i);
  return requested;
}

export function explicitPanelWattage(text: string) {
  const panelFirst = text.match(/\bpanels?\s*(?:rated|at|of|=|:)?\s*(\d{2,4})\s*w(?:att)?s?\b/i);
  const compact = text.match(/\b\d{1,4}\s*[x×]\s*(\d{2,4})\s*w(?:att)?s?\s*(?:solar\s+)?panels?\b/i);
  const wattsFirst = text.match(/\b(\d{2,4})\s*w(?:att)?s?\s*(?:solar\s+)?panels?\b/i);
  return Number(panelFirst?.[1] ?? compact?.[1] ?? wattsFirst?.[1] ?? 0) || undefined;
}

export function explicitInverterMention(text: string) {
  const match = text.match(/\b(?:the\s+)?inverter\s+(?:is|is\s+a|is\s+an|=|:)\s+(?:a\s+|an\s+)?([\p{L}\p{N}-]+)(?:[^.\n]{0,40}?\b(\d+(?:\.\d+)?)\s*(k?w))?/iu);
  if (!match) return undefined;
  const value = match[2] ? Number(match[2]) : undefined;
  return { manufacturer: match[1], ratedPowerW: value ? value * (match[3]?.toLowerCase() === "kw" ? 1000 : 1) : undefined };
}

export function inverterClassFromEvidence(text: string) {
  if (/\bmicro[- ]?inverters?\b/i.test(text)) return "microinverter";
  if (/\bhybrid(?:\s+(?:solar|battery))?\s+inverter\b/i.test(text)) return "hybrid inverter";
  if (/\bstring\s+inverter\b/i.test(text)) return "string inverter";
  return undefined;
}

export function explicitInverterRatedPower(text: string) {
  const before = text.match(/\b(\d+(?:\.\d+)?)\s*(k?w)\b[^.\n,;]{0,35}\binverter\b/i);
  const after = text.match(/\binverter\b[^.\n,;]{0,35}\b(\d+(?:\.\d+)?)\s*(k?w)\b/i);
  const match = before ?? after;
  if (!match) return undefined;
  const value = Number(match[1]);
  return value * (match[2].toLocaleLowerCase() === "kw" ? 1000 : 1);
}

export function explicitBatteryDetails(text: string) {
  if (!/\bbatter(?:y|ies|ys|yes)\b/i.test(text)) return undefined;
  const voltage = text.match(/\b(\d+(?:\.\d+)?)\s*v\b/i);
  const capacity = text.match(/\b(\d+(?:\.\d+)?)\s*ah\b/i);
  const chemistry = /\bli\s*fe\s*(?:po|op)\s*4\b|\blfp\b/i.test(text) ? "LiFePO4"
    : /\blithium(?:-ion)?\b/i.test(text) ? "Lithium-ion"
    : /\bagm\b/i.test(text) ? "AGM"
    : /\bgel\b/i.test(text) ? "Gel"
    : undefined;
  return {
    voltageV: Number(voltage?.[1] ?? 0) || undefined,
    capacityAh: Number(capacity?.[1] ?? 0) || undefined,
    chemistry,
  };
}

export interface RequestedSchematicComponent {
  key: string;
  type: string;
  displayName: string;
  quantity: number;
  specifications: Record<string, string>;
}

export interface RequestedSchematicConnection {
  sourceKey: string;
  targetKey: string;
  name: string;
  polarity: "positive" | "negative" | "pair" | "na";
  connectionType?: "dc" | "ac" | "data";
  cableSizeMm2?: number;
  cableDescription?: string;
  protection?: string;
}

export interface RequestedPvArray {
  name: string;
  panelCount: number;
  panelWatts?: number;
  panelType?: string;
  cableSizeMm2?: number;
}

function requestedPvArrays(text: string): RequestedPvArray[] {
  const arrays: RequestedPvArray[] = [];
  const first = text.match(/\b(\d{1,4})\s*[x×]\s*(\d{2,4})\s*w\s+([^.;]*?)\bin\s+(\d{1,2})\s+strings?\s+of\s+(\d{1,3})\b([^.;]*)/i);
  if (first) {
    const total = Number(first[1]);
    const watts = Number(first[2]);
    const stringCount = Number(first[4]);
    const perString = Number(first[5]);
    const cable = Number(`${first[3]} ${first[6]}`.match(/\b(\d+(?:\.\d+)?)\s*mm(?:2|²)?\b/i)?.[1] ?? 0) || undefined;
    if (total === stringCount * perString) {
      for (let index = 0; index < stringCount; index += 1) arrays.push({ name: `PV${index + 1}`, panelCount: perString, panelWatts: watts, panelType: /bifacial/i.test(first[3]) ? "bifacial" : undefined, cableSizeMm2: cable });
    }
  }
  const labelled = /\bPV\s*(\d+)\s+(?:is|=|:)\s*(\d{1,4})\s*[x×]\s*(\d{2,4})\s*w\s*([^.;]*)/gi;
  for (const match of text.matchAll(labelled)) {
    const number = Number(match[1]);
    const tail = match[4];
    const array = { name: `PV${number}`, panelCount: Number(match[2]), panelWatts: Number(match[3]), panelType: /bifacial/i.test(tail) ? "bifacial" : undefined, cableSizeMm2: Number(tail.match(/\b(\d+(?:\.\d+)?)\s*mm(?:2|²)?\b/i)?.[1] ?? 0) || undefined };
    const existing = arrays.findIndex((item) => item.name === array.name);
    if (existing >= 0) arrays[existing] = array;
    else arrays.push(array);
  }
  return arrays.sort((a, b) => Number(a.name.slice(2)) - Number(b.name.slice(2)));
}

export function requestedSchematicPlan(text: string) {
  const arrays = requestedPvArrays(text);
  const conceptual = conceptualPvArrays(text);
  const pv = arrays.length ? {
    arrayCount: arrays.length,
    panelsPerArray: arrays.every((array) => array.panelCount === arrays[0].panelCount) ? arrays[0].panelCount : undefined,
    totalPanels: arrays.reduce((total, array) => total + array.panelCount, 0),
  } : conceptual;
  const panelWatts = explicitPanelWattage(text);
  const inverterClass = inverterClassFromEvidence(text);
  const inverterModel = text.match(/\b(SUN-[A-Z0-9-]+)\b/i)?.[1]?.toUpperCase();
  const modelRatedPowerW = Number(inverterModel?.match(/^SUN-(\d+(?:\.\d+)?)K-/i)?.[1] ?? 0) * 1000 || undefined;
  const inverterRatedPowerW = modelRatedPowerW ?? explicitInverterRatedPower(text);
  const inverterManufacturer = /\bDeye\b/i.test(text) ? "Deye" : undefined;
  const inverterPhase = /\bsingle[- ]phase\b/i.test(text) ? "Single-phase" : /\bthree[- ]phase\b/i.test(text) ? "Three-phase" : undefined;
  const mpptCount = Number(text.match(/\b(\d+)\s*MPPT\b/i)?.[1] ?? 0) || undefined;
  const generatorRatedKw = Number(text.match(/\b(\d+(?:\.\d+)?)\s*kW\s+(?:inverter|inverted)\s+generator\b/i)?.[1] ?? 0) || undefined;
  const battery = explicitBatteryDetails(text);
  const components: RequestedSchematicComponent[] = [];
  const add = (component: RequestedSchematicComponent) => components.push(component);

  for (const requested of requestedSchematicComponents(text)) {
    if (requested.type === "inverter") {
      add({
        key: "inverter",
        type: "inverter",
        displayName: `${inverterManufacturer ? `${inverterManufacturer} ` : ""}${inverterRatedPowerW ? `${inverterRatedPowerW / 1000} kW ` : ""}${inverterClass ?? "Inverter"}${inverterModel ? ` ${inverterModel}` : ""}`.replace(/\binverter inverter\b/i, "inverter").trim(),
        quantity: requested.quantity,
        specifications: {
          "Equipment class": inverterClass ?? "TBC",
          "Rated power": inverterRatedPowerW ? `${inverterRatedPowerW} W` : "TBC",
          ...(inverterModel ? { Model: inverterModel } : {}),
          ...(inverterPhase ? { Phase: inverterPhase } : {}),
          ...(mpptCount ? { "MPPT count": String(mpptCount) } : {}),
          ...(inverterManufacturer === "Deye" && inverterRatedPowerW === 10_000 && mpptCount === 3 ? { "Minimum battery cable": "95 mm² (manufacturer installation-manual value; verify exact model suffix and current manual)" } : {}),
        },
      });
    } else if (requested.type === "battery") {
      add({
        key: "battery",
        type: "battery",
        displayName: `${battery?.voltageV ? `${battery.voltageV} V ` : ""}${battery?.capacityAh ? `${battery.capacityAh} Ah ` : ""}${battery?.chemistry ? `${battery.chemistry} ` : ""}battery`.trim(),
        quantity: requested.quantity,
        specifications: {
          "Chemistry": battery?.chemistry ?? "TBC",
          "Nominal voltage": battery?.voltageV ? `${battery.voltageV} V` : "TBC",
          "Capacity": battery?.capacityAh ? `${battery.capacityAh} Ah` : "TBC",
        },
      });
    } else if (requested.type === "generator") {
      add({ key: "generator", type: "generator", displayName: generatorRatedKw ? `${generatorRatedKw} kW inverter generator` : "Generator", quantity: requested.quantity, specifications: { "Rated power": generatorRatedKw ? `${generatorRatedKw} kW` : "TBC", "Generator type": /\binvert(?:er|ed)\s+generator\b/i.test(text) ? "Inverter generator" : "TBC" } });
    } else {
      add({ key: requested.type, type: requested.type, displayName: requested.displayName, quantity: requested.quantity, specifications: { Rating: "TBC" } });
    }
  }

  const pvFusebox = text.match(/\bfuse\s*box\b[^.;]{0,80}?\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*A\s*(MCB|fuses?)?/i);
  const hasCombiner = /\bcombiner(?:\s+box)?\b/i.test(text) || Boolean(pvFusebox);
  if (hasCombiner) add({ key: "combiner", type: "combiner", displayName: pvFusebox ? `PV fusebox — ${pvFusebox[1]} × ${pvFusebox[2]} A ${pvFusebox[3]?.toUpperCase() ?? "devices"}` : "PV combiner box", quantity: 1, specifications: pvFusebox ? { "Input circuits": pvFusebox[1], "Branch protection": `${pvFusebox[2]} A ${pvFusebox[3]?.toUpperCase() ?? "device"}` } : { Rating: "TBC" } });

  const isolatorMention = text.match(/\b(?:(\d+)\s+)?isolators?\b|\b(?:(\d+)\s+)?disconnects?\b/i);
  const isolatorCount = isolatorMention
    ? Number(isolatorMention[1] ?? isolatorMention[2] ?? 0) || (/(?:isolators|disconnects)\b/i.test(isolatorMention[0]) ? Math.max(1, pv.arrayCount) : 1)
    : 0;
  for (let index = 0; index < isolatorCount; index += 1) {
    add({ key: `isolator-${index + 1}`, type: "isolator", displayName: `PV DC isolator ${index + 1}`, quantity: 1, specifications: { Rating: "TBC", "Protected string": `PV${index + 1}` } });
  }

  const hasMrbf = /\bMRBF\b/i.test(text);
  const hasFuse = /\bfused?\b|\bfuse\b/i.test(text) && !hasMrbf;
  if (hasFuse) add({ key: "battery-fuse", type: "protection", displayName: "Battery fuse", quantity: 1, specifications: { Rating: "TBC" } });

  const hasBusbar = /\bbus\s*bars?\b/i.test(text);
  if (hasBusbar) {
    add({ key: "positive-busbar", type: "connector", displayName: "Positive busbar", quantity: 1, specifications: { Polarity: "positive", Rating: "TBC" } });
    add({ key: "negative-busbar", type: "connector", displayName: "Negative busbar", quantity: 1, specifications: { Polarity: "negative", Rating: "TBC" } });
  }

  const detailedBattery = text.match(/\b(\d+)\s*[x×]\s*[^.;]{0,50}?\b(\d+(?:\.\d+)?)\s*v\s+(\d+(?:\.\d+)?)\s*ah\s+([^.;]{0,40}?)batter(?:y|ies)\b/i);
  if (detailedBattery && Number(detailedBattery[1]) > 1) {
    const genericIndex = components.findIndex((component) => component.key === "battery");
    if (genericIndex >= 0) components.splice(genericIndex, 1);
    const quantity = Number(detailedBattery[1]);
    const voltage = Number(detailedBattery[2]);
    const ampHours = Number(detailedBattery[3]);
    const chemistry = /life?po4|li\s*fe\s*po4|lfp/i.test(detailedBattery[4]) ? "LiFePO4" : battery?.chemistry ?? "TBC";
    for (let index = 0; index < quantity; index += 1) add({ key: `battery-${index + 1}`, type: "battery", displayName: `Battery ${index + 1} — ${voltage} V ${ampHours} Ah ${chemistry}`, quantity: 1, specifications: { Chemistry: chemistry, "Nominal voltage": `${voltage} V`, Capacity: `${ampHours} Ah`, "Parallel bank": `${quantity} matched batteries` } });
    if (hasMrbf) {
      const deye10kAm3 = inverterManufacturer === "Deye" && inverterRatedPowerW === 10_000 && mpptCount === 3;
      const inverterBatteryCurrent = deye10kAm3 ? 220 : undefined;
      const individualPlanningAmps = inverterBatteryCurrent ? 100 : undefined;
      for (let index = 0; index < quantity; index += 1) add({
        key: `battery-fuse-${index + 1}`,
        type: "protection",
        displayName: `Battery ${index + 1} MRBF fuse${individualPlanningAmps ? ` — ${individualPlanningAmps} A provisional` : ""}`,
        quantity: 1,
        specifications: {
          "AC / DC type": "DC",
          "Rated current": individualPlanningAmps ? `${individualPlanningAmps} A provisional` : "TBC — battery BMS and cable limits required",
          "Rated operational voltage": "At least 60 V DC; confirm the exact fuse and holder rating",
          "Fuse class / family": "MRBF",
          "Fuse holder / format": "MRBF terminal fuse / compatible covered holder",
          "Breaking / interrupt capacity": "TBC — calculate the prospective battery-bank fault current",
          "Circuit / equipment protected": `Battery ${index + 1} positive lead`,
          "Cable / terminal capacity": "TBC — record this battery lead size, insulation rating and terminal limits",
          ...(inverterBatteryCurrent ? { "Calculation basis": `${inverterBatteryCurrent} A inverter maximum battery current ÷ ${quantity} = ${(inverterBatteryCurrent / quantity).toFixed(1)} A ideal current share; 100 A is provisional only and must be coordinated with each battery BMS and cable` } : {}),
        },
      });
      add({
        key: "main-battery-fuse",
        type: "protection",
        displayName: `Positive busbar main MRBF fuse${deye10kAm3 ? " — 300 A manufacturer OCP basis" : ""}`,
        quantity: 1,
        specifications: {
          "AC / DC type": "DC",
          "Rated current": deye10kAm3 ? "300 A manufacturer DC over-current-device basis; verify MRBF fuse substitution" : "TBC",
          "Rated operational voltage": "At least 60 V DC; confirm the exact fuse and holder rating",
          "Fuse class / family": "MRBF requested — confirm suitability for the inverter manufacturer's required DC protection",
          "Fuse holder / format": "Covered MRBF holder rated for the selected fuse and conductors",
          "Breaking / interrupt capacity": "TBC — calculate the prospective battery-bank fault current",
          "Circuit / equipment protected": "Positive busbar-to-inverter battery feed",
          "Cable / terminal capacity": /\b4\s*AWG\b/i.test(text) ? "4 AWG recorded — does not match the Deye 10 kW AU manual's 4/0 AWG (95 mm²) battery-cable value; redesign/verify before use" : "TBC",
          ...(deye10kAm3 ? { "Manufacturer basis": "Deye SUN-10K-SG02LP1-AU-AM3 installation manual: 300 A battery DC breaker and 4/0 AWG (95 mm²) battery cable; verify the exact model suffix and current manual" } : {}),
        },
      });
    }
  }

  const acProtection = text.match(/\bAC\b[^.;]{0,100}?\b(\d+(?:\.\d+)?)\s*A\s+MCB\b/i);
  if (acProtection) add({ key: "inverter-ac-mcb", type: "protection", displayName: `${acProtection[1]} A inverter AC MCB`, quantity: 1, specifications: { Rating: `${acProtection[1]} A`, Circuit: "Inverter AC output" } });
  if (/\bhouse\s+switch\s*board|\bhouse\s+switchboard/i.test(text)) {
    const genericSwitchboard = components.findIndex((component) => component.key === "switchboard");
    if (genericSwitchboard >= 0) components.splice(genericSwitchboard, 1);
    add({ key: "house-switchboard", type: "switchboard", displayName: "House switchboard", quantity: 1, specifications: { Rating: "TBC" } });
  }
  const generatorProtection = text.match(/\bgenerator\b[^.;]{0,140}?\b(\d+(?:\.\d+)?)\s*A\s+(?:(?:wi[- ]?fi)(?:\s+type)?\s+)?MCB/i);
  if (generatorProtection) add({ key: "generator-mcb", type: "protection", displayName: `${generatorProtection[1]} A generator Wi-Fi MCB`, quantity: 1, specifications: { "Schematic image": "/schematic-components/ac-circuit-breaker-mcb.jpg", "AC / DC type": "AC", Rating: `${generatorProtection[1]} A`, Circuit: "Generator input" } });
  const monitor = text.match(/\b(?:managed|monitored|monitoring)\b[^.;]{0,100}?\b(?:by\s+)?(?:a\s+)?([\p{L}\p{N}-]+)\s+([\p{L}\p{N}-]+)\s+coulometer\b/iu);
  if (monitor) add({ key: "battery-monitor", type: "monitoring", displayName: `${monitor[1]} ${monitor[2]} coulometer`, quantity: 1, specifications: { Function: "Battery monitoring", "Measurement input": "Negative-side battery shunt", Communications: "Data/communications link to inverter — protocol and terminals to verify" } });

  const connections: RequestedSchematicConnection[] = [];
  const connect = (sourceKey: string | undefined, targetKey: string | undefined, name: string, polarity: RequestedSchematicConnection["polarity"] = "pair", detail: Partial<RequestedSchematicConnection> = {}) => {
    if (sourceKey && targetKey) connections.push({ sourceKey, targetKey, name, polarity, ...detail });
  };
  const hasInverter = components.some((component) => component.key === "inverter");
  for (let index = 0; index < pv.arrayCount; index += 1) {
    const isolatorKey = components.some((component) => component.key === `isolator-${index + 1}`) ? `isolator-${index + 1}` : undefined;
    const requestedArray = arrays[index];
    const cable = requestedArray?.cableSizeMm2;
    connect(`pv-${index + 1}`, isolatorKey ?? (hasCombiner ? "combiner" : hasInverter ? "inverter" : undefined), `PV${index + 1} DC`, "pair", cable ? { cableSizeMm2: cable, cableDescription: `${cable} mm² PV cable` } : {});
    connect(isolatorKey, hasCombiner ? "combiner" : hasInverter ? "inverter" : undefined, `PV${index + 1} isolated DC`);
  }
  if (pvFusebox && hasInverter) {
    arrays.forEach((array, index) => connect("combiner", "inverter", `PV${index + 1} fusebox output`, "pair", {
      cableSizeMm2: array.cableSizeMm2,
      cableDescription: array.cableSizeMm2 ? `${array.cableSizeMm2} mm² PV DC positive/negative pair` : "PV DC positive/negative cable pair",
      protection: `${pvFusebox[2]} A DC MCB — branch ${index + 1} of ${pvFusebox[1]}`,
    }));
  } else {
    connect(hasCombiner ? "combiner" : undefined, hasInverter ? "inverter" : undefined, "Combined PV DC");
  }

  const detailedBatteries = components.filter((component) => /^battery-\d+$/.test(component.key));
  const hasBattery = components.some((component) => component.key === "battery");
  if (detailedBatteries.length && hasBusbar) {
    detailedBatteries.forEach((component, index) => {
      const fuseKey = components.some((item) => item.key === `battery-fuse-${index + 1}`) ? `battery-fuse-${index + 1}` : undefined;
      connect(component.key, fuseKey ?? "positive-busbar", `Battery ${index + 1} positive`, "positive", { protection: fuseKey ? "Individual MRBF fuse" : undefined });
      connect(fuseKey, "positive-busbar", `Battery ${index + 1} fused positive`, "positive");
      connect(component.key, "negative-busbar", `Battery ${index + 1} negative`, "negative");
    });
    connect("positive-busbar", components.some((item) => item.key === "main-battery-fuse") ? "main-battery-fuse" : hasInverter ? "inverter" : undefined, "Positive busbar output", "positive");
    connect(components.some((item) => item.key === "main-battery-fuse") ? "main-battery-fuse" : undefined, hasInverter ? "inverter" : undefined, "Fused positive busbar to inverter", "positive", /\b4\s*AWG\b/i.test(text) ? { cableDescription: "4 AWG battery cable", protection: "Main MRBF fuse" } : {});
    connect("negative-busbar", hasInverter ? "inverter" : undefined, "Negative busbar to inverter", "negative", /\b4\s*AWG\b/i.test(text) ? { cableDescription: "4 AWG battery cable" } : {});
  }
  if (hasBattery && hasBusbar) {
    connect("battery", hasFuse ? "battery-fuse" : "positive-busbar", "Battery positive", "positive");
    connect(hasFuse ? "battery-fuse" : undefined, "positive-busbar", "Fused battery positive", "positive");
    connect("battery", "negative-busbar", "Battery negative", "negative");
    connect("positive-busbar", hasInverter ? "inverter" : undefined, "Positive busbar to inverter", "positive");
    connect("negative-busbar", hasInverter ? "inverter" : undefined, "Negative busbar to inverter", "negative");
  } else if (hasBattery) {
    connect("battery", hasFuse ? "battery-fuse" : hasInverter ? "inverter" : undefined, "Battery DC");
    connect(hasFuse ? "battery-fuse" : undefined, hasInverter ? "inverter" : undefined, "Fused battery DC");
  }

  if (components.some((component) => component.key === "inverter-ac-mcb")) {
    const acCable = Number(text.match(/\bAC\b[^.;]{0,80}?\b(\d+(?:\.\d+)?)\s*mm(?:2|²)?\b/i)?.[1] ?? 0) || undefined;
    connect("inverter", "inverter-ac-mcb", "Inverter AC output", "pair", { connectionType: "ac", cableSizeMm2: acCable, protection: `${acProtection?.[1]} A MCB` });
    connect("inverter-ac-mcb", components.some((component) => component.key === "house-switchboard") ? "house-switchboard" : undefined, "Protected AC feed to house switchboard", "pair", { connectionType: "ac", cableSizeMm2: acCable });
  }
  if (components.some((component) => component.key === "generator")) {
    connect("generator", components.some((component) => component.key === "generator-mcb") ? "generator-mcb" : "inverter", "Generator AC feed", "pair", { connectionType: "ac", protection: generatorProtection ? `${generatorProtection[1]} A Wi-Fi MCB` : undefined });
    connect(components.some((component) => component.key === "generator-mcb") ? "generator-mcb" : undefined, "inverter", "Protected generator input", "pair", { connectionType: "ac" });
  }
  if (components.some((component) => component.key === "battery-monitor")) connect("battery-monitor", "inverter", "Coulometer communications", "na", { connectionType: "data", cableDescription: "Blue data/communications cable; protocol, pinout and termination to verify" });

  return { pv: { ...pv, panelWatts: arrays[0]?.panelWatts ?? panelWatts }, arrays, components, connections };
}
