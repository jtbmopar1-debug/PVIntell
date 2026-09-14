import type { WattsonActionRequest } from "./actions";
import type { WattsonConversationState, WattsonIntent, WattsonPendingAction } from "./conversation-state";
import { requestsSchematicCreation } from "./schematic-intent";
import { affirmsPendingAction, rejectsPendingAction } from "./conversation-consent";

const mutatingActions = new Set([
  "create_power_system_workspace",
  "record_design_preference",
  "record_design_discovery",
  "record_preliminary_design",
  "update_proposed_design",
  "record_system_knowledge",
  "record_added_component",
  "update_system_settings",
  "update_project_settings",
  "update_system_component",
  "record_or_update_pv_array",
  "record_or_update_system_connection",
  "record_or_update_load",
]);

export interface WattsonRouteDecision {
  intent: WattsonIntent;
  mode: "answer" | "offer" | "execute" | "reject";
  mutationConsent: boolean;
  pendingAction?: WattsonPendingAction;
}

const schematicSubject = /\b(?:schematic|wiring diagram|connection diagram)\b/i;
const recordCreate = /\b(?:save|record|add|attach|import)\b[\s\S]{0,80}\b(?:this|that|it|record|equipment|component|inventory|image|photo|label|fact|detail|panel|array|battery|controller|inverter|generator|meter|load|connection)\b|\b(?:save|record|add|attach|import)\s+(?:this|that|it)\b/i;
const recordUpdate = /\b(?:update|correct|replace|change)\b(?!\s+me\b)[\s\S]{0,100}\b(?:record|equipment|component|inventory|image|photo|label|field|value|panel|array|battery|controller|inverter|connection|load|site name|system name)\b/i;

export function routeWattsonTurn(message: string, state: WattsonConversationState): WattsonRouteDecision {
  if (rejectsPendingAction(message) && !state.pendingAction) return { intent: state.activeIntent, mode: "reject", mutationConsent: false };
  if (state.pendingAction?.status === "confirmed" && affirmsPendingAction(message)) {
    const intent = state.pendingAction.kind === "create_schematic" ? "schematic"
      : state.pendingAction.kind === "create_system" ? "new_system"
      : state.pendingAction.kind === "attach_record" ? "record_attachment"
      : "equipment_record";
    return { intent, mode: "execute", mutationConsent: true, pendingAction: state.pendingAction };
  }
  if (requestsSchematicCreation(message)) {
    return {
      intent: "schematic",
      mode: "execute",
      mutationConsent: true,
      pendingAction: { kind: "create_schematic", status: "confirmed", description: "Create the requested schematic" },
    };
  }
  if (/\b(?:start|create|set up|setup|add)\b[\s\S]{0,40}\b(?:new )?(?:site|system)\b/i.test(message))
    return { intent: "new_system", mode: "offer", mutationConsent: false };
  if (/\b(?:start|continue|resume|help(?: me)?(?: with)?)\b[\s\S]{0,50}\b(?:site\s+)?discovery\b/i.test(message))
    return { intent: "site_discovery", mode: "offer", mutationConsent: false };
  if (recordCreate.test(message) || recordUpdate.test(message)) {
    return {
      intent: /\b(?:attach|image|photo|label)\b/i.test(message) ? "record_attachment" : "equipment_record",
      mode: "execute",
      mutationConsent: true,
    };
  }
  if (state.activeIntent === "discovery_help") {
    const subjectWords = new Set((state.activeSubject?.description ?? "").toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
    const messageWords = message.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
    const continuesSubject = messageWords.some((word) => subjectWords.has(word));
    const shortAnswer = message.trim().length <= 160 && !/\b(?:tell me|explain|why|what is|how (?:do|does|can)|about a|new topic)\b/i.test(message);
    if (continuesSubject || shortAnswer)
      return { intent: "discovery_help", mode: "answer", mutationConsent: false };
  }
  if (schematicSubject.test(message)) return { intent: "schematic", mode: "answer", mutationConsent: false };
  if (/\b(?:why|how|what|fault|error|code|diagnos|size|calculate|compatible|wire|connect|voltage|current|power)\b/i.test(message))
    return { intent: "technical_answer", mode: "answer", mutationConsent: false };
  return { intent: "general", mode: "answer", mutationConsent: false };
}

export function actionNeedsMutationConsent(action: WattsonActionRequest) {
  return mutatingActions.has(action.name);
}

export function actionsAllowedByDecision(actions: WattsonActionRequest[], decision: WattsonRouteDecision) {
  return actions.filter((action) => !actionNeedsMutationConsent(action) || decision.mutationConsent);
}

export function consumeConfirmedPendingAction(state: WattsonConversationState) {
  const next = structuredClone(state);
  delete next.pendingAction;
  return next;
}

export function pendingActionRequests(decision: WattsonRouteDecision) {
  const payload = decision.pendingAction?.payload;
  const raw = payload?.action;
  if (!raw || typeof raw !== "object") return [];
  const action = raw as Record<string, unknown>;
  return typeof action.name === "string" && action.arguments && typeof action.arguments === "object"
    ? [{ name: action.name, arguments: action.arguments } satisfies WattsonActionRequest]
    : [];
}
