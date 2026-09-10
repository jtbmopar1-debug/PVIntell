import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const equipmentSchema = z.object({
  siteId: z.uuid(),
  type: z.enum(["panel", "pv_string", "battery", "inverter", "generator", "protection", "meter", "other"]),
  name: z.string().trim().min(1).max(120),
  manufacturer: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(160).optional(),
  quantity: z.number().int().min(1).max(1000),
  condition: z.enum(["new", "used_good", "used_unknown", "needs_testing", "for_parts"]),
  specifications: z.record(z.string(), z.union([z.string().max(500), z.number()])),
  notes: z.string().trim().max(2000).optional(),
  photoPath: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const type = searchParams.get("type");
  if (!siteId || !z.uuid().safeParse(siteId).success) return Response.json({ error: "A valid Site is required" }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const site = await supabase.from("sites").select("id").eq("id", siteId).eq("owner_id", userId).maybeSingle();
  if (site.error || !site.data) return Response.json({ error: "Site not found" }, { status: 404 });
  let query = supabase.from("site_equipment").select("id,site_id,assigned_project_id,type,name,manufacturer,model,quantity,condition,status,specifications").eq("site_id", siteId).is("assigned_project_id", null).in("status", ["available", "considering"]);
  if (type && equipmentSchema.shape.type.safeParse(type).success) query = query.eq("type", type);
  const result = await query.order("created_at");
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ equipment: result.data ?? [] });
}

export async function POST(request: Request) {
  const parsed = equipmentSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid equipment details" }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const site = await supabase.from("sites").select("id").eq("id", parsed.data.siteId).maybeSingle();
  if (site.error || !site.data) return Response.json({ error: "Site not found" }, { status: 404 });
  const input = parsed.data;
  const created = await supabase.from("site_equipment").insert({
    site_id: input.siteId,
    type: input.type,
    name: input.name,
    manufacturer: input.manufacturer || null,
    model: input.model || null,
    serial_number: input.serialNumber || null,
    quantity: input.quantity,
    condition: input.condition,
    specifications: input.specifications,
    notes: input.notes || null,
    photo_urls: input.photoPath ? [input.photoPath] : [],
  }).select("*").single();
  if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
  return Response.json({ equipment: created.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = equipmentSchema.extend({ id: z.uuid() }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid equipment details" }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const input = parsed.data;
  const updated = await supabase.from("site_equipment").update({ site_id: input.siteId, type: input.type, name: input.name, manufacturer: input.manufacturer || null, model: input.model || null, serial_number: input.serialNumber || null, quantity: input.quantity, condition: input.condition, specifications: input.specifications, notes: input.notes || null, ...(input.photoPath ? { photo_urls: [input.photoPath] } : {}) }).eq("id", input.id).select("*").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  return Response.json({ equipment: updated.data });
}
