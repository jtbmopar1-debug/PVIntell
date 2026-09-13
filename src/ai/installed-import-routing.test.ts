import { describe, expect, it } from "vitest";
import { confirmedBatterySystemVoltage, mentionedExistingSite } from "./installed-import-routing";

describe("installed import routing", () => {
  it("selects an existing Site from a natural routing reply", () => {
    expect(mentionedExistingSite("Add it to River views", [{ id: "river", name: "River Views" }])).toEqual({ id: "river", name: "River Views" });
  });
  it("derives voltage only from consistent battery statements", () => {
    expect(confirmedBatterySystemVoltage("start battery 12v, 80ah, and 2x house battery, 12v AGM 110ah")).toBe(12);
    expect(confirmedBatterySystemVoltage("12v starter battery and a 24v house bank")).toBeUndefined();
  });
});
