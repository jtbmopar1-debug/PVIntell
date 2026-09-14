import { NextRequest, NextResponse } from "next/server";
import { safeInternalReturnPath } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const next = safeInternalReturnPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();
  const refreshed = await supabase.auth.refreshSession();
  if (!refreshed.error && refreshed.data.session) {
    const probe = await supabase.from("profiles").select("id").limit(1);
    if (!probe.error) return NextResponse.redirect(new URL(next, request.url));
  }
  await supabase.auth.signOut({ scope: "local" });
  const login = new URL("/login", request.url);
  login.searchParams.set("error", "Your saved sign-in had an invalid time stamp, so PVIntell cleared it. Please check that this device uses automatic date and time, then sign in again.");
  return NextResponse.redirect(login);
}
