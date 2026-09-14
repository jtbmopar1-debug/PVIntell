const schematicSubject = /\b(?:schematic|wiring diagram|connection diagram)\b/i;
const createVerb = /\b(?:build|create|draw|make|provide|generate|give|show)\b/i;
const directNeed = /\b(?:i|we)\s+(?:need|want|would like)\b/i;
const missingCorrection = /\b(?:you (?:have not|haven't|did not|didn't) (?:build|built|create|created|make|made)|where is|no (?:schematic|diagram)|build one now|build one)\b/i;

export function requestsSchematicCreation(message: string, priorAssistantMessage = "") {
  const directRequest = schematicSubject.test(message) && (createVerb.test(message) || directNeed.test(message));
  const correction = missingCorrection.test(message) && schematicSubject.test(`${message} ${priorAssistantMessage}`);
  return directRequest || correction;
}

export function nextNumberedName(prefix: "Site" | "System", names: string[]) {
  const used = new Set(names.map((name) => name.trim().toLocaleLowerCase()));
  let number = 1;
  while (used.has(`${prefix}${number}`.toLocaleLowerCase())) number += 1;
  return `${prefix}${number}`;
}

export function conceptualPvArrays(text: string) {
  const arrayMatrix = text.match(/\b(\d{1,2})\s*[x×]\s*(\d{1,3})\s*(?:panels?\s*)?arrays?\b/i);
  if (arrayMatrix) {
    const arrayCount = Number(arrayMatrix[1]);
    const panelsPerArray = Number(arrayMatrix[2]);
    return { arrayCount, panelsPerArray, totalPanels: arrayCount * panelsPerArray };
  }
  const totalPanels = Number(text.match(/\b(\d{1,4})(?:\s*x\s*\d{2,4}\s*w(?:att)?s?)?\s+(?:solar\s+)?panels?\b/i)?.[1] ?? 0) || undefined;
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
  const compact = text.match(/\b\d{1,4}\s*x\s*(\d{2,4})\s*w(?:att)?s?\s*(?:solar\s+)?panels?\b/i);
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
  polarity: "positive" | "negative" | "pair";
}

export function requestedSchematicPlan(text: string) {
  const pv = conceptualPvArrays(text);
  const panelWatts = explicitPanelWattage(text);
  const inverterClass = inverterClassFromEvidence(text);
  const inverterRatedPowerW = explicitInverterRatedPower(text);
  const battery = explicitBatteryDetails(text);
  const components: RequestedSchematicComponent[] = [];
  const add = (component: RequestedSchematicComponent) => components.push(component);

  for (const requested of requestedSchematicComponents(text)) {
    if (requested.type === "inverter") {
      add({
        key: "inverter",
        type: "inverter",
        displayName: `${inverterRatedPowerW ? `${inverterRatedPowerW / 1000} kW ` : ""}${inverterClass ?? "Inverter"}`.replace(/\binverter inverter\b/i, "inverter").trim(),
        quantity: requested.quantity,
        specifications: {
          "Equipment class": inverterClass ?? "TBC",
          "Rated power": inverterRatedPowerW ? `${inverterRatedPowerW} W` : "TBC",
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
    } else {
      add({ key: requested.type, type: requested.type, displayName: requested.displayName, quantity: requested.quantity, specifications: { Rating: "TBC" } });
    }
  }

  const hasCombiner = /\bcombiner(?:\s+box)?\b/i.test(text);
  if (hasCombiner) add({ key: "combiner", type: "combiner", displayName: "PV combiner box", quantity: 1, specifications: { Rating: "TBC" } });

  const isolatorMention = text.match(/\b(?:(\d+)\s+)?isolators?\b|\b(?:(\d+)\s+)?disconnects?\b/i);
  const isolatorCount = isolatorMention
    ? Number(isolatorMention[1] ?? isolatorMention[2] ?? 0) || (/(?:isolators|disconnects)\b/i.test(isolatorMention[0]) ? Math.max(1, pv.arrayCount) : 1)
    : 0;
  for (let index = 0; index < isolatorCount; index += 1) {
    add({ key: `isolator-${index + 1}`, type: "isolator", displayName: `PV DC isolator ${index + 1}`, quantity: 1, specifications: { Rating: "TBC", "Protected string": `PV${index + 1}` } });
  }

  const hasFuse = /\bfused?\b|\bfuse\b/i.test(text);
  if (hasFuse) add({ key: "battery-fuse", type: "protection", displayName: "Battery fuse", quantity: 1, specifications: { Rating: "TBC" } });

  const hasBusbar = /\bbus\s*bars?\b/i.test(text);
  if (hasBusbar) {
    add({ key: "positive-busbar", type: "connector", displayName: "Positive busbar", quantity: 1, specifications: { Polarity: "positive", Rating: "TBC" } });
    add({ key: "negative-busbar", type: "connector", displayName: "Negative busbar", quantity: 1, specifications: { Polarity: "negative", Rating: "TBC" } });
  }

  const connections: RequestedSchematicConnection[] = [];
  const connect = (sourceKey: string | undefined, targetKey: string | undefined, name: string, polarity: RequestedSchematicConnection["polarity"] = "pair") => {
    if (sourceKey && targetKey) connections.push({ sourceKey, targetKey, name, polarity });
  };
  const hasInverter = components.some((component) => component.key === "inverter");
  for (let index = 0; index < pv.arrayCount; index += 1) {
    const isolatorKey = components.some((component) => component.key === `isolator-${index + 1}`) ? `isolator-${index + 1}` : undefined;
    connect(`pv-${index + 1}`, isolatorKey ?? (hasCombiner ? "combiner" : hasInverter ? "inverter" : undefined), `PV${index + 1} DC`);
    connect(isolatorKey, hasCombiner ? "combiner" : hasInverter ? "inverter" : undefined, `PV${index + 1} isolated DC`);
  }
  connect(hasCombiner ? "combiner" : undefined, hasInverter ? "inverter" : undefined, "Combined PV DC");

  const hasBattery = components.some((component) => component.key === "battery");
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

  return { pv: { ...pv, panelWatts }, components, connections };
}
