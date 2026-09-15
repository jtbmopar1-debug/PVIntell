import { describe, expect, it } from "vitest";
import { requestsWholeSystemEarthing, wholeSystemEarthingPlan } from "./earthing-topology-editor";

describe("whole-system earthing requests", () => {
  it("recognises natural install wording and ignores questions", () => {
    expect(requestsWholeSystemEarthing("can you install earth wiring and pegs, for the whole system pls")).toBe(true);
    expect(requestsWholeSystemEarthing("what is an earth peg?")).toBe(false);
  });

  it("targets exposed system equipment without earthing live busbars", () => {
    const plan = wholeSystemEarthingPlan([
      { id: "inv", type: "inverter", display_name: "Hybrid inverter" },
      { id: "gen", type: "generator", display_name: "Generator" },
      { id: "pvbox", type: "combiner", display_name: "PV fusebox" },
      { id: "bat", type: "battery", display_name: "Battery 1" },
      { id: "pos", type: "connector", display_name: "Positive busbar" },
      { id: "neg", type: "connector", display_name: "Negative busbar" },
      { id: "earth", type: "connector", display_name: "Main protective-earth busbar" },
    ], [{ id: "pv1", name: "PV1" }], true);
    expect(plan.earthBar?.id).toBe("earth");
    expect(plan.componentTargets.map((component) => component.id)).toEqual(["inv", "gen", "pvbox", "bat"]);
    expect(plan.arrays).toEqual([{ id: "pv1", name: "PV1" }]);
  });
});
