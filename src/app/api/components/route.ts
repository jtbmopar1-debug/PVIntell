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

export async function POST(request: Request) {
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
  const input = parsed.data;
  if (input.type === "inverter" && input.quantity !== 1)
    return Response.json(
      { error: "Record each physical inverter separately." },
      { status: 400 },
    );
  const created = await supabase
    .from("system_components")
    .insert({
      project_id: input.projectId,
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
    .select("*")
    .single();
  if (created.error)
    return Response.json({ error: created.error.message }, { status: 400 });
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.projectId);
  return Response.json({ component: created.data }, { status: 201 });
}
