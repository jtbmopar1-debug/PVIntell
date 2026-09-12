export type ConversationEvidenceSource = "user" | "image" | "application";

export interface ActiveComponent {
  kind: "panel" | "battery" | "controller" | "other";
  label: string;
  specifications: Record<string, string | number>;
  source: ConversationEvidenceSource;
}

export interface ActiveConversationState {
  currentSite?: { id?: string; name: string; source: ConversationEvidenceSource };
  currentSubject?: {
    kind: "setup" | "component" | "site" | "unknown";
    description: string;
    source: "recent-conversation" | "attached-image";
    association: "unassociated" | "explicitly-associated";
    associatedSystemId?: string;
    associatedSystemName?: string;
  };
  confirmedComponents: ActiveComponent[];
  unknownInformation: string[];
  currentUserRequest?: string;
  proposedAction?: {
    type: "create-standalone-system" | "record-setup" | "other";
    confirmed: boolean;
    siteName?: string;
    subject: "active-setup";
    parameters: Record<string, string | number | boolean>;
  };
  rejectedInterpretations: string[];
  questions: Array<{ text: string; normalized: string; answered: boolean; answer?: string }>;
}

type ConversationMessage = {
  role: string;
  content: string;
  structured_context?: unknown;
};

type KnownSite = { id?: string; name: string };
type KnownSystem = { id: string; name: string; siteId?: string; siteName?: string };

type ImageCapture = {
  extraction?: Record<string, unknown>;
  equipmentName?: string;
  warning?: string;
};

const emptyState = (): ActiveConversationState => ({
  confirmedComponents: [],
  unknownInformation: [],
  rejectedInterpretations: [],
  questions: [],
});

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function firstNumber(value: unknown) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function activeStateFromContext(context: unknown) {
  if (!context || typeof context !== "object") return undefined;
  const candidate = (context as Record<string, unknown>).activeConversation;
  if (!candidate || typeof candidate !== "object") return undefined;
  const state = candidate as Partial<ActiveConversationState>;
  return {
    ...emptyState(),
    ...state,
    confirmedComponents: Array.isArray(state.confirmedComponents) ? state.confirmedComponents : [],
    unknownInformation: Array.isArray(state.unknownInformation) ? state.unknownInformation : [],
    rejectedInterpretations: Array.isArray(state.rejectedInterpretations) ? state.rejectedInterpretations : [],
    questions: Array.isArray(state.questions) ? state.questions : [],
  } satisfies ActiveConversationState;
}

export function normalizeQuestion(question: string) {
  return question
    .toLocaleLowerCase()
    .replace(/\b(?:please|again|already|currently|now|then|so|just)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function questionWords(question: string) {
  const ignored = new Set(["a", "an", "and", "are", "do", "does", "for", "i", "is", "it", "me", "of", "on", "the", "to", "we", "what", "which", "would", "you", "your"]);
  return new Set(normalizeQuestion(question).split(/\s+/).filter((word) => word && !ignored.has(word)));
}

export function questionsAreEquivalent(left: string, right: string) {
  const a = questionWords(left);
  const b = questionWords(right);
  if (!a.size || !b.size) return normalizeQuestion(left) === normalizeQuestion(right);
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.min(a.size, b.size) >= 0.75;
}

function addQuestion(state: ActiveConversationState, text: string) {
  const normalized = normalizeQuestion(text);
  const existing = state.questions.find((item) => questionsAreEquivalent(item.text, text));
  if (!existing) state.questions.push({ text: text.trim(), normalized, answered: false });
}

function questionsIn(message: string) {
  return message.match(/[^.!?\n]*\?/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function upsertComponent(state: ActiveConversationState, component: ActiveComponent) {
  const current = state.confirmedComponents.find((item) => item.kind === component.kind);
  if (!current) state.confirmedComponents.push(component);
  else {
    current.label = component.label || current.label;
    current.source = component.source;
    current.specifications = { ...current.specifications, ...component.specifications };
  }
}

function observeImage(state: ActiveConversationState, capture?: ImageCapture) {
  const extraction = capture?.extraction;
  if (!extraction) return;
  const equipmentType = textValue(extraction.equipmentType)?.toLocaleLowerCase();
  const descriptiveText = [capture?.equipmentName, extraction.manufacturer, extraction.model, extraction.description]
    .map(textValue).filter(Boolean).join(" ");
  const kind: ActiveComponent["kind"] = /controller|charge regulator|mppt|pwm/i.test(`${equipmentType} ${descriptiveText}`)
    ? "controller"
    : equipmentType === "panel" ? "panel" : equipmentType === "battery" ? "battery" : "other";
  const specifications = Object.fromEntries(Object.entries(extraction).flatMap(([key, value]) => {
    const text = textValue(value);
    const number = numberValue(value);
    return text !== undefined || number !== undefined ? [[key, text ?? number!]] : [];
  }));
  if (kind === "panel") {
    const watts = firstNumber(extraction.ratedPower);
    if (watts) specifications.ratedPowerW = watts;
  }
  if (kind === "battery") {
    const volts = firstNumber(extraction.ratedVoltage);
    const capacityAh = /\bah\b/i.test(String(extraction.capacity ?? "")) ? firstNumber(extraction.capacity) : undefined;
    if (volts) specifications.nominalVoltageV = volts;
    if (capacityAh) specifications.capacityAh = capacityAh;
    const batteryText = `${extraction.capacity ?? ""} ${JSON.stringify(extraction.otherSpecifications ?? [])}`;
    if (/\bAGM\b/i.test(batteryText)) specifications.chemistry = "AGM";
  }
  upsertComponent(state, { kind, label: descriptiveText || `${kind} shown in attached image`, specifications, source: "image" });
  state.currentSubject = {
    kind: kind === "other" ? "component" : "setup",
    description: `${descriptiveText || `${kind} shown in the attached image`} and the components discussed with it`,
    source: "attached-image",
    association: state.currentSubject?.association ?? "unassociated",
  };
  if (kind === "controller") {
    if (!textValue(extraction.model)) state.unknownInformation.push("controller exact model");
    if (!textValue(extraction.ratedCurrent) && !textValue(extraction.ratedPower)) state.unknownInformation.push("controller rating");
  }
}

function observeAssistant(state: ActiveConversationState, message: string) {
  for (const question of questionsIn(message)) addQuestion(state, question);
  if (state.currentSubject?.source === "attached-image" && /\b(?:solar )?(?:charge )?controller\b/i.test(message)) {
    const imageOther = state.confirmedComponents.find((component) => component.kind === "other" && component.source === "image");
    upsertComponent(state, { kind: "controller", label: imageOther?.label || "controller shown in the attached image", specifications: imageOther?.specifications ?? {}, source: "image" });
    state.currentSubject = { ...state.currentSubject, kind: "setup", description: "the pictured controller and the panel/battery discussed with it" };
    if (/\b(?:exact )?(?:model|rating)\b[\s\S]{0,40}\b(?:unknown|unclear|unreadable|cannot confirm|can'?t confirm)\b/i.test(message)) {
      state.unknownInformation.push("controller exact model");
      state.unknownInformation.push("controller rating");
    }
  }
  const standalone = message.match(/record this setup as a new standalone system on ([^?.,\n]+)/i);
  if (standalone) {
    state.proposedAction = {
      type: "create-standalone-system",
      confirmed: false,
      siteName: standalone[1].trim(),
      subject: "active-setup",
      parameters: { standalone: true },
    };
  } else if (/\b(?:record|add|save)\b[\s\S]*\b(?:this|that) setup\b/i.test(message)) {
    state.proposedAction = { type: "record-setup", confirmed: false, subject: "active-setup", parameters: {} };
  }
}

function readRating(message: string, pattern: RegExp) {
  const match = message.match(pattern);
  return match ? Number(match[1]) : undefined;
}

function observeUser(state: ActiveConversationState, message: string, previousAssistant: string | undefined, knownSites: KnownSite[], knownSystems: KnownSystem[]) {
  state.currentUserRequest = message.trim();
  const unresolved = [...state.questions].reverse().find((question) => !question.answered);
  const isNewQuestion = /\?\s*$/.test(message.trim()) && !/^\s*(?:yes|no)\b/i.test(message);
  if (unresolved && !isNewQuestion) {
    unresolved.answered = true;
    unresolved.answer = message.trim();
  }

  const namedSite = knownSites.find((site) => new RegExp(`(?:^|\\b)${site.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`, "i").test(message));
  if (namedSite) state.currentSite = { id: namedSite.id, name: namedSite.name, source: "user" };
  const explicitlyNamedSystem = knownSystems.find((system) => {
    const name = system.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b(?:this setup|this|it)\\b[\\s\\S]{0,50}\\b(?:is|belongs to|is for|part of|associate with|use)\\b[\\s\\S]{0,25}(?:${name})\\b`, "i").test(message)
      || new RegExp(`\\b(?:associate|attach|record|add)\\b[\\s\\S]{0,50}\\b(?:${name})\\b`, "i").test(message)
      || (Boolean(namedSite) && new RegExp(`(?:^|\\b)${name}(?:\\b|$)`, "i").test(message))
      || (/which (?:site|system|battery)|which power system|do you mean/i.test(previousAssistant ?? "") && new RegExp(`(?:^|\\b)${name}(?:\\b|$)`, "i").test(message));
  });
  if (explicitlyNamedSystem) {
    state.currentSubject = {
      kind: "setup",
      description: state.currentSubject?.description ?? "the setup established in this conversation",
      source: "recent-conversation",
      association: "explicitly-associated",
      associatedSystemId: explicitlyNamedSystem.id,
      associatedSystemName: explicitlyNamedSystem.name,
    };
    if (explicitlyNamedSystem.siteName) state.currentSite = { id: explicitlyNamedSystem.siteId, name: explicitlyNamedSystem.siteName, source: "application" };
  }

  if (/^\s*(?:yes|yes please|sure|okay|ok|do it)\b/i.test(message) && state.proposedAction) {
    state.proposedAction.confirmed = true;
    if (state.proposedAction.siteName && !state.currentSite)
      state.currentSite = { name: state.proposedAction.siteName, source: "user" };
  }

  if (/^\s*no\b/i.test(message)) {
    const rejected = (previousAssistant ?? "").match(/\b(?:Main House|Studio(?: battery)?|NOARK[^?.,;\n]*)\b/gi) ?? [];
    state.rejectedInterpretations = unique([...state.rejectedInterpretations, ...rejected, previousAssistant ? previousAssistant.slice(0, 500) : ""]);
  }
  if (/\b(?:no,?\s*)?(?:just|only) this setup\b/i.test(message)) {
    state.currentSubject = {
      kind: "setup",
      description: "the controller, panel and battery setup established in this conversation",
      source: "recent-conversation",
      association: "unassociated",
    };
  }

  const panelWatts = readRating(message, /\b(\d{2,4})\s*w(?:att)?s?\b(?=[^.!?]{0,35}\b(?:panels?|modules?)\b)/i)
    ?? readRating(message, /\b(?:panels?|modules?)\b[^.!?]{0,35}\b(\d{2,4})\s*w(?:att)?s?\b/i);
  if (panelWatts) upsertComponent(state, { kind: "panel", label: `${panelWatts} W panel`, specifications: { ratedPowerW: panelWatts }, source: "user" });

  const batteryVoltage = readRating(message, /\b(\d{1,3}(?:\.\d+)?)\s*v(?:olt)?s?\b(?=[^.!?]{0,50}\b(?:battery|agm)\b)/i)
    ?? (/\bbattery\b/i.test(message) ? readRating(message, /\b(\d{1,3}(?:\.\d+)?)\s*v(?:olt)?s?\b/i) : undefined);
  const batteryAh = readRating(message, /\b(\d{1,4}(?:\.\d+)?)\s*ah\b/i);
  const chemistry = /\bAGM\b/i.test(message) ? "AGM" : undefined;
  if (batteryVoltage || batteryAh || chemistry) upsertComponent(state, {
    kind: "battery",
    label: [batteryVoltage ? `${batteryVoltage} V` : "", batteryAh ? `${batteryAh} Ah` : "", chemistry ?? "", "battery"].filter(Boolean).join(" "),
    specifications: Object.fromEntries([["nominalVoltageV", batteryVoltage], ["capacityAh", batteryAh], ["chemistry", chemistry]].filter(([, value]) => value !== undefined) as Array<[string, string | number]>),
    source: "user",
  });
  if (/\bbatter(?:y|ies)\b/i.test(message)) {
    state.currentSubject = state.currentSubject ?? {
      kind: "component",
      description: "the battery mentioned by the user",
      source: "recent-conversation",
      association: "unassociated",
    };
    if (!batteryVoltage && !batteryAh && !chemistry) state.unknownInformation.push("battery identity and system association");
  }

  if (/\b(?:this|the) (?:solar )?(?:charge )?controller\b/i.test(message) || /\bcontroller\b/i.test(message)) {
    upsertComponent(state, { kind: "controller", label: "controller shown in the attached image", specifications: {}, source: "user" });
    state.currentSubject = state.currentSubject ?? {
      kind: "component",
      description: "the controller referenced in this conversation",
      source: "recent-conversation",
      association: "unassociated",
    };
    state.unknownInformation.push("controller exact model");
    state.unknownInformation.push("controller rating");
  }
  if (state.proposedAction && /what name would you like for the system|what shall I call (?:it|the system)/i.test(previousAssistant ?? "")
    && /^\s*[\p{L}\p{N}][\p{L}\p{N}' .&-]{0,119}\s*$/u.test(message)) {
    state.proposedAction.parameters.systemName = message.trim();
  }
  if (/\bschematic\b|\bwiring diagram\b/i.test(message)) state.currentUserRequest = "Provide a schematic for the active setup";
  if (/\b(?:this setup|one of these|with it|for it)\b/i.test(message) && state.confirmedComponents.length) {
    state.currentSubject = state.currentSubject ?? {
      kind: "setup",
      description: "the components established in the recent conversation",
      source: "recent-conversation",
      association: "unassociated",
    };
  }
}

export function buildActiveConversationState({
  messages,
  currentMessage,
  knownSites = [],
  currentImageCapture,
  knownSystems = [],
  ambientSite,
}: {
  messages: ConversationMessage[];
  currentMessage: string;
  knownSites?: KnownSite[];
  currentImageCapture?: ImageCapture;
  knownSystems?: KnownSystem[];
  ambientSite?: KnownSite;
}) {
  const persistedIndex = messages.findLastIndex((message) => Boolean(activeStateFromContext(message.structured_context)));
  const state = persistedIndex >= 0
    ? structuredClone(activeStateFromContext(messages[persistedIndex].structured_context)!)
    : emptyState();
  // The state is stored beside an assistant response. Observe that response as
  // well so its question or offered action is available when the user replies.
  if (persistedIndex >= 0 && messages[persistedIndex].role === "assistant")
    observeAssistant(state, messages[persistedIndex].content);
  const replay = persistedIndex >= 0 ? messages.slice(persistedIndex + 1) : messages;
  if (!state.currentSite && ambientSite) state.currentSite = { id: ambientSite.id, name: ambientSite.name, source: "application" };
  let previousAssistant: string | undefined;
  for (const item of replay) {
    if (item.role === "assistant") {
      observeAssistant(state, item.content);
      previousAssistant = item.content;
    } else if (item.role === "user") observeUser(state, item.content, previousAssistant, knownSites, knownSystems);
  }
  observeUser(state, currentMessage, [...messages].reverse().find((item) => item.role === "assistant")?.content, knownSites, knownSystems);
  observeImage(state, currentImageCapture);
  const panel = state.confirmedComponents.find((component) => component.kind === "panel");
  const panelSpecificationAliases: Record<string, string[]> = {
    "panel Voc": ["voc", "openCircuitVoltage"],
    "panel Vmp": ["vmp", "maximumPowerVoltage"],
    "panel Isc": ["isc", "shortCircuitCurrent"],
    "panel Imp": ["imp", "maximumPowerCurrent"],
  };
  const controller = state.confirmedComponents.find((component) => component.kind === "controller");
  const resolvedUnknown = (field: string) => {
    const panelAliases = panelSpecificationAliases[field];
    if (panelAliases) return Boolean(panel && Object.entries(panel.specifications).some(([key, value]) => panelAliases.some((alias) => key.toLocaleLowerCase() === alias.toLocaleLowerCase()) && String(value).trim()));
    if (field === "controller exact model") return Boolean(controller && String(controller.specifications.model ?? "").trim());
    if (field === "controller rating") return Boolean(controller && Object.entries(controller.specifications).some(([key, value]) => /ratedCurrent|ratedPower|maximum.*current|maximum.*power/i.test(key) && String(value).trim()));
    return false;
  };
  state.unknownInformation = state.unknownInformation.filter((field) => !resolvedUnknown(field));
  for (const [field, aliases] of Object.entries(panelSpecificationAliases))
    if (!panel || !Object.entries(panel.specifications).some(([key, value]) => aliases.some((alias) => key.toLocaleLowerCase() === alias.toLocaleLowerCase()) && String(value).trim())) state.unknownInformation.push(field);
  state.unknownInformation = unique(state.unknownInformation);
  state.rejectedInterpretations = unique(state.rejectedInterpretations);
  state.questions = state.questions.slice(-20);
  return state;
}

export function isRepeatedAnsweredQuestion(question: string, state: ActiveConversationState) {
  return state.questions.some((prior) => prior.answered && questionsAreEquivalent(prior.text, question));
}

export function removeRepeatedAnsweredQuestions(message: string, state: ActiveConversationState) {
  let result = message;
  for (const question of questionsIn(message)) {
    if (isRepeatedAnsweredQuestion(question, state)) result = result.replace(question, "");
  }
  return result.replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").trim();
}

export function conversationRetrievalPolicy(state: ActiveConversationState) {
  return {
    precedence: ["latest user correction", "recent conversation", "attached-image evidence", "active conversation state", "retrieved application records"],
    activeSubject: state.currentSubject,
    retrievedRecordsMaySupplementButNeverReplaceActiveSubject: true,
    associateActiveSetupWithSavedEquipmentOnlyAfterExplicitUserConfirmation: true,
    rejectedInterpretationsMustNotBeSuggestedAgain: state.rejectedInterpretations,
    factualClaimsAboutApplicationObjectsRequireSuppliedApplicationData: true,
  };
}

export function conceptualSchematicForActiveSetup(state: ActiveConversationState) {
  if (state.currentUserRequest !== "Provide a schematic for the active setup") return undefined;
  const panel = state.confirmedComponents.find((component) => component.kind === "panel");
  const battery = state.confirmedComponents.find((component) => component.kind === "battery");
  const controller = state.confirmedComponents.find((component) => component.kind === "controller");
  if (!panel && !battery && !controller) return undefined;
  const panelWatts = panel?.specifications.ratedPowerW;
  const batteryVoltage = battery?.specifications.nominalVoltageV;
  const batteryAh = battery?.specifications.capacityAh;
  const chemistry = battery?.specifications.chemistry;
  const panelLabel = panelWatts ? `${panelWatts} W panel` : "PV panel";
  const batteryLabel = [batteryVoltage ? `${batteryVoltage} V` : "", batteryAh ? `${batteryAh} Ah` : "", chemistry ?? "", "battery"].filter(Boolean).join(" ");
  return [
    "Yes—this schematic is for the controller/panel/battery setup established in this conversation; it is not associated with any stored equipment record.",
    "",
    `\`${panelLabel} → PV-side isolation/protection (rating TBD) → solar charge controller (shown in the image; exact model/rating unknown) → battery-side fuse/breaker (rating TBD) → ${batteryLabel}\``,
    "",
    `Confirmed: ${[panelWatts ? `${panelWatts} W panel` : undefined, batteryVoltage || batteryAh || chemistry ? batteryLabel : undefined, controller ? "the pictured controller" : undefined, state.currentSite?.name ? `Site: ${state.currentSite.name}` : undefined].filter(Boolean).join("; ")}.`,
    "This is a conceptual connection flow, not an exact wiring schematic or compatibility approval. Controller rating and panel Voc, Vmp, Isc and Imp are still unknown, so cable and protection ratings—and whether that panel/controller/battery combination is electrically compatible—cannot yet be confirmed. Any controller display codes such as b01–b04 are model-specific and cannot be decoded reliably until the exact controller model or manual is known.",
  ].join("\n");
}

export function equipmentTargetClarification(state: ActiveConversationState) {
  if (state.currentSubject?.association !== "unassociated") return undefined;
  if (!/\b(?:battery|controller|inverter|panel|equipment)\b/i.test(state.currentSubject.description)) return undefined;
  if (!/\b(?:why|dying|drain|draining|flat|failing|fault|wrong|problem|diagnos|check|inspect)\b/i.test(state.currentUserRequest ?? "")) return undefined;
  if (state.currentSite?.source === "user")
    return `Which power system or battery record at ${state.currentSite.name} do you mean? I won’t assume it is one of the saved systems.`;
  return "Which Site and power system or battery do you mean? I won’t associate this question with a saved battery until you confirm it.";
}
