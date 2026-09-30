import { createClient } from "@/lib/supabase/server";
import { pvArrayRows, pvArraySchema } from "./schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordShadowCreditUsage } from "@/credits/usage";

export async function POST(request: Request) {
  const parsed = pvArraySchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid PV array details." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = claims.data.claims.sub;
  const rows = pvArrayRows(parsed.data);
  const created = await supabase.from("pv_arrays").insert(rows).select("*"); if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", parsed.data.projectId);
  const project = await supabase.from("projects").select("site_id,phase").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
  if (project.data?.phase === "monitor") await Promise.all((created.data ?? []).map((array) => recordShadowCreditUsage(createAdminClient(), {
    ownerId: userId,
    siteId: project.data!.site_id,
    projectId: parsed.data.projectId,
    action: "captured_component",
    idempotencyKey: `captured-pv-array:${array.id}`,
    metadata: { recordType: "pv_array" },
  })));
  return Response.json({ array: created.data?.[0], arrays: created.data }, { status: 201 });
}
