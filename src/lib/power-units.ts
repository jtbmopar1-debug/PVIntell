/**
 * Power values arrive from labels, imports and older records in more than one
 * unit. Keep the conversion in one place so a value is never silently treated
 * as a different rating by another screen.
 */
export function powerInKw(value: unknown, defaultUnit: "W" | "kW" = "W") {
  const text = String(value ?? "").trim();
  const match = text.match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  return /\bkw\b|kilowatt/i.test(text) || (!/[a-z]/i.test(text) && defaultUnit === "kW")
    ? amount
    : amount / 1000;
}

export function formatPower(value: unknown, defaultUnit: "W" | "kW" = "W") {
  const kw = powerInKw(value, defaultUnit);
  if (kw === undefined) return undefined;
  if (kw >= 1) return `${Number(kw.toFixed(3))} kW`;
  return `${Number((kw * 1000).toFixed(3))} W`;
}

/** The form input for every inverter uses kW, including legacy W records. */
export function inverterPowerInputKw(value: unknown) {
  const kw = powerInKw(value);
  return kw === undefined ? "" : String(Number(kw.toFixed(3)));
}
