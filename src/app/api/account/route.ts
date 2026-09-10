import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { permanentlyDeleteUser } from "@/lib/supabase/delete-user";

const requestSchema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") });

export async function DELETE(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "The required confirmation phrase did not match." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return Response.json({ error: "Account deletion is not configured for this deployment. Contact pvintell1@gmail.com." }, { status: 503 });
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    await permanentlyDeleteUser(admin, userId);
    return Response.json({ deleted: true });
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Your account could not be deleted." }, { status: 500 });
  }
}
