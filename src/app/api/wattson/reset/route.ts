import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("dashboard") }),
  z.object({ scope: z.literal("system"), projectId: z.uuid() }),
]);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid conversation scope." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (parsed.data.scope === "dashboard") {
    const created = await supabase.from("user_conversations").insert({ owner_id: userId }).select("id").single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    return Response.json({ id: created.data.id }, { status: 201 });
  }
  const owned = await supabase.from("projects").select("id").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
  if (owned.error || !owned.data) return Response.json({ error: "System not found." }, { status: 404 });
  const created = await supabase.from("conversations").insert({ project_id: parsed.data.projectId, title: "Wattson conversation" }).select("id").single();
  if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
  return Response.json({ id: created.data.id }, { status: 201 });
}
