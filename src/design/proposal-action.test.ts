import { describe, expect, it } from "vitest";
import { defaultProposalPanel } from "@/design/candidate-panel";
import { deterministicProposalActions } from "@/design/proposal-action";

describe("deterministic proposal handoff", () => {
  it("uses the exact sourced module and does not ask AI to size the system", () => {
    expect(defaultProposalPanel).toMatchObject({
      manufacturer: "JA Solar",
      model: "JAM54D40-460/LR",
      panelType: "monofacial",
      watts: 460,
      lengthMm: 1762,
      widthMm: 1134,
      weightKg: 23.4,
      vmpV: 33.17,
      vocV: 39.70,
      impA: 13.87,
      iscA: 14.64,
    });
    const proposal = deterministicProposalActions({} as never).at(-1);
    expect(proposal?.name).toBe("record_preliminary_design");
    expect(proposal?.arguments).not.toHaveProperty("pv_kw");
    expect(proposal?.arguments).not.toHaveProperty("panel_count");
    expect(proposal?.arguments).not.toHaveProperty("inverter_kw");
    expect(proposal?.arguments).not.toHaveProperty("battery_usable_kwh");
    expect(proposal?.arguments).not.toHaveProperty("representative_panel_watts");
  });

  it("carries a compatible architecture choice before generating the proposal", () => {
    const actions = deterministicProposalActions({ architecture_preference: "combined" } as never);
    expect(actions.map((action) => action.name)).toEqual([
      "record_design_preference",
      "record_preliminary_design",
    ]);
    expect(actions[0].arguments).toMatchObject({ architecture: "combined_hybrid_inverter" });
  });
});
