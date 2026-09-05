import { z } from "zod";
import { createSystem } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  siteId: z.string().min(1),
  siteName: z.string().trim().max(120).optional(),
  systemName: z.string().trim().min(1).max(120),
  projectType: z.enum(["off-grid", "hybrid", "grid-tied"]),
  systemVoltage: z.number().int().positive().max(1000).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Check the Site and system details." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });

  let siteId = parsed.data.siteId;
  let createdSiteId: string | undefined;
  if (siteId === "__new__") {
    if (!parsed.data.siteName) return Response.json({ error: "Enter a name for the Site." }, { status: 400 });
    const profile = await supabase.from("profiles").select("home_location,timezone").eq("id", userId).single();
    if (profile.error) return Response.json({ error: profile.error.message }, { status: 400 });
    const site = await supabase.from("sites").insert({ owner_id: userId, name: parsed.data.siteName, location: profile.data.home_location || null, timezone: profile.data.timezone || "UTC", location_source: "imported", location_confirmed: false }).select("id").single();
    if (site.error) return Response.json({ error: site.error.message }, { status: 400 });
    siteId = site.data.id;
    createdSiteId = siteId;
  } else {
    const site = await supabase.from("sites").select("id").eq("id", siteId).eq("owner_id", userId).maybeSingle();
    if (site.error || !site.data) return Response.json({ error: "Site not found." }, { status: 404 });
  }

  let systemId: string | undefined;
  try {
    systemId = await createSystem(supabase, userId, siteId, parsed.data.systemName, parsed.data.projectType, "Record equipment that is already installed", parsed.data.systemVoltage);
    const installed = await supabase.from("projects").update({ phase: "monitor" }).eq("id", systemId).eq("owner_id", userId);
    if (installed.error) throw installed.error;
    return Response.json({ siteId, systemId, url: `/sites/${siteId}/systems/${systemId}?view=system` }, { status: 201 });
  } catch (problem) {
    if (systemId) await supabase.from("projects").delete().eq("id", systemId).eq("owner_id", userId);
    if (createdSiteId) await supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", userId);
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not create the installed system." }, { status: 400 });
  }
}
