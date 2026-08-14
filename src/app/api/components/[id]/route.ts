import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  projectId: z.uuid(),
  type: z.enum([
    "panel",
    "pv_string",
    "battery",
    "inverter",
    "charger",
    "generator",
    "protection",
    "isolator",
    "cable",
    "connector",
    "combiner",
    "meter",
    "monitoring",
    "load",
    "other",
  ]),
  name: z.string().trim().min(1).max(120),
  manufacturer: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  quantity: z.number().int().min(1).max(1000),
  installationLocation: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  serialNumber: z.string().trim().max(200).optional(),
  firmwareVersion: z.string().trim().max(120).optional(),
  manualUrl: z.url().max(1000).optional(),
  photoUrl: z.string().trim().max(1000).optional(),
  specifications: z.record(
    z.string(),
    z.union([z.string().max(500), z.number()]),
  ),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Invalid component details." },
      { status: 400 },
    );
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const input = parsed.data;
  if (input.type === "inverter" && input.quantity !== 1)
    return Response.json(
      {
        error:
          "Split this record into individual inverter cards before saving.",
      },
      { status: 400 },
    );
  const updated = await supabase
    .from("system_components")
    .update({
      type: input.type,
      display_name: input.name,
      manufacturer: input.manufacturer || null,
      model: input.model || null,
      quantity: input.quantity,
      installation_location: input.installationLocation || null,
      notes: input.notes || null,
      serial_number: input.serialNumber || null,
      firmware_version: input.firmwareVersion || null,
      manual_url: input.manualUrl || null,
      photo_url: input.photoUrl || null,
      specifications: input.specifications,
      confidence: "confirmed",
    })
    .eq("id", id)
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  if (updated.error)
    return Response.json({ error: updated.error.message }, { status: 400 });
  const event = await supabase
    .from("system_events")
    .insert({
      project_id: input.projectId,
      type: "component_specification_updated",
      severity: "info",
      message: `Updated ${input.name} specifications`,
      metadata: { componentId: id },
    });
  if (event.error)
    return Response.json({ error: event.error.message }, { status: 400 });
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.projectId);
  return Response.json({ component: updated.data });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await supabase
    .from("system_components")
    .delete()
    .eq("id", id)
    .select("project_id,type,display_name,model")
    .single();
  if (removed.error)
    return Response.json({ error: removed.error.message }, { status: 400 });
  await supabase
    .from("system_events")
    .insert({
      project_id: removed.data.project_id,
      type: "component_removed",
      severity: "info",
      message: `Removed ${removed.data.display_name ?? removed.data.model ?? removed.data.type}`,
      metadata: { componentId: id },
    });
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", removed.data.project_id);
  return Response.json({ ok: true });
}
