import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) throw new Error("Supabase public environment variables are not configured.");
  return createBrowserClient(url, key);
}
