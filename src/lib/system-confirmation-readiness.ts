import type { SupabaseClient } from "@supabase/supabase-js";
import { proposalInstallationReadiness } from "@/design/proposal-installation-readiness";
import { hasUnresolvedSuitabilityIssue } from "@/lib/suitability-status";

export async function systemConfirmationReadiness(supabase: SupabaseClient, projectId: string, options: { ignoreConfidence?: boolean; proposalSettings?: Record<string, unknown> } = {}) {
  const [components, arrays, connections] = await Promise.all([
    supabase.from("system_components").select("id,display_name,confidence,notes,specifications").eq("project_id", projectId),
    supabase.from("pv_arrays").select("id,name,confidence,installation_notes,specifications").eq("project_id", projectId),
    supabase.from("system_connections").select("id,name,confidence,notes,source_ref,target_ref,connection_type").eq("project_id", projectId),
  ]);
  const error = components.error ?? arrays.error ?? connections.error;
  if (error) throw error;
  const confidenceBlocks = (confidence: string) => !options.ignoreConfidence && confidence !== "confirmed";
  const componentBlockers = (components.data ?? []).filter((item) => confidenceBlocks(item.confidence) || hasUnresolvedSuitabilityIssue(item.notes, item.specifications)).map((item) => item.display_name);
  const arrayBlockers = (arrays.data ?? []).filter((item) => confidenceBlocks(item.confidence) || hasUnresolvedSuitabilityIssue(item.installation_notes, item.specifications)).map((item) => item.name);
  const connectionBlockers = (connections.data ?? []).filter((item) => confidenceBlocks(item.confidence) || hasUnresolvedSuitabilityIssue(item.notes)).map((item) => item.name);
  const proposal = options.proposalSettings ? proposalInstallationReadiness(options.proposalSettings, {
    componentIds: (components.data ?? []).map((item) => item.id),
    pvArrayIds: (arrays.data ?? []).map((item) => item.id),
    connections: (connections.data ?? []).map((item) => ({ sourceRef: item.source_ref, targetRef: item.target_ref, connectionType: item.connection_type })),
  }) : { ready: true, blockers: [] };
  const blockers = [...componentBlockers, ...arrayBlockers, ...connectionBlockers, ...proposal.blockers];
  return {
    ready: blockers.length === 0,
    blockers,
    counts: { components: componentBlockers.length, pvArrays: arrayBlockers.length, connections: connectionBlockers.length },
    message: blockers.length ? `Complete and save every schematic record before finishing handover. Still blocking: ${blockers.slice(0, 8).join(", ")}${blockers.length > 8 ? ` and ${blockers.length - 8} more` : ""}.` : undefined,
  };
}
