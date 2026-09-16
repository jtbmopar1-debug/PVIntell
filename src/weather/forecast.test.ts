import { describe, expect, it } from "vitest";
import { fiveDaySolarOutlook, latestForecastHour, type SolarWeatherHour } from "./forecast";

const hour = (time: string, irradiance: number): SolarWeatherHour => ({
  time,
  irradiance,
  temperature: 14,
  cloudCover: 99,
  precipitation: 0,
  windSpeed: 1.4,
  uvIndex: 1,
});

describe("Site-local solar horizon", () => {
  const context = { latitude: -38.14, longitude: 176.25, timezone: "Pacific/Auckland" };

  it("shows zero live irradiance after sunset instead of the stale hourly bucket", () => {
    const result = latestForecastHour(
      [hour("2026-09-15T06:00:00.000Z", 104)],
      new Date("2026-09-15T06:40:00.000Z"),
      context,
    );
    expect(result?.irradiance).toBe(0);
    expect(result?.uvIndex).toBe(0);
  });

  it("removes provider irradiance from forecast hours that fall after sunset", () => {
    const result = fiveDaySolarOutlook(
      [hour("2026-09-15T05:00:00.000Z", 104), hour("2026-09-15T07:00:00.000Z", 35)],
      context.timezone,
      5,
      new Date("2026-09-15T00:00:00.000Z"),
      context,
    );
    expect(result[0]?.hours.at(-1)?.irradiance).toBe(0);
  });

  it("retains the provider reading during daylight", () => {
    const result = latestForecastHour(
      [hour("2026-09-14T23:00:00.000Z", 620)],
      new Date("2026-09-14T23:30:00.000Z"),
      context,
    );
    expect(result?.irradiance).toBe(620);
  });
});
