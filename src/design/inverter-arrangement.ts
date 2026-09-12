export type InverterArrangementAdvice = {
  jurisdiction: "nz" | "local_review";
  unitRatingsKw: number[];
  preferredPhase: "single" | "three" | "confirm";
  message: string;
};

const rounded = (value: number) => Number(value.toFixed(1));

/**
 * Converts a calculated total AC requirement into a market-aware equipment
 * topology. Only verified jurisdiction profiles should be added here; an
 * unknown country must never inherit another country's residential limits.
 */
export function inverterArrangementAdvice(input: {
  requiredKw?: number;
  siteLocation?: string;
  timezone?: string;
  connectionType?: "dc" | "ac_single" | "ac_three";
}): InverterArrangementAdvice | undefined {
  const requiredKw = Number(input.requiredKw);
  if (!Number.isFinite(requiredKw) || requiredKw <= 0) return undefined;
  const location = `${input.siteLocation ?? ""} ${input.timezone ?? ""}`.toLowerCase();
  const isNz = location.includes("new zealand") || input.timezone === "Pacific/Auckland";

  if (!isNz) return {
    jurisdiction: "local_review",
    unitRatingsKw: [rounded(requiredKw)],
    preferredPhase: input.connectionType === "ac_three" ? "three" : input.connectionType === "ac_single" ? "single" : "confirm",
    message: `${rounded(requiredKw)} kW is a total AC requirement, not a confirmed single-inverter model. Confirm the country's small-generation threshold, distributor export limit, phase-balance rules, approved inverter standard, and each model's MPPT/string limits before selecting one or more units.`,
  };

  if (requiredKw <= 10) return {
    jurisdiction: "nz",
    unitRatingsKw: [rounded(requiredKw)],
    preferredPhase: input.connectionType === "ac_three" ? "three" : input.connectionType === "ac_single" ? "single" : "confirm",
    message: `${rounded(requiredKw)} kW total is within New Zealand's up-to-10 kW small distributed-generation application class. Confirm the local distributor's export limit, phase rules, approved inverter and MPPT/input limits.`,
  };

  const firstUnit = Math.min(10, rounded(Math.ceil(requiredKw / 2)));
  const secondUnit = rounded(requiredKw - firstUnit);
  const unitRatingsKw = secondUnit > 0 ? [firstUnit, secondUnit] : [firstUnit];
  const phaseMessage = input.connectionType === "ac_three"
    ? `Prefer a ${rounded(requiredKw)} kW-class three-phase arrangement, or ${unitRatingsKw.join(" + ")} kW units where the selected equipment and distributor permit it.`
    : input.connectionType === "ac_single"
      ? `Do not present this as one oversized residential inverter: cap the base option at 10 kW, compare ${unitRatingsKw.join(" + ")} kW units, and assess a three-phase supply/inverter option.`
      : `Compare a 10 kW capped option, ${unitRatingsKw.join(" + ")} kW units, and a three-phase arrangement after confirming the site's phase supply.`;
  return {
    jurisdiction: "nz",
    unitRatingsKw,
    preferredPhase: "three",
    message: `${phaseMessage} More than 10 kW total nameplate capacity follows New Zealand's larger Part 2 distributed-generation application process; splitting it across two units does not avoid that threshold.`,
  };
}
