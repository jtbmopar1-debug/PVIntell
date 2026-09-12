import { z } from "zod";
import { userConversationCount, WATTSON_CONVERSATION_LIMIT } from "@/ai/conversation-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("dashboard"), siteId: z.uuid().optional(), projectId: z.uuid().optional() }),
  z.object({ scope: z.literal("system"), projectId: z.uuid() }),
]);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid conversation scope." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (await userConversationCount(supabase, userId) >= WATTSON_CONVERSATION_LIMIT)
      return Response.json({ error: `You have reached the ${WATTSON_CONVERSATION_LIMIT}-chat limit. Delete an old chat from Wattson chats before starting another.` }, { status: 409 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not check chat storage." }, { status: 400 });
  }
  if (parsed.data.scope === "dashboard") {
    if (parsed.data.siteId) {
      const site = await supabase.from("sites").select("id").eq("id", parsed.data.siteId).eq("owner_id", userId).maybeSingle();
      if (!site.data) return Response.json({ error: "Site not found." }, { status: 404 });
    }
    if (parsed.data.projectId) {
      const project = await supabase.from("projects").select("id").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
      if (!project.data) return Response.json({ error: "System not found." }, { status: 404 });
    }
    const created = await supabase.from("user_conversations").insert({ owner_id: userId, site_id: parsed.data.siteId, project_id: parsed.data.projectId, title: "Dashboard — New chat" }).select("id").single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    return Response.json({ id: created.data.id }, { status: 201 });
  }
  const owned = await supabase.from("projects").select("id").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
  if (owned.error || !owned.data) return Response.json({ error: "System not found." }, { status: 404 });
  const created = await supabase.from("conversations").insert({ project_id: parsed.data.projectId, title: "Wattson conversation" }).select("id").single();
  if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
  return Response.json({ id: created.data.id }, { status: 201 });
}
