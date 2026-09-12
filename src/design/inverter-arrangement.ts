export type InverterArrangementAdvice = {
  jurisdiction: "nz" | "local_review";
  selectionStatus: "candidate_selected" | "candidate_selected_pending_local_approval";
  unitRatingsKw: number[];
  preferredPhase: "single" | "three" | "confirm";
  message: string;
};

const rounded = (value: number) => Number(value.toFixed(1));
const residentialUnitRatingsKw = [.5, .8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

function repeatedResidentialUnits(requiredKw: number, maximumUnitKw = 10) {
  const quantity = Math.max(1, Math.ceil(requiredKw / maximumUnitKw));
  const minimumPerUnitKw = requiredKw / quantity;
  const unitKw = residentialUnitRatingsKw.find((rating) => rating >= minimumPerUnitKw - 1e-9);
  return unitKw ? Array.from({ length: quantity }, () => unitKw) : [];
}

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
  projectType?: "off-grid" | "grid-tied" | "hybrid";
}): InverterArrangementAdvice | undefined {
  const requiredKw = Number(input.requiredKw);
  if (!Number.isFinite(requiredKw) || requiredKw <= 0) return undefined;
  const location = `${input.siteLocation ?? ""} ${input.timezone ?? ""}`.toLowerCase();
  const isNz = location.includes("new zealand") || input.timezone === "Pacific/Auckland";
  const offGrid = input.projectType === "off-grid";

  if (offGrid) return {
    jurisdiction: isNz ? "nz" : "local_review",
    selectionStatus: isNz ? "candidate_selected" : "candidate_selected_pending_local_approval",
    unitRatingsKw: [rounded(requiredKw)],
    preferredPhase: input.connectionType === "ac_three" ? "three" : input.connectionType === "ac_single" ? "single" : "confirm",
    message: `${rounded(requiredKw)} kW is the required off-grid inverter capacity and may be supplied by one suitable larger inverter or a documented parallel arrangement. Public-grid generation and export thresholds do not apply to a genuinely standalone system; confirm the selected equipment's parallel-operation, phase, battery, surge and protection limits, plus any electrical, building, fire, inspection or sign-off requirements at the Site.`,
  };

  if (!isNz) return {
    jurisdiction: "local_review",
    selectionStatus: "candidate_selected_pending_local_approval",
    unitRatingsKw: [rounded(requiredKw)],
    preferredPhase: input.connectionType === "ac_three" ? "three" : requiredKw > 10 ? "three" : input.connectionType === "ac_single" ? "single" : "confirm",
    message: `${rounded(requiredKw)} kW is the total grid-connected inverter requirement, not a confirmed single-inverter model or a legal capacity determination. Wattson may assess one suitable larger inverter, multiple coordinated units or a three-phase option after applying the Site's country, network, export, phase-balance, approved-equipment, inspection and sign-off requirements.`,
  };

  if (requiredKw <= 10) return {
    jurisdiction: "nz",
    selectionStatus: "candidate_selected",
    unitRatingsKw: [rounded(requiredKw)],
    preferredPhase: input.connectionType === "ac_three" ? "three" : input.connectionType === "ac_single" ? "single" : "confirm",
    message: `${rounded(requiredKw)} kW total is within New Zealand's up-to-10 kW small distributed-generation application class. Confirm the local distributor's export limit, phase rules, approved inverter and MPPT/input limits.`,
  };

  const unitRatingsKw = repeatedResidentialUnits(requiredKw);
  const phaseMessage = input.connectionType === "ac_three"
    ? `Prefer a ${rounded(requiredKw)} kW-class three-phase arrangement, or ${unitRatingsKw.join(" + ")} kW units where the selected equipment and distributor permit it.`
    : input.connectionType === "ac_single"
      ? `Do not present this as one oversized residential inverter: cap the base option at 10 kW, compare ${unitRatingsKw.join(" + ")} kW units, and assess a three-phase supply/inverter option.`
      : `Compare a 10 kW capped option, ${unitRatingsKw.join(" + ")} kW units, and a three-phase arrangement after confirming the site's phase supply.`;
  return {
    jurisdiction: "nz",
    selectionStatus: "candidate_selected",
    unitRatingsKw,
    preferredPhase: "three",
    message: `${phaseMessage} More than 10 kW total nameplate capacity follows New Zealand's larger Part 2 distributed-generation application process; splitting it across two units does not avoid that threshold.`,
  };
}
