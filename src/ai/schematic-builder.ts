import type { SupabaseClient } from "@supabase/supabase-js";
import { explicitInverterMention, requestedSchematicPlan } from "./schematic-intent";

export interface PersistedSchematicPlan {
  arrayIds: string[];
  componentIds: string[];
  connectionIds: string[];
  arrayCount: number;
  panelsPerArray?: number;
  panelWatts?: number;
  componentNames: string[];
}

export async function persistRequestedSchematic({ supabase, projectId, message, priorUserText = "", fallbackPanelWatts }: {
  supabase: SupabaseClient;
  projectId: string;
  message: string;
  priorUserText?: string;
  fallbackPanelWatts?: number;
}): Promise<PersistedSchematicPlan> {
  const currentPlan = requestedSchematicPlan(message);
  const allUserText = `${priorUserText}\n${message}`.trim();
  const plan = currentPlan.pv.totalPanels || currentPlan.components.length ? currentPlan : requestedSchematicPlan(allUserText);
  const panelWatts = plan.pv.panelWatts ?? fallbackPanelWatts;
  const explicitInverter = explicitInverterMention(allUserText);
  const arrayIds: string[] = [];
  const componentIds: string[] = [];
  const connectionIds: string[] = [];

  try {
    let createdArrays: Array<{ id: string; name: string }> = [];
    if (plan.pv.totalPanels || panelWatts) {
      const rows = Array.from({ length: plan.pv.arrayCount }, (_, index) => ({
        project_id: projectId,
        name: `PV${index + 1}`,
        panel_watts: panelWatts ?? null,
        panel_count: plan.pv.panelsPerArray ?? null,
        strings: 1,
        panels_per_string: plan.pv.panelsPerArray ?? null,
        specifications: {
          "Wiring arrangement": "series string",
          "Panel Voc": "TBC",
          "Panel Vmp": "TBC",
          "Panel Isc": "TBC",
          "Panel Imp": "TBC",
          "Design status": "Conceptual — verify ratings before installation",
        },
        confidence: "estimated",
      }));
      const inserted = await supabase.from("pv_arrays").insert(rows).select("id,name");
      if (inserted.error) throw inserted.error;
      createdArrays = inserted.data ?? [];
      arrayIds.push(...createdArrays.map((row) => row.id));
    }

    const persistedComponents = plan.components.map((component) => ({
      ...component,
      persistedName: component.type === "inverter" && explicitInverter?.manufacturer ? `${explicitInverter.manufacturer} ${component.displayName}` : component.displayName,
    }));
    let createdComponents: Array<{ id: string; display_name: string }> = [];
    if (persistedComponents.length) {
      const inserted = await supabase.from("system_components").insert(persistedComponents.map((component) => ({
        project_id: projectId,
        type: component.type,
        display_name: component.persistedName,
        quantity: component.quantity,
        specifications: {
          ...component.specifications,
          ...(component.type === "inverter" && explicitInverter?.ratedPowerW ? { "Rated power": `${explicitInverter.ratedPowerW} W` } : {}),
          "Unconfirmed specifications": "TBC",
        },
        notes: "Conceptual schematic item explicitly requested by the user; confirm exact model and ratings before installation.",
        confidence: "estimated",
      }))).select("id,display_name");
      if (inserted.error) throw inserted.error;
      createdComponents = inserted.data ?? [];
      componentIds.push(...createdComponents.map((row) => row.id));
    }

    const nodeRefs = new Map<string, string>();
    createdArrays.forEach((row) => {
      const index = Number(row.name.match(/\d+$/)?.[0] ?? 0);
      if (index) nodeRefs.set(`pv-${index}`, `pv:${row.id}`);
    });
    persistedComponents.forEach((component) => {
      const inserted = createdComponents.find((row) => row.display_name === component.persistedName);
      if (inserted) nodeRefs.set(component.key, `component:${inserted.id}`);
    });
    const connectionRows = plan.connections.flatMap((connection) => {
      const sourceRef = nodeRefs.get(connection.sourceKey);
      const targetRef = nodeRefs.get(connection.targetKey);
      return sourceRef && targetRef ? [{
        project_id: projectId,
        source_ref: sourceRef,
        target_ref: targetRef,
        name: connection.name,
        connection_type: "dc",
        polarity: connection.polarity,
        notes: "Conceptual connection; cable, protection and route details are TBC.",
        confidence: "estimated",
      }] : [];
    });
    if (connectionRows.length) {
      const inserted = await supabase.from("system_connections").insert(connectionRows).select("id");
      if (inserted.error) throw inserted.error;
      connectionIds.push(...(inserted.data ?? []).map((row) => row.id));
    }
    return { arrayIds, componentIds, connectionIds, arrayCount: plan.pv.arrayCount, panelsPerArray: plan.pv.panelsPerArray, panelWatts, componentNames: persistedComponents.map((component) => component.persistedName) };
  } catch (error) {
    if (connectionIds.length) await supabase.from("system_connections").delete().in("id", connectionIds).eq("project_id", projectId);
    if (componentIds.length) await supabase.from("system_components").delete().in("id", componentIds).eq("project_id", projectId);
    if (arrayIds.length) await supabase.from("pv_arrays").delete().in("id", arrayIds).eq("project_id", projectId);
    throw error;
  }
}
