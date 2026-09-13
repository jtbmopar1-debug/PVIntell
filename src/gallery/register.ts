type GalleryClient = { from: (table: string) => { insert: (value: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> } };

export async function registerGalleryImage(client: GalleryClient, input: { ownerId: string; storagePath: string; fileName: string; mimeType: string; source: "gallery" | "wattson" }) {
  const result = await client.from("user_gallery_images").insert({ owner_id: input.ownerId, storage_path: input.storagePath, file_name: input.fileName, mime_type: input.mimeType, source: input.source });
  if (result.error) throw new Error(result.error.message);
}

