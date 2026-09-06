import { z } from "zod";
import { POST as continueDashboardChat } from "@/app/api/wattson/dashboard/route";
import { POST as continueDiscoveryHelp } from "@/app/api/wattson/discovery-help/route";
import { POST as continueSystemChat } from "@/app/api/wattson/route";
import { loadWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ kind: z.enum(["dashboard", "system"]), message: z.string().trim().min(1).max(4000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const input = bodySchema.safeParse(await request.json());
  if (!z.uuid().safeParse(id).success || !input.success) return Response.json({ error: "Enter a valid message." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (input.data.kind === "dashboard") {
    const conversation = await supabase.from("user_conversations").select("id,site_id,project_id").eq("id", id).eq("owner_id", userId).maybeSingle();
    if (conversation.error || !conversation.data) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const contextMessages = await supabase.from("user_chat_messages").select("structured_context").eq("conversation_id", id).order("created_at", { ascending: false }).limit(30);
    const structured = (contextMessages.data ?? []).map((message) => message.structured_context && typeof message.structured_context === "object" ? message.structured_context as Record<string, unknown> : {}).find((item) => (item.kind === "discovery_help" || item.kind === "discovery_topic") && item.question && typeof item.question === "object") ?? {};
    if (structured.kind === "discovery_help" && structured.question && typeof structured.question === "object") {
      const recent = await supabase.from("user_chat_messages").select("role,content").eq("conversation_id", id).order("created_at", { ascending: false }).limit(8);
      return continueDiscoveryHelp(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: input.data.message, conversationId: id, siteId: conversation.data.site_id ?? undefined, projectId: conversation.data.project_id ?? undefined, discoveryAnswers: structured.discoveryAnswers && typeof structured.discoveryAnswers === "object" ? structured.discoveryAnswers : {}, question: structured.question, recentConversation: (recent.data ?? []).reverse().map((item) => ({ role: item.role, content: item.content })) }) }));
    }
    return continueDashboardChat(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: input.data.message, conversationId: id, siteId: conversation.data.site_id ?? undefined, projectId: conversation.data.project_id ?? undefined }) }));
  }
  const conversation = await supabase.from("conversations").select("id,project_id").eq("id", id).maybeSingle();
  if (conversation.error || !conversation.data) return Response.json({ error: "Conversation not found." }, { status: 404 });
  const workspace = await loadWorkspace(supabase, conversation.data.project_id, id);
  return continueSystemChat(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: input.data.message, conversationId: id, projectId: conversation.data.project_id, project: workspace.project }) }));
}
