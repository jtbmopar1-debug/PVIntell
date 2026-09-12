import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const finite = z.number().finite().min(0).max(1_000_000);
const calculatorSchema = z.object({
  projectId: z.uuid(),
  design: z.object({
    proposalEngineVersion: finite.optional(),
    proposedChecklist: z.record(z.string(), z.boolean()).optional(),
    proposedAsBuiltDraft: z.object({
      createdAt: z.string().datetime(),
      architecture: z.enum(["combined_hybrid_inverter", "separate_solar_controller_and_inverter", "ac_coupled", "not_decided"]).optional(),
      flow: z.array(z.string().max(100)).min(2).max(10),
      nodes: z.array(z.object({ id: z.string().max(50), label: z.string().max(160), detail: z.string().max(2000), image: z.string().max(200), x: finite, y: finite, installed: z.boolean().optional(), reviewed: z.boolean().optional(), notes: z.string().max(2000).optional(), authorityCheck: z.boolean().optional() })).max(100).optional(),
      connections: z.array(z.object({ from: z.string().max(50), to: z.string().max(50), label: z.string().max(200), kind: z.enum(["solar-dc", "battery-dc", "ac", "earth"]), lengthM: finite.optional(), lengthBasis: z.enum(["estimated", "measured"]).optional(), cableSizeMm2: finite.optional(), protectionAmps: finite.optional(), notes: z.string().max(2000).optional(), authorityCheck: z.boolean().optional(), configured: z.boolean().optional() })).max(200).optional(),
      panelCount: finite.optional(), panelWatts: finite.optional(), pvStrings: finite.optional(), panelsPerString: finite.optional(),
      panelVmpV: finite.optional(), panelVocV: finite.optional(), panelImpA: finite.optional(), panelIscA: finite.optional(), batteryVoltage: finite.optional(),
      batteryAh: finite.optional(), batteryQuantity: finite.optional(), inverterKw: finite.optional(), generatorContinuousKw: finite.optional(), generatorSurgeKw: finite.optional(),
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
      arrays: z.array(z.object({
        id: z.string().max(100), name: z.string().max(200), capacity: finite.optional(), mounting: z.string().max(100).optional(),
        direction: z.string().max(100).optional(), pitch: z.string().max(100).optional(), allocatedPanelCount: finite.optional(),
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
    planningPanelCapacity: finite.optional(), fitLimited: z.boolean().optional(), panelLengthMm: finite.optional(),
    panelWidthMm: finite.optional(), panelThicknessMm: finite.optional(), panelWeightKg: finite.optional(),
    panelWeightBasis: z.string().max(300).optional(), panelMaximumSystemVoltageV: finite.optional(),
    panelMaximumSeriesFuseA: finite.optional(), panelVocTemperatureCoefficientPercentPerC: z.number().finite().min(-10).max(10).optional(),
    requiredPanelAreaM2: finite.optional(),
    fitStatus: z.enum(["verified", "unverified", "does_not_fit"]).optional(),
    azimuthDegrees: finite.max(360).optional(), tiltDegrees: finite.max(90).optional(),
    peakSunHours: finite.max(24).optional(), systemEfficiencyPercent: finite.max(100).optional(),
    inverterKw: finite.optional(), batteryChemistry: z.string().max(100).optional(), batteryVoltage: finite.optional(),
    inverterPlan: z.object({
      jurisdiction: z.enum(["nz", "local_review"]),
      selectionStatus: z.enum(["candidate_selected", "candidate_selected_pending_local_approval"]),
      unitRatingsKw: z.array(finite).max(20),
      preferredPhase: z.enum(["single", "three", "confirm"]),
      message: z.string().max(2000),
    }).optional(),
    batteryAh: finite.optional(), batteryQuantity: finite.optional(), usableBatteryPercent: finite.max(100).optional(),
    batteryUsableKwh: finite.optional(),
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
    generatorIncluded: z.boolean().optional(), generatorPurchaseStatus: z.enum(["not_purchased", "have_details"]).optional(), generatorType: z.string().max(100).optional(), generatorFuel: z.string().max(100).optional(), generatorContinuousKw: finite.optional(), generatorSurgeKw: finite.optional(), generatorConnectionMethod: z.string().max(100).optional(), electricalStandard: z.enum(["as_nzs", "nec", "iec", "local_review"]).optional(), connectionType: z.enum(["dc", "ac_single", "ac_three"]).optional(),
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
  const current = await supabase.from("projects").select("settings").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
  if (current.error) return Response.json({ error: current.error.message }, { status: 400 });
  if (!current.data) return Response.json({ error: "Power system not found." }, { status: 404 });
  const settings = (current.data.settings ?? {}) as Record<string, unknown>;
  settings.designCalculator = { ...parsed.data.design, sizingMethod: "user-adjusted", updatedAt: new Date().toISOString(), updatedBy: "user" };
  const saved = await supabase.from("projects").update({ settings }).eq("id", parsed.data.projectId).eq("owner_id", userId);
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ saved: true });
}
