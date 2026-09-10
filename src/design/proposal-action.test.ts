import { describe, expect, it } from "vitest";
import { defaultProposalPanel, proposalPanelProfiles } from "@/design/candidate-panel";
import { deterministicProposalActions } from "@/design/proposal-action";

describe("deterministic proposal handoff", () => {
  it("uses numerical brand-neutral planning profiles and does not ask AI to size the system", () => {
    expect(defaultProposalPanel).toMatchObject({
      manufacturer: undefined,
      model: undefined,
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
    expect(proposalPanelProfiles.bifacial).toMatchObject({ panelType: "bifacial", watts: 450, weightKg: 24.8 });
    expect(proposalPanelProfiles.flexible).toMatchObject({ panelType: "flexible", watts: 400, weightKg: 6.7 });
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

  it("hands an explicitly included existing panel allocation to deterministic sizing", () => {
    const actions = deterministicProposalActions({
      panel_construction_interest: ["existing", "bifacial"],
      existing_panel_selection: JSON.stringify({ name: "Workshop bifacial panels", panelType: "bifacial", quantity: 10, maxUseQuantity: 3, watts: 580, proposalUse: "include" }),
    } as never);
    expect(actions.at(-1)?.arguments).toMatchObject({
      panel_type: "bifacial",
      representative_panel_watts: 580,
      existing_panel_name: "Workshop bifacial panels",
      existing_panel_available_count: 10,
      existing_panel_max_use_count: 3,
      existing_panel_assessment_required: true,
    });
  });
});
