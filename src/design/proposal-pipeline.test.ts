import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyWattsonActions } from "@/ai/actions";
import { deterministicProposalActions } from "./proposal-action";
import { siteDiscoveryActions } from "@/discovery/site-actions";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { PUT } from "@/app/api/design-calculator/route";
import { createProposedAsBuiltDraft, ProposalScopeOverview, wattsonPanelSizingIsPlausible } from "@/components/design-calculator";
import type { DesignCalculatorState, Project } from "@/domain/models";

const auth = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => auth.client }));

/** Exercise the real action and save boundaries without touching user projects. */
function projectStore(mode = "off_grid") {
  const project = { mode, settings: {
    peakSunHours: 2,
    solarResource: { latitude: -36.85, source: "Audit fixture", basis: "weakest_month", monthlyPeakSunHours: Array(12).fill(2) },
  } as Record<string, unknown> };
  const counters = { reads: 0, writes: 0 };
  const client = {
    auth: { getClaims: async () => ({ data: { claims: { sub: "audit-user" } } }) },
    from(table: string) {
      let update: Record<string, unknown> | undefined;
      const execute = () => {
        if (table === "projects" && update) { Object.assign(project, structuredClone(update)); counters.writes++; }
        else if (table === "projects") counters.reads++;
        return { data: table === "projects" ? structuredClone(project) : [], error: null };
      };
      const query = {
        select: () => query, eq: () => query, delete: () => query, insert: () => query,
        update: (value: Record<string, unknown>) => { update = value; return query; },
        single: async () => execute(), maybeSingle: async () => execute(),
        then: (resolve: (result: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return query;
    },
  };
  return { project, counters, client: client as unknown as SupabaseClient };
}

const workshop: DiscoveryAnswers = {
  utility_relationship: "off_grid", battery_requirement: "none", off_grid_daily_energy_use: 6,
  panel_location: ["main_roof"], panel_construction_interest: ["existing", "bifacial"],
  existing_panel_selection: JSON.stringify({ name: "Owned panels", panelType: "bifacial", quantity: 8, maxUseQuantity: 8, watts: 580, proposalUse: "include" }),
  heavy_loads: ["saw_tools"], household_motor_ratings: JSON.stringify({ saw_tools: { name: "Drop saw", runningKw: 1.8, startingKw: 5.4, quantity: 1, simultaneous: false, runtimeMinutesPerDay: 60 } }),
  generator_requirement: "include", generator_outage_role: ["high_power_loads"], generator_details: JSON.stringify({ purchaseStatus: "not_purchased" }),
  architecture_preference: "combined",
};

async function build(answers: DiscoveryAnswers, store = projectStore()) {
  await applyWattsonActions(store.client, "e3b1409d-9aa1-4ce5-858e-bf3e2c8797ea", [
    ...siteDiscoveryActions(answers), ...deterministicProposalActions(answers),
  ]);
  return { ...store, design: store.project.settings.designCalculator as Record<string, unknown> };
}

describe("discovery → stored proposal → calculator save", () => {
  it.each([
    ["combined", "combined_hybrid_inverter", "Hybrid inverter"],
    ["modular", "separate_solar_controller_and_inverter", "Inverter / charger"],
    ["string_inverter", "ac_coupled", "Solar string inverter"],
    ["optimiser_string", "ac_coupled", "DC optimisers"],
    ["microinverters", "ac_coupled", "Microinverters"],
    ["compare", "not_decided", "Inverter arrangement to assess"],
    ["existing", "not_decided", "Inverter arrangement to assess"],
  ])("preserves the %s inverter choice through the schematic", async (choice, architecture, label) => {
    const { design } = await build({ ...workshop, architecture_preference: choice });
    expect(design).toMatchObject({ inverterArrangement: choice, architecture });
    const draft = createProposedAsBuiltDraft(design);
    expect(draft.nodes?.some((node) => node.label === label)).toBe(true);
    const nodeIds = new Set(draft.nodes?.map((node) => node.id));
    for (const connection of draft.connections ?? []) {
      expect(nodeIds.has(connection.from)).toBe(true);
      expect(nodeIds.has(connection.to)).toBe(true);
    }
  });

  it("does not put string DC isolators on a microinverter's outgoing AC branch", async () => {
    const { design } = await build({ ...workshop, architecture_preference: "microinverters" });
    const draft = createProposedAsBuiltDraft(design);
    expect(draft.nodes?.some((node) => node.id.startsWith("solar-safety"))).toBe(false);
    expect(draft.connections?.find((edge) => edge.from === "pv-inverter")?.kind).toBe("ac");
  });

  it("shows Site angle recommendations and exposes an unresolved battery-free AC topology", async () => {
    const built = await build({ ...workshop, architecture_preference: "microinverters" });
    const project = { projectType: "off-grid", designDiscovery: built.project.settings.designDiscovery, solarResource: built.project.settings.solarResource } as unknown as Project;
    const html = renderToStaticMarkup(createElement(ProposalScopeOverview, { project, design: built.design as DesignCalculatorState }));
    expect(html).toContain("0° (north)");
    expect(html).toContain("37° tilt");
    expect(html).toContain("microinverter arrangement");
    expect(html).toContain("power path remains unverified");
    expect(html).not.toContain("Grid-connected operation");
  });

  it("keeps future expansion as a note rather than adding today's capacity", async () => {
    const baseline = (await build(workshop)).design;
    const future = (await build({ ...workshop, expected_expansion: ["ev", "more_pv", "extra_dwelling"] })).design;
    for (const key of ["panelCount", "targetPvKw", "inverterKw", "batteryUsableKwh", "generatorContinuousKw"]) expect(future[key]).toEqual(baseline[key]);
  });

  it("persists the solar-first array, inverter, generator and Site angles together", async () => {
    const { design } = await build(workshop);
    expect(design).toMatchObject({ panelCount: 8, panelWatts: 580, targetPvKw: 7.2, inverterKw: 6, generatorContinuousKw: 5, generatorSurgeKw: 5.4, azimuthDegrees: 0, tiltDegrees: 36.9 });
    expect(design.existingPanelGroup).toMatchObject({ proposedUseCount: 8, supplementaryTargetPvKw: 2.56 });
  });

  it.each([["bifacial", 450], ["flexible_lightweight", 400], ["standard", 460]])("uses the chosen %s panel profile consistently", async (type, watts) => {
    const { design } = await build({ ...workshop, existing_panel_selection: "", panel_construction_interest: [type] });
    expect(design.panelWatts).toBe(watts);
    expect(Number(design.targetPvKw)).toBeCloseTo(Number(design.panelCount) * Number(watts) / 1000, 2);
    expect(Number(design.panelVmpV) * Number(design.panelImpA)).toBeCloseTo(Number(watts), -1);
  });

  it("can save its own generated evidence and retain runtime inputs", async () => {
    const built = await build(workshop);
    auth.client = built.client;
    const proposedAsBuiltDraft = createProposedAsBuiltDraft(built.design as DesignCalculatorState);
    const response = await PUT(new Request("http://localhost/api/design-calculator", { method: "PUT", body: JSON.stringify({ projectId: "e3b1409d-9aa1-4ce5-858e-bf3e2c8797ea", design: { ...built.design, proposedAsBuiltDraft } }) }));
    expect(response.status).toBe(200);
    expect((built.project.settings.designCalculator as { sizingInputs: unknown }).sizingInputs).toMatchObject({ scheduledLoadEnergyKwh: 1.8 });
  });

  it("does not reuse an excluded generator's stale rating or connection", async () => {
    const store = projectStore();
    store.project.settings.designCalculator = { generatorContinuousKw: 20, generatorSurgeKw: 30, generatorConnectionMethod: "ats" };
    const { design } = await build({ ...workshop, generator_requirement: "none" }, store);
    expect(design.generatorIncluded).toBeFalsy();
    expect(design.generatorContinuousKw).toBeUndefined();
    expect(design.generatorConnectionMethod).toBeUndefined();
  });

  it("carries existing generator ratings and its destination through the proposal", async () => {
    const { design } = await build({ ...workshop, generator_details: JSON.stringify({ purchaseStatus: "have_details", continuousRating: 7, surgeRating: 9, ratingUnit: "kW", connectionMethod: "inverter_input" }) });
    expect(design).toMatchObject({ generatorContinuousKw: 7, generatorSurgeKw: 9, generatorConnectionMethod: "inverter_input" });
  });

  it("does not put excluded panels back into a generator-only proposal", async () => {
    const { design } = await build({ ...workshop, panel_location: ["none"] });
    expect(design.panelCount ?? 0).toBe(0);
    expect(design.targetPvKw ?? 0).toBe(0);
    expect(design.existingPanelGroup).toBeUndefined();
    expect(createProposedAsBuiltDraft(design).nodes?.some((node) => node.id.startsWith("solar"))).toBe(false);
  });

  it("records discovery together instead of reading and saving every answer separately", async () => {
    const { counters } = await build(workshop);
    expect(counters.reads).toBeLessThanOrEqual(3);
    expect(counters.writes).toBeLessThanOrEqual(4);
  });

  it("keeps a single-answer edit and uses it on the next rebuild", async () => {
    const built = await build(workshop);
    await applyWattsonActions(built.client, "audit-project", [{ name: "record_design_discovery", arguments: { key: "off_grid_daily_energy_use", value: "20 kWh/day", confidence: "user_confirmed" } }]);
    expect(built.project.settings.designDiscovery).toMatchObject({ off_grid_daily_energy_use: { value: "20 kWh/day" }, household_motor_ratings: { value: workshop.household_motor_ratings } });
    await applyWattsonActions(built.client, "audit-project", deterministicProposalActions(workshop));
    const design = built.project.settings.designCalculator as Record<string, unknown>;
    expect(design.sizingInputs).toMatchObject({ dailyEnergyKwh: 20, startupPeakKw: 5.4 });
    expect(Number(design.targetPvKw)).toBeGreaterThan(7.2);
  });

  it("removing the selected load removes its old surge on rebuild", async () => {
    const built = await build(workshop);
    await applyWattsonActions(built.client, "audit-project", [{ name: "record_design_discovery", arguments: { key: "heavy_or_surge_loads", value: "none", confidence: "user_confirmed" } }, ...deterministicProposalActions(workshop)]);
    const design = built.project.settings.designCalculator as Record<string, unknown>;
    expect(design.sizingInputs).toMatchObject({ startupPeakKw: undefined });
    expect(design.generatorSurgeKw).toBeUndefined();
  });

  it("retains a capacity-only extra array on a grid-connected proposal", async () => {
    const store = projectStore("hybrid");
    const { design } = await build({ ...workshop, utility_relationship: "grid_connected", heavy_loads: ["none"], off_grid_daily_energy_use: 20,
      existing_panel_selection: JSON.stringify({ name: "Spare panels", panelType: "bifacial", quantity: 10, maxUseQuantity: 3, watts: 580, proposalUse: "include" }),
    }, store);
    const project = { projectType: "hybrid", peakSunHours: 2, designDiscovery: store.project.settings.designDiscovery, designCalculator: design, solarResource: store.project.settings.solarResource } as unknown as Project;
    expect(design.existingPanelGroup).toMatchObject({ proposedUseCount: 3, surplusCount: 7 });
    expect(wattsonPanelSizingIsPlausible(project, 580, design)).toBe(true);
    const draft = createProposedAsBuiltDraft(design, true);
    expect(draft.nodes?.find((node) => node.id === "solar-pv-1")?.detail).toContain("3 × 580");
    expect(draft.nodes?.find((node) => node.id === "solar-pv-2")?.detail).toContain("kW minimum");
  });
});
