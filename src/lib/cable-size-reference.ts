export type AwgCableSize = {
  awg: string;
  aliases: readonly string[];
  areaMm2: number;
  conductorDiameterMm: number;
  nearestMetricMm2: number;
};

// Nominal AWG conductor dimensions follow ASTM B258. The diameter is the
// solid-conductor equivalent; flexible stranding and insulation increase the
// measured diameter of a real cable.
export const AWG_CABLE_SIZES: readonly AwgCableSize[] = [
  { awg: "18 AWG", aliases: ["18 gauge"], areaMm2: 0.823, conductorDiameterMm: 1.024, nearestMetricMm2: 0.75 },
  { awg: "16 AWG", aliases: ["16 gauge"], areaMm2: 1.31, conductorDiameterMm: 1.291, nearestMetricMm2: 1.5 },
  { awg: "14 AWG", aliases: ["14 gauge"], areaMm2: 2.08, conductorDiameterMm: 1.628, nearestMetricMm2: 2.5 },
  { awg: "12 AWG", aliases: ["12 gauge"], areaMm2: 3.31, conductorDiameterMm: 2.053, nearestMetricMm2: 4 },
  { awg: "10 AWG", aliases: ["10 gauge"], areaMm2: 5.26, conductorDiameterMm: 2.588, nearestMetricMm2: 6 },
  { awg: "8 AWG", aliases: ["8 gauge"], areaMm2: 8.37, conductorDiameterMm: 3.264, nearestMetricMm2: 10 },
  { awg: "6 AWG", aliases: ["6 gauge"], areaMm2: 13.3, conductorDiameterMm: 4.115, nearestMetricMm2: 16 },
  { awg: "4 AWG", aliases: ["4 gauge"], areaMm2: 21.2, conductorDiameterMm: 5.189, nearestMetricMm2: 25 },
  { awg: "2 AWG", aliases: ["2 gauge"], areaMm2: 33.6, conductorDiameterMm: 6.544, nearestMetricMm2: 35 },
  { awg: "1 AWG", aliases: ["1 gauge"], areaMm2: 42.4, conductorDiameterMm: 7.348, nearestMetricMm2: 50 },
  { awg: "1/0 AWG", aliases: ["0 AWG", "0 gauge", "one-aught", "one ought"], areaMm2: 53.5, conductorDiameterMm: 8.251, nearestMetricMm2: 50 },
  { awg: "2/0 AWG", aliases: ["00 AWG", "two-aught", "two ought"], areaMm2: 67.4, conductorDiameterMm: 9.266, nearestMetricMm2: 70 },
  { awg: "3/0 AWG", aliases: ["000 AWG", "three-aught", "three ought"], areaMm2: 85.0, conductorDiameterMm: 10.405, nearestMetricMm2: 95 },
  { awg: "4/0 AWG", aliases: ["0000 AWG", "four-aught", "four ought"], areaMm2: 107.2, conductorDiameterMm: 11.684, nearestMetricMm2: 120 },
] as const;

export function normaliseAwgAlias(value: string) {
  const cleaned = value.trim().toLowerCase().replace(/[–—]/g, "-").replace(/^0\s*g$/i, "0 awg").replace(/\s*(awg|gauge)\b/g, " $1").replace(/\s+/g, " ");
  return AWG_CABLE_SIZES.find((size) =>
    size.awg.toLowerCase() === cleaned || size.aliases.some((alias) => alias.toLowerCase().replace(/\s*(awg|gauge)\b/g, " $1") === cleaned),
  );
}
