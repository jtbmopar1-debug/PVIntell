import type { SupabaseClient } from "@supabase/supabase-js";

export function requestsWholeSystemEarthing(message: string) {
  return /\b(?:add|install|create|connect|wire|record)\b/i.test(message)
    && /\b(?:earth|earthing|ground|grounding)\b/i.test(message)
    && /\b(?:whole|entire|all|system|wiring|connections?|pegs?|electrodes?|bonding)\b/i.test(message);
}

type ExistingComponent = { id: string; type: string; display_name: string; specifications?: Record<string, unknown> | null };
type ExistingArray = { id: string; name: string };
type ExistingConnection = { source_ref: string; target_ref: string; name: string };

export function wholeSystemEarthingPlan(components: ExistingComponent[], arrays: ExistingArray[], includeElectrode: boolean) {
  const identity = (component: ExistingComponent) => `${component.type} ${component.display_name}`.toLowerCase();
  const earthBar = components.find((component) => /protective[- ]earth.*(?:bar|busbar)|earth.*busbar|ground.*bar/.test(identity(component)));
  const electrode = components.find((component) => /earth electrode|earth peg|ground rod|ground electrode/.test(identity(component)));
  const componentTargets = components.filter((component) => {
    const value = identity(component);
    if (component.id === earthBar?.id || component.id === electrode?.id) return false;
    return component.type === "inverter"
      || component.type === "generator"
      || component.type === "combiner"
      || component.type === "switchboard"
      || component.type === "battery"
      || /switchboard|distribution board|fusebox|fuse box/.test(value);
  });
  return { earthBar, electrode, componentTargets, arrays, includeElectrode };
}

export async function addWholeSystemEarthing(supabase: SupabaseClient, projectId: string, message: string) {
  const [componentsResult, arraysResult, connectionsResult] = await Promise.all([
    supabase.from("system_components").select("id,type,display_name,specifications").eq("project_id", projectId),
    supabase.from("pv_arrays").select("id,name").eq("project_id", projectId),
    supabase.from("system_connections").select("source_ref,target_ref,name").eq("project_id", projectId),
  ]);
  if (componentsResult.error) throw componentsResult.error;
  if (arraysResult.error) throw arraysResult.error;
  if (connectionsResult.error) throw connectionsResult.error;
  const includeElectrode = /\b(?:pegs?|electrodes?|ground rods?)\b/i.test(message);
  const plan = wholeSystemEarthingPlan((componentsResult.data ?? []) as ExistingComponent[], (arraysResult.data ?? []) as ExistingArray[], includeElectrode);
  const insertedComponentIds: string[] = [];
  const insertedConnectionIds: string[] = [];
  try {
    let earthBar = plan.earthBar;
    if (!earthBar) {
      const inserted = await supabase.from("system_components").insert({
        project_id: projectId,
        type: "connector",
        display_name: "Main protective-earth busbar",
        quantity: 1,
        specifications: { "Schematic image": "/schematic-components/earthing-ground-bar.jpg", Function: "Common protective-earthing and bonding point", "Conductor size": "TBC", "Design status": "Provisional — verify the Site earthing arrangement and local requirements" },
        notes: "Added by Wattson for whole-system earthing review. This does not establish the supply earthing system, neutral-earth bond location or conductor sizes.",
        confidence: "estimated",
      }).select("id,type,display_name,specifications").single();
      if (inserted.error) throw inserted.error;
      earthBar = inserted.data as ExistingComponent;
      insertedComponentIds.push(earthBar.id);
    }
    let electrode = plan.electrode;
    if (includeElectrode && !electrode) {
      const inserted = await supabase.from("system_components").insert({
        project_id: projectId,
        type: "other",
        display_name: "Site earth electrode system",
        quantity: 1,
        specifications: { "Schematic image": "/schematic-components/earth-electrode.png", "Electrode type / quantity": "TBC", "Conductor size": "TBC", "Design status": "Provisional — confirm whether a new electrode is permitted and how it integrates with the Site supply earthing arrangement" },
        notes: "The user requested earth peg(s). Electrode count, spacing, conductor, test method and connection point require the confirmed Site jurisdiction and earthing design.",
        confidence: "estimated",
      }).select("id,type,display_name,specifications").single();
      if (inserted.error) throw inserted.error;
      electrode = inserted.data as ExistingComponent;
      insertedComponentIds.push(electrode.id);
    }
    const earthBarRef = `component:${earthBar.id}`;
    const desired: Array<Record<string, unknown>> = [];
    const add = (sourceRef: string, targetRef: string, name: string, notes: string) => desired.push({ project_id: projectId, source_ref: sourceRef, target_ref: targetRef, name, connection_type: "earth", polarity: "na", cable_size: "TBC", notes, confidence: "estimated" });
    if (electrode) add(`component:${electrode.id}`, earthBarRef, "Earth electrode conductor", "Provisional electrode conductor; confirm the complete Site earthing arrangement, size, protection, termination and test requirements.");
    for (const component of plan.componentTargets) {
      const value = `${component.type} ${component.display_name}`.toLowerCase();
      const label = component.type === "battery" ? `${component.display_name} enclosure bonding` : component.type === "generator" ? `${component.display_name} protective earth` : component.type === "combiner" || /fusebox|fuse box/.test(value) ? `${component.display_name} enclosure earth` : `${component.display_name} protective earth`;
      add(earthBarRef, `component:${component.id}`, label, component.type === "battery" ? "Bond the battery/rack enclosure only where required by the equipment instructions and earthing design; never bond a live battery terminal." : "Provisional protective-earth/bonding conductor; size, route and terminals remain to be verified.");
    }
    for (const array of plan.arrays) add(`pv:${array.id}`, earthBarRef, `${array.name} module-frame bonding`, "Provisional PV module-frame and mounting-system bonding path; verify listed hardware, conductor size, routing and local requirements.");
    const existing = new Set(((connectionsResult.data ?? []) as ExistingConnection[]).map((connection) => `${connection.source_ref}|${connection.target_ref}|${connection.name}`));
    const rows = desired.filter((row) => !existing.has(`${row.source_ref}|${row.target_ref}|${row.name}`));
    if (rows.length) {
      const inserted = await supabase.from("system_connections").insert(rows).select("id");
      if (inserted.error) throw inserted.error;
      insertedConnectionIds.push(...(inserted.data ?? []).map((row) => row.id));
    }
    return { summary: `Added the whole-system earthing review with ${rows.length} earth/bonding connections${includeElectrode ? " and a provisional Site earth-electrode record" : ""}. Conductor sizes and the Site earthing arrangement remain to be verified.`, componentIds: insertedComponentIds, connectionIds: insertedConnectionIds };
  } catch (error) {
    if (insertedConnectionIds.length) await supabase.from("system_connections").delete().in("id", insertedConnectionIds).eq("project_id", projectId);
    if (insertedComponentIds.length) await supabase.from("system_components").delete().in("id", insertedComponentIds).eq("project_id", projectId);
    throw error;
  }
}
