import { z } from "zod";
import { isAdminEmail } from "@/admin/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { permanentlyDeleteUser } from "@/lib/supabase/delete-user";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ confirmation: z.string().min(1) });

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const current = await supabase.auth.getUser();
  if (current.error || !current.data.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(current.data.user.email)) return Response.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  const userId = z.uuid().safeParse(id);
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!userId.success || !body.success) return Response.json({ error: "Invalid deletion request." }, { status: 400 });
  if (userId.data === current.data.user.id) return Response.json({ error: "You cannot delete the account currently signed in." }, { status: 409 });

  const admin = createAdminClient();
  const target = await admin.auth.admin.getUserById(userId.data);
  if (target.error || !target.data.user) return Response.json({ error: "User not found." }, { status: 404 });
  if (isAdminEmail(target.data.user.email)) return Response.json({ error: "Admin accounts cannot be deleted here." }, { status: 409 });
  const expected = `DELETE ${target.data.user.email ?? userId.data}`;
  if (body.data.confirmation !== expected) return Response.json({ error: "The confirmation phrase did not match." }, { status: 400 });

  try {
    await permanentlyDeleteUser(admin, userId.data);
    return Response.json({ deleted: true });
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "The user could not be deleted." }, { status: 500 });
  }
}
