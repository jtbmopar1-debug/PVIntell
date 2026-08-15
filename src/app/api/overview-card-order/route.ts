import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  projectId: z.uuid(),
  nodeRefs: z
    .array(z.string().trim().min(1).max(180))
    .min(1)
    .max(200)
    .refine((items) => new Set(items).size === items.length),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Invalid card order." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const input = parsed.data;
  const rows = input.nodeRefs.map((nodeRef, position) => ({
    project_id: input.projectId,
    node_ref: nodeRef,
    position,
  }));
  const saved = await supabase
    .from("system_overview_card_order")
    .upsert(rows, { onConflict: "project_id,node_ref" });
  if (saved.error)
    return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ ok: true });
}
