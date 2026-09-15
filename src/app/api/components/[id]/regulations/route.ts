import { askGemini } from "@/ai/gemini";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";
import {
  COMPONENT_REGULATORY_LIBRARY_VERSION,
  regulatoryJurisdictionKey,
  regulatorySubjectKey,
  resolveComponentRegulatoryBundle,
} from "@/regulations/component-regulatory-library";

const missingTableCodes = new Set(["42P01", "PGRST205"]);

async function contextForComponent(id: string, jurisdictionOverride?: string | null) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const row = await supabase.from("system_components").select("id,project_id").eq("id", id).maybeSingle();
  if (row.error) return { error: Response.json({ error: row.error.message }, { status: 400 }) } as const;
  if (!row.data) return { error: Response.json({ error: "Component not found" }, { status: 404 }) } as const;
  const project = await supabase.from("projects").select("id,site_id").eq("id", row.data.project_id).eq("owner_id", userId).maybeSingle();
  if (project.error) return { error: Response.json({ error: project.error.message }, { status: 400 }) } as const;
  if (!project.data) return { error: Response.json({ error: "Component not found" }, { status: 404 }) } as const;
  try {
    const workspace = await loadSiteWorkspace(supabase, project.data.site_id, project.data.id);
    const component = workspace.project.components.find((candidate) => candidate.id === id);
    if (!component) return { error: Response.json({ error: "Component not found" }, { status: 404 }) } as const;
    const bundle = resolveComponentRegulatoryBundle({
      component,
      siteLocation: jurisdictionOverride?.trim() || workspace.site.location,
      siteLocationConfirmed: Boolean(jurisdictionOverride?.trim()) || workspace.site.locationConfirmed,
      relatedComponents: workspace.project.components,
      connections: workspace.project.connections,
    });
    return { supabase, userId, workspace, component, bundle } as const;
  } catch {
    return { error: Response.json({ error: "Component not found" }, { status: 404 }) } as const;
  }
}

async function cachedGuidance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  componentKind: string,
  subjectKey: string,
  jurisdictionKey: string,
) {
  const result = await supabase
    .from("component_regulatory_guidance")
    .select("guidance_markdown,citations,checked_at,refresh_after,jurisdiction_label")
    .eq("owner_id", userId)
    .eq("component_kind", componentKind)
    .eq("subject_key", subjectKey)
    .eq("jurisdiction_key", jurisdictionKey)
    .eq("topic_library_version", COMPONENT_REGULATORY_LIBRARY_VERSION)
    .maybeSingle();
  if (result.error && !missingTableCodes.has(result.error.code)) throw result.error;
  return result.data ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await contextForComponent(id, new URL(request.url).searchParams.get("jurisdiction"));
  if ("error" in context) return context.error;
  if (!context.bundle.jurisdiction.confirmed || !context.bundle.jurisdiction.label)
    return Response.json({ bundle: context.bundle, guidance: null });
  try {
    const guidance = await cachedGuidance(
      context.supabase,
      context.userId,
      context.component.kind,
      regulatorySubjectKey(context.component),
      regulatoryJurisdictionKey(context.bundle.jurisdiction.label),
    );
    return Response.json({ bundle: context.bundle, guidance });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load regulatory guidance" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await contextForComponent(id, new URL(request.url).searchParams.get("jurisdiction"));
  if ("error" in context) return context.error;
  const jurisdiction = context.bundle.jurisdiction.label;
  if (!context.bundle.jurisdiction.confirmed || !jurisdiction)
    return Response.json({ error: "Confirm this Site's location before loading jurisdiction-specific requirements.", bundle: context.bundle }, { status: 409 });
  const key = regulatoryJurisdictionKey(jurisdiction);
  const subjectKey = regulatorySubjectKey(context.component);
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "true";
  try {
    const cached = await cachedGuidance(context.supabase, context.userId, context.component.kind, subjectKey, key);
    if (!forceRefresh && cached && new Date(cached.refresh_after).getTime() > Date.now())
      return Response.json({ bundle: context.bundle, guidance: cached, cached: true });

    const relevantComponents = context.workspace.project.components
      .filter((candidate) => candidate.id !== context.component.id)
      .map((candidate) => ({ kind: candidate.kind, name: candidate.name, location: candidate.location, specs: candidate.specs }));
    const topicList = [...context.bundle.appliesHere, ...context.bundle.mayApply]
      .map((candidate) => ({ id: candidate.id, title: candidate.title, purpose: candidate.purpose }));
    const result = await askGemini({
      message: `Build the local Rules & requirements page for ${context.component.name}.\n\nConfirmed Site jurisdiction/location: ${jurisdiction}\nEquipment category: ${context.bundle.componentLabel} (${context.component.kind})\nApplication key: ${subjectKey}\nCanonical topics: ${JSON.stringify(topicList)}\nCurrent component record: ${JSON.stringify({ name: context.component.name, manufacturer: context.component.manufacturer, model: context.component.model, location: context.component.location, specs: context.component.specs })}\nRelated system equipment: ${JSON.stringify(relevantComponents)}\n\nThis must be a practical component-rules page, not an article. Use only rules for the confirmed Site jurisdiction and official primary authority/standards information. Never use another country's rule, a stock photograph, Wikimedia, retailer content or a generic tutorial as regulatory authority. For every rule, name the governing instrument and clause/section where a public official source supports it. If a paid standard controls a detail whose exact clause/value cannot be verified, name the standard but mark the detail as requiring access to that standard instead of inventing it. Explicitly cover the permitted component type/class and rating for this application; location, orientation, mounting and clearances; enclosure and environmental requirements; conductors, terminals and torque; and required companion isolation, protection, earthing and labels. Manufacturer torque and clearance values must come from the exact recorded model manual; if the make/model is missing, say no numeric value can yet be stated. Return concise Markdown under exactly these headings: "Type and rating", "Location and mounting", "Enclosure and environment", "Connections and torque", and "Related protection and isolation". Do not add inspection, paperwork or a sources section. Do not ask a follow-up question and do not propose or perform any record action.`,
      project: { ...context.workspace.project, location: jurisdiction },
      recentConversation: [],
      questionnaireContext: {
        regulatoryLibraryRefresh: true,
        selectedSite: { id: context.workspace.site.id, name: context.workspace.site.name, location: jurisdiction, locationConfirmed: true },
        canonicalRegulatoryBundle: context.bundle,
      },
      allowActions: false,
    });
    const checkedAt = new Date();
    const refreshAfter = new Date(checkedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const guidance = {
      owner_id: context.userId,
      component_kind: context.component.kind,
      subject_key: subjectKey,
      jurisdiction_key: key,
      jurisdiction_label: jurisdiction,
      topic_library_version: COMPONENT_REGULATORY_LIBRARY_VERSION,
      guidance_markdown: result.message,
      citations: result.citations,
      checked_at: checkedAt.toISOString(),
      refresh_after: refreshAfter.toISOString(),
      updated_at: checkedAt.toISOString(),
    };
    const saved = await context.supabase.from("component_regulatory_guidance").upsert(guidance, {
      onConflict: "owner_id,subject_key,jurisdiction_key,topic_library_version",
    });
    if (saved.error && !missingTableCodes.has(saved.error.code)) throw saved.error;
    return Response.json({
      bundle: context.bundle,
      guidance: {
        guidance_markdown: result.message,
        citations: result.citations,
        checked_at: checkedAt.toISOString(),
        refresh_after: refreshAfter.toISOString(),
        jurisdiction_label: jurisdiction,
      },
      cached: false,
      persisted: !saved.error,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not check current regulatory guidance" },
      { status: 502 },
    );
  }
}
