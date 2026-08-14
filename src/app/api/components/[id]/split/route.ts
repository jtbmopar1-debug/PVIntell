import { createClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const current = await supabase.from("system_components").select("*").eq("id", id).single();
  if (current.error) return Response.json({ error: current.error.message }, { status: 404 });
  if (current.data.type !== "inverter" || current.data.quantity < 2) {
    return Response.json({ error: "This is not a multi-inverter record." }, { status: 400 });
  }
  if (current.data.quantity > 20) {
    return Response.json({ error: "Split no more than 20 inverter units at once." }, { status: 400 });
  }

  const quantity = Number(current.data.quantity);
  const rawName = current.data.display_name ?? current.data.model ?? "Inverter";
  const baseName = String(rawName).replace(/\s+\d+$/, "").trim() || "Inverter";
  const original = await supabase
    .from("system_components")
    .update({ display_name: `${baseName} 1`, quantity: 1 })
    .eq("id", id)
    .select("*")
    .single();
  if (original.error) return Response.json({ error: original.error.message }, { status: 400 });

  const copies = Array.from({ length: quantity - 1 }, (_, index) => ({
    project_id: current.data.project_id,
    type: current.data.type,
    display_name: `${baseName} ${index + 2}`,
    manufacturer: current.data.manufacturer,
    model: current.data.model,
    quantity: 1,
    installation_location: current.data.installation_location,
    notes: current.data.notes,
    serial_number: null,
    firmware_version: current.data.firmware_version,
    manual_url: current.data.manual_url,
    photo_url: current.data.photo_url,
    specifications: current.data.specifications,
    confidence: current.data.confidence,
  }));
  const inserted = await supabase.from("system_components").insert(copies).select("*");
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 400 });

  await supabase.from("system_events").insert({
    project_id: current.data.project_id,
    type: "inverters_split",
    severity: "info",
    message: `Separated ${quantity} physical inverters into individual records`,
    metadata: { sourceComponentId: id, quantity },
  });
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", current.data.project_id);
  return Response.json({ components: [original.data, ...(inserted.data ?? [])] });
}
