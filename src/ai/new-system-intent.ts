export const startHereUrl = "/discovery/new-system";
export const startHereLabel = "Start here";

export function isNewSystemSetupIntent(message: string) {
  const text = message.trim();
  if (!text) return false;
  const structure = /\b(?:system|setup|site|shed|workshop|garage|cabin|tiny home|house|home|property)\b/i.test(text);
  const solarOrPower = /\b(?:solar|pv|battery|power|electricity|off[- ]?grid)\b/i.test(text);
  const starting = /\b(?:new|another|add|create|start|plan|design|build|install|set\s*up|put)\b/i.test(text);
  const directIntent = /\bi (?:want|need|would like|plan) to\b/i.test(text);
  return structure && solarOrPower && (starting || directIntent)
    || /\bnew (?:solar |power )?(?:system|setup|site|shed|workshop|garage|cabin)\b/i.test(text);
}

export function startHereMessage() {
  return "A new power system should begin with Start here. It takes you through the Site, intended use, loads, available solar space and design preferences in a clear sequence. I’ll review the completed brief afterward and help with anything uncertain.";
}
