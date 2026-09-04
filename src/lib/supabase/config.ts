export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  const missing = [
    !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !key ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
  ].filter((name): name is string => Boolean(name));
  return { url, key, configured: missing.length === 0, missing };
}
