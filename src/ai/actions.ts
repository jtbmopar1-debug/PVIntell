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

export interface WattsonActionRequest {
  name: string;
  arguments: unknown;
}

export interface AppliedWattsonAction {
  type:
    | "component_added"
    | "component_updated"
    | "settings_updated"
    | "pv_array_added"
    | "pv_array_updated";
  summary: string;
}

export const wattsonActionTools = [
  {
    type: "function",
    name: "record_added_component",
    description:
      "Update the current PVIntell system inventory only when the user explicitly says that physical equipment has been added or installed. Do not call for hypothetical plans, recommendations, or questions.",
    parameters: {
      type: "object",
      properties: {
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
    name: "update_system_settings",
    description:
      "Update current system settings only when the user explicitly states a corrected value or asks PVIntell to change it. Do not call for hypothetical values or calculations.",
    parameters: {
      type: "object",
      properties: {
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
          .select("id,name,specifications")
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
