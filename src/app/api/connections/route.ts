import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  projectId: z.uuid(),
  sourceRef: z.string().trim().min(1).max(160),
  targetRef: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120).default("Connection"),
  connectionType: z.enum(["dc", "ac", "data", "earth", "other"]),
  polarity: z.enum(["positive", "negative", "pair", "na"]).default("na"),
  cableSize: z.string().trim().max(120).optional(),
  cableLength: z.string().trim().max(120).optional(),
  breakerSize: z.string().trim().max(120).optional(),
  fuseSize: z.string().trim().max(120).optional(),
  isolator: z.string().trim().max(240).optional(),
  route: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Invalid connection details." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const input = parsed.data;
  if (input.sourceRef === input.targetRef)
    return Response.json({ error: "Connect two different items." }, { status: 400 });
  const created = await supabase
    .from("system_connections")
    .insert({
      project_id: input.projectId,
      source_ref: input.sourceRef,
      target_ref: input.targetRef,
      name: input.name,
      connection_type: input.connectionType,
      polarity: input.polarity,
      cable_size: input.cableSize || null,
      cable_length: input.cableLength || null,
      breaker_size: input.breakerSize || null,
      fuse_size: input.fuseSize || null,
      isolator: input.isolator || null,
      route: input.route || null,
      notes: input.notes || null,
      confidence: "confirmed",
    })
    .select("*")
    .single();
  if (created.error)
    return Response.json({ error: created.error.message }, { status: 400 });
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.projectId);
  return Response.json({ connection: created.data }, { status: 201 });
}
