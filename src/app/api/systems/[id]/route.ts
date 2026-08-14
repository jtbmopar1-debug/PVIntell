import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({ name: z.string().trim().min(1).max(120), projectType: z.enum(["off-grid", "grid-tied", "hybrid"]) });
const mode = (type: z.infer<typeof updateSchema>["projectType"]) => type === "grid-tied" ? "grid_tied" : type === "hybrid" ? "hybrid" : "off_grid";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid system details." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const updated = await supabase.from("projects").update({ name: parsed.data.name, mode: mode(parsed.data.projectType) }).eq("id", id).select("id").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 }); return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const removed = await supabase.from("projects").delete().eq("id", id).select("id").single();
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 }); return Response.json({ ok: true });
}
