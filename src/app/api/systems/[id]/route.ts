import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const detailsUpdateSchema = z.object({ name: z.string().trim().min(1).max(120), projectType: z.enum(["off-grid", "grid-tied", "hybrid"]) });
const lifecycleUpdateSchema = z.object({ phase: z.literal("monitor") });
const updateSchema = z.union([detailsUpdateSchema, lifecycleUpdateSchema]);
const mode = (type: z.infer<typeof detailsUpdateSchema>["projectType"]) => type === "grid-tied" ? "grid_tied" : type === "hybrid" ? "hybrid" : "off_grid";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid system details." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if ("phase" in parsed.data) {
    const [steps, checks] = await Promise.all([
      supabase.from("installation_steps").select("completed_at").eq("project_id", id),
      supabase.from("commissioning_records").select("result").eq("project_id", id),
    ]);
    if (steps.error || checks.error) return Response.json({ error: steps.error?.message ?? checks.error?.message }, { status: 400 });
    const buildComplete = Boolean(steps.data?.length) && steps.data.every((step) => Boolean(step.completed_at));
    const commissioningPassed = Boolean(checks.data?.length) && checks.data.every((check) => check.result === "pass");
    if (!buildComplete || !commissioningPassed) return Response.json({ error: "Complete every build sheet and resolve all commissioning checks first." }, { status: 409 });
  }
  const changes = "phase" in parsed.data
    ? { phase: parsed.data.phase }
    : { name: parsed.data.name, mode: mode(parsed.data.projectType) };
  const updated = await supabase.from("projects").update(changes).eq("id", id).select("id").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 }); return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const removed = await supabase.from("projects").delete().eq("id", id).select("id").single();
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 }); return Response.json({ ok: true });
}
