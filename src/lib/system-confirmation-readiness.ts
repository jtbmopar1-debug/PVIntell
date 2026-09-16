import type { SupabaseClient } from "@supabase/supabase-js";
import { hasUnresolvedSuitabilityIssue } from "@/lib/suitability-status";

export async function systemConfirmationReadiness(supabase: SupabaseClient, projectId: string) {
  const [components, arrays, connections] = await Promise.all([
    supabase.from("system_components").select("id,display_name,confidence,notes,specifications").eq("project_id", projectId),
    supabase.from("pv_arrays").select("id,name,confidence,installation_notes,specifications").eq("project_id", projectId),
    supabase.from("system_connections").select("id,name,confidence,notes").eq("project_id", projectId),
  ]);
  const error = components.error ?? arrays.error ?? connections.error;
  if (error) throw error;
  const componentBlockers = (components.data ?? []).filter((item) => item.confidence !== "confirmed" || hasUnresolvedSuitabilityIssue(item.notes, item.specifications)).map((item) => item.display_name);
  const arrayBlockers = (arrays.data ?? []).filter((item) => item.confidence !== "confirmed" || hasUnresolvedSuitabilityIssue(item.installation_notes, item.specifications)).map((item) => item.name);
  const connectionBlockers = (connections.data ?? []).filter((item) => item.confidence !== "confirmed" || hasUnresolvedSuitabilityIssue(item.notes)).map((item) => item.name);
  const blockers = [...componentBlockers, ...arrayBlockers, ...connectionBlockers];
  return {
    ready: blockers.length === 0,
    blockers,
    counts: { components: componentBlockers.length, pvArrays: arrayBlockers.length, connections: connectionBlockers.length },
    message: blockers.length ? `Confirm every schematic record before commissioning. Still blocking: ${blockers.slice(0, 8).join(", ")}${blockers.length > 8 ? ` and ${blockers.length - 8} more` : ""}.` : undefined,
  };
}
