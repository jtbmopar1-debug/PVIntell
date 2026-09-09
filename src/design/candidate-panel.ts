/**
 * Concrete module used for preliminary panel counts until the user selects a
 * different product. Only values that agree with the exact-model supplier
 * listing and JA Solar's current manufacturer datasheet are included.
 *
 * Weight is a visible planning midpoint because the current manufacturer sheet
 * and supplier page describe different construction revisions/weights. The
 * label and datasheet shipped with the purchased modules remain authoritative.
 */
export const defaultProposalPanel = {
  manufacturer: undefined as string | undefined,
  model: undefined as string | undefined,
  supplier: undefined as string | undefined,
  productUrl: undefined as string | undefined,
  datasheetUrl: undefined as string | undefined,
  datasheetVersion: undefined as string | undefined,
  panelType: "not_selected" as const,
  watts: 460,
  lengthMm: 1800,
  widthMm: 1150,
  thicknessMm: undefined as number | undefined,
  weightKg: undefined as number | undefined,
  weightBasis: "Not included in preliminary sizing",
  vmpV: undefined as number | undefined,
  vocV: undefined as number | undefined,
  impA: undefined as number | undefined,
  iscA: undefined as number | undefined,
  maximumSystemVoltageV: undefined as number | undefined,
  maximumSeriesFuseA: undefined as number | undefined,
  vocTemperatureCoefficientPercentPerC: undefined as number | undefined,
};

export const defaultProposalPanelWarnings = [
  "Panel count uses a product-neutral 460 W planning rating and 1800 × 1150 mm fit envelope; select an actual module before procurement or detailed electrical design.",
  "No module voltage, current, fuse or temperature-coefficient values are assumed; verify the final string layout against the selected module and inverter datasheets.",
] as const;

export function defaultProposalPanelStringLayout(panelCount: number) {
  const candidates = [1, 2, 3, 4]
    .filter((strings) => panelCount % strings === 0)
    .map((strings) => ({ strings, panelsPerString: panelCount / strings }))
    .filter((layout) => layout.panelsPerString >= 6 && layout.panelsPerString <= 12)
    .sort((left, right) => Math.abs(left.panelsPerString - 10) - Math.abs(right.panelsPerString - 10));
  return candidates[0];
}
