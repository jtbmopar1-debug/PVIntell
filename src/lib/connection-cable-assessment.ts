import { normaliseAwgAlias } from "@/lib/cable-size-reference";

export function cableAreaMm2(value: string) {
  const awgToken = value.match(/\b(?:[1-4]\s*\/\s*0|0{1,4}|(?:one|two|three|four)[- ]?(?:aught|ought)|\d{1,2})\s*(?:AWG|gauge|G)\b/i)?.[0];
  const awg = normaliseAwgAlias(awgToken ?? value);
  if (awg) return awg.areaMm2;
  // This field explicitly asks for cable size, and metric conductor area is
  // commonly entered as "4 mm" as well as "4 mm²" or "4 mm2".
  const metric = value.match(/\b(\d+(?:\.\d+)?)\s*mm(?:²|2)?(?![\p{L}\p{N}])/iu);
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

export function assessCableAgainstEndpoints(
  cableSize: string,
  endpoints: Array<{ display_name: string; specifications: Record<string, unknown> | null }>,
  circuitRole: "pv_dc" | "battery_dc" | "auxiliary_dc" | "unspecified" = "unspecified",
) {
  const recordedArea = cableAreaMm2(cableSize);
  if (!cableSize.trim()) return undefined;
  if (!recordedArea) return `Cable compatibility needs verification: “${cableSize}” could not be resolved to a conductor area. Record the jacket size or manufacturer datasheet; outside diameter is not conductor size.`;
  // Battery-conductor minima on hybrid inverters apply to the battery port,
  // not to PV strings arriving at an MPPT or to an auxiliary DC circuit.
  const requirements = circuitRole === "pv_dc" || circuitRole === "auxiliary_dc" ? [] : endpoints.flatMap((endpoint) => {
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
  const cleaned = (notes ?? "").replace(/(?:^|\n)(?:Cable compatibility (?:warning|needs verification):|AC application warning:|AC cable size needs verification:|AC cable size is not recorded;|AC cable length is not recorded;|AC breaker\/protection is not recorded;|AC isolation details are not recorded;|AC cable route is not recorded;)[^\n]*/g, "").trim();
  return [cleaned, warning].filter(Boolean).join("\n") || null;
}

type AcEndpoint = { display_name: string; type?: string; specifications: Record<string, unknown> | null };

/** Advisory checks for an Orange/System Capture AC connection record. */
export function assessAcConnectionRecord(input: {
  cableSize?: string;
  cableLength?: string;
  breakerSize?: string;
  isolator?: string;
  route?: string;
  endpoints: AcEndpoint[];
}) {
  const warnings: string[] = [];
  const dcEndpoint = input.endpoints.some((endpoint) => {
    const type = endpoint.type ?? "";
    const name = endpoint.display_name;
    return /^(?:panel|pv_string|battery|charger|combiner)$/i.test(type) ||
      (/\b(?:dc|pv|solar|battery|busbar|mppt)\b/i.test(name) && !/\bac\b/i.test(name));
  });
  if (dcEndpoint)
    warnings.push("AC application warning: one endpoint appears to be DC/PV equipment; verify that this is the intended AC port or connection path.");
  if (input.cableSize && !cableAreaMm2(input.cableSize))
    warnings.push("AC cable size needs verification: record the conductor area or manufacturer cable designation.");
  if (!input.cableSize) warnings.push("AC cable size is not recorded; cable ampacity and voltage drop cannot be checked.");
  if (!input.cableLength) warnings.push("AC cable length is not recorded; voltage drop cannot be checked.");
  if (!input.breakerSize) warnings.push("AC breaker/protection is not recorded; cable and protection coordination cannot be checked.");
  if (!input.isolator) warnings.push("AC isolation details are not recorded; the required isolation arrangement needs verification.");
  if (!input.route) warnings.push("AC cable route is not recorded; installation method and derating cannot be checked.");
  return warnings.length ? warnings.join("\n") : undefined;
}
