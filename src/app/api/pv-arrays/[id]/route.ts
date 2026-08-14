import { createClient } from "@/lib/supabase/server";
import { pvArrayRow, pvArraySchema } from "../schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = pvArraySchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid PV array details." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  const updated = await supabase.from("pv_arrays").update(pvArrayRow(parsed.data)).eq("id", id).eq("project_id", parsed.data.projectId).select("*").single(); if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", parsed.data.projectId); return Response.json({ array: updated.data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  const removed = await supabase.from("pv_arrays").delete().eq("id", id).select("project_id,name").single(); if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
  await supabase.from("system_events").insert({ project_id: removed.data.project_id, type: "pv_array_removed", severity: "info", message: `Removed ${removed.data.name}`, metadata: { pvArrayId: id } }); await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", removed.data.project_id); return Response.json({ ok: true });
}
