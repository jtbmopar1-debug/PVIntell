import { createClient } from "@/lib/supabase/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await supabase.rpc("delete_discovery_draft_workspace", { target_draft_id: id });
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
  const outcome = removed.data as { deleted?: boolean } | null;
  if (!outcome?.deleted) return Response.json({ error: "Discovery draft not found." }, { status: 404 });
  return Response.json({ ok: true });
}
