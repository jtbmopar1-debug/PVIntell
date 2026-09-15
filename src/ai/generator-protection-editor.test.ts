import { describe, expect, it } from "vitest";
import { requestedGeneratorMcb } from "./generator-protection-editor";

describe("generator-input protection requests", () => {
  it("recognises the user's incremental schematic instruction", () => {
    expect(requestedGeneratorMcb("can you install a 63A wifi MCB on the ac line from the generator to the inverter")).toEqual({ ratingA: 63, wifi: true });
  });

  it("does not turn questions into mutations", () => {
    expect(requestedGeneratorMcb("what size MCB should the generator use with the inverter?")).toBeNull();
  });
});
