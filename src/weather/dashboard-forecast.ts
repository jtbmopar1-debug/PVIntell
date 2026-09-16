import type { SolarArrayForecastInput } from "@/weather/forecast";

export interface DashboardSolarArrayRow {
  project_id: string;
  panel_watts: number | string | null;
  panel_count: number | string | null;
  orientation_degrees: number | string | null;
  tilt_degrees: number | string | null;
}

export function dashboardSolarArraysBySystem(
  systemIds: string[],
  rows: DashboardSolarArrayRow[],
): Record<string, SolarArrayForecastInput[]> {
  return Object.fromEntries(systemIds.map((systemId) => [
    systemId,
    rows.flatMap((array) => {
      if (array.project_id !== systemId) return [];
      const capacityKw = Number(array.panel_watts ?? 0) * Number(array.panel_count ?? 0) / 1000;
      if (capacityKw <= 0) return [];
      return [{
        capacityKw,
        azimuthDegrees: array.orientation_degrees == null ? null : Number(array.orientation_degrees),
        tiltDegrees: array.tilt_degrees == null ? null : Number(array.tilt_degrees),
      }];
    }),
  ]));
}
