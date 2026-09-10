import { describe, expect, it } from "vitest";
import { assessPanelSurfaces, mountingShoppingItems } from "./panel-surfaces";

const design = { panelCount: 8, panelLengthMm: 2000, panelWidthMm: 1000, mountingLocations: ["main_roof"] };
function discovery(direction: string, slope: string) {
  return {
    panel_area_dimensions: { value: JSON.stringify([{ id: "main_roof-0", name: "Main roof", lengthM: 6, widthM: 7 }]) },
    orientation_and_pitch: { value: JSON.stringify([{ id: "main_roof-0", name: "Main roof", direction, slope }]) },
  };
}
describe("roof fit, aspect and mounting purchases", () => {
  it("adds a tilt kit for a flat roof and carries its latitude-based target", () => {
    const answers = discovery("flat", "flat");
    const result = assessPanelSurfaces(answers, design, -37);
    expect(result.faces[0]).toMatchObject({ mounting: "tilt_frame", tiltedRowSpacingPending: true });
    expect(result.status).toBe("unverified");
    expect(mountingShoppingItems(answers, design, -37)[0]).toMatchObject({ name: "Solar tilt frame / adjustable strut kit", specification: expect.stringContaining("37°") });
  });
  it("follows a pitched roof without buying tilt struts", () => {
    const answers = discovery("north", "medium");
    const result = assessPanelSurfaces(answers, design, -37);
    expect(result.faces[0]).toMatchObject({ azimuthDegrees: 0, pitch: "21–35°", mounting: "roof_rails" });
    expect(mountingShoppingItems(answers, design, -37)).toEqual([]);
  });
  it.each([[37, "north"], [-37, "south"]])("flags the pole-facing roof at latitude %s", (latitude, direction) => {
    const result = assessPanelSurfaces(discovery(direction, "steep"), design, latitude);
    expect(result.warnings).toContainEqual(expect.stringContaining("Faces away from the equator"));
  });
  it("catches a power-driven array enlargement that exceeds the available roof", () => {
    const result = assessPanelSurfaces(discovery("north", "medium"), { ...design, panelCount: 24 }, -37);
    expect(result.status).toBe("exceeds_space");
    expect(result.capacity).toBeLessThan(24);
  });
  it("deducts recorded obstructions and rejects a wholly blocked surface", () => {
    const result = assessPanelSurfaces({ ...discovery("north", "medium"), panel_area_constraints: { value: JSON.stringify([{ areaId: "main_roof-0", kind: "access", lengthM: 6, widthM: 7 }]) } }, design, -37);
    expect(result.capacity).toBe(0);
    expect(result.status).toBe("exceeds_space");
  });
  it("does not claim the extra array fits using the owned array's dimensions", () => {
    const result = assessPanelSurfaces(discovery("north", "medium"), { ...design, existingPanelGroup: { name: "Owned", availableCount: 8, proposedUseCount: 8, supplementaryTargetPvKw: 3, assessmentStatus: "provisional_pending_datasheet_and_condition" } }, -37);
    expect(result.status).toBe("unverified");
    expect(result.totalAreaM2).toBeUndefined();
    expect(result.warnings).toContainEqual(expect.stringContaining("additional 3 kW array"));
  });
  it("does not treat blank dimensions as zero available space", () => {
    const result = assessPanelSurfaces({ panel_area_dimensions: JSON.stringify([{ id: "roof", lengthM: "", widthM: "" }]) }, design, -37);
    expect(result.capacity).toBeUndefined();
    expect(result.status).toBe("unverified");
  });
});
