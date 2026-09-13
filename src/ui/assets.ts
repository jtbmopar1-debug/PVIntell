/** Canonical UI assets. Replacements belong here so every surface changes together. */
export const GRID_CONNECTION_IMAGE = "/schematic-components/grid-connection-v2.png";
export const METER_BOARD_IMAGE = "/schematic-components/meter-board-socket-enclosure.png";
export const SMART_ELECTRICITY_METER_IMAGE = "/schematic-components/smart-electricity-meter.png";
export const NON_COMMUNICATING_DIGITAL_METER_IMAGE = "/schematic-components/non-communicating-digital-meter.png";
export const DC_CABLE_IMAGE = "/schematic-components/dc-battery-cable.png";
export const AS_BUILT_SCHEMATIC_IMAGE = "/guides/records/as-built-system-schematic.png";
export const AZIMUTH_TILT_IMAGE = "/guides/solar-geometry/azimuth-and-tilt-angle.png";
export const PLUG_IN_POWER_METER_IMAGE = "/schematic-components/plug-in-power-meter.png";
export const POOL_CIRCULATION_PUMP_IMAGE = "/guides/pool-equipment/pool-circulation-pump.png";
export const THERMAL_VS_ELECTRICAL_IMAGE = "/guides/energy-concepts/thermal-vs-electrical-input.png";
export const PURE_VS_MODIFIED_SINE_IMAGE = "/guides/energy-concepts/pure-vs-modified-sine-wave.png";
export const UNSAFE_BACKFEED_IMAGE = "/guides/energy-concepts/unsafe-backfeed.png";
export const COEFFICIENT_OF_PERFORMANCE_IMAGE = "/guides/energy-concepts/coefficient-of-performance.png";
export const METERING_REGION_IMAGE = "/guides/location/metering-region-world-map.png";
export const POOL_OR_SPA_COVER_IMAGE = "/guides/pool-equipment/pool-or-spa-cover.png";
export const PV_STRING_IMAGE = "/guides/panels/pv-string-series.png";
export const AUTOMATIC_GENERATOR_START_IMAGE = "/schematic-components/automatic-generator-start-controller.png";
export const ELECTRIC_HOT_WATER_CYLINDER_IMAGE = "/guides/solar-hot-water/electric-hot-water-cylinder.png";
export const EARTH_ELECTRODE_IMAGE = "/schematic-components/earth-electrode.png";

/** Accept only repository-owned equipment artwork. This is shared by the
 * library picker and every schematic renderer so an accepted selection cannot
 * later fall back to an unrelated generic picture. */
export function isCanonicalEquipmentImage(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/")) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (decoded.includes("\\") || decoded.includes("//") || decoded.split("/").includes("..")) return false;
  return /^\/(?:schematic-components|guides)\/(?:[A-Za-z0-9._()+ -]+\/)*[A-Za-z0-9._()+ -]+\.(?:jpe?g|png|webp|svg)$/i.test(decoded);
}
