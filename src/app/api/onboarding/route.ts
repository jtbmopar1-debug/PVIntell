import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const answerSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  location: z.string().trim().max(180).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  experience: z.enum(["new", "some", "experienced", "professional"]).optional(),
  electricalConfidence: z.enum(["learn", "basic", "confident", "qualified"]).optional(),
  history: z.array(z.string().trim().max(100)).max(10).optional(),
  currentSituation: z.array(z.string().trim().max(100)).max(10).optional(),
  goals: z.array(z.string().trim().max(100)).max(10).optional(),
  notes: z.string().trim().max(1500).optional(),
});

const requestSchema = z.object({
  answers: answerSchema,
  completed: z.boolean().optional(),
  editing: z.boolean().optional(),
});

export async function PUT(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Some assessment answers are invalid." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const completed = Boolean(parsed.data.completed);
  const remainsCompleted = completed || Boolean(parsed.data.editing);
  const update = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.answers.displayName || null,
      home_location: parsed.data.answers.location || null,
      timezone: parsed.data.answers.timezone || "UTC",
      onboarding_status: remainsCompleted ? "completed" : "in_progress",
      onboarding_assessment: parsed.data.answers,
      onboarding_completed_at: remainsCompleted ? new Date().toISOString() : null,
    })
    .eq("id", userId);
  if (update.error)
    return Response.json({ error: update.error.message }, { status: 400 });
  return Response.json({ ok: true, completed });
}
