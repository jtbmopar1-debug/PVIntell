import { describe, expect, it } from "vitest";
import { requestsMrbfCardUpdate } from "./mrbf-specification-editor";

describe("contextual MRBF card updates", () => {
  it("resolves 'those specs' from the preceding MRBF answer", () => {
    expect(requestsMrbfCardUpdate("can you add those specs to the technical cards for each please", "The MRBF fuses should be sized at 100 A.")).toBe(true);
  });

  it("does not infer an unrelated antecedent", () => {
    expect(requestsMrbfCardUpdate("can you add those specs to the technical cards", "The PV cable is 6 mm².")).toBe(false);
  });
});
