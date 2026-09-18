export function wattsonErrorDetail(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const detail = [record.message, record.details, record.hint, record.code]
      .filter((value) => typeof value === "string" && value)
      .join(" · ");
    if (detail) return detail;
    try { return JSON.stringify(error); } catch { return "Unknown structured error"; }
  }
  return String(error || "Unknown error");
}
