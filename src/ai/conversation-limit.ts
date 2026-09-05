import type { SupabaseClient } from "@supabase/supabase-js";

export const WATTSON_CONVERSATION_LIMIT = 25;

export async function userConversationCount(supabase: SupabaseClient, userId: string) {
  const [dashboard, projects] = await Promise.all([
    supabase.from("user_conversations").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase.from("projects").select("id").eq("owner_id", userId),
  ]);
  if (dashboard.error) throw dashboard.error; if (projects.error) throw projects.error;
  const projectIds = (projects.data ?? []).map((project) => project.id);
  const system = projectIds.length ? await supabase.from("conversations").select("id", { count: "exact", head: true }).in("project_id", projectIds) : { count: 0, error: null };
  if (system.error) throw system.error;
  return (dashboard.count ?? 0) + (system.count ?? 0);
}

export function conversationTitle(message: string) {
  const clean = message.replace(/\s+/g, " ").replace(/\[Attached image:[^\]]+\]/gi, "").trim();
  return clean.length > 64 ? `${clean.slice(0, 61).trimEnd()}…` : clean || "Wattson chat";
}
