import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

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
  pv_kw: z.number().positive().max(1000).optional(),
  panel_count: z.number().int().positive().max(10000).optional(),
  representative_panel_watts: z.number().positive().max(5000).optional(),
  pv_strings: z.number().int().positive().max(1000).optional(),
  panels_per_string: z.number().int().positive().max(1000).optional(),
  panel_vmp_v: z.number().positive().max(5000).optional(),
  panel_voc_v: z.number().positive().max(5000).optional(),
  panel_imp_a: z.number().positive().max(1000).optional(),
  panel_isc_a: z.number().positive().max(1000).optional(),
  panel_type: z.enum(["bifacial", "monofacial", "other", "not_selected"]).default("not_selected"),
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
  "ac_phase_arrangement",
  "nominal_ac_voltage",
  "primary_outcome",
  "current_energy_use",
  "served_floor_area",
  "garage_conditioning",
  "garage_floor_area",
  "bill_evidence",
  "backup_preference",
  "outage_essential_loads",
  "backup_duration",
  "generator_requirement",
  "generator_details",
  "heavy_or_surge_loads",
  "cooking_energy",
  "water_heating_energy",
  "space_heating_energy",
  "pool_or_spa",
  "pool_heating_method",
  "pool_heating_profile",
  "pool_heater_electrical_kw",
  "pool_heater_cop",
  "pool_equipment_ratings",
  "household_motor_ratings",
  "everyday_needs",
  "building_type",
  "property_authority",
  "proposed_panel_location",
  "storage_supply_source",
  "panel_construction_interest",
  "usable_solar_space",
  "panel_area_dimensions",
  "panel_area_constraints",
  "orientation_and_pitch",
  "shading",
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
  value: z.string().trim().min(1).max(1500),
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
      "Save or refresh Wattson's evidence-led preliminary working design after discovery and an architecture direction are complete. Use this for proposed sizing only, never installed or purchased equipment. Prefer a modest useful starting stage plus a compatible expansion path. A panel count is a candidate only: set fit_status to verified solely when recorded usable dimensions, obstructions, clearances and the candidate panel dimensions demonstrate that it fits; otherwise use unverified. Record proposed azimuth and tilt when the mounting surface or frame direction is supported by site evidence, and explain seasonal production trade-offs in the design basis or expansion path. Record series/parallel string arrangement and panel electrical values only when the exact module and controller or inverter input limits are supported by evidence; otherwise leave them unknown. Do not use budget to determine technical size.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Exact system UUID from connectedSiteSystems." },
        design_basis: { type: "string", description: "Short evidence summary, including energy and resilience inputs used." },
        starting_stage: { type: "string", description: "A useful minimum starting stage, clearly described as proposed." },
        expansion_path: { type: "string", description: "How the design can expand without stranding the starting equipment." },
        next_validation: { type: "string", description: "The single most important measurement or evidence still needed." },
        pv_kw: { type: "number", exclusiveMinimum: 0 },
        panel_count: { type: "integer", minimum: 1 },
        representative_panel_watts: { type: "number", exclusiveMinimum: 0 },
        pv_strings: { type: "integer", minimum: 1, description: "Number of PV strings connected in parallel." },
        panels_per_string: { type: "integer", minimum: 1, description: "Number of panels connected in series in each string." },
        panel_vmp_v: { type: "number", exclusiveMinimum: 0, description: "One panel's nameplate maximum-power voltage (Vmp)." },
        panel_voc_v: { type: "number", exclusiveMinimum: 0, description: "One panel's nameplate open-circuit voltage (Voc)." },
        panel_imp_a: { type: "number", exclusiveMinimum: 0, description: "One panel's nameplate maximum-power current (Imp)." },
        panel_isc_a: { type: "number", exclusiveMinimum: 0, description: "One panel's nameplate short-circuit current (Isc)." },
        panel_type: { type: "string", enum: ["bifacial", "monofacial", "other", "not_selected"] },
        panel_length_mm: { type: "number", exclusiveMinimum: 0 },
        panel_width_mm: { type: "number", exclusiveMinimum: 0 },
        panel_weight_kg: { type: "number", exclusiveMinimum: 0 },
        required_panel_area_m2: { type: "number", exclusiveMinimum: 0 },
        fit_status: { type: "string", enum: ["verified", "unverified", "does_not_fit"] },
        azimuth_degrees: { type: "number", minimum: 0, maximum: 360, description: "Proposed panel facing direction in degrees from true north clockwise: 0 north, 90 east, 180 south, 270 west." },
        tilt_degrees: { type: "number", minimum: 0, maximum: 90, description: "Proposed panel tilt from horizontal, in degrees." },
        inverter_kw: { type: "number", exclusiveMinimum: 0 },
        battery_usable_kwh: { type: "number", exclusiveMinimum: 0 },
      },
      required: ["design_basis", "starting_stage", "expansion_path", "next_validation", "panel_type", "fit_status"],
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
  for (const action of actions) {
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
      const current = await supabase.from("projects").select("settings").eq("id", projectId).single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      const previous = settings.designCalculator && typeof settings.designCalculator === "object"
        ? settings.designCalculator as Record<string, unknown>
        : {};
      settings.designCalculator = {
        ...previous,
        designBasis: input.design_basis,
        startingStage: input.starting_stage,
        expansionPath: input.expansion_path,
        nextValidation: input.next_validation,
        panelType: input.panel_type,
        targetPvKw: input.pv_kw ?? previous.targetPvKw,
        panelWatts: input.representative_panel_watts ?? previous.panelWatts,
        panelCount: input.panel_count ?? previous.panelCount,
        pvStrings: input.pv_strings ?? previous.pvStrings,
        panelsPerString: input.panels_per_string ?? previous.panelsPerString,
        panelVmpV: input.panel_vmp_v ?? previous.panelVmpV,
        panelVocV: input.panel_voc_v ?? previous.panelVocV,
        panelImpA: input.panel_imp_a ?? previous.panelImpA,
        panelIscA: input.panel_isc_a ?? previous.panelIscA,
        panelLengthMm: input.panel_length_mm ?? previous.panelLengthMm,
        panelWidthMm: input.panel_width_mm ?? previous.panelWidthMm,
        panelWeightKg: input.panel_weight_kg ?? previous.panelWeightKg,
        requiredPanelAreaM2: input.required_panel_area_m2 ?? previous.requiredPanelAreaM2,
        fitStatus: input.fit_status,
        azimuthDegrees: input.azimuth_degrees ?? previous.azimuthDegrees,
        tiltDegrees: input.tilt_degrees ?? previous.tiltDegrees,
        inverterKw: input.inverter_kw ?? previous.inverterKw,
        batteryUsableKwh: input.battery_usable_kwh ?? previous.batteryUsableKwh,
        updatedAt: new Date().toISOString(),
        updatedBy: "wattson",
      };
      const changed = await supabase.from("projects").update({ settings }).eq("id", projectId);
      if (changed.error) throw changed.error;
      applied.push({
        type: "preliminary_design_updated",
        summary: "Updated the proposed Design Calculator",
      });
    }

    if (action.name === "record_design_preference") {
      const parsed = designPreferenceSchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const current = await supabase.from("projects").select("settings").eq("id", projectId).single();
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
        updatedBy: "wattson",
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
      const parsed = designDiscoverySchema.safeParse(action.arguments);
      if (!parsed.success) continue;
      const current = await supabase.from("projects").select("settings").eq("id", projectId).single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      const discovery = (settings.designDiscovery ?? {}) as Record<string, unknown>;
      discovery[parsed.data.key] = {
        value: parsed.data.value,
        confidence: parsed.data.confidence,
        recordedAt: new Date().toISOString(),
      };
      settings.designDiscovery = discovery;
      const changed = await supabase.from("projects").update({ settings }).eq("id", projectId);
      if (changed.error) throw changed.error;
      applied.push({
        type: "design_discovery_updated",
        summary: `Added ${parsed.data.key.replaceAll("_", " ")} to the discovery notes`,
      });
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
        .select("name,settings")
        .eq("id", projectId)
        .single();
      if (current.error) throw current.error;
      const settings = (current.data.settings ?? {}) as Record<string, unknown>;
      if (input.autonomy_days !== undefined)
        settings.autonomyDays = input.autonomy_days;
      if (input.peak_sun_hours !== undefined)
        settings.peakSunHours = input.peak_sun_hours;
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
