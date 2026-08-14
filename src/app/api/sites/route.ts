import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1).max(120), timezone: z.string().trim().min(1).max(100).optional() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Enter a site name." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const created = await supabase.from("sites").insert({ owner_id: userId, name: parsed.data.name, timezone: parsed.data.timezone ?? "UTC" }).select("id").single();
  if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
  return Response.json({ id: created.data.id }, { status: 201 });
}
