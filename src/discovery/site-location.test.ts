import { describe, expect, it } from "vitest";
import { confirmedDiscoverySiteLocation } from "./site-location";

describe("Discovery Site location persistence", () => {
  it("accepts a selected town and produces a confirmed Site update", () => {
    expect(confirmedDiscoverySiteLocation({
      site_id: "site-1",
      site_name: "Workshop",
      site_location: "Otaki, New Zealand",
      site_latitude: -40.758,
      site_longitude: 175.15,
      site_timezone: "Pacific/Auckland",
    }, "site-1")).toEqual({
      ok: true,
      update: {
        location: "Otaki, New Zealand",
        latitude: -40.758,
        longitude: 175.15,
        timezone: "Pacific/Auckland",
        location_source: "search",
        location_confirmed: true,
      },
    });
  });

  it("blocks completion until a search result supplies regional coordinates", () => {
    expect(confirmedDiscoverySiteLocation({ site_id: "site-1", site_name: "Workshop" }, "site-1")).toEqual({
      ok: false,
      error: "Choose the Site's town or location from the search results before building the proposal.",
    });
  });

  it("does not silently move an existing system to another Site", () => {
    expect(confirmedDiscoverySiteLocation({
      site_id: "site-2",
      site_location: "Town",
      site_latitude: 10,
      site_longitude: 20,
    }, "site-1")).toMatchObject({ ok: false });
  });
});
