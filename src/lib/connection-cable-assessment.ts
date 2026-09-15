import { normaliseAwgAlias } from "@/lib/cable-size-reference";

export function cableAreaMm2(value: string) {
  const awgToken = value.match(/\b(?:[1-4]\s*\/\s*0|0{1,4}|(?:one|two|three|four)[- ]?(?:aught|ought)|\d{1,2})\s*(?:AWG|gauge|G)\b/i)?.[0];
  const awg = normaliseAwgAlias(awgToken ?? value);
  if (awg) return awg.areaMm2;
  const metric = value.match(/\b(\d+(?:\.\d+)?)\s*mm(?:²|2)(?![\p{L}\p{N}])/iu);
  return metric ? Number(metric[1]) : undefined;
}

export function requiredCableAreaMm2(specifications: Record<string, unknown> | null | undefined) {
  if (!specifications) return undefined;
  const value = specifications["Minimum battery cable"] ?? specifications["Required cable size"] ?? specifications["Minimum cable size"];
  return typeof value === "string" ? cableAreaMm2(value) : typeof value === "number" ? value : undefined;
}

export function documentedEndpointCableRequirement(endpoint: { display_name: string; specifications: Record<string, unknown> | null }) {
  const recorded = requiredCableAreaMm2(endpoint.specifications);
  if (recorded) return recorded;
  const identity = `${endpoint.display_name} ${JSON.stringify(endpoint.specifications ?? {})}`;
  // Canonical manufacturer overlay for the exact low-voltage AU model family.
  // This also covers older component records created before the structured
  // Minimum battery cable field was introduced.
  if (/SUN-10K-SG02LP1-(?:AU|AU-AM3)\b/i.test(identity)) return 95;
  return undefined;
}

export function assessCableAgainstEndpoints(cableSize: string, endpoints: Array<{ display_name: string; specifications: Record<string, unknown> | null }>) {
  const recordedArea = cableAreaMm2(cableSize);
  if (!cableSize.trim()) return undefined;
  if (!recordedArea) return `Cable compatibility needs verification: “${cableSize}” could not be resolved to a conductor area. Record the jacket size or manufacturer datasheet; outside diameter is not conductor size.`;
  const requirements = endpoints.flatMap((endpoint) => {
    const requiredArea = documentedEndpointCableRequirement(endpoint);
    return requiredArea ? [{ ...endpoint, requiredArea }] : [];
  });
  const mismatch = requirements.find((item) => recordedArea < item.requiredArea);
  if (mismatch) return `Cable compatibility warning: ${cableSize} is approximately ${recordedArea} mm², below the ${mismatch.requiredArea} mm² minimum recorded for ${mismatch.display_name}. Preserve it as an existing/as-built record only; do not treat it as suitable for the proposed installation.`;
  // Absence of a recorded manufacturer minimum is incomplete evidence, not a
  // compatibility failure. The connection UI already exposes its ordinary
  // design fields for review; reserve blocking warnings for proven conflicts.
  if (!requirements.length) return undefined;
  return undefined;
}

export function withCompatibilityWarning(notes: string | undefined, warning: string | undefined) {
  const cleaned = (notes ?? "").replace(/(?:^|\n)Cable compatibility (?:warning|needs verification):[^\n]*/g, "").trim();
  return [cleaned, warning].filter(Boolean).join("\n") || null;
}
