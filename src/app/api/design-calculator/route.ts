import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordOwnShadowCreditUsage } from "@/credits/usage";
import { syncPlannedInverterCards } from "@/design/inverter-card-sync";

const finite = z.number().finite().min(0).max(1_000_000);
const calculatorSchema = z.object({
  projectId: z.uuid(),
  creditEvent: z.literal("proposal_rebuild").optional(),
  requestId: z.uuid().optional(),
  design: z.object({
    proposalEngineVersion: finite.optional(),
    proposedChecklist: z.record(z.string(), z.boolean()).optional(),
    proposedAsBuiltDraft: z.object({
      sourceRecordFingerprint: z.string().max(100).optional(),
      createdAt: z.string().datetime(),
      architecture: z.enum(["combined_hybrid_inverter", "separate_solar_controller_and_inverter", "ac_coupled", "not_decided"]).optional(),
      flow: z.array(z.string().max(100)).min(2).max(10),
      nodes: z.array(z.object({ id: z.string().max(50), label: z.string().max(160), detail: z.string().max(2000), image: z.string().max(200), x: finite, y: finite, recordRef: z.string().max(100).optional(), installed: z.boolean().optional(), installedRecordId: z.string().uuid().optional(), reviewed: z.boolean().optional(), rejected: z.boolean().optional(), notes: z.string().max(2000).optional(), authorityCheck: z.boolean().optional(), introduced: z.boolean().optional(), introductionReason: z.string().max(500).optional() })).max(100).optional(),
      connections: z.array(z.object({ from: z.string().max(50), to: z.string().max(50), label: z.string().max(200), kind: z.enum(["solar-dc", "battery-dc", "ac", "earth"]), lengthM: finite.optional(), lengthBasis: z.enum(["estimated", "measured"]).optional(), cableSizeMm2: finite.optional(), protectionAmps: finite.optional(), notes: z.string().max(2000).optional(), authorityCheck: z.boolean().optional(), configured: z.boolean().optional(), provisionalInterface: z.boolean().optional() })).max(200).optional(),
      panelCount: finite.optional(), panelWatts: finite.optional(), pvStrings: finite.optional(), panelsPerString: finite.optional(),
      panelVmpV: finite.optional(), panelVocV: finite.optional(), panelImpA: finite.optional(), panelIscA: finite.optional(), batteryVoltage: finite.optional(),
      batteryAh: finite.optional(), batteryQuantity: finite.optional(), inverterKw: finite.optional(), evChargingKw: finite.optional(), evChargingPhase: z.enum(["single", "three"]).optional(), generatorContinuousKw: finite.optional(), generatorSurgeKw: finite.optional(),
    }).optional(),
    architecture: z.enum(["combined_hybrid_inverter", "separate_solar_controller_and_inverter", "ac_coupled", "not_decided"]).optional(),
    designBasis: z.string().max(2000).optional(),
    inverterArrangement: z.enum(["combined", "modular", "string_inverter", "optimiser_string", "microinverters", "compare", "existing"]).optional(),
    startingStage: z.string().max(2000).optional(),
    expansionPath: z.string().max(2000).optional(),
    nextValidation: z.string().max(1000).optional(),
    panelType: z.enum(["bifacial", "monofacial", "flexible", "other", "not_selected"]).optional(),
    panelProfileBasis: z.enum(["representative", "user_equipment"]).optional(),
    panelManufacturer: z.string().max(120).optional(), panelModel: z.string().max(120).optional(),
    panelSupplier: z.string().max(200).optional(), panelProductUrl: z.url().max(1000).optional(),
    panelDatasheetUrl: z.url().max(1000).optional(), panelDatasheetVersion: z.string().max(100).optional(),
    mountingLocations: z.array(z.string().max(80)).max(12).optional(),
    pvArrayPlan: z.object({
      status: z.enum(["surface_allocation_required", "topology_unresolved", "resolved"]),
      configurationSource: z.enum(["discovery", "user"]).optional(),
      arrays: z.array(z.object({
        id: z.string().max(100), name: z.string().max(200), capacity: finite.optional(), mounting: z.string().max(100).optional(),
        direction: z.string().max(100).optional(), pitch: z.string().max(100).optional(), allocatedPanelCount: finite.optional(),
        panelWatts: finite.optional(), panelVmpV: finite.optional(), panelVocV: finite.optional(), panelImpA: finite.optional(), panelIscA: finite.optional(),
        panelElectricalBasis: z.enum(["recorded", "representative"]).optional(),
        topology: z.object({
          kind: z.enum(["series", "parallel", "series_parallel"]),
          status: z.enum(["pending_surface_allocation_and_equipment", "resolved"]),
          strings: z.array(z.object({ id: z.string().max(100), panelsInSeries: finite, parallelGroup: z.string().max(100).optional(), mpptInput: z.string().max(100).optional() })).max(100),
          combinerRequirement: z.enum(["pending", "not_required", "required"]),
          reason: z.string().max(2000).optional(),
        }),
      })).min(1).max(20),
    }).optional(),
    panelWatts: finite.optional(), panelCount: finite.optional(), pvStrings: finite.optional(), panelsPerString: finite.optional(),
    existingPanelGroup: z.object({
      name: z.string().max(160), availableCount: finite, maximumAvailableToProposal: finite.optional(), proposedUseCount: finite.optional(),
      surplusCount: finite.optional(), supplementaryCount: finite.optional(), supplementaryTargetPvKw: finite.optional(), wattsEach: finite.optional(), supplementaryWattsEach: finite.optional(),
      recordedCapacityKw: finite.optional(),
      supplementaryPanelType: z.string().max(80).optional(), supplementaryLengthMm: finite.optional(), supplementaryWidthMm: finite.optional(),
      assessmentStatus: z.literal("provisional_pending_datasheet_and_condition"),
    }).optional(),
    stringDesign: z.object({
      strings: finite, panelsPerString: finite, stringVmpV: finite, stringVocV: finite, coldStringVocV: finite,
      minimumMpptCurrentA: finite, minimumInputShortCircuitCurrentA: finite,
      planningMinimumTemperatureC: z.number().finite().min(-100).max(100),
    }).optional(),
    panelVmpV: finite.optional(), panelVocV: finite.optional(), panelImpA: finite.optional(), panelIscA: finite.optional(),
    targetPvKw: finite.optional(), energyTargetPvKw: finite.optional(), energyTargetPanelCount: finite.optional(),
    calculatedPvRequirementKw: finite.optional(), calculatedInverterRequirementKw: finite.optional(), recordedPvCapacityKw: finite.optional(), recordedInverterCapacityKw: finite.optional(),
    planningPanelCapacity: finite.optional(), fitLimited: z.boolean().optional(), panelLengthMm: finite.optional(),
    panelWidthMm: finite.optional(), panelThicknessMm: finite.optional(), panelWeightKg: finite.optional(),
    panelWeightBasis: z.string().max(300).optional(), panelMaximumSystemVoltageV: finite.optional(),
    panelMaximumSeriesFuseA: finite.optional(), panelVocTemperatureCoefficientPercentPerC: z.number().finite().min(-10).max(10).optional(),
    requiredPanelAreaM2: finite.optional(),
    fitStatus: z.enum(["verified", "unverified", "does_not_fit"]).optional(),
    azimuthDegrees: finite.max(360).optional(), tiltDegrees: finite.max(90).optional(),
    peakSunHours: finite.max(24).optional(), systemEfficiencyPercent: finite.max(100).optional(),
    inverterKw: finite.optional(), evChargingKw: finite.optional(), evChargingPhase: z.enum(["single", "three"]).optional(), batteryChemistry: z.string().max(100).optional(), batteryVoltage: finite.optional(),
    inverterPlan: z.object({
      jurisdiction: z.enum(["nz", "local_review"]),
      selectionStatus: z.enum(["candidate_selected", "candidate_selected_pending_local_approval"]),
      unitRatingsKw: z.array(finite).max(20),
      preferredPhase: z.enum(["single", "three", "confirm"]),
      message: z.string().max(2000),
      acceptedByUser: z.boolean().optional(),
    }).optional(),
    batteryAh: finite.optional(), batteryQuantity: finite.optional(), usableBatteryPercent: finite.max(100).optional(),
    batteryUsableKwh: finite.optional(), calculatedBatteryUsableKwh: finite.optional(), recordedBatteryUsableKwh: finite.optional(),
    sizingMethod: z.enum(["deterministic-v1", "user-adjusted"]).optional(),
    sizingInputs: z.object({
      dailyEnergyKwh: finite.optional(), dailyEnergySource: z.enum(["off_grid_daily_energy_use", "current_energy_use", "pool_equipment_schedule"]).optional(),
      peakSunHours: finite.max(24).optional(), systemEfficiency: finite.max(1).optional(), simultaneousLoadKw: finite.optional(), directSolarLoadKw: finite.optional(),
      startupPeakKw: finite.optional(), startupLoadName: z.string().trim().max(160).optional(), batteryOnlyDays: finite.optional(),
      scheduledLoadEnergyKwh: finite.optional(),
      batterySizingBasis: z.enum(["no_sun_autonomy", "solar_assisted_typical_winter", "daily_energy_fraction"]).optional(),
      weakestMonthPvKwh: finite.optional(), assumedNonSolarLoadKwh: finite.optional(),
    }).optional(),
    sizingAssumptions: z.array(z.string().max(2000)).max(100).optional(),
    sizingWarnings: z.array(z.string().max(2000)).max(100).optional(),
    generatorIncluded: z.boolean().optional(), generatorPurchaseStatus: z.enum(["not_purchased", "have_details"]).optional(), generatorType: z.string().max(100).optional(), generatorFuel: z.string().max(100).optional(), generatorContinuousKw: finite.optional(), generatorSurgeKw: finite.optional(), calculatedGeneratorContinuousKw: finite.optional(), calculatedGeneratorSurgeKw: finite.optional(), recordedGeneratorContinuousKw: finite.optional(), recordedGeneratorSurgeKw: finite.optional(), generatorConnectionMethod: z.string().max(100).optional(), electricalStandard: z.enum(["as_nzs", "nec", "iec", "local_review"]).optional(), connectionType: z.enum(["dc", "ac_single", "ac_three"]).optional(),
    connectionVoltage: finite.optional(), connectionCurrent: finite.optional(), connectionLengthM: finite.optional(),
    cableSizeMm2: finite.optional(), breakerAmps: finite.optional(), maxVoltageDropPercent: finite.max(20).optional(),
  }),
});

export async function PUT(request: Request) {
  let payload: unknown;
  try {
    const body = await request.text();
    if (!body.trim()) return Response.json({ error: "Missing calculator values." }, { status: 400 });
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid calculator values." }, { status: 400 });
  }
  const parsed = calculatorSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid calculator values." }, { status: 400 });
  const { panelCount, pvStrings, panelsPerString } = parsed.data.design;
  const hasLegacyTopology = pvStrings !== undefined || panelsPerString !== undefined;
  if (hasLegacyTopology && (
    !Number.isInteger(panelCount) || !Number.isInteger(pvStrings) || !Number.isInteger(panelsPerString)
    || !panelCount || !pvStrings || !panelsPerString
    || pvStrings * panelsPerString !== panelCount
  )) return Response.json({ error: "PV string topology must account for the exact panel total." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const current = await supabase.from("projects").select("settings,phase,site_id").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
  if (current.error) return Response.json({ error: current.error.message }, { status: 400 });
  if (!current.data) return Response.json({ error: "Power system not found." }, { status: 404 });
  const settings = (current.data.settings ?? {}) as Record<string, unknown>;
  const draft = parsed.data.design.proposedAsBuiltDraft;
  if (draft?.nodes?.length) {
    // Introduced shortfall options belong in the working schematic, but are not
    // equipment records until the user explicitly accepts their specification.
    const materializedNodes = draft.nodes.filter((node) => !node.rejected && (!node.introduced || node.reviewed === true));
    const componentType = (nodeId: string) => {
      if (nodeId === "battery") return "battery";
      if (nodeId === "generator") return "generator";
      if (nodeId === "controller" || nodeId === "charge-controller") return "charger";
      if (nodeId.includes("isolator")) return "isolator";
      if (nodeId.includes("combiner")) return "combiner";
      if (/breaker|fuse|protection|safety/.test(nodeId)) return "protection";
      if (nodeId === "battery-inverter" || nodeId === "inverter" || nodeId.startsWith("inverter-") || nodeId.includes("inverter")) return "inverter";
      if (nodeId.includes("meter")) return "meter";
      if (nodeId.includes("monitor")) return "monitoring";
      if (nodeId.includes("earth")) return "other";
      return "other";
    };
    const plannedArrays = parsed.data.design.pvArrayPlan?.arrays ?? [];
    try {
      await Promise.all(materializedNodes.map(async (node) => {
        if (node.authorityCheck || node.recordRef) return;
        const isPvArray = node.id === "solar" || node.id.startsWith("solar-pv-");
        if (isPvArray) {
          const identity = { "Proposal source": "Wattson design", "Proposal node id": node.id };
          const identified = await supabase.from("pv_arrays").select("id,specifications").eq("project_id", parsed.data.projectId).contains("specifications", identity).limit(1).maybeSingle();
          if (identified.error) throw new Error(identified.error.message);
          const existing = identified.data ? { data: identified.data, error: null } : await supabase.from("pv_arrays").select("id,specifications").eq("project_id", parsed.data.projectId).eq("name", node.label).contains("specifications", { "Proposal source": "Wattson design" }).order("created_at", { ascending: true }).limit(1).maybeSingle();
          if (existing.error) throw new Error(existing.error.message);
          let id = existing.data?.id;
          if (id && !identified.data) {
            const tagged = await supabase.from("pv_arrays").update({ specifications: { ...(existing.data?.specifications ?? {}), ...identity } }).eq("id", id).eq("project_id", parsed.data.projectId);
            if (tagged.error) throw new Error(tagged.error.message);
          }
          if (!id) {
            const plannedIndex = Number(node.id.match(/^solar-pv-(\d+)$/)?.[1] ?? 1) - 1;
            const plannedArray = plannedArrays[plannedIndex];
            const panelCount = plannedArray?.allocatedPanelCount ?? parsed.data.design.panelCount ?? null;
            const created = await supabase.from("pv_arrays").insert({
              project_id: parsed.data.projectId,
              name: node.label,
              panel_watts: plannedArray?.panelWatts ?? parsed.data.design.panelWatts ?? null,
              panel_count: panelCount,
              strings: plannedArray?.topology.strings.length || null,
              panels_per_string: plannedArray?.topology.strings.every((string) => string.panelsInSeries === plannedArray.topology.strings[0]?.panelsInSeries) ? plannedArray.topology.strings[0]?.panelsInSeries ?? null : null,
              maximum_power_voltage_v: plannedArray?.panelVmpV ?? parsed.data.design.panelVmpV ?? null,
              open_circuit_voltage_v: plannedArray?.panelVocV ?? parsed.data.design.panelVocV ?? null,
              maximum_power_current_a: plannedArray?.panelImpA ?? parsed.data.design.panelImpA ?? null,
              short_circuit_current_a: plannedArray?.panelIscA ?? parsed.data.design.panelIscA ?? null,
              specifications: identity,
              confidence: "estimated",
            }).select("id").single();
            if (created.error?.code === "23505") {
              const raced = await supabase.from("pv_arrays").select("id").eq("project_id", parsed.data.projectId).contains("specifications", identity).single();
              if (raced.error) throw new Error(raced.error.message);
              id = raced.data.id;
            } else if (created.error) throw new Error(created.error.message);
            else id = created.data.id;
          }
          node.recordRef = `pv:${id}`;
          return;
        }
        const type = componentType(node.id);
        const identity = { "Proposal source": "Wattson design", "Proposal node id": node.id };
        const identified = await supabase.from("system_components").select("id,specifications").eq("project_id", parsed.data.projectId).contains("specifications", identity).limit(1).maybeSingle();
        if (identified.error) throw new Error(identified.error.message);
        const existing = identified.data ? { data: identified.data, error: null } : await supabase.from("system_components").select("id,specifications").eq("project_id", parsed.data.projectId).eq("type", type).eq("display_name", node.label).contains("specifications", { "Proposal source": "Wattson design" }).order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (existing.error) throw new Error(existing.error.message);
        let id = existing.data?.id;
        if (id) {
          const refreshed = await supabase.from("system_components").update({
            display_name: node.label,
            type,
            specifications: { ...(existing.data?.specifications ?? {}), ...identity, "Schematic image": node.image },
          }).eq("id", id).eq("project_id", parsed.data.projectId);
          if (refreshed.error) throw new Error(refreshed.error.message);
        }
        if (!id) {
          const specifications: Record<string, string | number> = { ...identity, "Schematic image": node.image };
          if (type === "inverter" && parsed.data.design.inverterKw) specifications["Rated power"] = `${parsed.data.design.inverterKw} kW`;
          if (type === "battery") {
            if (parsed.data.design.batteryChemistry) specifications["Chemistry / battery type"] = parsed.data.design.batteryChemistry;
            if (parsed.data.design.batteryVoltage) specifications["Nominal voltage"] = `${parsed.data.design.batteryVoltage} V`;
            if (parsed.data.design.batteryAh) specifications.Capacity = `${parsed.data.design.batteryAh} Ah`;
          }
          if (type === "generator" && parsed.data.design.generatorContinuousKw) specifications["Continuous output"] = `${parsed.data.design.generatorContinuousKw} kW`;
          const created = await supabase.from("system_components").insert({
            project_id: parsed.data.projectId,
            type,
            display_name: node.label,
            quantity: type === "battery" ? parsed.data.design.batteryQuantity ?? 1 : 1,
            specifications,
            notes: node.notes || null,
            confidence: "estimated",
          }).select("id").single();
          if (created.error?.code === "23505") {
            const raced = await supabase.from("system_components").select("id").eq("project_id", parsed.data.projectId).contains("specifications", identity).single();
            if (raced.error) throw new Error(raced.error.message);
            id = raced.data.id;
          } else if (created.error) throw new Error(created.error.message);
          else id = created.data.id;
        }
        node.recordRef = `component:${id}`;
      }));

      const currentNodeIds = new Set(materializedNodes.map((node) => node.id));
      const generatedComponents = await supabase.from("system_components")
        .select("id,specifications")
        .eq("project_id", parsed.data.projectId)
        .contains("specifications", { "Proposal source": "Wattson design" });
      if (generatedComponents.error) throw new Error(generatedComponents.error.message);
      const obsoleteIds = (generatedComponents.data ?? []).filter((component) => {
        const specifications = (component.specifications ?? {}) as Record<string, unknown>;
        const nodeId = specifications["Proposal node id"];
        return typeof nodeId === "string" && !currentNodeIds.has(nodeId);
      }).map((component) => component.id);
      for (const id of obsoleteIds) {
        const recordRef = `component:${id}`;
        const links = await supabase.from("system_connections").delete().eq("project_id", parsed.data.projectId).or(`source_ref.eq.${recordRef},target_ref.eq.${recordRef}`);
        if (links.error) throw new Error(links.error.message);
      }
      if (obsoleteIds.length) {
        const removed = await supabase.from("system_components").delete().eq("project_id", parsed.data.projectId).in("id", obsoleteIds);
        if (removed.error) throw new Error(removed.error.message);
      }
    } catch (problem) {
      return Response.json({ error: problem instanceof Error ? problem.message : "Could not save the proposed equipment." }, { status: 400 });
    }

    const nodeRefs = new Map(materializedNodes.flatMap((node) => node.recordRef ? [[node.id, node.recordRef] as const] : []));
    const proposalConnections = (draft.connections ?? []).filter((connection) =>
      !connection.authorityCheck && nodeRefs.has(connection.from) && nodeRefs.has(connection.to));
    if (proposalConnections.length) {
      const existing = await supabase.from("system_connections")
        .select("id,source_ref,target_ref,name,notes")
        .eq("project_id", parsed.data.projectId);
      if (existing.error) return Response.json({ error: existing.error.message }, { status: 400 });
      try {
        await Promise.all(proposalConnections.map(async (connection) => {
          const sourceRef = nodeRefs.get(connection.from)!;
          const targetRef = nodeRefs.get(connection.to)!;
          const marker = `[proposal-connection:${connection.from}:${connection.to}:${connection.kind}]`;
          const prior = (existing.data ?? []).find((row) => String(row.notes ?? "").includes(marker))
            ?? (existing.data ?? []).find((row) => row.name === connection.label && (
              row.source_ref === sourceRef && row.target_ref === targetRef
              || row.source_ref === targetRef && row.target_ref === sourceRef
            ));
          const values = {
            project_id: parsed.data.projectId,
            source_ref: sourceRef,
            target_ref: targetRef,
            name: connection.label,
            connection_type: connection.kind === "solar-dc" || connection.kind === "battery-dc" ? "dc" : connection.kind,
            circuit_role: connection.kind === "solar-dc" ? "pv_dc" : connection.kind === "battery-dc" ? "battery_dc" : "unspecified",
            polarity: connection.kind === "solar-dc" || connection.kind === "battery-dc" ? "pair" : "na",
            cable_size: connection.cableSizeMm2 ? `${connection.cableSizeMm2} mm²` : null,
            cable_length: connection.lengthM ? `${connection.lengthM} m` : null,
            breaker_size: connection.protectionAmps ? `${connection.protectionAmps} A` : null,
            notes: [connection.notes, marker].filter(Boolean).join("\n"),
            confidence: "estimated" as const,
          };
          const savedConnection = prior
            ? await supabase.from("system_connections").update(values).eq("id", prior.id).eq("project_id", parsed.data.projectId)
            : await supabase.from("system_connections").insert(values);
          if (savedConnection.error) throw new Error(savedConnection.error.message);
        }));
      } catch (problem) {
        return Response.json({ error: problem instanceof Error ? problem.message : "Could not save the proposed connections." }, { status: 400 });
      }
    }
  }
  settings.designCalculator = { ...parsed.data.design, sizingMethod: "user-adjusted", updatedAt: new Date().toISOString(), updatedBy: "user" };
  const proposalPhase = ["discover", "design", "build", "commission"].includes(current.data.phase)
    ? parsed.data.design.proposedChecklist?.["proposed-schematic"] === true ? "build" : "design"
    : current.data.phase;
  const saved = await supabase.from("projects").update({ settings, phase: proposalPhase }).eq("id", parsed.data.projectId).eq("owner_id", userId);
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  try {
    await syncPlannedInverterCards(supabase, parsed.data.projectId, settings);
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not align the inverter technical cards." }, { status: 400 });
  }
  if (parsed.data.creditEvent === "proposal_rebuild") await recordOwnShadowCreditUsage(supabase, {
    siteId: current.data.site_id,
    projectId: parsed.data.projectId,
    action: "proposal_rebuild",
    idempotencyKey: parsed.data.requestId ? `proposal-rebuild:${parsed.data.requestId}` : undefined,
    metadata: { source: "design_calculator" },
  });
  return Response.json({ saved: true, design: settings.designCalculator });
}
