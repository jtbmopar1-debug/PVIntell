import { describe, expect, it } from "vitest";
import { formatPower, inverterPowerInputKw, powerInKw } from "./power-units";

describe("power units", () => {
  it("normalises explicit and legacy inverter ratings to kW", () => {
    expect(powerInKw("20000 W")).toBe(20);
    expect(powerInKw("20 kW")).toBe(20);
    expect(inverterPowerInputKw("20000 W")).toBe("20");
  });

  it("does not change the displayed meaning of a rating", () => {
    expect(formatPower("20000 W")).toBe("20 kW");
    expect(formatPower("475 W")).toBe("475 W");
  });
});
