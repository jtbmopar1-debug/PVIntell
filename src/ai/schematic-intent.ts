const schematicSubject = /\b(?:schematic|wiring diagram|connection diagram)\b/i;
const createVerb = /\b(?:build|create|draw|make|provide|generate|give|show)\b/i;
const directNeed = /\b(?:(?:i|we)\s+(?:need|want|would like)|(?:can|could|would|will)\s+you)\b/i;
const missingCorrection = /\b(?:you (?:have not|haven't|did not|didn't) (?:build|built|create|created|make|made)|where is|no (?:schematic|diagram)|build one now|build one)\b/i;

export function requestsSchematicCreation(message: string, priorAssistantMessage = "") {
  const directRequest = schematicSubject.test(message) && (createVerb.test(message) || directNeed.test(message) || /\blink|\bpls\b|\bplease\b/i.test(message));
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
  const totalPanels = Number(text.match(/\b(\d{1,4})(?:\s*x\s*\d{2,4}\s*w(?:att)?s?)?\s+(?:solar\s+)?panels?\b/i)?.[1] ?? 0) || undefined;
  const seriesParallel = text.match(/\b(\d+)S(\d+)P\b/i);
  if (seriesParallel) return { arrayCount: Number(seriesParallel[2]), panelsPerArray: Number(seriesParallel[1]), totalPanels };
  const parallelSeries = text.match(/\b(\d+)P(\d+)S\b/i);
  if (parallelSeries) return { arrayCount: Number(parallelSeries[1]), panelsPerArray: Number(parallelSeries[2]), totalPanels };
  return { arrayCount: 1, panelsPerArray: totalPanels, totalPanels };
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
