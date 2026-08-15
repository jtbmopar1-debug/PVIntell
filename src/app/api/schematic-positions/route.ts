import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  projectId: z.uuid(),
  nodeRef: z.string().trim().min(1).max(160).optional(),
  x: z.number().finite().min(0).max(2000).optional(),
  y: z.number().finite().min(0).max(4000).optional(),
  positions: z
    .array(
      z.object({
        nodeRef: z.string().trim().min(1).max(160),
        x: z.number().finite().min(0).max(2000),
        y: z.number().finite().min(0).max(4000),
      }),
    )
    .min(1)
    .max(200)
    .optional(),
}).refine(
  (value) =>
    Boolean(value.positions?.length) ||
    (value.nodeRef !== undefined && value.x !== undefined && value.y !== undefined),
);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Invalid schematic position." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const input = parsed.data;
  const positions =
    input.positions ?? [{ nodeRef: input.nodeRef!, x: input.x!, y: input.y! }];
  const saved = await supabase
    .from("system_schematic_positions")
    .upsert(
      positions.map((position) => ({
        project_id: input.projectId,
        node_ref: position.nodeRef,
        position_x: position.x,
        position_y: position.y,
      })),
      { onConflict: "project_id,node_ref" },
    )
    .select("node_ref,position_x,position_y");
  if (saved.error)
    return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ position: saved.data });
}
