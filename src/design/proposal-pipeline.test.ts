import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyWattsonActions, refreshProposalAfterSizingInput } from "@/ai/actions";
import { deterministicProposalActions } from "./proposal-action";
import { siteDiscoveryActions } from "@/discovery/site-actions";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { PUT } from "@/app/api/design-calculator/route";
import { createProposedAsBuiltDraft, ensureInverterProtectiveEarth, ensurePvArrayEarth, ensureSupplementaryMicroinverterRouting, planningNodeDetail, ProposalScopeOverview, recoverRecordedStringLayout, repairCustomEquipmentDraft, wattsonPanelSizingIsPlausible } from "@/components/design-calculator";
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

  it("persists selected pool equipment and sizes a proposal from its timer schedule", async () => {
    const answers: DiscoveryAnswers = {
      utility_relationship: "grid_connected",
      battery_requirement: "none",
      panel_location: ["main_roof"],
      panel_construction_interest: ["bifacial"],
      pool_or_spa: ["pool"],
      pool_heating_method: ["heat_pump"],
      pool_equipment: ["sanitation", "filtration_pump"],
      pool_equipment_ratings: JSON.stringify({
        filtration_pump: { quantity: 1, runningKw: 2, startingKw: 6, runtimeMinutesPerDay: 240, simultaneous: true },
        sanitation: { quantity: 1, runningKw: .3, startingKw: .3, runtimeMinutesPerDay: 240, simultaneous: true },
      }),
      architecture_preference: "string_inverter",
    };
    const built = await build(answers, projectStore("grid_tied"));
    expect(built.project.settings.designDiscovery).toMatchObject({
      pool_equipment: { value: "sanitation, filtration_pump" },
      pool_equipment_ratings: { value: answers.pool_equipment_ratings },
    });
    expect(built.design).toMatchObject({
      panelCount: 13,
      inverterKw: 5,
      sizingInputs: {
        dailyEnergyKwh: 9.2,
        dailyEnergySource: "pool_equipment_schedule",
        simultaneousLoadKw: 2.3,
        scheduledLoadEnergyKwh: 9.2,
      },
    });
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

  it("retains a newly calculated representative string layout when sizing changes", () => {
    const settings: Record<string, unknown> = {
      peakSunHours: 4,
      solarResource: { source: "Test solar resource", basis: "annual_average" },
      designDiscovery: {
        current_energy_use: { value: "438 kWh/month" },
        proposed_panel_location: { value: "main_roof" },
      },
      designCalculator: {
        panelCount: 6,
        panelWatts: 450,
        panelType: "bifacial",
        panelProfileBasis: "representative",
        pvStrings: 1,
        panelsPerString: 6,
        updatedBy: "wattson",
      },
    };

    refreshProposalAfterSizingInput(settings, "grid_tied");

    expect(settings.designCalculator).toMatchObject({ panelCount: 11, pvStrings: 1, panelsPerString: 11 });
  });

  it("recovers a missing string layout from complete recorded module electrical values", () => {
    const layout = recoverRecordedStringLayout({
      panelType: "bifacial",
      panelProfileBasis: "user_equipment",
      panelCount: 10,
      panelWatts: 450,
      panelVmpV: 33,
      panelVocV: 39.5,
      panelImpA: 13.64,
      panelIscA: 14.4,
      panelVocTemperatureCoefficientPercentPerC: -.25,
    }, 10);

    expect(layout).toMatchObject({ strings: 1, panelsPerString: 10, stringVmpV: 330, stringVocV: 395 });
  });

  it("does not repeatedly prepend the inverter rating while reconciling a draft", () => {
    const design = { inverterKw: 4 } as DesignCalculatorState;
    const first = planningNodeDetail({ id: "pv-inverter", label: "Solar string inverter", detail: "Converts the PV strings to AC", image: "/inverter.jpg", x: 0, y: 0 }, design);
    const second = planningNodeDetail(first, design);
    const third = planningNodeDetail(second, design);

    expect(third.detail).toBe("4 kW continuous rating proposed; Converts the PV strings to AC");
  });

  it("describes a proposed microinverter rating as one combined fleet capacity", () => {
    const first = planningNodeDetail(
      { id: "pv-inverter", label: "Microinverters", detail: "Module-level DC-to-AC conversion", image: "/micro.jpg", x: 0, y: 0 },
      { inverterKw: 15, inverterArrangement: "microinverters" } as DesignCalculatorState,
    );
    const detail = planningNodeDetail(planningNodeDetail(first, { inverterKw: 15, inverterArrangement: "microinverters" } as DesignCalculatorState), { inverterKw: 15, inverterArrangement: "microinverters" } as DesignCalculatorState);
    const batteryDetail = planningNodeDetail(
      { id: "battery-inverter", label: "Deye 8k Inverter", detail: "Added to the working system", image: "/hybrid.jpg", x: 0, y: 0 },
      { inverterKw: 15, inverterArrangement: "microinverters" } as DesignCalculatorState,
    );

    expect(detail.detail).toBe("15 kW combined AC capacity proposed across all microinverters; exact unit count, model and branch ratings to confirm");
    expect(batteryDetail.detail).toBe("Added to the working system");
  });

  it("does not assign the mixed proposal total to an existing microinverter fleet", () => {
    const design = {
      inverterKw: 15,
      inverterArrangement: "microinverters",
      batteryVoltage: 51.2,
      batteryUsableKwh: 5.3,
      existingPanelGroup: { name: "Home", availableCount: 25, proposedUseCount: 25, wattsEach: 280, supplementaryTargetPvKw: 8.4, assessmentStatus: "provisional_pending_datasheet_and_condition" },
    } as DesignCalculatorState;
    const inflated = { id: "pv-inverter", label: "Microinverters", detail: "15 kW combined AC capacity proposed across all microinverters; 15 kW combined AC capacity proposed across all microinverters", image: "/micro.jpg", x: 0, y: 0 };

    expect(planningNodeDetail(inflated, design).detail).toBe("Existing microinverter fleet serving 25 panels; combined AC nameplate and branch ratings to confirm");
  });

  it("describes existing microinverters and a supplementary hybrid MPPT as separate scope paths", () => {
    const design = {
      architecture: "ac_coupled",
      inverterArrangement: "microinverters",
      inverterKw: 15,
      batteryVoltage: 51.2,
      batteryUsableKwh: 5.3,
      panelWatts: 280,
      existingPanelGroup: { name: "Home", availableCount: 25, proposedUseCount: 25, wattsEach: 280, supplementaryTargetPvKw: 8.4, assessmentStatus: "provisional_pending_datasheet_and_condition" },
      proposedAsBuiltDraft: {
        createdAt: "2026-09-11T00:00:00.000Z",
        architecture: "ac_coupled",
        flow: [],
        nodes: [{ id: "battery-inverter", label: "Deye 8k Inverter", detail: "Added to the working system", image: "/hybrid.jpg", x: 0, y: 0 }],
        connections: [],
      },
    } as DesignCalculatorState;
    const project = { projectType: "grid-tied", designDiscovery: { battery_requirement: { value: "include" } } } as unknown as Project;
    const html = renderToStaticMarkup(createElement(ProposalScopeOverview, { project, design }));

    expect(html).toContain("existing 25-panel array retaining its microinverters");
    expect(html).toContain("additional array feeding Deye 8k Inverter through a DC-isolated MPPT input");
    expect(html).toContain("15 kW sizing value is not treated as the confirmed nameplate rating");
    expect(html).not.toContain("15 kW microinverter arrangement");
  });

  it("does not apply the PV inverter rating to a separate AC-coupled battery inverter", () => {
    const batteryInverter = planningNodeDetail({ id: "battery-inverter", label: "Deye 8k Inverter", detail: "Added to the working system", image: "/inverter.jpg", x: 0, y: 0 }, { architecture: "ac_coupled", inverterKw: 15 } as DesignCalculatorState);

    expect(batteryInverter.detail).toBe("Added to the working system");
    expect(batteryInverter.detail).not.toContain("15 kW");
  });

  it("adds one explicit protective-earth path from every inverter to the main earthing terminal", () => {
    const design = {
      architecture: "ac_coupled",
      inverterArrangement: "string_inverter",
      inverterKw: 4,
      panelCount: 10,
      panelWatts: 450,
      pvStrings: 1,
      panelsPerString: 10,
    } as DesignCalculatorState;
    const first = ensureInverterProtectiveEarth(createProposedAsBuiltDraft(design, true));
    const second = ensureInverterProtectiveEarth(first);
    const inverterEarths = second.connections?.filter((connection) => connection.kind === "earth" && connection.from === "pv-inverter");

    expect(inverterEarths).toEqual([
      expect.objectContaining({ to: "switchboard", label: "PV inverter protective earth" }),
    ]);
    expect(second.connections).toContainEqual(expect.objectContaining({ from: "switchboard", to: "earth", kind: "earth" }));
  });

  it("turns a legacy custom inverter into the connected AC-coupled battery inverter", () => {
    const design = {
      architecture: "ac_coupled",
      inverterArrangement: "microinverters",
      inverterKw: 8,
      panelCount: 25,
      panelWatts: 280,
      pvStrings: 1,
      panelsPerString: 25,
      batteryVoltage: 51.2,
      batteryAh: 130,
    } as DesignCalculatorState;
    const draft = createProposedAsBuiltDraft(design, true);
    draft.nodes = [
      ...(draft.nodes ?? []).filter((node) => node.id !== "battery-inverter"),
      { id: "custom-1", label: "Deye 8k Inverter", detail: "Added to the working system", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 445, y: 345 },
    ];
    const repaired = ensureInverterProtectiveEarth(repairCustomEquipmentDraft(draft));

    expect(repaired.nodes?.find((node) => node.id === "battery-inverter")).toMatchObject({
      label: "Deye 8k Inverter",
      image: "/schematic-components/hybrid-inverter.jpg",
    });
    expect(repaired.nodes?.some((node) => node.id === "custom-1")).toBe(false);
    expect(repaired.connections).toContainEqual(expect.objectContaining({ from: "battery-safety", to: "battery-inverter", kind: "battery-dc" }));
    expect(repaired.connections).toContainEqual(expect.objectContaining({ from: "battery-inverter", to: "ac-safety", kind: "ac" }));
    expect(repaired.connections).toContainEqual(expect.objectContaining({ from: "battery-inverter", to: "switchboard", kind: "earth" }));
  });

  it("routes a supplementary array to the hybrid MPPT instead of the existing microinverters", () => {
    const design = {
      architecture: "ac_coupled",
      inverterArrangement: "microinverters",
      inverterKw: 15,
      panelCount: 25,
      panelWatts: 280,
      pvStrings: 1,
      panelsPerString: 25,
      batteryVoltage: 51.2,
      batteryAh: 130,
      existingPanelGroup: {
        name: "Existing array",
        availableCount: 25,
        proposedUseCount: 25,
        wattsEach: 280,
        supplementaryCount: 18,
        supplementaryWattsEach: 470,
        supplementaryTargetPvKw: 8.4,
        assessmentStatus: "provisional_pending_datasheet_and_condition",
      },
    } as DesignCalculatorState;
    const draft = createProposedAsBuiltDraft(design, true);
    draft.nodes = draft.nodes?.filter((node) => node.id !== "supplementary-solar-safety");
    draft.connections = [
      ...(draft.connections ?? []).filter((connection) => connection.from !== "solar-pv-2" && connection.from !== "supplementary-solar-safety"),
      { from: "solar-pv-2", to: "pv-inverter", label: "Module DC inputs; compatibility to confirm", kind: "solar-dc" },
    ];
    const repaired = ensureSupplementaryMicroinverterRouting(draft, design);

    expect(repaired.connections).toContainEqual(expect.objectContaining({ from: "solar-pv-1", to: "pv-inverter" }));
    expect(repaired.connections).toContainEqual(expect.objectContaining({ from: "solar-pv-2", to: "supplementary-solar-safety" }));
    expect(repaired.connections).toContainEqual(expect.objectContaining({ from: "supplementary-solar-safety", to: "battery-inverter", kind: "solar-dc" }));
    expect(repaired.connections?.some((connection) => connection.from === "solar-pv-2" && connection.to === "pv-inverter")).toBe(false);
  });

  it("bonds the PV frames independently of the removable inverter", () => {
    const design = {
      architecture: "ac_coupled",
      inverterArrangement: "string_inverter",
      panelCount: 10,
      panelWatts: 450,
      pvStrings: 1,
      panelsPerString: 10,
    } as DesignCalculatorState;
    const first = ensurePvArrayEarth(createProposedAsBuiltDraft(design, true));
    const second = ensurePvArrayEarth(first);
    const frameBonds = second.connections?.filter((connection) => connection.kind === "earth" && /array frame bond/i.test(connection.label));

    expect(frameBonds).toEqual([
      expect.objectContaining({ from: "solar", to: "switchboard" }),
    ]);
    expect(frameBonds?.some((connection) => connection.to.includes("inverter"))).toBe(false);
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
