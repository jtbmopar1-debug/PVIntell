import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { defaultProposalPanel, defaultProposalPanelStringLayout, defaultProposalPanelWarnings, proposalPanelProfile } from "@/design/candidate-panel";
import { deriveProposalSizing, solarFirstPowerAlternative, supplementaryArrayPlan, type ProposalSizingInput } from "@/design/proposal-sizing";
import { recommendedPanelOrientation } from "@/design/panel-orientation";
import { generatorFromDiscovery, proposalIncludesSolar } from "@/design/proposal-inputs";
import { assessPanelSurfaces } from "@/design/panel-surfaces";
import type { DesignCalculatorState } from "@/domain/models";

const componentType = z.enum([
  "panel",
  "pv_string",
  "battery",
  "inverter",
  "charger",
  "generator",
  "protection",
  "isolator",
  "cable",
  "connector",
  "combiner",
  "meter",
  "monitoring",
  "load",
  "other",
]);
const addComponentSchema = z.object({
  component_type: componentType,
  quantity: z.number().int().min(1).max(100),
  component_name: z.string().trim().min(1).max(120).optional(),
});
const proposedComponentSchema = z.object({
  component_type: componentType,
  component_name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(100).default(1),
  reason: z.string().trim().min(1).max(500).optional(),
});
const preliminaryDesignSchema = z.object({
  design_basis: z.string().trim().min(1).max(1200),
  starting_stage: z.string().trim().min(1).max(800),
  expansion_path: z.string().trim().min(1).max(1200),
  next_validation: z.string().trim().min(1).max(800),
  inverter_arrangement: z.enum(["combined", "modular", "string_inverter", "optimiser_string", "microinverters", "compare", "existing"]).optional(),
  pv_kw: z.number().positive().max(1000).optional(),
  panel_count: z.number().int().positive().max(10000).optional(),
  representative_panel_watts: z.number().positive().max(5000).optional(),
  existing_panel_name: z.string().trim().min(1).max(160).optional(),
  existing_panel_available_count: z.number().int().positive().max(10000).optional(),
  existing_panel_max_use_count: z.number().int().positive().max(10000).optional(),
  existing_panel_assessment_required: z.boolean().optional(),
  pv_strings: z.number().int().positive().max(1000).optional(),
  panels_per_string: z.number().int().positive().max(1000).optional(),
  panel_vmp_v: z.number().positive().max(5000).optional(),
  panel_voc_v: z.number().positive().max(5000).optional(),
  panel_imp_a: z.number().positive().max(1000).optional(),
  panel_isc_a: z.number().positive().max(1000).optional(),
  panel_type: z.enum(["bifacial", "monofacial", "flexible", "other", "not_selected"]).default("not_selected"),
  panel_length_mm: z.number().positive().max(10000).optional(),
  panel_width_mm: z.number().positive().max(10000).optional(),
  panel_weight_kg: z.number().positive().max(500).optional(),
  required_panel_area_m2: z.number().positive().max(100000).optional(),
  fit_status: z.enum(["verified", "unverified", "does_not_fit"]),
  azimuth_degrees: z.number().min(0).max(360).optional(),
  tilt_degrees: z.number().min(0).max(90).optional(),
  inverter_kw: z.number().positive().max(1000).optional(),
  battery_usable_kwh: z.number().positive().max(10000).optional(),
});
const proposedDesignAdjustmentSchema = z.object({
  panel_count: z.number().int().positive().max(10000),
});

type PreliminaryDesign = z.infer<typeof preliminaryDesignSchema>;

const commonGeneratorRatingsKw = [1, 2, 3, 3.5, 5, 6, 7.5, 8.5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100];

/**
 * Produce a searchable preliminary generator class while retaining the actual
 * running and motor-start requirements as separate checks. For a large motor,
 * an initial class is screened using a conservative 15% assumed difference
 * between continuous and advertised peak output. The
 * returned motorStartKw must still be demonstrated by the selected datasheet.
 */
export function generatorPlanningTargets(input: {
  included: boolean;
  purchaseStatus?: string;
  roles?: string;
  inverterKw?: number;
  continuousLoadKw?: number;
  startupPeakKw?: number;
}) {
  if (!input.included) return {};
  const assignedHighPowerLoads = input.purchaseStatus === "not_purchased"
    && /high_power_loads|large_appliances/.test(String(input.roles ?? "").toLowerCase());
  const runningMinimumKw = assignedHighPowerLoads
    ? (input.continuousLoadKw ?? 0) * 1.15
    : (input.inverterKw ?? 0) * .85;
  const catalogueClassMinimumKw = assignedHighPowerLoads && input.startupPeakKw
    ? Math.max(runningMinimumKw, input.startupPeakKw / 1.15)
    : runningMinimumKw;
  const firstClassIndex = commonGeneratorRatingsKw.findIndex((rating) => rating >= catalogueClassMinimumKw);
  const selectedClassIndex = firstClassIndex;
  const continuousKw = catalogueClassMinimumKw > 0
    ? selectedClassIndex >= 0 ? commonGeneratorRatingsKw[selectedClassIndex] : Math.ceil(catalogueClassMinimumKw / 25) * 25
    : undefined;
  return {
    continuousKw,
    motorStartKw: assignedHighPowerLoads ? input.startupPeakKw : undefined,
    assignedHighPowerLoads,
  };
}

/**
 * AI output supplies narrative and representative equipment assumptions only.
 * Numeric system sizes are always recalculated from recorded evidence here.
 */
export function validatePreliminarySizing(
  input: PreliminaryDesign,
  settings: Record<string, unknown>,
  mode: string,
  module?: { lengthMm: number; widthMm: number },
) {
  const withheld: string[] = [];
  const discovery = settings.designDiscovery && typeof settings.designDiscovery === "object"
    ? settings.designDiscovery as Record<string, unknown>
    : {};
  const sizing = deriveProposalSizing({
    mode,
    peakSunHours: Number(settings.peakSunHours) || undefined,
    autonomyDays: Number(settings.autonomyDays) || undefined,
    discovery,
    representativePanelWatts: input.representative_panel_watts,
    representativePanelLengthMm: module?.lengthMm,
    representativePanelWidthMm: module?.widthMm,
    solarResource: settings.solarResource && typeof settings.solarResource === "object"
      ? settings.solarResource as ProposalSizingInput["solarResource"]
      : undefined,
  });
  const differs = (candidate: number | undefined, canonical: number | undefined) =>
    candidate !== undefined && (canonical === undefined || Math.abs(candidate - canonical) > .01);
  if (differs(input.pv_kw, sizing.pvKw)) withheld.push("AI-provided PV size");
  if (differs(input.panel_count, sizing.panelCount)) withheld.push("AI-provided panel count");
  if (differs(input.inverter_kw, sizing.inverterKw)) withheld.push("AI-provided inverter rating");
  if (differs(input.battery_usable_kwh, sizing.batteryUsableKwh)) withheld.push("AI-provided battery capacity");
  if (input.pv_strings || input.panels_per_string) withheld.push("PV string layout pending selected equipment limits");

  return {
    pvKw: sizing.pvKw,
    panelCount: sizing.panelCount,
    inverterKw: sizing.inverterKw,
    batteryUsableKwh: sizing.batteryUsableKwh,
    pvStrings: undefined,
    panelsPerString: undefined,
    sizing,
    withheld,
  };
}

function sizingFields(settings: Record<string, unknown>, mode: string, panelWatts?: number, selectedPanelCount?: number) {
  const discovery = settings.designDiscovery && typeof settings.designDiscovery === "object"
    ? settings.designDiscovery as Record<string, unknown>
    : {};
  const sizing = deriveProposalSizing({
    mode,
    peakSunHours: Number(settings.peakSunHours) || undefined,
    autonomyDays: Number(settings.autonomyDays) || undefined,
    discovery,
    representativePanelWatts: panelWatts,
    selectedPanelCount,
    representativePanelLengthMm: Number((settings.designCalculator as Record<string, unknown> | undefined)?.panelLengthMm) || undefined,
    representativePanelWidthMm: Number((settings.designCalculator as Record<string, unknown> | undefined)?.panelWidthMm) || undefined,
    solarResource: settings.solarResource && typeof settings.solarResource === "object"
      ? settings.solarResource as ProposalSizingInput["solarResource"]
      : undefined,
  });
  return {
    targetPvKw: sizing.pvKw,
    panelCount: sizing.panelCount,
    energyTargetPvKw: sizing.energyTargetPvKw,
    energyTargetPanelCount: sizing.energyTargetPanelCount,
    planningPanelCapacity: sizing.planningPanelCapacity,
    fitLimited: sizing.fitLimited,
    inverterKw: sizing.inverterKw,
    batteryUsableKwh: sizing.batteryUsableKwh,
    sizingMethod: sizing.method,
    sizingInputs: {
      dailyEnergyKwh: sizing.dailyEnergyKwh,
      dailyEnergySource: sizing.dailyEnergySource,
      peakSunHours: sizing.peakSunHours,
      systemEfficiency: sizing.systemEfficiency,
      simultaneousLoadKw: sizing.simultaneousLoadKw,
      startupPeakKw: sizing.startupPeakKw,
      startupLoadName: sizing.startupLoadName,
      scheduledLoadEnergyKwh: sizing.scheduledLoadEnergyKwh,
      batteryOnlyDays: sizing.batteryOnlyDays,
      batterySizingBasis: sizing.batterySizingBasis,
      weakestMonthPvKwh: sizing.weakestMonthPvKwh,
      assumedNonSolarLoadKwh: sizing.assumedNonSolarLoadKwh,
    },
    sizingAssumptions: sizing.assumptions,
    sizingWarnings: sizing.warnings,
  };
}

export function refreshProposalAfterSizingInput(settings: Record<string, unknown>, mode: string) {
  if (!settings.designCalculator || typeof settings.designCalculator !== "object") return;
  const calculator = settings.designCalculator as Record<string, unknown>;
  if (calculator.updatedBy === "user") {
    calculator.sizingWarnings = [
      "Discovery changed after this user-adjusted proposal. Review and save the sizing again before relying on it.",
    ];
    calculator.sizingMethod = "user-adjusted";
    delete calculator.proposedAsBuiltDraft;
    delete calculator.proposedChecklist;
    settings.designCalculator = calculator;
    return;
  }
  const previousSignature = [calculator.targetPvKw, calculator.panelCount, calculator.inverterKw, calculator.batteryUsableKwh].join("|");
  const fields = sizingFields(settings, mode, Number(calculator.panelWatts) || undefined);
  if (calculator.panelProfileBasis === "representative") {
    fields.sizingWarnings = [...fields.sizingWarnings, ...defaultProposalPanelWarnings];
  }
  const nextSignature = [fields.targetPvKw, fields.panelCount, fields.inverterKw, fields.batteryUsableKwh].join("|");
  const refreshed: Record<string, unknown> = { ...calculator, ...fields, updatedAt: new Date().toISOString(), updatedBy: "wattson" };
  if (fields.batteryUsableKwh) {
    const batteryVoltage = Number(refreshed.batteryVoltage) || 51.2;
    const usablePercent = Number(refreshed.usableBatteryPercent) || 80;
    refreshed.batteryVoltage = batteryVoltage;
    refreshed.usableBatteryPercent = usablePercent;
    refreshed.batteryQuantity = Number(refreshed.batteryQuantity) || 1;
    refreshed.batteryChemistry = refreshed.batteryChemistry || "LiFePO₄ (planning selection)";
    refreshed.batteryAh = Math.ceil(fields.batteryUsableKwh * 1000 / (batteryVoltage * usablePercent / 100));
  } else {
    for (const key of ["batteryVoltage", "usableBatteryPercent", "batteryQuantity", "batteryChemistry", "batteryAh"]) delete refreshed[key];
  }
  if (calculator.panelProfileBasis === "representative" && fields.panelCount) {
    const layout = defaultProposalPanelStringLayout(fields.panelCount, proposalPanelProfile(calculator.panelType));
    refreshed.pvStrings = layout?.strings;
    refreshed.panelsPerString = layout?.panelsPerString;
    refreshed.stringDesign = layout;
  }
  if (previousSignature !== nextSignature) {
    delete refreshed.pvStrings;
    delete refreshed.panelsPerString;
    delete refreshed.proposedAsBuiltDraft;
    delete refreshed.proposedChecklist;
    refreshed.fitStatus = "unverified";
  }
  for (const key of ["targetPvKw", "panelCount", "inverterKw", "batteryUsableKwh"]) {
    if (refreshed[key] === undefined) delete refreshed[key];
  }
  settings.designCalculator = refreshed;
}

const proposalSizingDiscoveryKeys = new Set([
  "current_energy_use", "off_grid_daily_energy_use", "backup_preference", "battery_requirement", "backup_duration",
  "generator_outage_role", "household_motor_ratings", "pool_equipment", "pool_equipment_ratings", "pool_heating_method", "pool_heater_electrical_kw",
]);
const designPreferenceSchema = z.object({
  architecture: z.enum([
    "combined_hybrid_inverter",
    "separate_solar_controller_and_inverter",
    "ac_coupled",
    "not_decided",
  ]),
  notes: z.string().trim().min(1).max(1000).optional(),
});
const discoveryKey = z.enum([
  "utility_relationship",
  "target_grid_role",
  "ac_phase_arrangement",
  "nominal_ac_voltage",
  "primary_outcome",
  "current_energy_use",
  "off_grid_daily_energy_use",
  "served_floor_area",
  "garage_conditioning",
  "garage_floor_area",
  "bill_evidence",
  "backup_preference",
  "outage_essential_loads",
  "backup_duration",
  "generator_requirement",
  "generator_details",
  "generator_outage_role",
  "heavy_or_surge_loads",
  "cooking_energy",
  "water_heating_energy",
  "hot_water_storage_litres",
  "solar_hot_water_arrangement",
  "solar_hot_water_storage_litres",
  "solar_hot_water_pump_watts",
  "solar_hot_water_pump_hours_per_day",
  "space_heating_energy",
  "pool_or_spa",
  "pool_heating_method",
  "pool_heating_profile",
  "pool_heater_electrical_kw",
  "pool_heater_cop",
  "pool_equipment",
  "pool_equipment_ratings",
  "household_motor_ratings",
  "everyday_needs",
  "building_type",
  "property_authority",
  "proposed_panel_location",
  "storage_supply_source",
  "panel_construction_interest",
  "existing_panel_selection",
  "usable_solar_space",
  "panel_area_dimensions",
  "panel_area_constraints",
  "orientation_and_pitch",
  "shading",
  "shade_affected_areas",
  "shade_time_windows",
  "shade_seasonality",
  "shade_extent",
  "structure_condition",
  "installation_access",
  "property_constraints",
  "planning_constraints",
  "network_constraints",
  "expected_expansion",
  "ev_status",
  "ev_vehicle_details",
  "ev_travel_profile",
  "ev_charging_window",
  "ev_charging_priority",
  "ev_available_supply",
  "ev_bidirectional_goal",
  "delivery_approach",
  "dc_system_voltage",
  "battery_requirement",
  "battery_chemistry",
  "custom_battery_assessment",
  "module_level_electronics",
  "module_electronics_compatibility",
  "repair_access",
  "redundancy_needs",
]);
const designDiscoverySchema = z.object({
  key: discoveryKey,
  value: z.string().trim().min(1).max(4000),
  confidence: z.enum(["user_confirmed", "evidence_provided"]).default("user_confirmed"),
});
const systemKnowledgeSchema = z.object({
  category: z.enum(["operation", "control", "monitoring", "maintenance", "fault_history", "as_built_note", "other"]),
  title: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(1500),
  confidence: z.enum(["user_confirmed", "evidence_provided"]).default("user_confirmed"),
});
const updateSettingsSchema = z
  .object({
    system_name: z.string().trim().min(1).max(120).optional(),
    system_voltage: z.number().positive().max(1000).optional(),
    autonomy_days: z.number().positive().max(30).optional(),
    peak_sun_hours: z.number().positive().max(24).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined));
const updateComponentSchema = z
  .object({
    component_id: z.uuid(),
    component_name: z.string().trim().min(1).max(120).optional(),
    manufacturer: z.string().trim().min(1).max(120).optional(),
    model: z.string().trim().min(1).max(120).optional(),
    quantity: z.number().int().min(1).max(1000).optional(),
    installation_location: z.string().trim().min(1).max(200).optional(),
    notes: z.string().trim().min(1).max(2000).optional(),
    serial_number: z.string().trim().min(1).max(200).optional(),
    firmware_version: z.string().trim().min(1).max(120).optional(),
    manual_url: z.url().max(1000).optional(),
    specifications: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          value: z.string().trim().min(1).max(500),
        }),
      )
      .max(30)
      .optional(),
  })
  .refine((value) =>
    Object.entries(value).some(
      ([key, item]) => key !== "component_id" && item !== undefined,
    ),
  );
const pvArrayActionSchema = z
  .object({
    operation: z.enum(["add", "update"]),
    array_id: z.uuid().optional(),
    array_name: z.string().trim().min(1).max(80),
    manufacturer: z.string().trim().min(1).max(120).optional(),
    panel_model: z.string().trim().min(1).max(120).optional(),
    panel_type: z
      .enum([
        "monofacial",
        "bifacial",
        "thin-film",
        "flexible",
        "other",
        "unknown",
      ])
      .optional(),
    supplier: z.string().trim().min(1).max(200).optional(),
    purchased_on: z.iso.date().optional(),
    installed_on: z.iso.date().optional(),
    maximum_power_voltage_v: z.number().positive().optional(),
    maximum_power_current_a: z.number().positive().optional(),
    open_circuit_voltage_v: z.number().positive().optional(),
    short_circuit_current_a: z.number().positive().optional(),
    maximum_system_voltage_v: z.number().positive().optional(),
    nominal_operating_cell_temp_c: z.number().positive().optional(),
    maximum_series_fuse_a: z.number().positive().optional(),
    panel_watts: z.number().positive().optional(),
    panel_count: z.number().int().positive().optional(),
    strings: z.number().int().positive().optional(),
    panels_per_string: z.number().int().positive().optional(),
    orientation_degrees: z.number().min(0).max(360).optional(),
    tilt_degrees: z.number().min(0).max(90).optional(),
    cable_size_mm2: z.number().positive().optional(),
    cable_length_m: z.number().positive().optional(),
    connector_type: z.string().trim().min(1).max(160).optional(),
    breaker_details: z.string().trim().min(1).max(500).optional(),
    isolator_details: z.string().trim().min(1).max(500).optional(),
    combiner_details: z.string().trim().min(1).max(500).optional(),
    installation_notes: z.string().trim().min(1).max(2000).optional(),
    specifications: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          value: z.string().trim().min(1).max(500),
        }),
      )
      .max(30)
      .optional(),
  })
  .refine(
    (value) => value.operation === "add" || value.array_id !== undefined,
    { message: "An exact array ID is required when updating an array." },
  );
const connectionActionSchema = z
  .object({
    operation: z.enum(["add", "update"]),
    connection_id: z.uuid().optional(),
    source_ref: z.string().trim().min(1).max(160).optional(),
    target_ref: z.string().trim().min(1).max(160).optional(),
    connection_name: z.string().trim().min(1).max(120),
    connection_type: z.enum(["dc", "ac", "data", "earth", "other"]),
    polarity: z.enum(["positive", "negative", "pair", "na"]).optional(),
    cable_size: z.string().trim().min(1).max(120).optional(),
    cable_length: z.string().trim().min(1).max(120).optional(),
    breaker_size: z.string().trim().min(1).max(120).optional(),
    fuse_size: z.string().trim().min(1).max(120).optional(),
    isolator: z.string().trim().min(1).max(240).optional(),
    route: z.string().trim().min(1).max(500).optional(),
    notes: z.string().trim().min(1).max(2000).optional(),
  })
  .refine(
    (value) =>
      value.operation === "update"
        ? value.connection_id !== undefined
        : value.source_ref !== undefined && value.target_ref !== undefined,
    { message: "Add requires both endpoints; update requires a connection ID." },
  );
const loadActionSchema = z
  .object({
    operation: z.enum(["add", "update"]),
    load_id: z.uuid().optional(),
    load_name: z.string().trim().min(1).max(120),
    watts: z.number().min(0),
    quantity: z.number().int().min(1).max(1000).default(1),
    hours_per_day: z.number().min(0).max(24),
    surge_watts: z.number().min(0).optional(),
    current_type: z.enum(["AC", "DC"]).default("AC"),
    simultaneous: z.boolean().default(true),
    confidence: z.enum(["estimated", "confirmed"]),
  })
  .refine(
    (value) => value.operation === "add" || value.load_id !== undefined,
    { message: "An exact load ID is required when updating a load." },
  );

export interface WattsonActionRequest {
  name: string;
  arguments: unknown;
}

export interface AppliedWattsonAction {
  type:
    | "component_added"
    | "component_proposed"
    | "preliminary_design_updated"
    | "component_updated"
    | "design_preference_updated"
    | "design_discovery_updated"
    | "system_knowledge_updated"
    | "settings_updated"
    | "pv_array_added"
    | "pv_array_updated"
    | "connection_added"
    | "connection_updated"
    | "load_added"
    | "load_updated"
    | "workspace_created";
  summary: string;
}

export const wattsonActionTools = [
  {
    type: "function",
    name: "create_power_system_workspace",
    description:
      "Dashboard only: create the user's first empty place and power-system workspace after the public-electricity relationship and primary goal have both been confirmed in plain language. This creates a discovery workspace only; it does not select architecture or equipment. Use onboarding location and do not ask for coordinates again. Do not call when connectedSiteSystems already contains a system.",
    parameters: {
      type: "object",
      properties: {
        place_name: { type: "string", description: "Plain name such as Home, Farm or Cabin." },
        system_name: { type: "string", description: "Plain name such as House solar or Cabin power." },
      },
      required: ["place_name", "system_name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_proposed_component",
    description:
      "Add or refresh one clearly proposed design component only after the basic energy/site discovery gate and architecture decision are complete and the recorded evidence supports that component. This is a proposal, not installed equipment. Use a stable plain name so later calls update rather than duplicate it. Never invent a manufacturer, model, rating or quantity. Do not use this for inverter-architecture components because record_design_preference creates those automatically.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        component_type: { type: "string", enum: componentType.options },
        component_name: { type: "string" },
        quantity: { type: "integer", minimum: 1, maximum: 100 },
        reason: { type: "string" },
      },
      required: ["component_type", "component_name", "quantity"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_preliminary_design",
    description:
      "Create or refresh Wattson's preliminary working design after discovery and an architecture direction are complete. Supply explanation and staging only. PVIntell selects the representative planning module and calculates PV capacity, panel count, inverter rating and usable battery capacity deterministically from recorded discovery evidence; do not calculate or state those numeric sizes in this tool call. Missing evidence deliberately produces a blank size and a validation warning. This is a proposal, never installed or purchased equipment. Use fit_status=unverified unless physical fit has been established separately, and do not use budget to determine technical size.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Exact system UUID from connectedSiteSystems." },
        design_basis: { type: "string", description: "Short evidence summary, including energy and resilience inputs used." },
        starting_stage: { type: "string", description: "A useful minimum starting stage, clearly described as proposed." },
        expansion_path: { type: "string", description: "How the design can expand without stranding the starting equipment." },
        next_validation: { type: "string", description: "The single most important measurement or evidence still needed." },
        panel_type: { type: "string", enum: ["bifacial", "monofacial", "flexible", "other", "not_selected"] },
        fit_status: { type: "string", enum: ["unverified"], description: "The deterministic baseline does not prove physical fit." },
        azimuth_degrees: { type: "number", minimum: 0, maximum: 360, description: "Proposed panel facing direction in degrees from true north clockwise: 0 north, 90 east, 180 south, 270 west." },
        tilt_degrees: { type: "number", minimum: 0, maximum: 90, description: "Proposed panel tilt from horizontal, in degrees." },
      },
      required: ["design_basis", "starting_stage", "expansion_path", "next_validation", "panel_type", "fit_status"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_proposed_design",
    description:
      "Update the existing proposed Design Calculator only after the user explicitly requests or confirms an exact adjustment. This does not alter installed equipment. Currently supports an exact panel count; never infer the count or use this tool merely because Wattson recommended one.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Exact system UUID from connectedSiteSystems." },
        panel_count: { type: "integer", minimum: 1, maximum: 10000, description: "Exact proposed panel count confirmed by the user." },
      },
      required: ["project_id", "panel_count"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_design_preference",
    description:
      "Save the user's confirmed architecture preference only after basic energy and site suitability discovery is complete and the relevant choices have been explained in plain language. Use not_decided when the user explicitly wants Wattson to recommend an architecture after discovery. A preference is not installed equipment.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        architecture: {
          type: "string",
          enum: [
            "combined_hybrid_inverter",
            "separate_solar_controller_and_inverter",
            "ac_coupled",
            "not_decided",
          ],
        },
        notes: { type: "string" },
      },
      required: ["architecture"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_design_discovery",
    description:
      "Save one material fact learned during design discovery after the user states or confirms it. This is a design brief, not installed equipment. Keep the value faithful to the user's words or supplied evidence; do not invent measurements, consumption, constraints or approvals.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        key: { type: "string", enum: discoveryKey.options },
        value: { type: "string" },
        confidence: {
          type: "string",
          enum: ["user_confirmed", "evidence_provided"],
        },
      },
      required: ["key", "value", "confidence"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_added_component",
    description:
      "Update the current PVIntell system inventory only when the user explicitly says that physical equipment has been added or installed. Do not call for hypothetical plans, recommendations, or questions.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        component_type: { type: "string", enum: componentType.options },
        quantity: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Number newly added, not the new total.",
        },
        component_name: {
          type: "string",
          description:
            "Manufacturer/model or user-facing name, only if stated.",
        },
      },
      required: ["component_type", "quantity"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_system_knowledge",
    description:
      "Save one confirmed fact about an already installed or commissioned system for future monitoring, diagnostics or fault finding. Use this in monitor/as-built mode for operating behaviour, controls, smart devices, maintenance notes, known quirks, fault history or confirmed as-built context. This is not design discovery and must not create proposed equipment.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        category: { type: "string", enum: ["operation", "control", "monitoring", "maintenance", "fault_history", "as_built_note", "other"] },
        title: { type: "string" },
        value: { type: "string" },
        confidence: {
          type: "string",
          enum: ["user_confirmed", "evidence_provided"],
        },
      },
      required: ["category", "title", "value", "confidence"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_system_settings",
    description:
      "Update current system settings only when the user explicitly states a corrected value or asks PVIntell to change it. Do not call for hypothetical values or calculations.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        system_name: { type: "string" },
        system_voltage: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
        autonomy_days: { type: "number", exclusiveMinimum: 0, maximum: 30 },
        peak_sun_hours: { type: "number", exclusiveMinimum: 0, maximum: 24 },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_system_component",
    description:
      "Update an existing component only when the user explicitly asks to correct or change that exact installed component. Use the component_id from PVIntell context. Do not call for hypothetical upgrades, recommendations, or an ambiguous component when several could match.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        component_id: {
          type: "string",
          description: "Exact existing system component UUID from context.",
        },
        component_name: {
          type: "string",
          description:
            "User-facing name for this exact physical unit, such as Inverter 2.",
        },
        manufacturer: { type: "string" },
        model: { type: "string" },
        quantity: {
          type: "integer",
          minimum: 1,
          maximum: 1000,
          description: "New total quantity.",
        },
        installation_location: { type: "string" },
        notes: { type: "string" },
        serial_number: { type: "string" },
        firmware_version: { type: "string" },
        manual_url: {
          type: "string",
          description: "Full URL for the exact equipment manual.",
        },
        specifications: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["component_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_or_update_pv_array",
    description:
      "Add one physical PV string, or update one exact existing PV string, only when the user explicitly provides the information or asks for the change. Each string must be recorded separately. For an update, use the exact array_id from PVIntell context; if the string is ambiguous, ask the user instead of calling this tool. Never record suggested or assumed values as installed facts.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        operation: { type: "string", enum: ["add", "update"] },
        array_id: {
          type: "string",
          description:
            "Exact existing PV string UUID. Required for update; omit for add.",
        },
        array_name: {
          type: "string",
          description: "String name such as PV1, PV2 or East roof.",
        },
        manufacturer: { type: "string" },
        panel_model: { type: "string" },
        panel_type: {
          type: "string",
          enum: [
            "monofacial",
            "bifacial",
            "thin-film",
            "flexible",
            "other",
            "unknown",
          ],
        },
        supplier: { type: "string" },
        purchased_on: {
          type: "string",
          description: "Purchase date in YYYY-MM-DD format.",
        },
        installed_on: {
          type: "string",
          description: "Installation date in YYYY-MM-DD format.",
        },
        maximum_power_voltage_v: {
          type: "number",
          exclusiveMinimum: 0,
          description: "Per-panel Vmp.",
        },
        maximum_power_current_a: {
          type: "number",
          exclusiveMinimum: 0,
          description: "Per-panel Imp.",
        },
        open_circuit_voltage_v: {
          type: "number",
          exclusiveMinimum: 0,
          description: "Per-panel Voc.",
        },
        short_circuit_current_a: {
          type: "number",
          exclusiveMinimum: 0,
          description: "Per-panel Isc.",
        },
        maximum_system_voltage_v: { type: "number", exclusiveMinimum: 0 },
        nominal_operating_cell_temp_c: {
          type: "number",
          exclusiveMinimum: 0,
          description: "NOCT in degrees Celsius.",
        },
        maximum_series_fuse_a: { type: "number", exclusiveMinimum: 0 },
        panel_watts: { type: "number", exclusiveMinimum: 0 },
        panel_count: { type: "integer", minimum: 1 },
        strings: { type: "integer", minimum: 1 },
        panels_per_string: { type: "integer", minimum: 1 },
        orientation_degrees: { type: "number", minimum: 0, maximum: 360 },
        tilt_degrees: { type: "number", minimum: 0, maximum: 90 },
        cable_size_mm2: { type: "number", exclusiveMinimum: 0 },
        cable_length_m: { type: "number", exclusiveMinimum: 0 },
        connector_type: { type: "string" },
        breaker_details: { type: "string" },
        isolator_details: { type: "string" },
        combiner_details: { type: "string" },
        installation_notes: { type: "string" },
        specifications: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["operation", "array_name"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_or_update_system_connection",
    description:
      "Add or update a saved schematic connection only when the user explicitly identifies both exact equipment endpoints or an exact existing connection and provides the installed details. Use endpoint references and connection IDs exactly as supplied in PVIntell context. Never invent cable or protection ratings.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Exact system UUID. Required when working from dashboard context.",
        },
        operation: { type: "string", enum: ["add", "update"] },
        connection_id: { type: "string" },
        source_ref: { type: "string" },
        target_ref: { type: "string" },
        connection_name: { type: "string" },
        connection_type: {
          type: "string",
          enum: ["dc", "ac", "data", "earth", "other"],
        },
        polarity: {
          type: "string",
          enum: ["positive", "negative", "pair", "na"],
        },
        cable_size: { type: "string" },
        cable_length: { type: "string" },
        breaker_size: { type: "string" },
        fuse_size: { type: "string" },
        isolator: { type: "string" },
        route: { type: "string" },
        notes: { type: "string" },
      },
      required: ["operation", "connection_name", "connection_type"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_or_update_load",
    description:
      "Add or update one load in the power-use model only when watts and daily use are supported by a user value, readable label, measurement, model specification, bill-derived calculation, or an explicitly stated planning estimate. Never assign generic wattage or hours from an appliance name alone. Use confirmed only for user/label/measurement values and estimated for clearly identified planning estimates.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Exact system UUID. Required when working from dashboard context." },
        operation: { type: "string", enum: ["add", "update"] },
        load_id: { type: "string" },
        load_name: { type: "string" },
        watts: { type: "number", minimum: 0 },
        quantity: { type: "integer", minimum: 1, maximum: 1000 },
        hours_per_day: { type: "number", minimum: 0, maximum: 24 },
        surge_watts: { type: "number", minimum: 0 },
        current_type: { type: "string", enum: ["AC", "DC"] },
        simultaneous: { type: "boolean" },
        confidence: { type: "string", enum: ["estimated", "confirmed"] },
      },
      required: ["operation", "load_name", "watts", "quantity", "hours_per_day", "current_type", "simultaneous", "confidence"],
      additionalProperties: false,
    },
  },
] as const;

function labelFor(type: z.infer<typeof componentType>, quantity: number) {
  const label = type === "pv_string" ? "PV string" : type.replace("_", " ");
  return `${quantity} ${label}${quantity === 1 ? "" : "s"}`;
}

export async function applyWattsonActions(
  supabase: SupabaseClient,
  projectId: string,
  actions: WattsonActionRequest[],
) {
  const applied: AppliedWattsonAction[] = [];
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
    const action = actions[actionIndex];
    if (action.name === "record_proposed_component") {
      const parsed = proposedComponentSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const existing = await supabase
        .from("system_components")
        .select("id")
        .eq("project_id", projectId)
        .eq("type", input.component_type)
        .eq("display_name", input.component_name)
        .eq("confidence", "estimated")
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      const values = {
        quantity: input.quantity,
        notes: input.reason
          ? `Proposed by Wattson: ${input.reason}`
          : "Proposed by Wattson; not confirmed or installed",
        confidence: "estimated",
      };
      const changed = existing.data
        ? await supabase.from("system_components").update(values).eq("id", existing.data.id).eq("project_id", projectId)
        : await supabase.from("system_components").insert({ project_id: projectId, type: input.component_type, display_name: input.component_name, ...values });
      if (changed.error) throw changed.error;
      applied.push({
        type: "component_proposed",
        summary: `Proposed ${input.component_name} in the working design`,
      });
    }

    if (action.name === "record_preliminary_design") {
      const parsed = preliminaryDesignSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const current = await supabase.from("projects").select("settings,mode").eq("id", projectId).single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      const previous = settings.designCalculator && typeof settings.designCalculator === "object"
        ? settings.designCalculator as Record<string, unknown>
        : {};
      const previousPanelWatts = Number(previous.panelWatts) || undefined;
      const useDefaultCandidate = input.representative_panel_watts === undefined
        && (!previous.existingPanelGroup && previous.updatedBy !== "user" || previousPanelWatts === undefined);
      const candidate = useDefaultCandidate ? {
        ...defaultProposalPanel,
        ...proposalPanelProfile(input.panel_type),
      } : undefined;
      const representativePanelWatts = input.representative_panel_watts ?? candidate?.watts ?? previousPanelWatts ?? defaultProposalPanel.watts;
      const sizing = validatePreliminarySizing(
        { ...input, representative_panel_watts: representativePanelWatts },
        settings,
        String(current.data.mode),
        candidate ? { lengthMm: candidate.lengthMm, widthMm: candidate.widthMm } : undefined,
      );
      const discovery = settings.designDiscovery && typeof settings.designDiscovery === "object"
        ? settings.designDiscovery as Record<string, { value?: unknown }>
        : {};
      const recordedBatteryRequirement = String(discovery.battery_requirement?.value ?? "").trim().toLowerCase();
      const batteryExplicitlyExcluded = /^(?:none|no battery storage)$/.test(recordedBatteryRequirement);
      const standaloneMode = ["off-grid", "off_grid"].includes(String(current.data.mode).toLowerCase());
      const solarFirstUpgrade = standaloneMode && batteryExplicitlyExcluded ? solarFirstPowerAlternative({
        panelCount: sizing.panelCount,
        panelWatts: representativePanelWatts,
        inverterKw: sizing.inverterKw,
        startupPeakKw: sizing.sizing.startupPeakKw,
      }) : undefined;
      let proposedPanelCount = solarFirstUpgrade?.totalPanelCount ?? sizing.panelCount;
      let proposedPvKw = solarFirstUpgrade?.targetPvKw ?? sizing.pvKw;
      const proposedInverterKw = solarFirstUpgrade?.inverterKw ?? sizing.inverterKw;
      const retainUserModule = previous.updatedBy === "user" && Number(previous.panelWatts) === representativePanelWatts;
      let candidateStringLayout = candidate && proposedPanelCount
        ? defaultProposalPanelStringLayout(proposedPanelCount, candidate)
        : undefined;
      const recordedChemistry = String(discovery.battery_chemistry?.value ?? "").toLowerCase();
      const isLeadAcid = /lead|agm|gel/.test(recordedChemistry);
      const batteryChemistry = recordedChemistry === "lifepo4"
        ? "LiFePO₄"
        : recordedChemistry ? recordedChemistry.replaceAll("_", " ") : "LiFePO₄ (planning selection)";
      const nominalDcVoltage = Number(String(discovery.dc_system_voltage?.value ?? "").match(/\d+(?:\.\d+)?/)?.[0]);
      const generatorRoles = String(discovery.generator_outage_role?.value ?? "").toLowerCase();
      const generatorDetails = generatorFromDiscovery(discovery);
      const generatorIncluded = generatorDetails.included;
      const generatorTargets = generatorPlanningTargets({
        included: generatorIncluded,
        purchaseStatus: generatorDetails.purchaseStatus,
        roles: generatorRoles,
        inverterKw: proposedInverterKw,
        continuousLoadKw: sizing.sizing.simultaneousLoadKw,
        startupPeakKw: sizing.sizing.startupPeakKw,
      });
      const calculatedGeneratorContinuousKw = generatorTargets.continuousKw;
      const calculatedGeneratorSurgeKw = generatorTargets.motorStartKw;
      const batteryVoltage = sizing.batteryUsableKwh
        ? (Number(previous.batteryVoltage) || (nominalDcVoltage === 48 && !isLeadAcid ? 51.2 : nominalDcVoltage || 51.2))
        : undefined;
      const usableBatteryPercent = sizing.batteryUsableKwh
        ? (Number(previous.usableBatteryPercent) || (isLeadAcid ? 50 : 80))
        : undefined;
      const batteryAh = sizing.batteryUsableKwh && batteryVoltage && usableBatteryPercent
        ? Math.ceil(sizing.batteryUsableKwh * 1000 / (batteryVoltage * usableBatteryPercent / 100))
        : undefined;
      const existingPanelAvailable = input.existing_panel_assessment_required ? input.existing_panel_available_count : undefined;
      const existingPanelAllocation = existingPanelAvailable ? Math.min(input.existing_panel_max_use_count ?? existingPanelAvailable, existingPanelAvailable) : undefined;
      let existingPanelsUsed = existingPanelAllocation && proposedPanelCount ? Math.min(existingPanelAllocation, proposedPanelCount) : undefined;
      // A second array is selected independently. Discovery establishes its
      // required capacity here; module class, wattage and quantity stay open
      // until a compatible option is assessed for its own mounting surface and
      // inverter/MPPT input.
      let supplementaryCapacityRequiredKw: number | undefined;
      let supplementaryPanelsRequired = existingPanelsUsed !== undefined && proposedPanelCount ? Math.max(0, proposedPanelCount - existingPanelsUsed) : undefined;
      if (existingPanelsUsed !== undefined) {
        const targetFrontSidePvKw = solarFirstUpgrade ? solarFirstUpgrade.inverterKw * 1.2 : sizing.pvKw;
        if (targetFrontSidePvKw) {
          existingPanelsUsed = Math.min(existingPanelAllocation ?? 0, Math.ceil(targetFrontSidePvKw * 1000 / representativePanelWatts));
        }
        const supplementary = targetFrontSidePvKw ? supplementaryArrayPlan({
          targetPvKw: targetFrontSidePvKw,
          existingPanelCount: existingPanelsUsed,
          existingPanelWatts: representativePanelWatts,
        }) : undefined;
        supplementaryCapacityRequiredKw = supplementary?.requiredCapacityKw || undefined;
        supplementaryPanelsRequired = supplementaryCapacityRequiredKw ? supplementary?.planningCount : undefined;
        proposedPanelCount = existingPanelsUsed + (supplementaryPanelsRequired ?? 0);
        proposedPvKw = supplementary?.totalPlannedPvKw ?? Number((existingPanelsUsed * representativePanelWatts / 1000).toFixed(2));
        // Electrically different modules are represented as independent arrays;
        // final series counts wait for both module and MPPT datasheets.
        candidateStringLayout = undefined;
      }
      const existingPanelsSurplus = existingPanelAvailable && existingPanelsUsed !== undefined ? existingPanelAvailable - existingPanelsUsed : undefined;
      const existingPanelWarnings = existingPanelAvailable ? [
        `${existingPanelAvailable} user-owned ${input.representative_panel_watts} W panels are recorded, with up to ${existingPanelAllocation} made available to this proposal. The proposal uses ${existingPanelsUsed ?? 0}; ${existingPanelsSurplus ?? 0} remain unused${supplementaryCapacityRequiredKw ? `, and a separate array supplying at least ${supplementaryCapacityRequiredKw} kW is included` : ""}.`,
        "Existing-panel suitability is provisional until the exact model, dimensions, weight, Voc, Vmp, Isc, Imp, temperature coefficient, condition and inverter/MPPT limits are verified. Any electrically different additional modules must use a separately compatible string or input.",
      ] : [];
      const solarFirstWarnings = solarFirstUpgrade ? [
        `Solar-first power sizing increases the proposal from the ${sizing.pvKw ?? "unconfirmed"} kW energy baseline to at least ${proposedPvKw} kW of front-side panel capacity with a ${proposedInverterKw} kW inverter class so the ${sizing.sizing.startupLoadName ?? "largest motor"} can be assessed against its ${sizing.sizing.startupPeakKw} kW starting demand. Direct operation still requires adequate sunlight and documented inverter motor-start performance.`,
      ] : [];
      const generatorSizingWarnings = generatorTargets.assignedHighPowerLoads && calculatedGeneratorContinuousKw && calculatedGeneratorSurgeKw ? [
        `${calculatedGeneratorContinuousKw} kW is the preliminary, slightly up-specified marketed generator class screened from the recorded running and ${calculatedGeneratorSurgeKw} kW startup demand. Select it only if the exact model documents at least ${calculatedGeneratorSurgeKw} kW motor-start output and acceptable voltage/frequency recovery; continuous kW alone does not prove motor-start suitability.`,
      ] : [];
      const nextDesign: Record<string, unknown> = {
        ...previous,
        designBasis: input.design_basis,
        startingStage: input.starting_stage,
        expansionPath: input.expansion_path,
        nextValidation: input.next_validation,
        panelType: candidate?.panelType ?? input.panel_type,
        inverterArrangement: input.inverter_arrangement,
        panelProfileBasis: candidate ? "representative" : "user_equipment",
        mountingLocations: String(discovery.proposed_panel_location?.value ?? "").split(",").map((location) => location.trim()).filter(Boolean),
        targetPvKw: proposedPvKw,
        panelWatts: representativePanelWatts,
        panelCount: proposedPanelCount,
        existingPanelGroup: existingPanelAvailable ? {
          name: input.existing_panel_name ?? "Existing panels",
          availableCount: existingPanelAvailable,
          maximumAvailableToProposal: existingPanelAllocation,
          proposedUseCount: existingPanelsUsed,
          surplusCount: existingPanelsSurplus,
          supplementaryCount: supplementaryPanelsRequired,
          supplementaryTargetPvKw: supplementaryCapacityRequiredKw,
          wattsEach: input.representative_panel_watts,
          supplementaryWattsEach: undefined,
          supplementaryPanelType: undefined,
          supplementaryLengthMm: undefined,
          supplementaryWidthMm: undefined,
          assessmentStatus: "provisional_pending_datasheet_and_condition",
        } : undefined,
        energyTargetPvKw: sizing.sizing.energyTargetPvKw,
        energyTargetPanelCount: sizing.sizing.energyTargetPanelCount,
        planningPanelCapacity: sizing.sizing.planningPanelCapacity,
        fitLimited: sizing.sizing.fitLimited,
        pvStrings: supplementaryCapacityRequiredKw ? 2 : candidateStringLayout?.strings,
        panelsPerString: candidateStringLayout?.panelsPerString,
        stringDesign: candidateStringLayout,
        panelManufacturer: candidate?.manufacturer ?? (retainUserModule ? previous.panelManufacturer : undefined),
        panelModel: candidate?.model ?? (retainUserModule ? previous.panelModel : undefined),
        panelSupplier: candidate?.supplier ?? (retainUserModule ? previous.panelSupplier : undefined),
        panelProductUrl: candidate?.productUrl ?? (retainUserModule ? previous.panelProductUrl : undefined),
        panelDatasheetUrl: candidate?.datasheetUrl ?? (retainUserModule ? previous.panelDatasheetUrl : undefined),
        panelDatasheetVersion: candidate?.datasheetVersion ?? (retainUserModule ? previous.panelDatasheetVersion : undefined),
        panelVmpV: candidate?.vmpV ?? (retainUserModule ? previous.panelVmpV : undefined),
        panelVocV: candidate?.vocV ?? (retainUserModule ? previous.panelVocV : undefined),
        panelImpA: candidate?.impA ?? (retainUserModule ? previous.panelImpA : undefined),
        panelIscA: candidate?.iscA ?? (retainUserModule ? previous.panelIscA : undefined),
        panelLengthMm: candidate?.lengthMm ?? (retainUserModule ? previous.panelLengthMm : undefined),
        panelWidthMm: candidate?.widthMm ?? (retainUserModule ? previous.panelWidthMm : undefined),
        panelThicknessMm: candidate?.thicknessMm ?? (retainUserModule ? previous.panelThicknessMm : undefined),
        panelWeightKg: candidate?.weightKg ?? (retainUserModule ? previous.panelWeightKg : undefined),
        panelWeightBasis: candidate?.weightBasis ?? (retainUserModule ? previous.panelWeightBasis : undefined),
        panelMaximumSystemVoltageV: candidate?.maximumSystemVoltageV ?? (retainUserModule ? previous.panelMaximumSystemVoltageV : undefined),
        panelMaximumSeriesFuseA: candidate?.maximumSeriesFuseA ?? (retainUserModule ? previous.panelMaximumSeriesFuseA : undefined),
        panelVocTemperatureCoefficientPercentPerC: candidate?.vocTemperatureCoefficientPercentPerC ?? (retainUserModule ? previous.panelVocTemperatureCoefficientPercentPerC : undefined),
        requiredPanelAreaM2: retainUserModule ? previous.requiredPanelAreaM2 : undefined,
        fitStatus: "unverified",
        ...recommendedPanelOrientation({
          azimuthDegrees: input.azimuth_degrees ?? previous.azimuthDegrees,
          tiltDegrees: input.tilt_degrees ?? previous.tiltDegrees,
        }, (settings.solarResource as { latitude?: number } | undefined)?.latitude),
        inverterKw: proposedInverterKw,
        generatorIncluded: generatorIncluded || undefined,
        generatorPurchaseStatus: generatorDetails.purchaseStatus || undefined,
        generatorContinuousKw: generatorIncluded ? generatorDetails.purchaseStatus === "not_purchased" ? calculatedGeneratorContinuousKw : generatorDetails.continuousKw : undefined,
        generatorSurgeKw: generatorIncluded ? generatorDetails.purchaseStatus === "not_purchased" ? calculatedGeneratorSurgeKw : generatorDetails.surgeKw : undefined,
        generatorConnectionMethod: generatorDetails.connectionMethod,
        generatorType: generatorDetails.generatorType,
        generatorFuel: generatorDetails.fuel,
        batteryUsableKwh: sizing.batteryUsableKwh,
        batteryChemistry: sizing.batteryUsableKwh ? batteryChemistry : undefined,
        batteryVoltage,
        batteryAh,
        batteryQuantity: sizing.batteryUsableKwh ? 1 : undefined,
        usableBatteryPercent,
        sizingMethod: sizing.sizing.method,
        sizingInputs: {
          dailyEnergyKwh: sizing.sizing.dailyEnergyKwh,
          dailyEnergySource: sizing.sizing.dailyEnergySource,
          peakSunHours: sizing.sizing.peakSunHours,
          systemEfficiency: sizing.sizing.systemEfficiency,
          simultaneousLoadKw: sizing.sizing.simultaneousLoadKw,
          startupPeakKw: sizing.sizing.startupPeakKw,
          startupLoadName: sizing.sizing.startupLoadName,
          scheduledLoadEnergyKwh: sizing.sizing.scheduledLoadEnergyKwh,
          batteryOnlyDays: sizing.sizing.batteryOnlyDays,
          batterySizingBasis: sizing.sizing.batterySizingBasis,
          weakestMonthPvKwh: sizing.sizing.weakestMonthPvKwh,
          assumedNonSolarLoadKwh: sizing.sizing.assumedNonSolarLoadKwh,
        },
        sizingAssumptions: [...sizing.sizing.assumptions, ...(solarFirstUpgrade ? [`Solar-first proposal adds the panel and inverter capacity needed to assess the recorded ${sizing.sizing.startupPeakKw} kW motor-start demand before relying on generator or grid support.`] : [])],
        sizingWarnings: [...sizing.sizing.warnings, ...solarFirstWarnings, ...generatorSizingWarnings, ...generatorDetails.warnings, ...existingPanelWarnings, ...(candidate ? defaultProposalPanelWarnings : [])],
        updatedAt: new Date().toISOString(),
        updatedBy: "wattson",
      };
      // A rebuild is a new proposal even if its four headline sizes match.
      // Generator route, panel grouping, orientation and architecture may change.
      delete nextDesign.proposedAsBuiltDraft;
      delete nextDesign.proposedChecklist;
      if (!proposalIncludesSolar(discovery)) {
        nextDesign.panelCount = 0;
        nextDesign.targetPvKw = 0;
        for (const key of ["existingPanelGroup", "pvStrings", "panelsPerString", "stringDesign", "panelLengthMm", "panelWidthMm", "panelWeightKg", "panelVmpV", "panelVocV", "panelImpA", "panelIscA"]) delete nextDesign[key];
      }
      const finalSurfaceAssessment = assessPanelSurfaces(discovery, nextDesign as DesignCalculatorState, (settings.solarResource as { latitude?: number } | undefined)?.latitude);
      nextDesign.sizingWarnings = [...new Set([...(nextDesign.sizingWarnings as string[]), ...finalSurfaceAssessment.warnings])];
      if (finalSurfaceAssessment.status === "exceeds_space") {
        nextDesign.fitLimited = true;
        nextDesign.fitStatus = "does_not_fit";
      }
      for (const key of ["targetPvKw", "panelCount", "energyTargetPvKw", "energyTargetPanelCount", "planningPanelCapacity", "pvStrings", "panelsPerString", "stringDesign", "panelManufacturer", "panelModel", "panelSupplier", "panelProductUrl", "panelDatasheetUrl", "panelDatasheetVersion", "panelVmpV", "panelVocV", "panelImpA", "panelIscA", "panelLengthMm", "panelWidthMm", "panelThicknessMm", "panelWeightKg", "panelWeightBasis", "panelMaximumSystemVoltageV", "panelMaximumSeriesFuseA", "panelVocTemperatureCoefficientPercentPerC", "requiredPanelAreaM2", "inverterKw", "generatorIncluded", "generatorPurchaseStatus", "generatorContinuousKw", "generatorSurgeKw", "batteryUsableKwh", "batteryChemistry", "batteryVoltage", "batteryAh", "batteryQuantity", "usableBatteryPercent"]) {
        if (nextDesign[key] === undefined) delete nextDesign[key];
      }
      settings.designCalculator = nextDesign;
      const changed = await supabase.from("projects").update({ settings }).eq("id", projectId);
      if (changed.error) throw changed.error;
      applied.push({
        type: "preliminary_design_updated",
        summary: sizing.withheld.length
          ? `Updated the proposed Design Calculator; left unsupported ${sizing.withheld.join(", ")} unconfirmed`
          : "Updated the proposed Design Calculator",
      });
    }

    if (action.name === "update_proposed_design") {
      const parsed = proposedDesignAdjustmentSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const current = await supabase.from("projects").select("settings,mode").eq("id", projectId).single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      if (!settings.designCalculator || typeof settings.designCalculator !== "object") continue;
      const calculator = { ...(settings.designCalculator as Record<string, unknown>) };
      const panelWatts = Number(calculator.panelWatts);
      if (!Number.isFinite(panelWatts) || panelWatts <= 0) continue;
      const panelCount = parsed.data.panel_count;
      const panelCapacity = Number(calculator.planningPanelCapacity);
      if (Number.isFinite(panelCapacity) && panelCapacity >= 0 && panelCount > panelCapacity) continue;
      const knownPanelProfile = calculator.panelProfileBasis === "representative" && !calculator.existingPanelGroup;
      const stringLayout = knownPanelProfile
        ? defaultProposalPanelStringLayout(panelCount, proposalPanelProfile(calculator.panelType))
        : undefined;
      const dependentSizing = sizingFields(settings, String(current.data.mode), panelWatts, panelCount);
      calculator.panelCount = panelCount;
      calculator.targetPvKw = Number((panelCount * panelWatts / 1000).toFixed(2));
      calculator.energyTargetPvKw = dependentSizing.energyTargetPvKw;
      calculator.energyTargetPanelCount = dependentSizing.energyTargetPanelCount;
      calculator.planningPanelCapacity = dependentSizing.planningPanelCapacity;
      calculator.fitLimited = dependentSizing.fitLimited;
      calculator.pvStrings = stringLayout?.strings;
      calculator.panelsPerString = stringLayout?.panelsPerString;
      calculator.stringDesign = stringLayout;
      calculator.sizingInputs = dependentSizing.sizingInputs;
      calculator.sizingAssumptions = dependentSizing.sizingAssumptions;
      calculator.inverterKw = dependentSizing.inverterKw;
      if (dependentSizing.batteryUsableKwh) {
        const batteryVoltage = Number(calculator.batteryVoltage) || 51.2;
        const usableBatteryPercent = Number(calculator.usableBatteryPercent) || 80;
        calculator.batteryUsableKwh = dependentSizing.batteryUsableKwh;
        calculator.batteryVoltage = batteryVoltage;
        calculator.usableBatteryPercent = usableBatteryPercent;
        calculator.batteryAh = Math.ceil(dependentSizing.batteryUsableKwh * 1000 / (batteryVoltage * usableBatteryPercent / 100));
      }
      calculator.sizingMethod = "user-adjusted";
      calculator.updatedBy = "user";
      calculator.updatedAt = new Date().toISOString();
      calculator.sizingWarnings = [
        ...dependentSizing.sizingWarnings
          .filter((warning) => !warning.startsWith("Panel count adjusted to ")),
        `Panel count adjusted to ${panelCount} at the user's request; verify the final string layout against the selected inverter MPPT limits and cold-weather module voltage.`,
      ];
      delete calculator.proposedAsBuiltDraft;
      delete calculator.proposedChecklist;
      settings.designCalculator = calculator;
      const changed = await supabase.from("projects").update({ settings }).eq("id", projectId);
      if (changed.error) throw changed.error;
      applied.push({
        type: "preliminary_design_updated",
        summary: `Set the proposed array to ${panelCount} panels (${calculator.targetPvKw} kW)`,
      });
    }

    if (action.name === "record_design_preference") {
      const parsed = designPreferenceSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const current = await supabase.from("projects").select("settings,mode").eq("id", projectId).single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      settings.designPreferences = {
        ...((settings.designPreferences ?? {}) as Record<string, unknown>),
        architecture: parsed.data.architecture,
        notes: parsed.data.notes ?? null,
        confirmedThroughWattson: true,
      };
      const calculator = settings.designCalculator && typeof settings.designCalculator === "object"
        ? settings.designCalculator as Record<string, unknown>
        : {};
      settings.designCalculator = {
        ...calculator,
        architecture: parsed.data.architecture,
        updatedAt: new Date().toISOString(),
        updatedBy: calculator.updatedBy === "user" ? "user" : "wattson",
      };
      const changed = await supabase.from("projects").update({ settings }).eq("id", projectId);
      if (changed.error) throw changed.error;
      const architectureMarker = "Proposed by Wattson: architecture preference";
      const cleared = await supabase
        .from("system_components")
        .delete()
        .eq("project_id", projectId)
        .eq("confidence", "estimated")
        .eq("notes", architectureMarker);
      if (cleared.error) throw cleared.error;
      applied.push({
        type: "design_preference_updated",
        summary: "Saved the architecture preference for the Design Calculator",
      });
    }

    if (action.name === "record_design_discovery") {
      const batch = [];
      while (actionIndex < actions.length && actions[actionIndex].name === "record_design_discovery") {
        const parsed = designDiscoverySchema.safeParse(actions[actionIndex].arguments);
        if (parsed.success) batch.push(parsed.data);
        actionIndex++;
      }
      actionIndex--;
      if (!batch.length) continue;
      const current = await supabase.from("projects").select("settings,mode").eq("id", projectId).single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      const discovery = (settings.designDiscovery ?? {}) as Record<string, unknown>;
      for (const input of batch) discovery[input.key] = {
        value: input.value, confidence: input.confidence, recordedAt: new Date().toISOString(),
      };
      settings.designDiscovery = discovery;
      if (batch.some((input) => proposalSizingDiscoveryKeys.has(input.key))
        && !actions.slice(actionIndex + 1).some((next) => next.name === "record_preliminary_design"))
        refreshProposalAfterSizingInput(settings, String(current.data.mode));
      const changed = await supabase.from("projects").update({ settings }).eq("id", projectId);
      if (changed.error) throw changed.error;
      applied.push(...batch.map((input) => ({
        type: "design_discovery_updated" as const,
        summary: `Added ${input.key.replaceAll("_", " ")} to the discovery notes`,
      })));
    }

    if (action.name === "record_system_knowledge") {
      const parsed = systemKnowledgeSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const current = await supabase.from("projects").select("settings").eq("id", projectId).single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      const existing = Array.isArray(settings.systemKnowledge) ? settings.systemKnowledge as Array<Record<string, unknown>> : [];
      const entry = {
        id: crypto.randomUUID(),
        category: input.category,
        title: input.title,
        value: input.value,
        confidence: input.confidence,
        recordedAt: new Date().toISOString(),
        source: "wattson",
      };
      const duplicateIndex = existing.findIndex((item) => String(item.title ?? "").toLowerCase() === input.title.toLowerCase());
      settings.systemKnowledge = duplicateIndex >= 0
        ? existing.map((item, index) => index === duplicateIndex ? { ...item, ...entry, id: item.id ?? entry.id } : item)
        : [...existing, entry];
      const changed = await supabase.from("projects").update({ settings }).eq("id", projectId);
      if (changed.error) throw changed.error;
      applied.push({
        type: "system_knowledge_updated",
        summary: `Saved system knowledge: ${input.title}`,
      });
    }

    if (action.name === "record_added_component") {
      const parsed = addComponentSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const baseName =
        input.component_name ??
        (input.component_type === "inverter"
          ? "Inverter"
          : labelFor(input.component_type, input.quantity));
      const rows =
        input.component_type === "inverter"
          ? Array.from({ length: input.quantity }, (_, index) => ({
              project_id: projectId,
              type: input.component_type,
              display_name:
                input.quantity === 1 ? baseName : `${baseName} ${index + 1}`,
              model: input.component_name ?? null,
              quantity: 1,
              confidence: "confirmed",
              notes: "Recorded through Wattson",
            }))
          : [
              {
                project_id: projectId,
                type: input.component_type,
                display_name: baseName,
                model: input.component_name ?? null,
                quantity: input.quantity,
                confidence: "confirmed",
                notes: "Recorded through Wattson",
              },
            ];
      const inserted = await supabase.from("system_components").insert(rows);
      if (inserted.error) throw inserted.error;
      const summary = `Added ${labelFor(input.component_type, input.quantity)} to this system`;
      applied.push({ type: "component_added", summary });
    }

    if (action.name === "update_system_settings") {
      const parsed = updateSettingsSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const current = await supabase
        .from("projects")
        .select("name,settings,mode")
        .eq("id", projectId)
        .single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      if (input.autonomy_days !== undefined)
        settings.autonomyDays = input.autonomy_days;
      if (input.peak_sun_hours !== undefined)
        settings.peakSunHours = input.peak_sun_hours;
      if (input.autonomy_days !== undefined || input.peak_sun_hours !== undefined)
        refreshProposalAfterSizingInput(settings, String(current.data.mode));
      const update: Record<string, unknown> = { settings };
      if (input.system_name !== undefined) update.name = input.system_name;
      if (input.system_voltage !== undefined)
        update.system_voltage = input.system_voltage;
      const updated = await supabase
        .from("projects")
        .update(update)
        .eq("id", projectId);
      if (updated.error) throw updated.error;
      const changed = [
        input.system_name !== undefined ? `name to ${input.system_name}` : null,
        input.system_voltage !== undefined
          ? `system voltage to ${input.system_voltage} V`
          : null,
        input.autonomy_days !== undefined
          ? `reserve to ${input.autonomy_days} days`
          : null,
        input.peak_sun_hours !== undefined
          ? `peak sun to ${input.peak_sun_hours} hours`
          : null,
      ].filter(Boolean);
      applied.push({
        type: "settings_updated",
        summary: `Updated ${changed.join(", ")}`,
      });
    }

    if (action.name === "update_system_component") {
      const parsed = updateComponentSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const current = await supabase
        .from("system_components")
        .select(
          "id,type,display_name,manufacturer,model,quantity,specifications",
        )
        .eq("id", input.component_id)
        .eq("project_id", projectId)
        .maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) continue;
      const specifications = {
        ...((current.data.specifications ?? {}) as Record<string, unknown>),
      };
      for (const specification of input.specifications ?? [])
        specifications[specification.name] = specification.value;
      const update: Record<string, unknown> = {
        specifications,
        confidence: "confirmed",
      };
      if (input.component_name !== undefined)
        update.display_name = input.component_name;
      if (input.manufacturer !== undefined)
        update.manufacturer = input.manufacturer;
      if (input.model !== undefined) update.model = input.model;
      if (input.quantity !== undefined && current.data.type !== "inverter")
        update.quantity = input.quantity;
      if (input.installation_location !== undefined)
        update.installation_location = input.installation_location;
      if (input.notes !== undefined) update.notes = input.notes;
      if (input.serial_number !== undefined)
        update.serial_number = input.serial_number;
      if (input.firmware_version !== undefined)
        update.firmware_version = input.firmware_version;
      if (input.manual_url !== undefined) update.manual_url = input.manual_url;
      const changed = await supabase
        .from("system_components")
        .update(update)
        .eq("id", input.component_id)
        .eq("project_id", projectId);
      if (changed.error) throw changed.error;
      const label =
        input.component_name ??
        current.data.display_name ??
        input.model ??
        current.data.model ??
        current.data.type;
      applied.push({
        type: "component_updated",
        summary: `Updated ${label} specifications`,
      });
    }

    if (action.name === "record_or_update_pv_array") {
      const parsed = pvArrayActionSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      if (input.operation === "update") {
        const current = await supabase
          .from("pv_arrays")
          .select("id,name,specifications,strings,panels_per_string,panel_count")
          .eq("id", input.array_id!)
          .eq("project_id", projectId)
          .maybeSingle();
        if (current.error) throw current.error;
        if (!current.data) continue;
        const specifications = {
          ...((current.data.specifications ?? {}) as Record<string, unknown>),
        };
        for (const specification of input.specifications ?? [])
          specifications[specification.name] = specification.value;
        const update: Record<string, unknown> = {
          name: input.array_name,
          specifications,
          confidence: "confirmed",
        };
        for (const field of [
          "manufacturer",
          "panel_model",
          "panel_type",
          "supplier",
          "purchased_on",
          "installed_on",
          "maximum_power_voltage_v",
          "maximum_power_current_a",
          "open_circuit_voltage_v",
          "short_circuit_current_a",
          "maximum_system_voltage_v",
          "nominal_operating_cell_temp_c",
          "maximum_series_fuse_a",
          "panel_watts",
          "panel_count",
          "strings",
          "panels_per_string",
          "orientation_degrees",
          "tilt_degrees",
          "cable_size_mm2",
          "cable_length_m",
          "connector_type",
          "breaker_details",
          "isolator_details",
          "combiner_details",
          "installation_notes",
        ] as const) {
          if (input[field] !== undefined) update[field] = input[field];
        }
        // A PV-array record represents one physical string by default. When its
        // confirmed panel total changes, keep that string's series count in sync
        // unless the user has recorded a different parallel arrangement.
        if (input.panel_count !== undefined && input.panels_per_string === undefined && Number(input.strings ?? current.data.strings ?? 1) === 1) {
          update.panels_per_string = input.panel_count;
        }
        const changed = await supabase
          .from("pv_arrays")
          .update(update)
          .eq("id", input.array_id!)
          .eq("project_id", projectId);
        if (changed.error) throw changed.error;
        applied.push({
          type: "pv_array_updated",
          summary: `Updated ${input.array_name} details`,
        });
      } else {
        const specifications = Object.fromEntries(
          (input.specifications ?? []).map((item) => [item.name, item.value]),
        );
        const row: Record<string, unknown> = {
          project_id: projectId,
          name: input.array_name,
          specifications,
          confidence: "confirmed",
          strings: 1,
          panels_per_string: input.panel_count ?? null,
        };
        for (const field of [
          "manufacturer",
          "panel_model",
          "panel_type",
          "supplier",
          "purchased_on",
          "installed_on",
          "maximum_power_voltage_v",
          "maximum_power_current_a",
          "open_circuit_voltage_v",
          "short_circuit_current_a",
          "maximum_system_voltage_v",
          "nominal_operating_cell_temp_c",
          "maximum_series_fuse_a",
          "panel_watts",
          "panel_count",
          "strings",
          "panels_per_string",
          "orientation_degrees",
          "tilt_degrees",
          "cable_size_mm2",
          "cable_length_m",
          "connector_type",
          "breaker_details",
          "isolator_details",
          "combiner_details",
          "installation_notes",
        ] as const) {
          if (input[field] !== undefined) row[field] = input[field];
        }
        const inserted = await supabase.from("pv_arrays").insert(row);
        if (inserted.error) throw inserted.error;
        applied.push({
          type: "pv_array_added",
          summary: `Added ${input.array_name} to this system`,
        });
      }
    }

    if (action.name === "record_or_update_system_connection") {
      const parsed = connectionActionSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const values = {
        name: input.connection_name,
        connection_type: input.connection_type,
        polarity: input.polarity ?? "na",
        cable_size: input.cable_size ?? null,
        cable_length: input.cable_length ?? null,
        breaker_size: input.breaker_size ?? null,
        fuse_size: input.fuse_size ?? null,
        isolator: input.isolator ?? null,
        route: input.route ?? null,
        notes: input.notes ?? null,
        confidence: "confirmed",
      };
      if (input.operation === "update") {
        const changed = await supabase
          .from("system_connections")
          .update(values)
          .eq("id", input.connection_id!)
          .eq("project_id", projectId)
          .select("id")
          .maybeSingle();
        if (changed.error) throw changed.error;
        if (!changed.data) continue;
        applied.push({
          type: "connection_updated",
          summary: `Updated ${input.connection_name} connection`,
        });
      } else {
        if (input.source_ref === input.target_ref) continue;
        const inserted = await supabase.from("system_connections").insert({
          project_id: projectId,
          source_ref: input.source_ref,
          target_ref: input.target_ref,
          ...values,
        });
        if (inserted.error) throw inserted.error;
        applied.push({
          type: "connection_added",
          summary: `Connected ${input.connection_name}`,
        });
      }
    }

    if (action.name === "record_or_update_load") {
      const parsed = loadActionSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const input = parsed.data;
      const values = {
        name: input.load_name,
        watts: input.watts,
        quantity: input.quantity,
        hours_per_day: input.hours_per_day,
        surge_watts: input.surge_watts ?? null,
        current_type: input.current_type,
        simultaneous: input.simultaneous,
        confidence: input.confidence,
      };
      if (input.operation === "update") {
        const changed = await supabase.from("loads").update(values).eq("id", input.load_id!).eq("project_id", projectId).select("id").maybeSingle();
        if (changed.error) throw changed.error;
        if (!changed.data) continue;
        applied.push({ type: "load_updated", summary: `Updated ${input.load_name} in the power-use model` });
      } else {
        const inserted = await supabase.from("loads").insert({ project_id: projectId, ...values });
        if (inserted.error) throw inserted.error;
        applied.push({ type: "load_added", summary: `Added ${input.load_name} to the power-use model` });
      }
    }
  }
  if (applied.length) {
    const event = await supabase
      .from("system_events")
      .insert({
        project_id: projectId,
        type: "wattson_configuration_change",
        severity: "info",
        message: applied.map((item) => item.summary).join("; "),
        metadata: { actions: applied },
      });
    if (event.error) throw event.error;
    const touched = await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (touched.error) throw touched.error;
  }
  return applied;
}
