import { z } from "zod";
import { applyWattsonActions } from "@/ai/actions";
import { invalidateProposalAfterDiscovery } from "@/design/invalidate-proposal";
import { deterministicProposalActions } from "@/design/proposal-action";
import { refreshProjectSolarResource } from "@/design/refresh-solar-resource";
import { discoveryProjectType, type DiscoveryAnswers } from "@/discovery/new-system";
import { siteDiscoveryActions } from "@/discovery/site-actions";
import { createClient } from "@/lib/supabase/server";

const answersSchema = z.record(z.string(), z.union([z.string().max(4000), z.number(), z.array(z.string().max(100)).min(1).max(20)]));
const draftSchema = z.object({ answers: answersSchema, questionId: z.string().max(100).optional() });
const completeSchema = z.object({ answers: answersSchema, systemId: z.string().uuid().optional() });

async function ownedSite(siteId: string) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const site = await supabase.from("sites").select("id").eq("id", siteId).eq("owner_id", userId).maybeSingle();
  if (site.error) return { error: Response.json({ error: site.error.message }, { status: 400 }) };
  if (!site.data) return { error: Response.json({ error: "Site not found." }, { status: 404 }) };
  const discovery = await supabase.from("site_discoveries").select("status,answers,baseline_answers,impact_pending").eq("site_id", siteId).maybeSingle();
  if (discovery.error) return { error: Response.json({ error: discovery.error.message }, { status: 400 }) };
  return { supabase, userId, site: site.data, discovery: discovery.data };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = draftSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid discovery draft" }, { status: 400 });
  const { id } = await params;
  const context = await ownedSite(id);
  if ("error" in context) return context.error;
  const saved = await context.supabase.from("site_discoveries").upsert({
    site_id: id,
    owner_id: context.userId,
    status: "draft",
    question_id: parsed.data.questionId ?? null,
    answers: parsed.data.answers,
    baseline_answers: context.discovery?.baseline_answers ?? (context.discovery?.status === "completed" ? context.discovery.answers : null),
    impact_pending: context.discovery?.impact_pending ?? false,
  });
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ saved: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = completeSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid discovery answers" }, { status: 400 });
  const { id } = await params;
  const context = await ownedSite(id);
  if ("error" in context) return context.error;
  const baseline = context.discovery?.baseline_answers ?? (context.discovery?.status === "completed" ? context.discovery.answers : undefined);
  const changed = Boolean(baseline) && JSON.stringify(baseline) !== JSON.stringify(parsed.data.answers);
  const systems = await context.supabase.from("projects").select("id,phase,mode,updated_at").eq("site_id", id).eq("owner_id", context.userId).order("updated_at", { ascending: false });
  if (systems.error) return Response.json({ error: systems.error.message }, { status: 400 });
  const saved = await context.supabase.from("site_discoveries").upsert({
    site_id: id,
    owner_id: context.userId,
    status: "completed",
    question_id: null,
    answers: parsed.data.answers,
    baseline_answers: parsed.data.answers,
    impact_pending: changed && systems.data.length > 0,
    completed_at: new Date().toISOString(),
  });
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  if (systems.data.length) {
    const advanced = await context.supabase.from("projects").update({ phase: "design" }).eq("site_id", id).eq("owner_id", context.userId).eq("phase", "discover");
    if (advanced.error) return Response.json({ error: advanced.error.message }, { status: 400 });
  }
  const requestedSystem = parsed.data.systemId ? systems.data.find((system) => system.id === parsed.data.systemId) : undefined;
  const activeDesigns = systems.data.filter((system) => !["monitor", "diagnose", "maintain", "explain"].includes(system.phase));
  const targetSystem = requestedSystem ?? activeDesigns[0] ?? systems.data[0];
  let affectedDesigns = 0;
  const targets = requestedSystem ? [requestedSystem] : activeDesigns;
  try {
    if (changed) affectedDesigns = await invalidateProposalAfterDiscovery(context.supabase, context.userId, targets.map((system) => system.id));
    const nextProjectType = discoveryProjectType(parsed.data.answers as DiscoveryAnswers);
    const nextMode = nextProjectType === "grid-tied" ? "grid_tied" : nextProjectType === "hybrid" ? "hybrid" : "off_grid";
    for (const system of targets) {
      const updatedSystem = await context.supabase.from("projects").update({ mode: nextMode }).eq("id", system.id).eq("owner_id", context.userId);
      if (updatedSystem.error) throw updatedSystem.error;
      await refreshProjectSolarResource(context.supabase, context.userId, system.id, id, nextMode === "off_grid");
      await applyWattsonActions(context.supabase, system.id, [
        ...siteDiscoveryActions(parsed.data.answers as DiscoveryAnswers),
        ...deterministicProposalActions(parsed.data.answers as DiscoveryAnswers),
      ]);
    }
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not rebuild the affected proposal" }, { status: 400 });
  }
  const designUrl = targetSystem ? `/sites/${id}/systems/${targetSystem.id}/design/schematic?proposal=intro` : `/sites/${id}`;
  return Response.json({ saved: true, affectedDesigns, designUrl });
}
