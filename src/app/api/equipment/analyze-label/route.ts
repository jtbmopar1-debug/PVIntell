import { extractEquipmentLabel } from "@/ai/equipment-label";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileBytes = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");
  if (!(file instanceof File) || typeof projectId !== "string") return Response.json({ error: "Choose a label photo first." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 400 });
  if (!file.size || file.size > maxFileBytes) return Response.json({ error: "The photo must be smaller than 8 MB." }, { status: 400 });

  const owned = await supabase.from("projects").select("id,site_id").eq("id", projectId).maybeSingle();
  if (owned.error || !owned.data) return Response.json({ error: "System not found." }, { status: 404 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extraction = await extractEquipmentLabel(bytes, file.type);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const photoPath = `${userId}/${projectId}/equipment-labels/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage.from("project-photos").upload(photoPath, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error(`The label was read, but its photo could not be stored: ${uploaded.error.message}`);
    return Response.json({ extraction, photoPath, siteId: owned.data.site_id });
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Wattson could not read this label." }, { status: 502 });
  }
}
