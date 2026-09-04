import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const preferencesSchema = z.object({
  temperature: z.enum(["c", "f"]),
  windSpeed: z.enum(["ms", "kmh", "mph", "kn"]),
  rainfall: z.enum(["mm", "in"]),
  distance: z.enum(["km", "mi"]),
  dimensions: z.enum(["metric", "us"]),
  weight: z.enum(["kg", "lb"]),
  pressure: z.enum(["hpa", "inhg"]),
});

async function account() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  return { supabase, userId: typeof userId === "string" ? userId : undefined };
}

export async function GET() {
  const { supabase, userId } = await account();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await supabase.from("profiles").select("unit_preferences").eq("id", userId).single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  const parsed = preferencesSchema.safeParse(result.data.unit_preferences);
  return Response.json({ preferences: parsed.success ? parsed.data : null });
}

export async function PATCH(request: Request) {
  const parsed = preferencesSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid measurement preferences" }, { status: 400 });
  const { supabase, userId } = await account();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await supabase.from("profiles").update({ unit_preferences: parsed.data }).eq("id", userId);
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ preferences: parsed.data });
}
