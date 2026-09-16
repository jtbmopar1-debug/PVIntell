/** A persisted assessment failure. Unknown/estimated alone is not a safety failure. */
export function hasUnresolvedSuitabilityIssue(...values: unknown[]) {
  const assessment = values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => typeof value === "string" ? value : JSON.stringify(value))
    .join(" ")
    .toLowerCase()
    .replaceAll("compatibility warnings acknowledged", "")
    .replaceAll("compatibility review pending", "");
  return /compatibility warning|unsafe|unsuitable|not suitable|not applicable|incorrect(?:ly)? suitable|incompatible|undersized|under-sized|too small|not (?:large|big) enough|does not meet|failed|failure|do not use|not recommended/.test(assessment);
}
