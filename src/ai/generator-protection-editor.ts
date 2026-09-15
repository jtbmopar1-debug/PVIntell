import type { SupabaseClient } from "@supabase/supabase-js";

export function requestedGeneratorMcb(message: string) {
  if (!/\b(?:add|install|insert|connect|fit|wire|record)\b/i.test(message)) return null;
  if (!/\bgenerator\b/i.test(message) || !/\b(?:inverter|generator input)\b/i.test(message)) return null;
  const rating = message.match(/\b(\d+(?:\.\d+)?)\s*A\b/i)?.[1];
  if (!rating || !/\bMCB\b|\bbreaker\b|miniature circuit breaker/i.test(message)) return null;
  return { ratingA: Number(rating), wifi: /\bwi[- ]?fi\b/i.test(message) };
}

type ComponentRow = { id: string; type: string; display_name: string };
type ConnectionRow = { id: string; source_ref: string; target_ref: string; name: string; cable_size: string | null; cable_length: string | null; route: string | null; notes: string | null };

export async function insertGeneratorMcb(supabase: SupabaseClient, projectId: string, ratingA: number, wifi: boolean) {
  const [componentsResult, connectionsResult] = await Promise.all([
    supabase.from("system_components").select("id,type,display_name").eq("project_id", projectId),
    supabase.from("system_connections").select("id,source_ref,target_ref,name,cable_size,cable_length,route,notes").eq("project_id", projectId),
  ]);
  if (componentsResult.error) throw componentsResult.error;
  if (connectionsResult.error) throw connectionsResult.error;

  const components = (componentsResult.data ?? []) as ComponentRow[];
  const generator = components.find((item) => item.type === "generator" || /generator/i.test(item.display_name));
  const inverter = components.find((item) => item.type === "inverter" || /inverter/i.test(item.display_name));
  if (!generator || !inverter) throw new Error("The schematic needs both a recorded generator and inverter before generator-input protection can be inserted.");

  const generatorRef = `component:${generator.id}`;
  const inverterRef = `component:${inverter.id}`;
  const direct = ((connectionsResult.data ?? []) as ConnectionRow[]).find((item) =>
    (item.source_ref === generatorRef && item.target_ref === inverterRef) ||
    (item.source_ref === inverterRef && item.target_ref === generatorRef));
  const existingMcb = components.find((item) => item.type === "protection" && /generator.*(?:MCB|breaker)|(?:MCB|breaker).*generator/i.test(item.display_name));
  if (existingMcb) throw new Error("A generator-input protection record already exists. Open its technical card to confirm or change its rating.");

  let componentId: string | undefined;
  const connectionIds: string[] = [];
  try {
    const label = `${ratingA} A generator${wifi ? " Wi-Fi" : ""} MCB`;
    const insertedComponent = await supabase.from("system_components").insert({
      project_id: projectId,
      type: "protection",
      display_name: label,
      quantity: 1,
      specifications: {
        "Schematic image": "/schematic-components/ac-circuit-breaker-mcb.jpg",
        "AC / DC type": "AC",
        "Rated current": `${ratingA} A`,
        "Circuit / equipment protected": "Generator AC input to inverter",
        "Device type": wifi ? "Wi-Fi miniature circuit breaker" : "Miniature circuit breaker",
        "Rated operational voltage": "TBC",
        "Number of poles": "TBC",
        "Breaking / interrupt capacity": "TBC",
        "Standard / certification": "TBC",
      },
      notes: "User-requested generator-input protection. Verify voltage, poles, breaking capacity, generator neutral/earth arrangement, inverter generator-input requirements and local rules before installation.",
      confidence: "estimated",
    }).select("id").single();
    if (insertedComponent.error) throw insertedComponent.error;
    componentId = insertedComponent.data.id;
    const mcbRef = `component:${componentId}`;
    const inherited = direct ? { cable_size: direct.cable_size, cable_length: direct.cable_length, route: direct.route } : {};
    const insertedConnections = await supabase.from("system_connections").insert([
      { project_id: projectId, source_ref: generatorRef, target_ref: mcbRef, name: "Generator AC feed to input MCB", connection_type: "ac", polarity: "na", breaker_size: `${ratingA} A`, ...inherited, notes: "Generator AC supply conductors to the dedicated input MCB; verify all ratings and conductor details.", confidence: "estimated" },
      { project_id: projectId, source_ref: mcbRef, target_ref: inverterRef, name: "Protected generator AC input", connection_type: "ac", polarity: "na", breaker_size: `${ratingA} A`, ...inherited, notes: "Protected generator AC input to the inverter; verify input compatibility, transfer controls, neutral/earth arrangement and backfeed prevention.", confidence: "estimated" },
    ]).select("id");
    if (insertedConnections.error) throw insertedConnections.error;
    connectionIds.push(...(insertedConnections.data ?? []).map((row) => row.id));
    if (direct) {
      const removed = await supabase.from("system_connections").delete().eq("id", direct.id).eq("project_id", projectId);
      if (removed.error) throw removed.error;
    }
    return { summary: `Inserted a ${ratingA} A${wifi ? " Wi-Fi" : ""} MCB between the generator and inverter. Voltage, poles, breaking capacity and the generator neutral/earth arrangement remain to be verified.`, componentId, connectionIds };
  } catch (error) {
    if (connectionIds.length) await supabase.from("system_connections").delete().in("id", connectionIds).eq("project_id", projectId);
    if (componentId) await supabase.from("system_components").delete().eq("id", componentId).eq("project_id", projectId);
    throw error;
  }
}
