const monthKeys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const monthDays = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

type PowerResponse = {
  properties?: { parameter?: { ALLSKY_SFC_SW_DWN?: Record<string, number | undefined> } };
};

export type SiteSolarResource = {
  peakSunHours: number;
  basis: "annual_weighted_average" | "weakest_month";
  source: "NASA POWER ALLSKY_SFC_SW_DWN";
  period: string;
  monthlyPeakSunHours: number[];
};

export function selectPeakSunHours(monthly: number[], standalone: boolean) {
  const valid = monthly.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length !== 12) return undefined;
  if (standalone) return Math.min(...valid);
  const weighted = valid.reduce((sum, value, index) => sum + value * monthDays[index], 0)
    / monthDays.reduce((sum, value) => sum + value, 0);
  return Number(weighted.toFixed(2));
}

/** Load long-term all-sky daily solar energy at the confirmed Site coordinate.
 * kWh/m²/day is the equivalent peak-sun-hours input used by the proposal. */
export async function loadSiteSolarResource(latitude: number, longitude: number, standalone: boolean): Promise<SiteSolarResource> {
  const endYear = new Date().getUTCFullYear() - 1;
  const startYear = Math.max(2001, endYear - 19);
  const endpoint = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
  endpoint.search = new URLSearchParams({
    parameters: "ALLSKY_SFC_SW_DWN",
    // Renewable Energy returns ALLSKY_SFC_SW_DWN in kWh/m²/day. The
    // Sustainable Buildings community returns W/m² and caused the 183.65
    // value that collapsed the proposal to one panel.
    community: "RE",
    longitude: String(longitude),
    latitude: String(latitude),
    start: String(startYear),
    end: String(endYear),
    format: "JSON",
  }).toString();
  const response = await fetch(endpoint, { next: { revalidate: 2_592_000 } });
  if (!response.ok) throw new Error(`NASA POWER returned ${response.status}.`);
  const body = await response.json() as PowerResponse;
  const values = body.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  const monthly = monthKeys.map((key) => Number(values?.[key]));
  const peakSunHours = selectPeakSunHours(monthly, standalone);
  if (!peakSunHours) throw new Error("NASA POWER returned an incomplete Site solar climatology.");
  return {
    peakSunHours,
    basis: standalone ? "weakest_month" : "annual_weighted_average",
    source: "NASA POWER ALLSKY_SFC_SW_DWN",
    period: `${startYear}-${endYear}`,
    monthlyPeakSunHours: monthly.map((value) => Number(value.toFixed(2))),
  };
}
