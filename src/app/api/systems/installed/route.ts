import { createSystem } from "@/data/cloud-project";
import { installedSystemCreationReplay } from "@/data/installed-system-idempotency";
import { installedSystemInputSchema } from "@/data/installed-system-input";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = installedSystemInputSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the Site and system details." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const requestPayload = {
    siteId: parsed.data.siteId,
    siteName: parsed.data.siteName ?? null,
    systemName: parsed.data.systemName,
    projectType: parsed.data.projectType,
    systemVoltage: parsed.data.systemVoltage ?? null,
  };
  const reserved = await supabase.from("installed_system_creation_requests").insert({
    owner_id: userId,
    idempotency_key: parsed.data.idempotencyKey,
    request_payload: requestPayload,
  });
  if (reserved.error) {
    if (reserved.error.code !== "23505") return Response.json({ error: reserved.error.message }, { status: 400 });
    const existing = await supabase.from("installed_system_creation_requests")
      .select("request_payload,status,site_id,project_id")
      .eq("owner_id", userId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .maybeSingle();
    if (existing.error || !existing.data) return Response.json({ error: existing.error?.message ?? "Could not verify the existing request." }, { status: 400 });
    const replay = installedSystemCreationReplay(existing.data, requestPayload);
    if (replay.kind === "conflict")
      return Response.json({ error: "That creation request was already used for different system details." }, { status: 409 });
    if (replay.kind === "completed")
      return Response.json({ siteId: replay.siteId, systemId: replay.projectId, url: `/sites/${replay.siteId}/systems/${replay.projectId}/schematic?add=1`, replayed: true });
    return Response.json({ error: "This installed system is already being created." }, { status: 409, headers: { "retry-after": "2" } });
  }
  const releaseReservation = () => supabase.from("installed_system_creation_requests").delete().eq("owner_id", userId).eq("idempotency_key", parsed.data.idempotencyKey);

  let siteId = parsed.data.siteId;
  let createdSiteId: string | undefined;
  if (siteId === "__new__") {
    const profile = await supabase.from("profiles").select("home_location,timezone").eq("id", userId).single();
    if (profile.error) {
      await releaseReservation();
      return Response.json({ error: profile.error.message }, { status: 400 });
    }
    const site = await supabase.from("sites").insert({ owner_id: userId, name: parsed.data.siteName, location: profile.data.home_location || null, timezone: profile.data.timezone || "UTC", location_source: "imported", location_confirmed: false }).select("id").single();
    if (site.error) {
      await releaseReservation();
      return Response.json({ error: site.error.message }, { status: 400 });
    }
    siteId = site.data.id;
    createdSiteId = siteId;
  } else {
    const site = await supabase.from("sites").select("id").eq("id", siteId).eq("owner_id", userId).maybeSingle();
    if (site.error || !site.data) {
      await releaseReservation();
      return Response.json({ error: "Site not found." }, { status: 404 });
    }
  }

  let systemId: string | undefined;
  try {
    systemId = await createSystem(supabase, userId, siteId, parsed.data.systemName, parsed.data.projectType, "Record equipment that is already installed", parsed.data.systemVoltage);
    const installed = await supabase.from("projects").update({ phase: "monitor" }).eq("id", systemId).eq("owner_id", userId);
    if (installed.error) throw installed.error;
    const completed = await supabase.from("installed_system_creation_requests").update({ status: "completed", site_id: siteId, project_id: systemId, completed_at: new Date().toISOString() }).eq("owner_id", userId).eq("idempotency_key", parsed.data.idempotencyKey);
    if (completed.error) throw completed.error;
    return Response.json({ siteId, systemId, url: `/sites/${siteId}/systems/${systemId}/schematic?add=1` }, { status: 201 });
  } catch (problem) {
    if (systemId) await supabase.from("projects").delete().eq("id", systemId).eq("owner_id", userId);
    if (createdSiteId) await supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", userId);
    await releaseReservation();
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not create the installed system." }, { status: 400 });
  }
}
