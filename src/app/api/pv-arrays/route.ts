import { createClient } from "@/lib/supabase/server";
import { pvArrayRow, pvArraySchema } from "./schema";

export async function POST(request: Request) {
  const parsed = pvArraySchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid PV array details." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const created = await supabase.from("pv_arrays").insert(pvArrayRow(parsed.data)).select("*").single(); if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", parsed.data.projectId); return Response.json({ array: created.data }, { status: 201 });
}
