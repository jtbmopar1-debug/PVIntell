import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ theme: z.enum(["light", "dark"]) });
async function account() { const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub; return { supabase, userId: typeof userId === "string" ? userId : undefined }; }

export async function GET() {
  const { supabase, userId } = await account(); if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await supabase.from("profiles").select("theme_preference").eq("id", userId).single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ theme: schema.shape.theme.safeParse(result.data.theme_preference).data ?? "light" });
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid theme preference" }, { status: 400 });
  const { supabase, userId } = await account(); if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await supabase.from("profiles").update({ theme_preference: parsed.data.theme }).eq("id", userId);
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json(parsed.data);
}
