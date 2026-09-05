import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WattsonChatHistory, type WattsonChatSummary } from "@/components/wattson-chat-history";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";
import { WATTSON_CONVERSATION_LIMIT } from "@/ai/conversation-limit";


export default async function WattsonChatsPage() {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const [dashboardRows, projects, sites] = await Promise.all([
    supabase.from("user_conversations").select("id,title,site_id,project_id,created_at,updated_at").eq("owner_id", userId).order("updated_at", { ascending: false }),
    supabase.from("projects").select("id,site_id,name").eq("owner_id", userId),
    supabase.from("sites").select("id,name").eq("owner_id", userId),
  ]);
  const projectIds = (projects.data ?? []).map((project) => project.id);
  if (dashboardRows.error) throw dashboardRows.error; if (projects.error) throw projects.error; if (sites.error) throw sites.error;
  const systemRows = projectIds.length ? await supabase.from("conversations").select("id,title,project_id,created_at,updated_at").in("project_id", projectIds).order("updated_at", { ascending: false }) : { data: [], error: null };
  if (systemRows.error) throw systemRows.error;
  const dashboardIds = (dashboardRows.data ?? []).map((row) => row.id); const systemIds = (systemRows.data ?? []).map((row) => row.id);
  const [dashboardMessages, systemMessages] = await Promise.all([
    dashboardIds.length ? supabase.from("user_chat_messages").select("conversation_id,role,content,created_at").in("conversation_id", dashboardIds).order("created_at") : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("chat_messages").select("conversation_id,role,content,created_at").in("conversation_id", systemIds).order("created_at") : Promise.resolve({ data: [], error: null }),
  ]);
  if (dashboardMessages.error) throw dashboardMessages.error; if (systemMessages.error) throw systemMessages.error;
  const summaries: WattsonChatSummary[] = [
    ...(dashboardRows.data ?? []).map((row) => { const messages = (dashboardMessages.data ?? []).filter((message) => message.conversation_id === row.id); const site = (sites.data ?? []).find((item) => item.id === row.site_id); return { id: row.id, kind: "dashboard" as const, title: row.title || messages[0]?.content?.slice(0, 64) || "Wattson chat", context: site?.name || "General dashboard", updatedAt: row.updated_at || row.created_at, messageCount: messages.length, preview: messages.at(-1)?.content || "", messages: messages.map((message) => ({ role: message.role === "user" ? "user" as const : "assistant" as const, content: message.content, createdAt: message.created_at })), href: `/dashboard${row.site_id ? `?site=${row.site_id}&conversation=${row.id}` : `?conversation=${row.id}`}#wattson` }; }),
    ...(systemRows.data ?? []).map((row) => { const messages = (systemMessages.data ?? []).filter((message) => message.conversation_id === row.id); const project = (projects.data ?? []).find((item) => item.id === row.project_id); const site = (sites.data ?? []).find((item) => item.id === project?.site_id); return { id: row.id, kind: "system" as const, title: row.title || messages[0]?.content?.slice(0, 64) || "System chat", context: [site?.name, project?.name].filter(Boolean).join(" · ") || "System", updatedAt: row.updated_at || row.created_at, messageCount: messages.length, preview: messages.at(-1)?.content || "", messages: messages.map((message) => ({ role: message.role === "user" ? "user" as const : "assistant" as const, content: message.content, createdAt: message.created_at })), href: project ? `/sites/${project.site_id}/systems/${project.id}?view=wattson&conversation=${row.id}` : "/dashboard" }; }),
  ].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><div className="mt-5"><div className="eyebrow">Conversation library</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Wattson chats</h1><p className="mt-1.5 text-xs leading-5 text-muted">Reopen previous advice and site discussions, or remove conversations you no longer need.</p></div><WattsonChatHistory initialChats={summaries} limit={WATTSON_CONVERSATION_LIMIT}/></div></main>;
}
