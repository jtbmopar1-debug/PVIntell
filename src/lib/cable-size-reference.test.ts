import { describe, expect, it } from "vitest";
import { normaliseAwgAlias } from "./cable-size-reference";

describe("AWG cable-size aliases", () => {
  it("recognises aught notation and spoken aliases", () => {
    expect(normaliseAwgAlias("4/0AWG")?.areaMm2).toBe(107.2);
    expect(normaliseAwgAlias("0000 AWG")?.awg).toBe("4/0 AWG");
    expect(normaliseAwgAlias("four-aught")?.awg).toBe("4/0 AWG");
  });

  it("never aliases 4 AWG to 4/0 AWG", () => {
    expect(normaliseAwgAlias("4 AWG")?.areaMm2).toBe(21.2);
    expect(normaliseAwgAlias("4 AWG")?.awg).not.toBe("4/0 AWG");
  });
});
