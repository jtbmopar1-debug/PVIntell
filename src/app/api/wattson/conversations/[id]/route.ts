import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const kindSchema = z.enum(["dashboard", "system"]);

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const kind = kindSchema.safeParse(new URL(request.url).searchParams.get("kind"));
  if (!z.uuid().safeParse(id).success || !kind.success) return Response.json({ error: "Invalid conversation." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (kind.data === "dashboard") {
    const result = await supabase.from("user_conversations").delete().eq("id", id).eq("owner_id", userId).select("id").maybeSingle();
    if (result.error || !result.data) return Response.json({ error: result.error?.message ?? "Conversation not found." }, { status: 404 });
  } else {
    const result = await supabase.from("conversations").delete().eq("id", id).select("id").maybeSingle();
    if (result.error || !result.data) return Response.json({ error: result.error?.message ?? "Conversation not found." }, { status: 404 });
  }
  return Response.json({ deleted: true });
}
