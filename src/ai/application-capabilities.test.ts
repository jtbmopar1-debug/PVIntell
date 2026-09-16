import { describe, expect, it } from "vitest";
import { containsUnsupportedSettingsSetupAdvice, wattsonApplicationCapabilities } from "./application-capabilities";

describe("Wattson application grounding", () => {
  it("defines actual setup destinations instead of generic Settings", () => {
    const context = wattsonApplicationCapabilities();
    expect(context.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Start a new system", path: "/discovery/new-system" }),
      expect.objectContaining({ name: "System Capture", path: "/record-installed" }),
    ]));
    expect(context.pages.find((page) => page.name === "Settings")?.purpose).toMatch(/not a generic system-setup workflow/i);
  });

  it("detects invented generic Settings setup directions without blocking real Settings functions", () => {
    expect(containsUnsupportedSettingsSetupAdvice("Go to Settings to set up the system and add the controller.")).toBe(true);
    expect(containsUnsupportedSettingsSetupAdvice("Open Settings, then build the schematic.")).toBe(true);
    expect(containsUnsupportedSettingsSetupAdvice("Open Settings > Unused Inventory to review unassigned equipment.")).toBe(false);
    expect(containsUnsupportedSettingsSetupAdvice("Open Settings to change your preferences.")).toBe(false);
  });
});
