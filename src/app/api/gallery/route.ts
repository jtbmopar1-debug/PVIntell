import { createClient } from "@/lib/supabase/server";
import { registerGalleryImage } from "@/gallery/register";
import { z } from "zod";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const renameSchema = z.object({ id: z.string().uuid(), fileName: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !allowed.has(file.type) || !file.size || file.size > 8 * 1024 * 1024) return Response.json({ error: "Use a JPEG, PNG or WebP image smaller than 8 MB." }, { status: 400 });
  const count = await supabase.from("user_gallery_images").select("id", { count: "exact", head: true }).eq("owner_id", userId);
  if (count.error) return Response.json({ error: count.error.message }, { status: 400 });
  if ((count.count ?? 0) >= 30) return Response.json({ error: "Gallery limit reached (30 images). Delete an image before adding another." }, { status: 409 });
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/gallery/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from("project-photos").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: upload.error.message }, { status: 400 });
  try { await registerGalleryImage(supabase, { ownerId: userId, storagePath: path, fileName: file.name, mimeType: file.type, source: "gallery" }); }
  catch (problem) { await supabase.storage.from("project-photos").remove([path]); return Response.json({ error: problem instanceof Error ? problem.message : "Could not add image." }, { status: 400 }); }
  return Response.json({ added: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Image not found." }, { status: 400 });
  const image = await supabase.from("user_gallery_images").select("id,storage_path").eq("id", id).eq("owner_id", userId).maybeSingle();
  if (image.error || !image.data) return Response.json({ error: image.error?.message ?? "Image not found." }, { status: 404 });
  const removed = await supabase.storage.from("project-photos").remove([image.data.storage_path]);
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
  const deleted = await supabase.from("user_gallery_images").delete().eq("id", id).eq("owner_id", userId);
  if (deleted.error) return Response.json({ error: deleted.error.message }, { status: 400 });
  return Response.json({ deleted: true });
}

export async function PATCH(request: Request) {
  const parsed = renameSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Enter an image name up to 120 characters." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const updated = await supabase.from("user_gallery_images").update({ file_name: parsed.data.fileName }).eq("id", parsed.data.id).eq("owner_id", userId).select("id,file_name").maybeSingle();
  if (updated.error || !updated.data) return Response.json({ error: updated.error?.message ?? "Image not found." }, { status: updated.error ? 400 : 404 });
  return Response.json({ image: { id: updated.data.id, fileName: updated.data.file_name } });
}
