import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function permanentlyDeleteUser(admin: SupabaseClient, userId: string) {
  const files = await listUserFiles(admin, userId);
  for (let index = 0; index < files.length; index += 100) {
    const removed = await admin.storage.from("project-photos").remove(files.slice(index, index + 100));
    if (removed.error) throw new Error(`Could not remove stored photos: ${removed.error.message}`);
  }
  const removedUser = await admin.auth.admin.deleteUser(userId);
  if (removedUser.error) throw removedUser.error;
}

