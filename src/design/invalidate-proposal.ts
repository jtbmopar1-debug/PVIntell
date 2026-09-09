import type { SupabaseClient } from "@supabase/supabase-js";

const editableProposalPhases = new Set(["discover", "design", "explain", "build", "check", "commission"]);

/**
 * Discovery is an input to the proposal, so a changed completed discovery must
 * not leave an older calculator or schematic draft looking current. This only
 * removes proposed state. Installed/as-built tables are deliberately untouched.
 */
export async function invalidateProposalAfterDiscovery(
  supabase: SupabaseClient,
  ownerId: string,
  projectIds: string[],
) {
  if (!projectIds.length) return 0;
  const projects = await supabase
    .from("projects")
    .select("id,phase,settings")
    .eq("owner_id", ownerId)
    .in("id", projectIds);
  if (projects.error) throw projects.error;

  const editable = (projects.data ?? []).filter((project) => editableProposalPhases.has(String(project.phase)));
  for (const project of editable) {
    const settings = { ...((project.settings ?? {}) as Record<string, unknown>) };
    delete settings.designCalculator;
    delete settings.designPreferences;
    delete settings.designDiscovery;
    const updated = await supabase
      .from("projects")
      .update({ settings, phase: "design" })
      .eq("id", project.id)
      .eq("owner_id", ownerId);
    if (updated.error) throw updated.error;

    const clearedProposals = await supabase
      .from("system_components")
      .delete()
      .eq("project_id", project.id)
      .eq("confidence", "estimated")
      .like("notes", "Proposed by Wattson%");
    if (clearedProposals.error) throw clearedProposals.error;
  }
  return editable.length;
}
