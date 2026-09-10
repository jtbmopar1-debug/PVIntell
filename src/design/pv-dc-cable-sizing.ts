const copperResistivityOhmMm2PerM = 0.0175;
const commonCableSizesMm2 = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120] as const;

const finitePositive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

const planningCableForCurrent = (amps: number) => amps <= 10 ? 1.5 : amps <= 16 ? 2.5 : amps <= 25 ? 4 : amps <= 32 ? 6 : amps <= 50 ? 10 : amps <= 63 ? 16 : amps <= 80 ? 25 : amps <= 100 ? 35 : amps <= 125 ? 50 : amps <= 160 ? 70 : 95;

const nextCommonCableSize = (minimumMm2: number) => commonCableSizesMm2.find((size) => size >= minimumMm2) ?? Math.ceil(minimumMm2);

export type PvDcCableSuggestion = {
  cableSizeMm2?: number;
  protectionAmps?: undefined;
  operatingVoltageV?: number;
  operatingCurrentA?: number;
  designCurrentA?: number;
  voltageDropPercent?: number;
  notes: string;
  warning?: string;
};

export function suggestPvDcStringCable(input: {
  panelsPerString?: unknown;
  panelVmpV?: unknown;
  panelImpA?: unknown;
  panelIscA?: unknown;
  lengthM?: unknown;
  maximumVoltageDropPercent?: unknown;
}): PvDcCableSuggestion {
  const panelsPerString = finitePositive(input.panelsPerString);
  const panelVmpV = finitePositive(input.panelVmpV);
  const panelImpA = finitePositive(input.panelImpA);
  const panelIscA = finitePositive(input.panelIscA);
  const lengthM = finitePositive(input.lengthM);
  const maximumVoltageDropPercent = finitePositive(input.maximumVoltageDropPercent) ?? 2;

  if (!panelsPerString || !Number.isInteger(panelsPerString) || !panelVmpV || !panelImpA || !panelIscA || !lengthM) {
    return {
      notes: "PV DC cable sizing requires a confirmed panels-per-string layout plus module Vmp, Imp and Isc values.",
      warning: "Complete the PV string layout and module electrical values before calculating this route.",
    };
  }

  const operatingVoltageV = panelsPerString * panelVmpV;
  const operatingCurrentA = panelImpA;
  const designCurrentA = panelIscA * 1.25;
  const minimumByVoltageDropMm2 = 2 * copperResistivityOhmMm2PerM * lengthM * operatingCurrentA
    / (operatingVoltageV * maximumVoltageDropPercent / 100);
  const cableSizeMm2 = nextCommonCableSize(Math.max(minimumByVoltageDropMm2, planningCableForCurrent(designCurrentA)));
  const voltageDropV = 2 * copperResistivityOhmMm2PerM * lengthM * operatingCurrentA / cableSizeMm2;

  return {
    cableSizeMm2,
    protectionAmps: undefined,
    operatingVoltageV: Number(operatingVoltageV.toFixed(2)),
    operatingCurrentA: Number(operatingCurrentA.toFixed(2)),
    designCurrentA: Number(designCurrentA.toFixed(2)),
    voltageDropPercent: Number((voltageDropV / operatingVoltageV * 100).toFixed(2)),
    notes: "Preliminary PV DC string-cable sizing uses string Vmp and module Imp for voltage drop, with 125% of module Isc as the current-capacity planning reference. String overcurrent protection is not selected automatically; verify whether it is required from parallel-string reverse current, the module maximum-series-fuse rating, inverter instructions and local rules.",
  };
}
