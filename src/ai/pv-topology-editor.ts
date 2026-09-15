import type { SupabaseClient } from "@supabase/supabase-js";

export type PvTopologyRequest = { arrayCount: number; panelsPerArray: number };

type LegacyComponent = {
  type?: string | null;
  display_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  specifications?: Record<string, unknown> | null;
};

function positiveNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Extracts a representative module rating without inventing one for legacy schematics. */
export function legacyPanelWatts(component: LegacyComponent | undefined) {
  if (!component) return undefined;
  const specs = component.specifications ?? {};
  for (const [key, value] of Object.entries(specs)) {
    if (/watts?\s*(?:each|per\s*panel)?|panel\s*(?:watts?|power)|rated\s*(?:power|output)|module\s*(?:watts?|power)/i.test(key)) {
      const watts = positiveNumber(value);
      if (watts) return watts;
    }
  }
  const identity = [component.display_name, component.model, ...Object.values(specs).filter((value) => typeof value === "string")].join(" ");
  const labelled = identity.match(/(\d+(?:\.\d+)?)\s*(?:w|watt)s?\b/i);
  return labelled ? positiveNumber(labelled[1]) : undefined;
}

type DraftNode = { id: string; label: string; detail: string; image?: string; x?: number; y?: number; [key: string]: unknown };
type DraftConnection = { from: string; to: string; label: string; kind: string; [key: string]: unknown };

/** Rebuilds only the PV branch of a reviewed proposal and preserves every other branch. */
export function reconfiguredProposedDesign(settings: Record<string, unknown>, request: PvTopologyRequest) {
  const existing = settings.designCalculator;
  if (!existing || typeof existing !== "object") return null;
  const calculator = { ...(existing as Record<string, unknown>) };
  const draftValue = calculator.proposedAsBuiltDraft;
  if (!draftValue || typeof draftValue !== "object") return null;
  const draft = draftValue as Record<string, unknown>;
  const oldNodes = Array.isArray(draft.nodes) ? draft.nodes as DraftNode[] : [];
  const oldConnections = Array.isArray(draft.connections) ? draft.connections as DraftConnection[] : [];
  const pvNode = (id: string) => id === "solar" || id.startsWith("solar-pv-") || id.startsWith("solar-safety") || id === "pv-combiner";
  const oldPvIds = new Set(oldNodes.filter((node) => pvNode(node.id)).map((node) => node.id));
  const oldPvConnection = oldConnections.find((connection) => oldPvIds.has(connection.from) && !oldPvIds.has(connection.to));
  const target = oldPvConnection?.to
    ?? oldNodes.find((node) => ["controller", "inverter", "pv-inverter", "battery-inverter"].includes(node.id))?.id;
  if (!target) return null;

  const originalSolarText = oldNodes
    .filter((node) => node.id === "solar" || node.id.startsWith("solar-pv-"))
    .map((node) => `${node.label} ${node.detail}`)
    .join(" ");
  const recordedModuleWatts = originalSolarText.match(/(\d+(?:\.\d+)?)\s*(?:w|watt)s?\b/i)?.[1];
  const recordedPanelCount = positiveNumber(calculator.panelCount) ?? positiveNumber((draft as { panelCount?: unknown }).panelCount);
  const recordedArrayKw = positiveNumber(calculator.targetPvKw);
  const panelWatts = positiveNumber(calculator.panelWatts)
    ?? positiveNumber((draft as { panelWatts?: unknown }).panelWatts)
    ?? positiveNumber(recordedModuleWatts)
    ?? (recordedArrayKw && recordedPanelCount ? Number((recordedArrayKw * 1000 / recordedPanelCount).toFixed(3)) : undefined);
  const arrays = Array.from({ length: request.arrayCount }, (_, index) => ({
    id: `solar-pv-${index + 1}`,
    label: `PV${index + 1} · ${request.panelsPerArray} panels`,
    detail: `${request.panelsPerArray} × ${panelWatts ?? "?"} W; one independent PV string; final MPPT allocation to verify`,
    image: "/schematic-components/solar-panel-pv-module.jpg",
    x: 35,
    y: 20 + index * 125,
  }));
  const isolators = arrays.map((array, index) => ({
    id: `solar-safety-${index + 1}`,
    label: `PV${index + 1} isolator`,
    detail: `Provisional DC isolation for PV${index + 1}; type and ratings to verify`,
    image: "/schematic-components/dc-disconnect-isolator.jpg",
    x: 250,
    y: array.y,
  }));
  const combiner = request.arrayCount > 1 ? {
    id: "pv-combiner",
    label: "PV combiner box",
    detail: "Provisional combiner; verify string inputs, voltage, current, isolation and protection",
    image: "/schematic-components/dc-combiner-box.jpg",
    x: 430,
    y: 20 + Math.max(0, request.arrayCount - 1) * 62.5,
  } : undefined;
  const endpoint = combiner?.id ?? target;
  const pvConnections: DraftConnection[] = arrays.flatMap((array, index) => [
    { from: array.id, to: isolators[index].id, label: `PV${index + 1} string`, kind: "solar-dc" },
    { from: isolators[index].id, to: endpoint, label: `PV${index + 1} isolated DC`, kind: "solar-dc" },
  ]);
  if (combiner) pvConnections.push({ from: combiner.id, to: target, label: "Combined PV DC; ratings to verify", kind: "solar-dc" });

  const panelCount = request.arrayCount * request.panelsPerArray;
  calculator.panelCount = panelCount;
  if (panelWatts) calculator.panelWatts = panelWatts;
  calculator.pvStrings = request.arrayCount;
  calculator.panelsPerString = request.panelsPerArray;
  // A complete stringDesign contains calculated electrical values. The user's
  // grouping alone must not be stored in that typed field.
  delete calculator.stringDesign;
  // The former surface allocation describes the topology being replaced. If
  // retained, the proposal renderer can continuously alternate between it and
  // this explicit string layout.
  delete calculator.pvArrayPlan;
  if (calculator.existingPanelGroup && typeof calculator.existingPanelGroup === "object") {
    const group: Record<string, unknown> = { ...(calculator.existingPanelGroup as Record<string, unknown>), proposedUseCount: panelCount };
    delete group.supplementaryCount;
    delete group.supplementaryTargetPvKw;
    delete group.supplementaryWattsEach;
    delete group.supplementaryPanelType;
    delete group.supplementaryLengthMm;
    delete group.supplementaryWidthMm;
    calculator.existingPanelGroup = group;
  }
  if (panelWatts) calculator.targetPvKw = Number((panelCount * panelWatts / 1000).toFixed(3));
  calculator.updatedBy = "user";
  calculator.updatedAt = new Date().toISOString();
  if (calculator.proposedChecklist && typeof calculator.proposedChecklist === "object") {
    calculator.proposedChecklist = { ...(calculator.proposedChecklist as Record<string, unknown>), "proposed-schematic": false };
  }
  calculator.proposedAsBuiltDraft = {
    ...draft,
    panelCount,
    panelWatts: panelWatts ?? draft.panelWatts,
    pvStrings: request.arrayCount,
    panelsPerString: request.panelsPerArray,
    nodes: [...oldNodes.filter((node) => !oldPvIds.has(node.id)), ...arrays, ...isolators, ...(combiner ? [combiner] : [])],
    connections: [...oldConnections.filter((connection) => !oldPvIds.has(connection.from) && !oldPvIds.has(connection.to)), ...pvConnections],
  };
  return { ...settings, designCalculator: calculator };
}

export function requestedPvTopology(message: string): PvTopologyRequest | null {
  const match = message.match(/\b(?:change|charge|set|make|split|reconfigure)?\s*(?:them|it|the\s+(?:pv\s*)?arrays?)?\s*(?:to|as|into)?\s*(\d+)\s+(?:pv\s*)?arrays?\s+(?:of|with)\s+(\d+)(?:\s+panels?)?\b/i);
  if (!match) return null;
  const arrayCount = Number(match[1]);
  const panelsPerArray = Number(match[2]);
  return Number.isInteger(arrayCount) && Number.isInteger(panelsPerArray) && arrayCount > 0 && arrayCount <= 24 && panelsPerArray > 0 && panelsPerArray <= 100
    ? { arrayCount, panelsPerArray }
    : null;
}

export async function reconfigurePvTopology(supabase: SupabaseClient, projectId: string, request: PvTopologyRequest) {
  const [arraysResult, componentsResult, connectionsResult, projectResult] = await Promise.all([
    supabase.from("pv_arrays").select("*").eq("project_id", projectId).order("name"),
    supabase.from("system_components").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("system_connections").select("*").eq("project_id", projectId),
    supabase.from("projects").select("settings").eq("id", projectId).single(),
  ]);
  if (arraysResult.error) throw arraysResult.error;
  if (componentsResult.error) throw componentsResult.error;
  if (connectionsResult.error) throw connectionsResult.error;
  if (projectResult.error) throw projectResult.error;
  const originalArrays = arraysResult.data ?? [];
  const components = componentsResult.data ?? [];
  const originalConnections = connectionsResult.data ?? [];
  const legacyPanels = components.filter((component) => component.type === "panel" || component.type === "pv_string");
  if (!originalArrays.length && !legacyPanels.length) {
    const nextSettings = reconfiguredProposedDesign((projectResult.data.settings ?? {}) as Record<string, unknown>, request);
    if (!nextSettings) throw new Error("No editable PV branch is available in either the installed or proposed schematic.");
    const changed = await supabase.from("projects").update({ settings: nextSettings, updated_at: new Date().toISOString() }).eq("id", projectId);
    if (changed.error) throw changed.error;
    return { summary: `Changed the proposed PV layout to ${request.arrayCount} arrays of ${request.panelsPerArray} panels and added the required provisional isolation${request.arrayCount > 1 ? " and combiner" : ""}. Final MPPT, voltage, current and protection ratings remain to be verified.` };
  }
  const destination = components.find((component) => component.type === "inverter") ?? components.find((component) => component.type === "charger");
  if (!destination) throw new Error("No existing inverter or charge controller is available for the PV connection.");
  const originalPvRefs = new Set([
    ...originalArrays.map((array) => `pv:${array.id}`),
    ...legacyPanels.map((component) => `component:${component.id}`),
  ]);
  const pvConnectedRefs = new Set(originalConnections.flatMap((connection) => originalPvRefs.has(connection.source_ref) || originalPvRefs.has(connection.target_ref) ? [connection.source_ref, connection.target_ref] : []));
  const isolators = components.filter((component) => component.type === "isolator" && (pvConnectedRefs.has(`component:${component.id}`) || /\bpv\b|solar|array/i.test(component.display_name ?? "")));
  let combiner = components.find((component) => component.type === "combiner");
  let addedCombinerId: string | undefined;

  try {
    const legacyTemplate = legacyPanels[0];
    const template = originalArrays[0] ?? {
      project_id: projectId,
      manufacturer: legacyTemplate?.manufacturer ?? null,
      panel_model: legacyTemplate?.model ?? null,
      panel_watts: legacyPanelWatts(legacyTemplate) ?? null,
      specifications: {
        ...(legacyTemplate?.specifications ?? {}),
        "Record origin": "Converted from the schematic's legacy PV component by Wattson",
        "Design status": "Provisional — verify module and MPPT ratings",
      },
      confidence: "estimated",
    };
    const retained = originalArrays.slice(0, request.arrayCount);
    for (let index = 0; index < retained.length; index += 1) {
      const updated = await supabase.from("pv_arrays").update({ name: `PV${index + 1}`, panel_count: request.panelsPerArray, strings: 1, panels_per_string: request.panelsPerArray, confidence: "estimated" }).eq("id", retained[index].id).eq("project_id", projectId);
      if (updated.error) throw updated.error;
    }
    if (retained.length < request.arrayCount) {
      const rows = Array.from({ length: request.arrayCount - retained.length }, (_, offset) => ({
        ...template,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
        project_id: projectId,
        name: `PV${retained.length + offset + 1}`,
        panel_count: request.panelsPerArray,
        strings: 1,
        panels_per_string: request.panelsPerArray,
        confidence: "estimated",
      }));
      const inserted = await supabase.from("pv_arrays").insert(rows);
      if (inserted.error) throw inserted.error;
    }
    const removed = originalArrays.slice(request.arrayCount);
    if (removed.length) {
      const deleted = await supabase.from("pv_arrays").delete().in("id", removed.map((array) => array.id)).eq("project_id", projectId);
      if (deleted.error) throw deleted.error;
    }

    if (request.arrayCount > 1 && !combiner) {
      const inserted = await supabase.from("system_components").insert({ project_id: projectId, type: "combiner", display_name: "PV combiner box", quantity: 1, specifications: { "Design status": "Provisional — verify string inputs, voltage, current and protection" }, notes: "Added to complete the user-requested multi-string PV topology; final ratings remain to be verified.", confidence: "estimated" }).select("*").single();
      if (inserted.error) throw inserted.error;
      combiner = inserted.data;
      addedCombinerId = inserted.data.id;
    }

    const currentArrays = await supabase.from("pv_arrays").select("id,name").eq("project_id", projectId).order("name");
    if (currentArrays.error) throw currentArrays.error;
    const topologyRefs = new Set([
      ...originalArrays.map((array) => `pv:${array.id}`),
      ...legacyPanels.map((component) => `component:${component.id}`),
      ...isolators.map((component) => `component:${component.id}`),
      ...(combiner ? [`component:${combiner.id}`] : []),
    ]);
    const affected = originalConnections.filter((connection) => topologyRefs.has(connection.source_ref) || topologyRefs.has(connection.target_ref));
    if (affected.length) {
      const deleted = await supabase.from("system_connections").delete().in("id", affected.map((connection) => connection.id)).eq("project_id", projectId);
      if (deleted.error) throw deleted.error;
    }
    const destinationRef = `component:${destination.id}`;
    const combinerRef = combiner ? `component:${combiner.id}` : destinationRef;
    const connectionRows = (currentArrays.data ?? []).flatMap((array, index) => {
      const arrayRef = `pv:${array.id}`;
      const isolator = isolators[index];
      return isolator
        ? [
            { project_id: projectId, source_ref: arrayRef, target_ref: `component:${isolator.id}`, name: `${array.name} DC`, connection_type: "dc", polarity: "pair", notes: "Reconfigured by Wattson; cable and protection ratings remain TBC.", confidence: "estimated" },
            { project_id: projectId, source_ref: `component:${isolator.id}`, target_ref: combinerRef, name: `${array.name} isolated DC`, connection_type: "dc", polarity: "pair", notes: "Reconfigured by Wattson; verify final ratings.", confidence: "estimated" },
          ]
        : [{ project_id: projectId, source_ref: arrayRef, target_ref: combinerRef, name: `${array.name} DC`, connection_type: "dc", polarity: "pair", notes: "Reconfigured by Wattson; verify isolation and protection requirements.", confidence: "estimated" }];
    });
    if (combiner && combinerRef !== destinationRef) connectionRows.push({ project_id: projectId, source_ref: combinerRef, target_ref: destinationRef, name: "Combined PV DC", connection_type: "dc", polarity: "pair", notes: "Provisional connection; verify inverter/controller input and combiner ratings.", confidence: "estimated" });
    const connected = await supabase.from("system_connections").insert(connectionRows);
    if (connected.error) throw connected.error;
    await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
    return { summary: `Changed the PV layout to ${request.arrayCount} arrays of ${request.panelsPerArray} panels and ${combiner ? "connected them through a provisional combiner" : "connected the array to the existing inverter/controller"}. Final MPPT, voltage, current and protection ratings remain to be verified.` };
  } catch (error) {
    await supabase.from("system_connections").delete().eq("project_id", projectId);
    if (originalConnections.length) await supabase.from("system_connections").insert(originalConnections);
    await supabase.from("pv_arrays").delete().eq("project_id", projectId);
    if (originalArrays.length) await supabase.from("pv_arrays").insert(originalArrays);
    if (addedCombinerId) await supabase.from("system_components").delete().eq("id", addedCombinerId).eq("project_id", projectId);
    throw error;
  }
}
