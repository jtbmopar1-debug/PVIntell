import type { Load } from "./models";

export interface LoadSummary {
  dailyWh: number;
  dailyKWh: number;
  connectedWatts: number;
  simultaneousWatts: number;
  surgeWatts: number;
}

export interface SolarSizingInput {
  dailyWh: number;
  peakSunHours: number;
  systemEfficiency?: number;
  designMargin?: number;
  panelWatts?: number;
}

export interface BatterySizingInput {
  dailyWh: number;
  autonomyDays: number;
  systemVoltage: number;
  depthOfDischarge?: number;
  efficiency?: number;
  designMargin?: number;
}

export function calculateLoads(loads: Load[]): LoadSummary {
  const dailyWh = loads.reduce(
    (total, load) => total + load.watts * load.quantity * load.hoursPerDay,
    0,
  );
  const connectedWatts = loads.reduce(
    (total, load) => total + load.watts * load.quantity,
    0,
  );
  const simultaneousWatts = loads.reduce(
    (total, load) => total + (load.simultaneous ? load.watts * load.quantity : 0),
    0,
  );
  const largestSurgeDelta = loads.reduce(
    (largest, load) => Math.max(largest, (load.surgeWatts - load.watts) * load.quantity),
    0,
  );

  return {
    dailyWh: Math.round(dailyWh),
    dailyKWh: Number((dailyWh / 1000).toFixed(2)),
    connectedWatts: Math.round(connectedWatts),
    simultaneousWatts: Math.round(simultaneousWatts),
    surgeWatts: Math.round(simultaneousWatts + largestSurgeDelta),
  };
}

export function sizeSolar(input: SolarSizingInput) {
  const efficiency = input.systemEfficiency ?? 0.78;
  const margin = input.designMargin ?? 1.2;
  const panelWatts = input.panelWatts ?? 450;
  const requiredWatts = (input.dailyWh * margin) / (input.peakSunHours * efficiency);
  const panelCount = Math.ceil(requiredWatts / panelWatts);
  const suggestedWatts = panelCount * panelWatts;
  const expectedDailyWh = suggestedWatts * input.peakSunHours * efficiency;

  return {
    requiredWatts: Math.round(requiredWatts),
    suggestedWatts,
    panelCount,
    panelWatts,
    expectedDailyWh: Math.round(expectedDailyWh),
    dailySurplusWh: Math.round(expectedDailyWh - input.dailyWh),
  };
}

export function sizeBattery(input: BatterySizingInput) {
  const depthOfDischarge = input.depthOfDischarge ?? 0.8;
  const efficiency = input.efficiency ?? 0.92;
  const margin = input.designMargin ?? 1.1;
  const usableWh = input.dailyWh * input.autonomyDays * margin;
  const nominalWh = usableWh / (depthOfDischarge * efficiency);

  return {
    usableWh: Math.round(usableWh),
    usableKWh: Number((usableWh / 1000).toFixed(1)),
    nominalWh: Math.round(nominalWh),
    nominalKWh: Number((nominalWh / 1000).toFixed(1)),
    ampHours: Math.ceil(nominalWh / input.systemVoltage),
    depthOfDischarge,
  };
}

export function sizeInverter(summary: LoadSummary, headroom = 1.25) {
  const minimumContinuousWatts = Math.ceil(summary.simultaneousWatts * headroom / 500) * 500;
  const minimumSurgeWatts = Math.ceil(summary.surgeWatts / 500) * 500;
  return {
    minimumContinuousWatts,
    recommendedWatts: Math.max(minimumContinuousWatts, 3000),
    minimumSurgeWatts,
  };
}
