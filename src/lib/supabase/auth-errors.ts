export function isFutureJwtError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") return /JWT issued (?:at|in the) future|PGRST303/i.test(error);
  if (typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  return value.code === "PGRST303"
    || (typeof value.message === "string" && /JWT issued (?:at|in the) future/i.test(value.message))
    || isFutureJwtError(value.cause);
}

export function safeInternalReturnPath(value: string | null, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
