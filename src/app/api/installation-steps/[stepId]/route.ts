import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  projectId: z.uuid(),
  complete: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stepId: string }> },
) {
  const { stepId } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !z.uuid().safeParse(stepId).success)
    return Response.json({ error: "Invalid installation step update." }, { status: 400 });

  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await supabase
    .from("installation_steps")
    .update({ completed_at: parsed.data.complete ? new Date().toISOString() : null })
    .eq("id", stepId)
    .eq("project_id", parsed.data.projectId)
    .select("id")
    .maybeSingle();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  if (!updated.data) return Response.json({ error: "Installation step not found." }, { status: 404 });
  return Response.json({ saved: true });
}
