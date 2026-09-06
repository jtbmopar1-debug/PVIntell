import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ systemId: z.uuid().nullable() });

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid system" }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!parsed.data.systemId) {
    const cleared = await supabase.from("profiles").update({ dashboard_default_system_id: null, dashboard_default_site_id: null }).eq("id", userId);
    if (cleared.error) return Response.json({ error: cleared.error.message }, { status: 400 });
    return Response.json({ systemId: null });
  }

  const system = await supabase.from("projects").select("id,site_id").eq("id", parsed.data.systemId).eq("owner_id", userId).maybeSingle();
  if (system.error) return Response.json({ error: system.error.message }, { status: 400 });
  if (!system.data) return Response.json({ error: "System not found" }, { status: 404 });
  const result = await supabase.from("profiles").update({ dashboard_default_system_id: system.data.id, dashboard_default_site_id: system.data.site_id }).eq("id", userId);
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ systemId: system.data.id, siteId: system.data.site_id });
}
