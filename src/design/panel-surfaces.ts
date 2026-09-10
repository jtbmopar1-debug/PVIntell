import type { DesignCalculatorState } from "@/domain/models";
import { answerList, discoveryValue, proposalIncludesSolar } from "./proposal-inputs";
import { recommendedPanelOrientation } from "./panel-orientation";

const directions: Record<string, number> = { north: 0, north_east: 45, east: 90, south_east: 135, south: 180, south_west: 225, west: 270, north_west: 315 };
const pitches: Record<string, string> = { flat: "0–5°", low: "6–20°", medium: "21–35°", steep: "36–60°", very_steep: "61–89°", vertical: "90°" };
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
function rows(value: unknown): Record<string, unknown>[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row === "object" && !Array.isArray(row)) : [];
  } catch { return []; }
}

/** Geometric screening, not a roof engineering or irradiance simulation. */
export function assessPanelSurfaces(discovery: Record<string, unknown>, design: DesignCalculatorState, latitude?: number) {
  const recommendations = recommendedPanelOrientation(design, latitude);
  const areas = proposalIncludesSolar(discovery) ? rows(discoveryValue(discovery, "panel_area_dimensions")) : [];
  const orientations = rows(discoveryValue(discovery, "orientation_and_pitch"));
  const obstructions = rows(discoveryValue(discovery, "panel_area_constraints"));
  const locations = design.mountingLocations?.length ? design.mountingLocations : answerList(discoveryValue(discovery, "proposed_panel_location") ?? discoveryValue(discovery, "panel_location"));
  const moduleLength = positive(design.panelLengthMm);
  const moduleWidth = positive(design.panelWidthMm);
  const faces = areas.map((area) => {
    const id = String(area.id ?? "");
    const name = String(area.name ?? "Panel area");
    const orientation = orientations.find((row) => row.id === area.id || row.name === area.name);
    const direction = String(orientation?.direction ?? "");
    const slope = String(orientation?.slope ?? "");
    const azimuth = directions[direction];
    const roof = /roof|carport|pergola/.test(id) || locations.length > 0 && locations.every((location) => /roof|carport|pergola/.test(location));
    const flat = slope === "flat";
    const mounting = roof ? flat && (recommendations.tiltDegrees ?? 0) > 5 ? "tilt_frame" : slope && slope !== "flat" ? "roof_rails" : flat ? "roof_rails" : "confirm_roof_pitch"
      : locations.includes("ground") ? "ground_frame" : "specialist_frame";
    const length = positive(area.lengthM);
    const width = positive(area.widthM);
    const excludedAreaM2 = obstructions.filter((row) => row.kind !== "none" && row.areaId === area.id)
      .reduce((sum, row) => sum + (positive(row.lengthM) ?? 0) * (positive(row.widthM) ?? 0), 0);
    const usableAreaM2 = length && width ? Math.max(0, length * width - excludedAreaM2) : undefined;
    let capacity: number | undefined;
    if (length && width && moduleLength && moduleWidth) {
      const a = moduleLength / 1000, b = moduleWidth / 1000, gap = .02;
      const portrait = Math.floor((length + gap) / (a + gap)) * Math.floor((width + gap) / (b + gap));
      const landscape = Math.floor((length + gap) / (b + gap)) * Math.floor((width + gap) / (a + gap));
      capacity = Math.max(0, Math.max(portrait, landscape) - Math.ceil(excludedAreaM2 / (a * b)));
    }
    const ideal = recommendedPanelOrientation({}, latitude).azimuthDegrees;
    const difference = azimuth === undefined || ideal === undefined ? undefined : Math.abs(((azimuth - ideal + 540) % 360) - 180);
    const aspect = flat ? "Tilt-frame direction can be chosen independently of the roof face."
      : difference === undefined ? "Roof-face direction still needs confirming."
        : difference > 90 ? "Faces away from the equator; assess seasonal yield before allocating panels here."
          : difference === 90 ? "East/west face: compare morning or afternoon yield with the load schedule."
            : "Generally favourable aspect; shade and seasonal yield still affect the result.";
    const mountingDescription = mounting === "tilt_frame"
      ? `Tilt frame / struts to target ${recommendations.tiltDegrees}°; row spacing and wind loading must be designed.`
      : mounting === "roof_rails" ? `Roof rails following the recorded ${pitches[slope] ?? "roof"} pitch; no added tilt struts assumed.`
        : mounting === "confirm_roof_pitch" ? "Confirm roof pitch before selecting rails or tilt hardware."
          : mounting === "ground_frame" ? "Ground frame and foundations for the selected panel angle."
            : "Mounting frame matched to this surface and panel type.";
    return { id, name, direction, azimuthDegrees: azimuth, pitch: pitches[slope], mounting, mountingDescription, aspect, usableAreaM2, capacity, tiltedRowSpacingPending: mounting === "tilt_frame" || mounting === "ground_frame" };
  });
  const capacityKnown = faces.length > 0 && faces.every((face) => face.capacity !== undefined);
  const capacity = capacityKnown ? faces.reduce((sum, face) => sum + (face.capacity ?? 0), 0) : undefined;
  const knownCount = design.existingPanelGroup?.proposedUseCount ?? design.panelCount;
  const extra = design.existingPanelGroup;
  const extraCapacity = positive(extra?.supplementaryTargetPvKw);
  const extraArea = extraCapacity && positive(extra?.supplementaryCount) && positive(extra?.supplementaryLengthMm) && positive(extra?.supplementaryWidthMm)
    ? Number(extra?.supplementaryCount) * Number(extra?.supplementaryLengthMm) * Number(extra?.supplementaryWidthMm) / 1e6 : undefined;
  const moduleAreaM2 = knownCount && moduleLength && moduleWidth ? knownCount * moduleLength * moduleWidth / 1e6 : undefined;
  const totalAreaM2 = moduleAreaM2 !== undefined && (!extraCapacity || extraArea !== undefined) ? moduleAreaM2 + (extraArea ?? 0) : undefined;
  const availableAreaM2 = faces.length && faces.every((face) => face.usableAreaM2 !== undefined) ? faces.reduce((sum, face) => sum + (face.usableAreaM2 ?? 0), 0) : undefined;
  const exceedsSpace = (capacity !== undefined && Number(knownCount) > capacity)
    || totalAreaM2 !== undefined && availableAreaM2 !== undefined && totalAreaM2 > availableAreaM2;
  const warnings: string[] = [];
  if (exceedsSpace) warnings.push("The proposed modules exceed the recorded usable mounting space. Allocate another suitable surface or revise the array before confirming this layout.");
  if (extraCapacity && extraArea === undefined) warnings.push(`The additional ${extraCapacity} kW array has no confirmed module dimensions or surface allocation. Its physical fit is not yet demonstrated.`);
  if (faces.some((face) => face.tiltedRowSpacingPending)) warnings.push("Flat-roof or ground tilt frames need a row-spacing and shadow layout; the rectangular module count does not include that spacing.");
  for (const face of faces) if (face.aspect.startsWith("Faces away")) warnings.push(`${face.name}: ${face.aspect}`);
  const status = exceedsSpace ? "exceeds_space" : capacity === undefined || extraCapacity || faces.some((face) => face.tiltedRowSpacingPending) ? "unverified" : "fits_planning_grid";
  return { ...recommendations, faces, capacity, availableAreaM2, totalAreaM2, status, warnings };
}

export function mountingShoppingItems(discovery: Record<string, unknown>, design: DesignCalculatorState, latitude?: number) {
  const assessment = assessPanelSurfaces(discovery, design, latitude);
  return assessment.faces.filter((face) => face.mounting === "tilt_frame").map((face) => ({
    name: "Solar tilt frame / adjustable strut kit",
    specification: `${face.name}: ${face.mountingDescription} Compatible feet, rails, braces and fixings from the selected mounting system.`,
    quantity: "Quantity from mounting layout", regulated: false,
    basis: "Recorded flat roof with a raised panel-angle recommendation",
  }));
}
