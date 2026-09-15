import { z } from "zod";
import { askGemini } from "@/ai/gemini";
import type { ComponentSpec, Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import {
  COMPONENT_REGULATORY_LIBRARY_VERSION,
  componentKindForGuide,
  regulatoryJurisdictionKey,
  resolveComponentRegulatoryBundle,
} from "@/regulations/component-regulatory-library";

const guideSchema = z.object({
  title: z.string().trim().min(1).max(180),
  group: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(1000),
  before: z.array(z.string().max(500)).max(30).default([]),
  steps: z.array(z.string().max(500)).max(40).default([]),
  checks: z.array(z.string().max(500)).max(30).default([]),
});
const missingTableCodes = new Set(["42P01", "PGRST205"]);

async function baseContext(request: Request, guideId: string, includeBody: boolean) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const siteId = new URL(request.url).searchParams.get("site");
  if (!siteId) return { error: Response.json({ error: "A Site is required" }, { status: 400 }) } as const;
  const site = await supabase.from("sites").select("id,name,location,location_confirmed").eq("id", siteId).eq("owner_id", userId).maybeSingle();
  if (site.error) return { error: Response.json({ error: site.error.message }, { status: 400 }) } as const;
  if (!site.data) return { error: Response.json({ error: "Site not found" }, { status: 404 }) } as const;
  let guide: z.infer<typeof guideSchema> | undefined;
  if (includeBody) {
    const parsed = guideSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return { error: Response.json({ error: "Invalid component-library guide" }, { status: 400 }) } as const;
    guide = parsed.data;
  }
  const jurisdiction = new URL(request.url).searchParams.get("jurisdiction")?.trim();
  return { supabase, userId, site: jurisdiction ? { ...site.data, location: jurisdiction, location_confirmed: true } : site.data, guideId: guideId.slice(0, 160), guide } as const;
}

function pseudoComponent(guideId: string, guide: z.infer<typeof guideSchema>): ComponentSpec {
  const kind = componentKindForGuide({ id: guideId, group: guide.group, title: guide.title });
  return {
    id: guideId,
    kind,
    name: guide.title,
    quantity: 1,
    status: "confirmed",
    specs: {
      "Application summary": guide.summary,
      "Installation subject": guide.group,
    },
  };
}

async function getCached({
  supabase,
  userId,
  subjectKey,
  jurisdictionKey,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  subjectKey: string;
  jurisdictionKey: string;
}) {
  const result = await supabase.from("component_regulatory_guidance")
    .select("guidance_markdown,citations,checked_at,refresh_after,jurisdiction_label")
    .eq("owner_id", userId)
    .eq("subject_key", subjectKey)
    .eq("jurisdiction_key", jurisdictionKey)
    .eq("topic_library_version", COMPONENT_REGULATORY_LIBRARY_VERSION)
    .maybeSingle();
  if (result.error && !missingTableCodes.has(result.error.code)) throw result.error;
  return result.data ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  const { guideId } = await params;
  const context = await baseContext(request, guideId, false);
  if ("error" in context) return context.error;
  if (!context.site.location_confirmed || !context.site.location)
    return Response.json({ guidance: null });
  try {
    const guidance = await getCached({
      supabase: context.supabase,
      userId: context.userId,
      subjectKey: `guide:${context.guideId}`,
      jurisdictionKey: regulatoryJurisdictionKey(context.site.location),
    });
    return Response.json({ guidance });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load component rules" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  const { guideId } = await params;
  const context = await baseContext(request, guideId, true);
  if ("error" in context) return context.error;
  if (!context.guide) return Response.json({ error: "Invalid component-library guide" }, { status: 400 });
  if (!context.site.location_confirmed || !context.site.location)
    return Response.json({ error: "Confirm this Site's location before loading local component rules." }, { status: 409 });
  const component = pseudoComponent(context.guideId, context.guide);
  const bundle = resolveComponentRegulatoryBundle({ component, siteLocation: context.site.location, siteLocationConfirmed: true });
  const jurisdictionKey = regulatoryJurisdictionKey(context.site.location);
  const subjectKey = `guide:${context.guideId}`;
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "true";
  try {
    const cached = await getCached({ supabase: context.supabase, userId: context.userId, subjectKey, jurisdictionKey });
    if (!forceRefresh && cached && new Date(cached.refresh_after).getTime() > Date.now())
      return Response.json({ bundle, guidance: cached, cached: true });

    const topics = [...bundle.appliesHere, ...bundle.mayApply].map(({ id, title, purpose }) => ({ id, title, purpose }));
    const project: Project = {
      id: "00000000-0000-0000-0000-000000000000",
      siteId: context.site.id,
      name: `${context.site.name} component rules`,
      description: context.guide.summary,
      projectType: "off-grid",
      phase: "explain",
      location: context.site.location,
      goal: "Explain the local rules for a component application",
      priorities: [],
      systemVoltage: 0,
      autonomyDays: 0,
      peakSunHours: 0,
      loads: [], assumptions: [], components: [component], connections: [], schematicPositions: [], overviewCardOrder: [], pvArrays: [], installationSteps: [], commissioning: [],
    };
    const applicationQuestions = /\b(?:underground|buried|trench)\b/i.test(`${context.guideId} ${context.guide.title} ${context.guide.summary}`)
      ? "Explicitly answer: when conduit is required or optional; which cable types may be directly buried; minimum cover/depth for each relevant route condition; bedding; warning tape, tiles or slabs; mechanical protection; separation and crossings with other services; joints, draw points, entries and as-built marking. Distinguish each condition instead of giving one universal depth."
      : "Explicitly cover: permitted component type/class and rating for the application; mounting position and clearances; enclosure and environmental rating; conductors, terminals and required torque source; related isolation, protection, earthing and labels. Omit a category only when it genuinely cannot apply and say why.";
    const result = await askGemini({
      message: `Build the local Rules & requirements page for the component-library subject below.\n\nConfirmed Site jurisdiction: ${context.site.location}\nLibrary subject: ${JSON.stringify(context.guide)}\nComponent category: ${component.kind}\nCanonical topics: ${JSON.stringify(topics)}\n\n${applicationQuestions}\n\nThis must be a practical rules page, not an article. For every rule, name the governing New Zealand or other confirmed-jurisdiction instrument and clause/section where the public official source supports it; if a paid standard controls a detail whose clause text cannot be verified, name the standard but mark the exact clause/value as requiring access to that standard. Never use another country's rule, a stock photograph, Wikimedia, a retailer blog or generic tutorial as regulatory authority. Manufacturer torque values must come from the exact product manual; if no make/model is selected, say that no numeric torque can yet be stated. Use concise Markdown grouped under "Type and rating", "Location and mounting", "Enclosure and environment", "Connections and torque", and "Related protection and isolation". Do not add inspection, paperwork or a sources section. Do not ask a question.`,
      project,
      recentConversation: [],
      questionnaireContext: { regulatoryLibraryRefresh: true, selectedSite: { ...context.site, locationConfirmed: true }, canonicalRegulatoryBundle: bundle },
      allowActions: false,
    });
    const checkedAt = new Date();
    const refreshAfter = new Date(checkedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const row = {
      owner_id: context.userId,
      component_kind: component.kind,
      subject_key: subjectKey,
      jurisdiction_key: jurisdictionKey,
      jurisdiction_label: context.site.location,
      topic_library_version: COMPONENT_REGULATORY_LIBRARY_VERSION,
      guidance_markdown: result.message,
      citations: result.citations,
      checked_at: checkedAt.toISOString(),
      refresh_after: refreshAfter.toISOString(),
      updated_at: checkedAt.toISOString(),
    };
    const saved = await context.supabase.from("component_regulatory_guidance").upsert(row, { onConflict: "owner_id,subject_key,jurisdiction_key,topic_library_version" });
    if (saved.error && !missingTableCodes.has(saved.error.code)) throw saved.error;
    return Response.json({ bundle, guidance: { guidance_markdown: result.message, citations: result.citations, checked_at: row.checked_at, refresh_after: row.refresh_after, jurisdiction_label: row.jurisdiction_label }, cached: false, persisted: !saved.error });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not check the local component rules" }, { status: 502 });
  }
}
