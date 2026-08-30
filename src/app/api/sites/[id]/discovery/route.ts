import { z } from "zod";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { createClient } from "@/lib/supabase/server";

const answersSchema = z.record(z.string(), z.union([z.string().max(4000), z.number(), z.array(z.string().max(100)).min(1).max(20)]));
const draftSchema = z.object({ answers: answersSchema, questionId: z.string().max(100).optional() });
const completeSchema = z.object({ answers: answersSchema });

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
  const systems = await context.supabase.from("projects").select("id").eq("site_id", id);
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
  const conversation = await context.supabase.from("user_conversations").insert({
    owner_id: context.userId,
    site_id: id,
    title: "Site discovery review",
  }).select("id").single();
  if (conversation.error) return Response.json({ error: conversation.error.message }, { status: 400 });
  const handoff = await context.supabase.from("user_chat_messages").insert({
    conversation_id: conversation.data.id,
    role: "assistant",
    content: changed
      ? "I’ve saved the updated Site discovery brief. The proposed designs at this Site are flagged for review; let’s work through what changed and what that affects."
      : "I’ve saved this Site discovery brief. Let’s review the answers, fill any gaps, and turn them into the next design steps.",
    structured_context: { kind: "site_discovery_review", siteId: id, affectedDesigns: changed ? systems.data.length : 0 },
  });
  if (handoff.error) return Response.json({ error: handoff.error.message }, { status: 400 });
  return Response.json({ saved: true, affectedDesigns: changed ? systems.data.length : 0, reviewUrl: `/dashboard?site=${id}&conversation=${conversation.data.id}#wattson` });
}
