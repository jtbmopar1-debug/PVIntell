import { z } from "zod";
import { applyWattsonActions, type WattsonActionRequest } from "@/ai/actions";
import { createSystem } from "@/data/cloud-project";
import { newSystemQuestions, unknownAnswer, type DiscoveryAnswers } from "@/discovery/new-system";
import { createClient } from "@/lib/supabase/server";

const answersSchema = z.record(z.string(), z.union([z.string().max(4000), z.number(), z.array(z.string().max(100)).min(1).max(20)]));
const draftSchema = z.object({ answers: answersSchema, questionId: z.string().max(100).optional() });
const completeSchema = z.object({ answers: answersSchema });
const editSchema = z.object({ projectId: z.uuid(), answers: answersSchema });

function outcomeText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => outcomeText(item)).join("; ");
  return ({
    off_grid_supply: "Provide all required power where no public electricity supply is available",
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

function structuredPanelAnswer(value: string | number | string[] | undefined, kind: "dimensions" | "orientation" | "structure" | "obstructions") {
  if (typeof value !== "string" || value === unknownAnswer) return value;
  try {
    const rows = JSON.parse(value) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) return value;
    return rows.map((row) => {
      if (kind === "dimensions") return `${String(row.name || "Panel area")}: ${String(row.lengthM || "?")} m × ${String(row.widthM || "?")} m`;
      if (kind === "orientation") return `${String(row.name || "Panel area")}: ${String(row.direction || "unknown direction")}, ${String(row.slope || "unknown surface slope")}`;
      if (kind === "obstructions") return row.kind === "none" ? "No known obstructions" : `${String(row.kind || "obstruction").replaceAll("_", " ")}: ${String(row.lengthM || "?")} m × ${String(row.widthM || "?")} m`;
      return `${String(row.name || "Panel area")}: ${String(row.material || "unknown support")}, ${String(row.age || "unknown age")}, ${String(row.condition || "unknown condition")}`;
    }).join("; ");
  } catch { return value; }
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
    ["pool_or_spa", answers.pool_or_spa],
    ["pool_heating_method", answers.pool_heating_method],
    ["pool_heating_profile", answers.pool_heating_profile],
    ["everyday_needs", answers.everyday_needs],
    ["heavy_or_surge_loads", answers.heavy_loads],
    ["building_type", answers.building_type],
    ["property_authority", answers.property_authority],
    ["proposed_panel_location", answers.panel_location],
    ["storage_supply_source", answers.storage_supply_source_off_grid ?? answers.storage_supply_source_grid],
    ["panel_construction_interest", answers.panel_construction_interest],
    ["panel_area_dimensions", structuredPanelAnswer(answers.panel_area_dimensions, "dimensions")],
    ["panel_area_constraints", structuredPanelAnswer(answers.panel_area_constraints, "obstructions")],
    ["orientation_and_pitch", structuredPanelAnswer(answers.orientation_and_pitch, "orientation")],
    ["shading", answers.shading],
    ["structure_condition", structuredPanelAnswer(answers.structure_condition, "structure")],
    ["expected_expansion", answers.future_changes],
    ["delivery_approach", answers.delivery_approach],
    ["module_level_electronics", answers.module_level_electronics],
    ["module_electronics_compatibility", answers.module_electronics_compatibility],
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
  title = "Guided system discovery",
  context?: { siteId?: string; projectId?: string },
) {
  // Discovery starts a new piece of work. Do not append its handoff to a
  // previous Wattson conversation, even if that is the most recent one.
  const created = await supabase.from("user_conversations").insert({ owner_id: userId, title, site_id: context?.siteId ?? null, project_id: context?.projectId ?? null }).select("id").single();
  if (created.error) throw created.error;
  const conversationId = created.data.id;
  const message = await supabase.from("user_chat_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content,
    structured_context: structuredContext,
  });
  if (message.error) throw message.error;
  return conversationId;
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

export async function PATCH(request: Request) {
  const parsed = editSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid discovery answers" }, { status: 400 });
  const context = await accountContext();
  if ("error" in context) return context.error;
  const project = await context.supabase.from("projects").select("id,site_id").eq("id", parsed.data.projectId).eq("owner_id", context.userId).maybeSingle();
  if (project.error || !project.data) return Response.json({ error: "Power system not found." }, { status: 404 });
  const answers = parsed.data.answers as DiscoveryAnswers;
  await applyWattsonActions(context.supabase, project.data.id, discoveryActions(answers));
  const questionnaire = await context.supabase.from("questionnaire_responses").upsert({
    project_id: project.data.id,
    template_key: "guided_new_system",
    template_version: 1,
    status: "completed",
    answers,
    completed_at: new Date().toISOString(),
  }, { onConflict: "project_id,template_key" });
  if (questionnaire.error) return Response.json({ error: questionnaire.error.message }, { status: 400 });
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
    const conversationId = await addWattsonHandoff(
      context.supabase,
      context.userId,
      "I’ve saved your discovery answers. Before I create a working system, I need to explain and confirm the unanswered starting details with you. Nothing has been guessed.",
      { kind: "guided_discovery_review", missingFoundation, unknownIds },
      "Discovery — details to confirm",
    );
    return Response.json({ needsReview: true, reviewUrl: `/dashboard?conversation=${conversationId}#wattson` });
  }

  const existingSites = await context.supabase.from("sites").select("id,name").eq("owner_id", context.userId).order("created_at");
  if (existingSites.error) return Response.json({ error: existingSites.error.message }, { status: 400 });
  const requestedSiteId = typeof answers.site_id === "string" ? answers.site_id : "";
  const requestedSiteName = String(answers.site_name || "").trim();
  const selectedExistingSite = requestedSiteId && requestedSiteId !== "__new__"
    ? existingSites.data.find((site) => site.id === requestedSiteId)
    : undefined;
  if (requestedSiteId && requestedSiteId !== "__new__" && !selectedExistingSite) {
    return Response.json({ error: "The selected Site is no longer available. Please choose another Site." }, { status: 400 });
  }
  const matchingSite = selectedExistingSite ?? (!requestedSiteId
    ? existingSites.data.find((site) => site.name.trim().toLocaleLowerCase() === requestedSiteName.toLocaleLowerCase())
    : undefined);
  let siteId = matchingSite?.id;
  let createdSiteId: string | undefined;
  if (!siteId) {
    if (!requestedSiteName) return Response.json({ error: "Enter a name for the new Site." }, { status: 400 });
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
    // The one guided questionnaire is also the Site's brief. A Site can share
    // an address with another Site, but it never shares its discovery answers.
    const siteBrief = await context.supabase.from("site_discoveries").upsert({
      site_id: siteId,
      owner_id: context.userId,
      status: "completed",
      question_id: null,
      answers,
      baseline_answers: answers,
      impact_pending: false,
      completed_at: new Date().toISOString(),
    });
    if (siteBrief.error) throw siteBrief.error;
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
    const conversationId = await addWattsonHandoff(
      context.supabase,
      context.userId,
      firstUnknown
        ? `I’ve saved your discovery brief and opened a working design for ${systemName}. You marked ${unknownIds.length} item${unknownIds.length === 1 ? "" : "s"} as unknown. Let’s start with this one: ${firstUnknown.title}`
        : `I’ve saved your discovery brief and opened a working design for ${systemName}. No equipment has been treated as purchased or installed. Next, I’ll review the answers with you before we select or size anything.`,
      { kind: "guided_discovery_complete", siteId, systemId, unknownIds },
      `${systemName} — discovery review`,
      { siteId, projectId: systemId },
    );
    return Response.json({ siteId, systemId, reviewUrl: `/dashboard?site=${siteId}&conversation=${conversationId}#wattson` });
  } catch (problem) {
    if (createdSystemId) await context.supabase.from("projects").delete().eq("id", createdSystemId).eq("owner_id", context.userId);
    if (createdSiteId) await context.supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", context.userId);
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not create the discovery workspace" }, { status: 400 });
  }
}
