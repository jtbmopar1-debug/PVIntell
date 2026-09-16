export type LocationMatch = { name: string; label: string; latitude: number; longitude: number; timezone: string; countryCode?: string };

export function locationSearchPath(query: string) {
  const params = new URLSearchParams({ q: query.trim() });
  return `/api/location/search?${params.toString()}`;
}
