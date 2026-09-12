const informationalQuestion = /^(?:how|what|why|when|where|which|is|are|can|could|would|should|do|does|did|will)\b/i;

const explicitChangeRequest = /\b(?:save|record|remember|update|change|set|rename|add|remove|delete|correct|replace|mark|apply|accept|confirm|create|build|rebuild)\b/i;

/**
 * Dashboard chat is allowed to write only when the message is not merely asking
 * for information. Answers to a structured discovery question remain writable
 * because that question has already established the record being completed.
 */
export function dashboardMessageAllowsActions(message: string, answeringStructuredQuestion = false) {
  const normalized = message.trim();
  if (/\b(?:build|create|draw|make|show)\b[\s\S]{0,60}\b(?:schematic|wiring diagram|diagram)\b/i.test(normalized)) return false;
  if (answeringStructuredQuestion) return true;
  if (!informationalQuestion.test(normalized)) return true;
  return explicitChangeRequest.test(normalized);
}
