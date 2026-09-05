import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") });

async function listUserFiles(admin: SupabaseClient, userId: string) {
  const files: string[] = [];
  const folders = [userId];
  while (folders.length) {
    const folder = folders.pop()!;
    for (let offset = 0; ; offset += 100) {
      const result = await admin.storage.from("project-photos").list(folder, { limit: 100, offset });
      if (result.error) throw new Error(`Could not inspect stored photos: ${result.error.message}`);
      const entries = result.data ?? [];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) files.push(path); else folders.push(path);
      }
      if (entries.length < 100) break;
    }
  }
  return files;
}

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
    const files = await listUserFiles(admin, userId);
    for (let index = 0; index < files.length; index += 100) {
      const removed = await admin.storage.from("project-photos").remove(files.slice(index, index + 100));
      if (removed.error) throw new Error(`Could not remove stored photos: ${removed.error.message}`);
    }
    const removedUser = await admin.auth.admin.deleteUser(userId);
    if (removedUser.error) throw removedUser.error;
    return Response.json({ deleted: true });
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Your account could not be deleted." }, { status: 500 });
  }
}
