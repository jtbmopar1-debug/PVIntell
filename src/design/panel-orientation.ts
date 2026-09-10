/** Annual-yield starting point in degrees from true north / horizontal.
 * Recorded mounting angles take precedence; latitude is not a roof measurement. */
export function recommendedPanelOrientation(
  recorded: { azimuthDegrees?: unknown; tiltDegrees?: unknown },
  latitude: unknown,
) {
  const valid = (value: unknown, min: number, max: number): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  const hasLatitude = valid(latitude, -90, 90);
  return {
    azimuthDegrees: valid(recorded.azimuthDegrees, 0, 360) ? recorded.azimuthDegrees
      : hasLatitude ? (latitude < 0 ? 0 : 180) : undefined,
    tiltDegrees: valid(recorded.tiltDegrees, 0, 90) ? recorded.tiltDegrees
      : hasLatitude ? Math.round(Math.abs(latitude) * 10) / 10 : undefined,
  };
}
