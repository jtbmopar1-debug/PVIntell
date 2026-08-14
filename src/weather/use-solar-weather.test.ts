import { describe, expect, it } from "vitest";
import { localDateKey } from "./use-solar-weather";

describe("solar weather daily cache date", () => {
  it("uses the site's timezone around midnight", () => {
    const instant = new Date("2026-08-14T12:30:00.000Z");
    expect(localDateKey(instant, "Pacific/Auckland")).toBe("2026-08-15");
    expect(localDateKey(instant, "Pacific/Honolulu")).toBe("2026-08-14");
  });
});
