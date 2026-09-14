import type { SupabaseClient } from "@supabase/supabase-js";

export type WattsonMessageTable = "user_chat_messages" | "chat_messages";

export async function cachedConversationResponse(
  supabase: SupabaseClient,
  table: WattsonMessageTable,
  conversationId: string | undefined,
  requestId?: string,
) {
  if (!requestId) return undefined;
  let query = supabase
    .from(table)
    .select("conversation_id,content,structured_context")
    .eq("response_to_request_id", requestId);
  if (conversationId) query = query.eq("conversation_id", conversationId);
  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return undefined;
  const context = result.data.structured_context && typeof result.data.structured_context === "object"
    ? result.data.structured_context as Record<string, unknown>
    : {};
  return { message: result.data.content, ...context, conversationId: result.data.conversation_id, cached: true };
}

export async function startedConversationRequest(
  supabase: SupabaseClient,
  table: WattsonMessageTable,
  conversationId: string | undefined,
  requestId?: string,
) {
  if (!requestId) return undefined;
  let query = supabase
    .from(table)
    .select("id,conversation_id")
    .eq("client_request_id", requestId);
  if (conversationId) query = query.eq("conversation_id", conversationId);
  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  return result.data ? { conversationId: result.data.conversation_id as string } : undefined;
}
