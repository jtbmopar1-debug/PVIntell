import { z } from "zod";
import { createSystem } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

const createSystemSchema = z.object({
  siteId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  projectType: z.enum(["off-grid", "grid-tied", "hybrid"]).optional(),
  startingGoal: z.string().trim().min(1).max(300).optional(),
});

export async function POST(request: Request) {
  const parsed = createSystemSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid system details" }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const site = await supabase.from("sites").select("id").eq("id", parsed.data.siteId).maybeSingle();
  if (site.error || !site.data) return Response.json({ error: "Site not found" }, { status: 404 });
  try {
    const id = await createSystem(supabase, userId, parsed.data.siteId, parsed.data.name, parsed.data.projectType, parsed.data.startingGoal);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create system" }, { status: 400 });
  }
}
