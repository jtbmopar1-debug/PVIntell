import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), locationMode: z.enum(["static", "mobile"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter a valid system position." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const updated = await supabase.from("projects").update({ map_latitude: parsed.data.latitude, map_longitude: parsed.data.longitude, location_mode: parsed.data.locationMode, map_location_updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", userId).select("id").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  return Response.json({ saved: true });
}
