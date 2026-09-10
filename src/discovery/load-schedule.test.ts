import { describe, expect, it } from "vitest";
import { timerRuntimeMinutes } from "./load-schedule";

describe("timerRuntimeMinutes", () => {
  it("calculates a daytime timer window", () => {
    expect(timerRuntimeMinutes("09:00", "15:30")).toBe(390);
  });

  it("calculates a timer window that crosses midnight", () => {
    expect(timerRuntimeMinutes("22:00", "02:00")).toBe(240);
  });

  it("leaves incomplete and equal times unresolved", () => {
    expect(timerRuntimeMinutes("09:00", undefined)).toBeUndefined();
    expect(timerRuntimeMinutes("09:00", "09:00")).toBeUndefined();
  });
});
