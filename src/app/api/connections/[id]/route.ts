import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assessCableAgainstEndpoints, withCompatibilityWarning } from "@/lib/connection-cable-assessment";

const schema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(120),
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Invalid connection details." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const input = parsed.data;
  const current = await supabase.from("system_connections").select("source_ref,target_ref").eq("id", id).eq("project_id", input.projectId).single();
  if (current.error) return Response.json({ error: current.error.message }, { status: 400 });
  const endpointIds = [current.data.source_ref, current.data.target_ref].filter((ref) => ref.startsWith("component:")).map((ref) => ref.slice("component:".length));
  const endpointResult = endpointIds.length ? await supabase.from("system_components").select("display_name,specifications").eq("project_id", input.projectId).in("id", endpointIds) : { data: [], error: null };
  if (endpointResult.error) return Response.json({ error: endpointResult.error.message }, { status: 400 });
  const compatibilityWarning = input.cableSize ? assessCableAgainstEndpoints(input.cableSize, endpointResult.data ?? []) : undefined;
  const updated = await supabase
    .from("system_connections")
    .update({
      name: input.name,
      connection_type: input.connectionType,
      polarity: input.connectionType === "dc" ? input.polarity : "na",
      cable_size: input.cableSize || null,
      cable_length: input.cableLength || null,
      breaker_size: input.breakerSize || null,
      fuse_size: input.fuseSize || null,
      isolator: input.isolator || null,
      route: input.route || null,
      notes: withCompatibilityWarning(input.notes, compatibilityWarning),
      confidence: compatibilityWarning ? "estimated" : "confirmed",
    })
    .eq("id", id)
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  if (updated.error)
    return Response.json({ error: updated.error.message }, { status: 400 });
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.projectId);
  return Response.json({ connection: updated.data, compatibilityWarning });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId || !z.uuid().safeParse(projectId).success)
    return Response.json({ error: "Project is required." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await supabase
    .from("system_connections")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id")
    .single();
  if (removed.error)
    return Response.json({ error: removed.error.message }, { status: 400 });
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);
  return Response.json({ ok: true });
}
