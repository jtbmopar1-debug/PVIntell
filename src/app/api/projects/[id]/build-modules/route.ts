import { z } from "zod";
import { handoverModuleIds } from "@/commissioning/handover-review";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ moduleId: z.enum(handoverModuleIds), complete: z.boolean() });

async function ownedProject(id: string) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const project = await supabase.from("projects").select("id").eq("id", id).eq("owner_id", userId).maybeSingle();
  if (project.error) return { error: Response.json({ error: project.error.message }, { status: 400 }) } as const;
  if (!project.data) return { error: Response.json({ error: "Power system not found." }, { status: 404 }) } as const;
  return { supabase } as const;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownedProject(id);
  if ("error" in owned) return owned.error;
  const records = await owned.supabase.from("system_build_modules").select("module_id,complete,completed_at").eq("project_id", id);
  if (records.error) return Response.json({ error: records.error.message }, { status: 400 });
  return Response.json({ modules: records.data ?? [] });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid build module update." }, { status: 400 });
  const { id } = await params;
  const owned = await ownedProject(id);
  if ("error" in owned) return owned.error;
  const saved = await owned.supabase.from("system_build_modules").upsert({
    project_id: id,
    module_id: parsed.data.moduleId,
    complete: parsed.data.complete,
    completed_at: parsed.data.complete ? new Date().toISOString() : null,
  }, { onConflict: "project_id,module_id" });
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ saved: true });
}
