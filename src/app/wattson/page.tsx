import { redirect } from "next/navigation";
import { WattsonPage } from "@/components/wattson-page";
import type { ChatMessage, Site, SystemSummary } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

export default async function WattsonPageRoute({ searchParams }: { searchParams: Promise<{ site?: string; conversation?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const [siteRows, systemRows] = await Promise.all([
    supabase.from("sites").select("id,name,location,latitude,longitude,timezone,location_source,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,mode,phase").eq("owner_id", userId).order("created_at"),
  ]);
  if (siteRows.error) throw siteRows.error;
  if (systemRows.error) throw systemRows.error;
  const sites: Site[] = (siteRows.data ?? []).map((site) => ({ id: site.id, name: site.name, location: site.location || "Location not set", latitude: site.latitude == null ? undefined : Number(site.latitude), longitude: site.longitude == null ? undefined : Number(site.longitude), timezone: site.timezone || "UTC", locationSource: site.location_source || "manual", locationConfirmed: Boolean(site.location_confirmed) }));
  const systems: SystemSummary[] = (systemRows.data ?? []).map((system) => ({ id: system.id, siteId: system.site_id, name: system.name, projectType: String(system.mode).replace("_", "-") as SystemSummary["projectType"], phase: system.phase as SystemSummary["phase"] }));
  const selectedSite = sites.find((site) => site.id === query.site) ?? sites[0];
  const conversation = query.conversation
    ? await supabase.from("user_conversations").select("id").eq("id", query.conversation).eq("owner_id", userId).maybeSingle()
    : selectedSite ? await supabase.from("user_conversations").select("id").eq("owner_id", userId).eq("site_id", selectedSite.id).order("updated_at", { ascending: false }).limit(1).maybeSingle() : { data: null, error: null };
  if (conversation.error) throw conversation.error;
  let messages: ChatMessage[] = [];
  if (conversation.data?.id) {
    const rows = await supabase.from("user_chat_messages").select("id,role,content,created_at,structured_context").eq("conversation_id", conversation.data.id).order("created_at").limit(60);
    if (rows.error) throw rows.error;
    messages = (rows.data ?? []).map((message) => ({ id: message.id, role: message.role as ChatMessage["role"], content: message.content, createdAt: message.created_at, citations: Array.isArray(message.structured_context?.citations) ? message.structured_context.citations : undefined, actionUrl: typeof message.structured_context?.actionUrl === "string" ? message.structured_context.actionUrl : undefined, actionLabel: typeof message.structured_context?.actionLabel === "string" ? message.structured_context.actionLabel : undefined }));
  }
  return <WattsonPage sites={sites} systems={systems} initialSiteId={selectedSite?.id} initialConversationId={conversation.data?.id} initialMessages={messages}/>;
}
