import { describe, expect, it } from "vitest";
import { isCanonicalEquipmentImage } from "./assets";

describe("isCanonicalEquipmentImage", () => {
  it.each([
    "/schematic-components/battery-shunt.jpg",
    "/guides/battery/battery-shunt-coulometer.png",
    "/guides/low-voltage-dc/removable-key-isolator.png",
  ])("accepts repository-owned component artwork: %s", (path) => {
    expect(isCanonicalEquipmentImage(path)).toBe(true);
  });

  it.each([
    "https://example.com/component.png",
    "/guides/../private.png",
    "/guides/%2e%2e/private.png",
    "/unrelated/component.png",
  ])("rejects non-canonical or unsafe artwork: %s", (path) => {
    expect(isCanonicalEquipmentImage(path)).toBe(false);
  });
});
