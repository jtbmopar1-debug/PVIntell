import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  const { url, key, configured } = getSupabaseConfig();
  if (!configured || !url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const claims = await supabase.auth.getClaims();
  const issuedAt = Number(claims.data?.claims?.iat ?? 0);
  const clockIsAhead = issuedAt > Math.floor(Date.now() / 1000) + 30;
  if (claims.error || clockIsAhead) await supabase.auth.refreshSession();
  return response;
}
