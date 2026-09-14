import { affirmsPendingAction, rejectsPendingAction } from "./conversation-consent";

export const WATTSON_STATE_VERSION = 1 as const;

export type WattsonIntent =
  | "technical_answer"
  | "site_discovery"
  | "discovery_help"
  | "equipment_record"
  | "record_attachment"
  | "schematic"
  | "new_system"
  | "general";

export type WattsonEvidenceSource = "user" | "image" | "application";

export interface WattsonEvidence {
  id: string;
  source: WattsonEvidenceSource;
  summary: string;
  messageIndex: number;
  data?: Record<string, unknown>;
}

export interface WattsonFact {
  key: string;
  value: string | number | boolean;
  source: WattsonEvidenceSource;
  evidenceId?: string;
  correctedAtRevision?: number;
}

export interface WattsonQuestion {
  key: string;
  text: string;
  answered: boolean;
  answer?: string;
}

export interface WattsonPendingAction {
  kind: "save_evidence" | "attach_record" | "record_equipment" | "create_schematic" | "create_system";
  status: "offered" | "confirmed";
  description: string;
  siteId?: string;
  systemId?: string;
  payload?: Record<string, unknown>;
}

export interface WattsonCompletedAction {
  kind: WattsonPendingAction["kind"];
  revision: number;
  description: string;
  siteId?: string;
  systemId?: string;
  result?: Record<string, unknown>;
}

export interface WattsonConversationState {
  version: typeof WATTSON_STATE_VERSION;
  revision: number;
  activeIntent: WattsonIntent;
  activeSubject?: {
    kind: "setup" | "component" | "site" | "general";
    description: string;
    association: "unassociated" | "site" | "system";
    siteId?: string;
    siteName?: string;
    systemId?: string;
    systemName?: string;
  };
  evidence: WattsonEvidence[];
  facts: WattsonFact[];
  corrections: Array<{ key?: string; statement: string; revision: number }>;
  questions: WattsonQuestion[];
  pendingAction?: WattsonPendingAction;
  completedActions: WattsonCompletedAction[];
}

export interface WattsonImageEvidence {
  imagePath?: string;
  mimeType?: string;
  extraction?: Record<string, unknown>;
  warning?: string;
}

const blankState = (): WattsonConversationState => ({
  version: WATTSON_STATE_VERSION,
  revision: 0,
  activeIntent: "general",
  evidence: [],
  facts: [],
  corrections: [],
  questions: [],
  completedActions: [],
});

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^0-9.+-]/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stateFromUnknown(value: unknown): WattsonConversationState | undefined {
  const candidate = record(value);
  if (!candidate || candidate.version !== WATTSON_STATE_VERSION) return undefined;
  return {
    ...blankState(),
    ...candidate,
    version: WATTSON_STATE_VERSION,
    revision: Number(candidate.revision ?? 0),
    evidence: Array.isArray(candidate.evidence) ? candidate.evidence as WattsonEvidence[] : [],
    facts: Array.isArray(candidate.facts) ? candidate.facts as WattsonFact[] : [],
    corrections: Array.isArray(candidate.corrections) ? candidate.corrections as WattsonConversationState["corrections"] : [],
    questions: Array.isArray(candidate.questions) ? candidate.questions as WattsonQuestion[] : [],
    completedActions: Array.isArray(candidate.completedActions) ? candidate.completedActions as WattsonCompletedAction[] : [],
    pendingAction: record(candidate.pendingAction) as unknown as WattsonPendingAction | undefined,
  };
}

export function parseWattsonConversationState(value: unknown) {
  return stateFromUnknown(value) ?? blankState();
}

function evidenceId(state: WattsonConversationState, source: WattsonEvidenceSource) {
  return `${source}:${state.revision}:${state.evidence.length + 1}`;
}

function setFact(state: WattsonConversationState, fact: WattsonFact, correction: boolean) {
  const index = state.facts.findIndex((current) => current.key === fact.key);
  if (index < 0) state.facts.push({ ...fact, correctedAtRevision: correction ? state.revision : undefined });
  else {
    const current = state.facts[index];
    // Direct user statements and corrections outrank image extraction and stored context.
    if (fact.source === "user" || current.source !== "user") state.facts[index] = {
      ...current,
      ...fact,
      correctedAtRevision: correction ? state.revision : current.correctedAtRevision,
    };
  }
}

function extractUserFacts(state: WattsonConversationState, message: string, sourceId: string, correction: boolean) {
  const panelPower = message.match(/\b(\d{2,4}(?:\.\d+)?)\s*w(?:att)?s?\b(?=[^.!?]{0,45}\b(?:panel|module)s?\b)|\b(?:panel|module)s?\b[^.!?]{0,45}\b(\d{2,4}(?:\.\d+)?)\s*w(?:att)?s?\b/i);
  if (panelPower) setFact(state, { key: "panel.rated_power_w", value: Number(panelPower[1] ?? panelPower[2]), source: "user", evidenceId: sourceId }, correction);
  const batteryContext = /\bbatter(?:y|ies)|\bbank\b/i.test(message);
  const voltage = batteryContext ? message.match(/\b(12|24|36|48)(?:\.0)?\s*v(?:olts?)?\b/i) : null;
  const capacity = batteryContext ? message.match(/\b(\d{1,5}(?:\.\d+)?)\s*ah\b/i) : null;
  const chemistry = message.match(/\b(AGM|GEL|LiFePO4|LFP|lead[- ]acid|lithium[- ]ion)\b/i);
  if (voltage) setFact(state, { key: "battery.nominal_voltage_v", value: Number(voltage[1]), source: "user", evidenceId: sourceId }, correction);
  if (capacity) setFact(state, { key: "battery.capacity_ah", value: Number(capacity[1]), source: "user", evidenceId: sourceId }, correction);
  if (chemistry) setFact(state, { key: "battery.chemistry", value: chemistry[1].toUpperCase(), source: "user", evidenceId: sourceId }, correction);
  const model = message.match(/\b(?:controller|inverter)\b[^.!?]{0,40}\b(?:model(?: is|:)?|is an?|is)\s+([\p{L}\p{N}][\p{L}\p{N} ._/-]{1,60})/iu);
  if (model) setFact(state, { key: /controller/i.test(model[0]) ? "controller.model" : "inverter.model", value: model[1].trim(), source: "user", evidenceId: sourceId }, correction);
}

function extractImageFacts(state: WattsonConversationState, image: WattsonImageEvidence, sourceId: string) {
  const extraction = image.extraction ?? {};
  const equipmentType = text(extraction.equipmentType) ?? "equipment";
  const manufacturer = text(extraction.manufacturer);
  const model = text(extraction.model);
  if (manufacturer) setFact(state, { key: `${equipmentType}.manufacturer`, value: manufacturer, source: "image", evidenceId: sourceId }, false);
  if (model) setFact(state, { key: `${equipmentType}.model`, value: model, source: "image", evidenceId: sourceId }, false);
  for (const [name, key] of [["ratedPower", "rated_power_w"], ["ratedCurrent", "rated_current_a"], ["ratedVoltage", "rated_voltage_v"]] as const) {
    const parsed = number(extraction[name]);
    if (parsed !== undefined) setFact(state, { key: `${equipmentType}.${key}`, value: parsed, source: "image", evidenceId: sourceId }, false);
  }
}

function isCorrection(message: string) {
  return /^\s*(?:no\b|actually\b|correction\b|that(?:'s| is) (?:not|wrong)\b)|\bI told you earlier\b/i.test(message);
}

function answersPriorQuestion(message: string) {
  const normalized = message.trim();
  if (!normalized || /\?\s*$/.test(normalized) && !/^\s*(?:yes|no)\b/i.test(normalized)) return false;
  return normalized.length <= 240 || /^\s*(?:yes|no|it is|they are|the site|the system)\b/i.test(normalized);
}

function startsNewSubject(message: string) {
  return /\b(?:another|different|separate|new|unrelated)\s+(?:site|system|setup|installation|boat|vehicle|battery|controller|inverter|array|topic)\b|\b(?:change|switch)(?:ing)?\s+(?:the\s+)?(?:subject|topic)\b|\b(?:now|instead)\s+(?:about|for)\b/i.test(message);
}

export function reduceWattsonUserTurn(
  input: unknown,
  message: string,
  options: { image?: WattsonImageEvidence; site?: { id?: string; name: string }; system?: { id: string; name: string } } = {},
) {
  const state = structuredClone(parseWattsonConversationState(input));
  state.revision += 1;
  const correction = isCorrection(message);
  const newSubject = startsNewSubject(message);
  const namesSubject = (name: string | undefined) => Boolean(name && message.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
  const scopedSystem = !newSubject || namesSubject(options.system?.name) ? options.system : undefined;
  const scopedSite = !newSubject || namesSubject(options.site?.name) || Boolean(scopedSystem) ? options.site : undefined;
  if (newSubject) {
    // Open questions and offers belong to the old topic. Confirmed facts and
    // corrections remain available if the user returns to it later.
    state.questions = state.questions.filter((question) => question.answered);
    delete state.pendingAction;
    delete state.activeSubject;
  }
  const userEvidenceId = evidenceId(state, "user");
  state.evidence.push({ id: userEvidenceId, source: "user", summary: message.trim(), messageIndex: state.revision });
  extractUserFacts(state, message, userEvidenceId, correction);
  if (correction) state.corrections.push({ statement: message.trim(), revision: state.revision });

  if (options.image) {
    const imageId = evidenceId(state, "image");
    state.evidence.push({ id: imageId, source: "image", summary: options.image.warning ?? "Attached image evidence", messageIndex: state.revision, data: { imagePath: options.image.imagePath, mimeType: options.image.mimeType, extraction: options.image.extraction } });
    extractImageFacts(state, options.image, imageId);
    const extraction = options.image.extraction ?? {};
    state.activeSubject = {
      kind: "component",
      description: text(extraction.equipmentType) ?? text(extraction.descriptiveText) ?? "equipment in the attached image",
      association: scopedSystem ? "system" : scopedSite ? "site" : "unassociated",
      siteId: scopedSite?.id,
      siteName: scopedSite?.name,
      systemId: scopedSystem?.id,
      systemName: scopedSystem?.name,
    };
  }

  if (!state.activeSubject && /\b(?:site|system|installation|boat|vehicle|battery|controller|inverter|panel|array|equipment|setup)\b/i.test(message)) {
    state.activeSubject = {
      kind: /\b(?:system|installation|setup|boat|vehicle)\b/i.test(message) ? "setup" : /\bsite\b/i.test(message) ? "site" : "component",
      description: message.trim().slice(0, 240),
      association: scopedSystem ? "system" : scopedSite ? "site" : "unassociated",
      siteId: scopedSite?.id,
      siteName: scopedSite?.name,
      systemId: scopedSystem?.id,
      systemName: scopedSystem?.name,
    };
  }

  if (!newSubject && state.questions.some((question) => !question.answered) && answersPriorQuestion(message)) {
    const question = [...state.questions].reverse().find((candidate) => !candidate.answered);
    if (question) {
      question.answered = true;
      question.answer = message.trim();
    }
  }

  if (state.pendingAction && rejectsPendingAction(message)) {
    state.corrections.push({ statement: `Rejected pending action: ${state.pendingAction.description}`, revision: state.revision });
    delete state.pendingAction;
  } else if (state.pendingAction && affirmsPendingAction(message)) {
    state.pendingAction.status = "confirmed";
  } else if (state.pendingAction && /\?\s*$/.test(message.trim())) {
    // A new technical question changes topic; an old offer must not capture a later “yes”.
    delete state.pendingAction;
  }

  state.evidence = state.evidence.slice(-100);
  state.facts = state.facts.slice(-100);
  state.corrections = state.corrections.slice(-50);
  state.questions = state.questions.slice(-40);
  state.completedActions = state.completedActions.slice(-30);
  return state;
}

export function recordWattsonAssistantTurn(state: WattsonConversationState, message: string) {
  const next = structuredClone(state);
  const questions = questionsInMessage(message);
  for (const questionText of questions) {
    const textValue = questionText.trim();
    const key = normalizeWattsonQuestion(textValue);
    const existing = next.questions.find((question) => question.key === key);
    if (!existing) next.questions.push({ key, text: textValue, answered: questionAlreadyAnswered(textValue, next) });
  }
  next.questions = next.questions.slice(-40);
  return next;
}

export function normalizeWattsonQuestion(question: string) {
  return question.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function removeAnsweredWattsonQuestions(message: string, state: WattsonConversationState) {
  let output = message;
  for (const questionText of questionsInMessage(message)) {
    if (questionAlreadyAnswered(questionText, state)) output = output.replace(questionText, "");
  }
  return output.replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").trim();
}

function questionsInMessage(message: string) {
  return message
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && part.length <= 240 && part.endsWith("?"));
}

function factRequiredByQuestion(question: string) {
  if (/\b(?:controller|charge controller)\b[\s\S]{0,60}\b(?:make|manufacturer|model)\b|\b(?:make|manufacturer|model)\b[\s\S]{0,60}\b(?:controller|charge controller)\b/i.test(question)) return "controller.model";
  if (/\binverter\b[\s\S]{0,60}\b(?:make|manufacturer|model)\b|\b(?:make|manufacturer|model)\b[\s\S]{0,60}\binverter\b/i.test(question)) return "inverter.model";
  if (/\bbatter(?:y|ies|y bank)\b[\s\S]{0,60}\b(?:voltage|volts?|nominal voltage)\b|\b(?:voltage|volts?|nominal voltage)\b[\s\S]{0,60}\bbatter/i.test(question)) return "battery.nominal_voltage_v";
  if (/\bbatter(?:y|ies|y bank)\b[\s\S]{0,60}\b(?:capacity|amp[ -]?hours?|ah)\b|\b(?:capacity|amp[ -]?hours?|ah)\b[\s\S]{0,60}\bbatter/i.test(question)) return "battery.capacity_ah";
  if (/\bbatter(?:y|ies|y bank)\b[\s\S]{0,60}\bchemistry\b|\bchemistry\b[\s\S]{0,60}\bbatter/i.test(question)) return "battery.chemistry";
  if (/\b(?:panel|module)s?\b[\s\S]{0,60}\b(?:watts?|wattage|rated power)\b|\b(?:watts?|wattage|rated power)\b[\s\S]{0,60}\b(?:panel|module)s?\b/i.test(question)) return "panel.rated_power_w";
  return undefined;
}

function questionAlreadyAnswered(question: string, state: WattsonConversationState) {
  const key = normalizeWattsonQuestion(question);
  if (state.questions.some((candidate) => candidate.answered && candidate.key === key)) return true;
  const factKey = factRequiredByQuestion(question);
  if (factKey && state.facts.some((fact) => fact.key === factKey)) return true;
  if (/\bwhich site|site name|what (?:shall|should) (?:i|we) call (?:the|this) site\b/i.test(question) && state.activeSubject?.siteName) return true;
  if (/\bwhich system|system name|what (?:shall|should) (?:i|we) call (?:the|this) system\b/i.test(question) && state.activeSubject?.systemName) return true;
  return false;
}

export function conversationStatePromptContext(state: WattsonConversationState) {
  return {
    version: state.version,
    activeIntent: state.activeIntent,
    activeSubject: state.activeSubject,
    facts: state.facts,
    corrections: state.corrections,
    pendingAction: state.pendingAction,
    completedActions: state.completedActions,
    answeredQuestions: state.questions.filter((question) => question.answered),
    unansweredQuestions: state.questions.filter((question) => !question.answered),
    recentEvidence: state.evidence.slice(-20),
  };
}
