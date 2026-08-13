export interface WeatherSnapshot {
  condition: string;
  temperatureC: number;
  cloudCoverPercent: number;
  solarIrradianceWm2: number;
  forecast: { label: string; solarHours: number; condition: string }[];
}

export interface WeatherProvider {
  currentWeather(location: string): Promise<WeatherSnapshot>;
  hourlyForecast(location: string): Promise<WeatherSnapshot["forecast"]>;
  cloudCover(location: string): Promise<number>;
  solarIrradiance(location: string): Promise<number>;
}

export class MockWeatherProvider implements WeatherProvider {
  private readonly snapshot: WeatherSnapshot = {
    condition: "Bright intervals", temperatureC: 18, cloudCoverPercent: 34,
    solarIrradianceWm2: 712,
    forecast: [
      { label: "Today", solarHours: 4.6, condition: "Mostly sunny" },
      { label: "Tomorrow", solarHours: 3.1, condition: "Some cloud" },
      { label: "Sunday", solarHours: 1.8, condition: "Showers" },
    ],
  };
  async currentWeather() { return this.snapshot; }
  async hourlyForecast() { return this.snapshot.forecast; }
  async cloudCover() { return this.snapshot.cloudCoverPercent; }
  async solarIrradiance() { return this.snapshot.solarIrradianceWm2; }
}
