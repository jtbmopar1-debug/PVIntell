export type ProposalPanelCategory = "monofacial" | "bifacial" | "flexible";

export type ProposalPanelProfile = {
  category: ProposalPanelCategory;
  label: string;
  basis: string;
  panelType: ProposalPanelCategory;
  watts: number;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  weightKg: number;
  weightBasis: string;
  vmpV: number;
  vocV: number;
  impA: number;
  iscA: number;
  maximumSystemVoltageV: number;
  maximumSeriesFuseA: number;
  vocTemperatureCoefficientPercentPerC: number;
};

/**
 * Product-neutral planning profiles. The values are realistic module-class
 * examples for proposal maths, not preferred products or guaranteed specs.
 * A selected module's current datasheet must replace them before detailed
 * string design, purchasing, structural assessment or installation.
 */
export const proposalPanelProfiles: Record<ProposalPanelCategory, ProposalPanelProfile> = {
  monofacial: {
    category: "monofacial", label: "Rigid monofacial planning module",
    basis: "Representative current high-output residential rigid module",
    panelType: "monofacial", watts: 460, lengthMm: 1762, widthMm: 1134, thicknessMm: 30,
    weightKg: 23.4, weightBasis: "Representative planning value",
    vmpV: 33.17, vocV: 39.7, impA: 13.87, iscA: 14.64,
    maximumSystemVoltageV: 1500, maximumSeriesFuseA: 25,
    vocTemperatureCoefficientPercentPerC: -.25,
  },
  bifacial: {
    category: "bifacial", label: "Rigid bifacial planning module",
    basis: "Representative current double-glass N-type residential module; rear-side gain excluded",
    panelType: "bifacial", watts: 450, lengthMm: 1762, widthMm: 1134, thicknessMm: 30,
    weightKg: 24.8, weightBasis: "Representative double-glass planning value",
    vmpV: 33.0, vocV: 39.5, impA: 13.64, iscA: 14.4,
    maximumSystemVoltageV: 1500, maximumSeriesFuseA: 25,
    vocTemperatureCoefficientPercentPerC: -.25,
  },
  flexible: {
    category: "flexible", label: "Flexible/lightweight planning module",
    basis: "Representative 400 W glass-free flexible module",
    panelType: "flexible", watts: 400, lengthMm: 1735, widthMm: 1141, thicknessMm: 3,
    weightKg: 6.7, weightBasis: "Representative lightweight planning value",
    vmpV: 30.7, vocV: 37.1, impA: 13.03, iscA: 13.66,
    maximumSystemVoltageV: 1000, maximumSeriesFuseA: 20,
    vocTemperatureCoefficientPercentPerC: -.28,
  },
};

export const defaultProposalPanel = {
  ...proposalPanelProfiles.monofacial,
  manufacturer: undefined as string | undefined,
  model: undefined as string | undefined,
  supplier: undefined as string | undefined,
  productUrl: undefined as string | undefined,
  datasheetUrl: undefined as string | undefined,
  datasheetVersion: undefined as string | undefined,
};

export const defaultProposalPanelWarnings = [
  "Panel wattage, dimensions, weight and electrical values are representative estimates for the selected panel class; the panels purchased may have different specifications.",
  "Replace every planning-module value with the selected product datasheet before procurement, structural assessment or detailed electrical design.",
] as const;

export function proposalPanelProfile(panelType: unknown) {
  return panelType === "bifacial" ? proposalPanelProfiles.bifacial
    : panelType === "flexible" ? proposalPanelProfiles.flexible
    : proposalPanelProfiles.monofacial;
}

export function defaultProposalPanelStringLayout(panelCount: number, profile: ProposalPanelProfile = defaultProposalPanel) {
  const candidates = [1, 2, 3, 4]
    .filter((strings) => panelCount % strings === 0)
    .map((strings) => ({ strings, panelsPerString: panelCount / strings }))
    .filter((layout) => layout.panelsPerString >= 6 && layout.panelsPerString <= 12)
    .sort((left, right) => Math.abs(left.panelsPerString - 10) - Math.abs(right.panelsPerString - 10));
  const selected = candidates[0];
  if (!selected) return undefined;
  const coldVocPerPanel = profile.vocV * (1 + Math.abs(profile.vocTemperatureCoefficientPercentPerC) / 100 * 35);
  return {
    ...selected,
    stringVmpV: Number((selected.panelsPerString * profile.vmpV).toFixed(1)),
    stringVocV: Number((selected.panelsPerString * profile.vocV).toFixed(1)),
    coldStringVocV: Number((selected.panelsPerString * coldVocPerPanel).toFixed(1)),
    minimumMpptCurrentA: profile.impA,
    minimumInputShortCircuitCurrentA: profile.iscA,
    planningMinimumTemperatureC: -10,
  };
}
