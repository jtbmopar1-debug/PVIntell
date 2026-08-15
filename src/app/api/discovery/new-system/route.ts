import { z } from "zod";
import { applyWattsonActions, type WattsonActionRequest } from "@/ai/actions";
import { createSystem } from "@/data/cloud-project";
import { newSystemQuestions, unknownAnswer, type DiscoveryAnswers } from "@/discovery/new-system";
import { createClient } from "@/lib/supabase/server";

const answersSchema = z.record(z.string(), z.union([z.string().max(4000), z.number(), z.array(z.string().max(100)).min(1).max(10)]));
const draftSchema = z.object({ answers: answersSchema, questionId: z.string().max(100).optional() });
const completeSchema = z.object({ answers: answersSchema });

function outcomeText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => outcomeText(item)).join("; ");
  return ({
    cost: "Reduce imported electricity and power costs",
    backup: "Keep essential loads running during outages",
    independence: "Become less dependent on public electricity",
    combination: "Reduce electricity use/cost and improve resilience",
  } as Record<string, string>)[String(value)] ?? "Design a suitable solar power system";
}

function projectType(answers: DiscoveryAnswers) {
  if (answers.utility_relationship === "off_grid") return "off-grid" as const;
  const outcomes = Array.isArray(answers.primary_outcome) ? answers.primary_outcome : [answers.primary_outcome];
  return outcomes.length === 1 && outcomes[0] === "cost" ? "grid-tied" as const : "hybrid" as const;
}

function discoveryActions(answers: DiscoveryAnswers): WattsonActionRequest[] {
  const mapped: Array<[string, string | number | string[] | undefined]> = [
    ["utility_relationship", answers.utility_relationship === "off_grid" ? "No public electricity supply" : "Connected to public electricity"],
    ["primary_outcome", outcomeText(answers.primary_outcome)],
    ["current_energy_use", typeof answers.current_energy_use === "number" ? `${answers.current_energy_use} kWh/month` : answers.current_energy_use],
    ["backup_preference", answers.backup_preference],
    ["outage_essential_loads", answers.outage_essential_loads],
    ["backup_duration", answers.backup_duration],
    ["cooking_energy", answers.cooking_energy],
    ["water_heating_energy", answers.water_heating_energy],
    ["space_heating_energy", answers.space_heating_energy],
    ["everyday_needs", answers.everyday_needs],
    ["heavy_or_surge_loads", answers.heavy_loads],
    ["building_type", answers.building_type],
    ["property_authority", answers.property_authority],
    ["proposed_panel_location", answers.panel_location],
    ["usable_solar_space", answers.usable_solar_space],
    ["panel_area_dimensions", answers.panel_area_dimensions],
    ["panel_area_constraints", answers.panel_area_constraints],
    ["orientation_and_pitch", answers.orientation_and_pitch],
    ["shading", answers.shading],
    ["structure_condition", answers.structure_condition],
    ["expected_expansion", answers.future_changes],
    ["delivery_approach", answers.delivery_approach],
  ];
  return mapped
    .filter(([, value]) => value !== undefined && value !== "" && value !== unknownAnswer)
    .map(([key, value]) => ({
      name: "record_design_discovery",
      arguments: { key, value: Array.isArray(value) ? value.join(", ") : String(value), confidence: "user_confirmed" },
    }));
}

async function accountContext() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const profile = await supabase.from("profiles").select("home_location,timezone,onboarding_assessment").eq("id", userId).single();
  if (profile.error) return { error: Response.json({ error: profile.error.message }, { status: 400 }) };
  return { supabase, userId, profile: profile.data };
}

async function addWattsonHandoff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  content: string,
  structuredContext: Record<string, unknown>,
) {
  const existing = await supabase.from("user_conversations").select("id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  let conversationId = existing.data?.id;
  if (!conversationId) {
    const created = await supabase.from("user_conversations").insert({ owner_id: userId, title: "Guided system discovery" }).select("id").single();
    if (created.error) throw created.error;
    conversationId = created.data.id;
  }
  const message = await supabase.from("user_chat_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content,
    structured_context: structuredContext,
  });
  if (message.error) throw message.error;
}

export async function PUT(request: Request) {
  const parsed = draftSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid discovery draft" }, { status: 400 });
  const context = await accountContext();
  if ("error" in context) return context.error;
  const assessment = (context.profile.onboarding_assessment ?? {}) as Record<string, unknown>;
  assessment.guidedNewSystem = {
    version: 1,
    status: "draft",
    questionId: parsed.data.questionId ?? null,
    answers: parsed.data.answers,
    updatedAt: new Date().toISOString(),
  };
  const saved = await context.supabase.from("profiles").update({ onboarding_assessment: assessment }).eq("id", context.userId);
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ saved: true });
}

export async function POST(request: Request) {
  const parsed = completeSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid discovery answers" }, { status: 400 });
  const answers = parsed.data.answers as DiscoveryAnswers;
  const context = await accountContext();
  if ("error" in context) return context.error;
  const unknownIds = newSystemQuestions
    .filter((question) => answers[question.id] === unknownAnswer)
    .map((question) => question.id);
  const missingFoundation = ["utility_relationship", "primary_outcome"].filter((key) => !answers[key] || answers[key] === unknownAnswer);

  if (missingFoundation.length) {
    const assessment = (context.profile.onboarding_assessment ?? {}) as Record<string, unknown>;
    assessment.guidedNewSystem = {
      version: 1,
      status: "review_needed",
      questionId: missingFoundation[0],
      answers,
      unknownIds,
      updatedAt: new Date().toISOString(),
    };
    const saved = await context.supabase.from("profiles").update({ onboarding_assessment: assessment }).eq("id", context.userId);
    if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
    await addWattsonHandoff(
      context.supabase,
      context.userId,
      "I’ve saved your discovery answers. Before I create a working system, I need to explain and confirm the unanswered starting details with you. Nothing has been guessed.",
      { kind: "guided_discovery_review", missingFoundation, unknownIds },
    );
    return Response.json({ needsReview: true, reviewUrl: "/dashboard#wattson" });
  }

  const existingSites = await context.supabase.from("sites").select("id,name").eq("owner_id", context.userId).order("created_at");
  if (existingSites.error) return Response.json({ error: existingSites.error.message }, { status: 400 });
  const requestedSiteName = String(answers.site_name || "Home").trim();
  const matchingSite = existingSites.data.find((site) => site.name.trim().toLocaleLowerCase() === requestedSiteName.toLocaleLowerCase());
  let siteId = matchingSite?.id;
  let createdSiteId: string | undefined;
  if (!siteId) {
    const created = await context.supabase.from("sites").insert({
      owner_id: context.userId,
      name: requestedSiteName,
      location: context.profile.home_location || null,
      timezone: context.profile.timezone || "UTC",
      location_source: "imported",
      location_confirmed: false,
    }).select("id").single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    siteId = created.data.id;
    createdSiteId = siteId;
  }

  let createdSystemId: string | undefined;
  try {
    const systemName = String(answers.system_name || "Home solar");
    const systemId = await createSystem(context.supabase, context.userId, siteId, systemName, projectType(answers), outcomeText(answers.primary_outcome));
    createdSystemId = systemId;
    await applyWattsonActions(context.supabase, systemId, discoveryActions(answers));
    const questionnaire = await context.supabase.from("questionnaire_responses").upsert({
      project_id: systemId,
      template_key: "guided_new_system",
      template_version: 1,
      status: "completed",
      answers,
      completed_at: new Date().toISOString(),
    }, { onConflict: "project_id,template_key" });
    if (questionnaire.error) throw questionnaire.error;
    const assessment = (context.profile.onboarding_assessment ?? {}) as Record<string, unknown>;
    delete assessment.guidedNewSystem;
    assessment.lastGuidedDiscovery = {
      version: 1,
      status: "completed",
      siteId,
      systemId,
      answers,
      unknownIds,
      completedAt: new Date().toISOString(),
    };
    const cleared = await context.supabase.from("profiles").update({ onboarding_assessment: assessment }).eq("id", context.userId);
    if (cleared.error) throw cleared.error;
    const firstUnknown = newSystemQuestions.find((question) => unknownIds.includes(question.id));
    await addWattsonHandoff(
      context.supabase,
      context.userId,
      firstUnknown
        ? `I’ve saved your discovery brief and opened a working design for ${systemName}. You marked ${unknownIds.length} item${unknownIds.length === 1 ? "" : "s"} as unknown. Let’s start with this one: ${firstUnknown.title}`
        : `I’ve saved your discovery brief and opened a working design for ${systemName}. No equipment has been treated as purchased or installed. Next, I’ll review the answers with you before we select or size anything.`,
      { kind: "guided_discovery_complete", siteId, systemId, unknownIds },
    );
    return Response.json({ siteId, systemId, reviewUrl: "/dashboard#wattson" });
  } catch (problem) {
    if (createdSystemId) await context.supabase.from("projects").delete().eq("id", createdSystemId).eq("owner_id", context.userId);
    if (createdSiteId) await context.supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", context.userId);
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not create the discovery workspace" }, { status: 400 });
  }
}
