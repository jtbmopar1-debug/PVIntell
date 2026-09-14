const affirmative = /^\s*(?:yes(?:,?\s+(?:please|do it|go ahead))?|sure(?:,?\s+go ahead)?|okay|ok|do it|please do|confirm)\s*[.!]?\s*$/i;
const rejection = /^\s*(?:no|nope|don'?t|do not|cancel|leave it|not now)\b/i;

export function affirmsPendingAction(message: string) {
  return affirmative.test(message);
}

export function rejectsPendingAction(message: string) {
  return rejection.test(message);
}
