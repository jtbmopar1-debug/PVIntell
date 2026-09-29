import type { DiscoveryAnswers } from "./new-system";

type ConfirmedSiteLocation = {
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  location_source: "search";
  location_confirmed: true;
};

type SiteLocationResult =
  | { ok: true; update: ConfirmedSiteLocation }
  | { ok: false; error: string };

/**
 * Converts the town/locality selected during Discovery into the Site update
 * that must be saved before any location-dependent proposal calculation runs.
 */
export function confirmedDiscoverySiteLocation(
  answers: DiscoveryAnswers,
  expectedSiteId: string,
  fallbackTimezone = "UTC",
): SiteLocationResult {
  const selectedSiteId = typeof answers.site_id === "string" ? answers.site_id : "";
  if (selectedSiteId && selectedSiteId !== "__new__" && selectedSiteId !== expectedSiteId) {
    return { ok: false, error: "This power system belongs to a different Site. Return to its current Site before completing Discovery." };
  }

  const latitude = typeof answers.site_latitude === "number" ? answers.site_latitude : undefined;
  const longitude = typeof answers.site_longitude === "number" ? answers.site_longitude : undefined;
  if (latitude === undefined || longitude === undefined) {
    return { ok: false, error: "Choose the Site's town or location from the search results before building the proposal." };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ok: false, error: "The selected Site location is invalid. Search for the town or location again." };
  }

  const location = String(answers.site_location ?? answers.site_name ?? "").trim();
  if (!location) {
    return { ok: false, error: "Choose the Site's town or location from the search results before building the proposal." };
  }

  return {
    ok: true,
    update: {
      location,
      latitude,
      longitude,
      timezone: String(answers.site_timezone ?? fallbackTimezone).trim() || "UTC",
      location_source: "search",
      location_confirmed: true,
    },
  };
}
