import { z } from "zod";
import { questionnaireTemplates } from "@/questionnaires/templates";
import { createClient } from "@/lib/supabase/server";

const responseSchema = z.object({
  projectId: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "completed"]),
  answers: z.record(z.string(), z.union([z.string().max(4000), z.number(), z.boolean()])),
});

export async function PUT(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const template = questionnaireTemplates.find((item) => item.key === key);
  const parsed = responseSchema.safeParse(await request.json());
  if (!template || !parsed.success || parsed.data.version !== template.version) return Response.json({ error: "Invalid questionnaire response" }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const project = await supabase.from("projects").select("id").eq("id", parsed.data.projectId).maybeSingle();
  if (project.error || !project.data) return Response.json({ error: "System not found" }, { status: 404 });
  const saved = await supabase.from("questionnaire_responses").upsert({
    project_id: parsed.data.projectId,
    template_key: template.key,
    template_version: template.version,
    status: parsed.data.status,
    answers: parsed.data.answers,
    completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
  }, { onConflict: "project_id,template_key" });
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ saved: true });
}
