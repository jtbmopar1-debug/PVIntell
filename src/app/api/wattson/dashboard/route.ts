import { z } from "zod";
import { applyWattsonActions, type AppliedWattsonAction, type WattsonActionRequest } from "@/ai/actions";
import { askGemini } from "@/ai/gemini";
import { confirmedPrimaryOutcome, confirmedUtilityRelationship, discoveryGuidance, nextRequiredDiscoveryQuestion, userExpressesUncertainty, workspaceProjectType } from "@/ai/discovery";
import type { Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import { createSystem } from "@/data/cloud-project";
import { newSystemQuestions } from "@/discovery/new-system";

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.uuid().optional(),
});
const workspaceActionSchema = z.object({
  place_name: z.string().trim().min(1).max(120),
  system_name: z.string().trim().min(1).max(120),
});

const questionToDiscoveryKey: Record<string, string> = {
  panel_location: "proposed_panel_location",
  heavy_loads: "heavy_or_surge_loads",
  future_changes: "expected_expansion",
};

function actionKeyForQuestion(questionId: string) {
  return questionToDiscoveryKey[questionId] ?? questionId;
}

function guidedQuestion(questionId: string) {
  const question = newSystemQuestions.find((item) => item.id === questionId);
  return question ? [actionKeyForQuestion(question.id), `${question.title} ${question.noviceHelp}`] as const : null;
}

function actionProjectId(action: WattsonActionRequest) {
  if (!action.arguments || typeof action.arguments !== "object") return undefined;
  const value = (action.arguments as Record<string, unknown>).project_id;
  return typeof value === "string" ? value : undefined;
}

function proposedArchitectureReply(actions: WattsonActionRequest[]) {
  const action = actions.find((item) => item.name === "record_design_preference");
  if (!action?.arguments || typeof action.arguments !== "object") return null;
  const architecture = (action.arguments as Record<string, unknown>).architecture;
  const equipment =
    architecture === "combined_hybrid_inverter"
      ? "a hybrid inverter"
      : architecture === "separate_solar_controller_and_inverter"
        ? "a separate solar charge controller and battery inverter"
        : architecture === "ac_coupled"
          ? "an AC-coupled inverter"
          : null;
  if (!equipment) return null;
  return `I’ve added ${equipment} to the proposed Design Calculator—it is not marked as purchased or installed and has not changed the overview or schematic. Next I’ll size the system from the recorded site, loads, resilience goal and future needs, with every estimate clearly marked.`;
}

function dashboardProject(location: string): Project {
  return {
    id: "dashboard",
    name: "PVIntell dashboard",
    description: "Synthetic dashboard transport context only. Ignore its project type, voltage, autonomy and empty equipment fields; use connectedSiteSystems and discovery records instead.",
    projectType: "off-grid",
    phase: "discover",
    location: location || "Location not set",
    goal: "Run the next incomplete discovery step without assuming a system type or equipment.",
    priorities: [],
    systemVoltage: 48,
    autonomyDays: 2,
    peakSunHours: 4,
    loads: [], assumptions: [], components: [], connections: [], schematicPositions: [], overviewCardOrder: [], pvArrays: [], installationSteps: [], commissioning: [],
  };
}

export async function POST(request: Request) {
  let candidate: unknown;
  let imageFile: File | undefined;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData();
    candidate = { message: form.get("message"), projectId: form.get("projectId") || undefined };
    const file = form.get("file");
    if (file instanceof File) imageFile = file;
  } else candidate = await request.json();
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) return Response.json({ error: "Enter a message for Wattson." }, { status: 400 });
  if (imageFile && (!new Set(["image/jpeg", "image/png", "image/webp"]).has(imageFile.type) || !imageFile.size || imageFile.size > 8 * 1024 * 1024))
    return Response.json({ error: "Use a JPEG, PNG or WebP image smaller than 8 MB." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [profile, sites, systems] = await Promise.all([
    supabase.from("profiles").select("display_name,home_location,timezone,onboarding_assessment").eq("id", userId).single(),
    supabase.from("sites").select("id,name,location,timezone,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,description,mode,phase,location,system_voltage,settings").eq("owner_id", userId).order("created_at"),
  ]);
  if (profile.error) return Response.json({ error: profile.error.message }, { status: 400 });
  if (sites.error) return Response.json({ error: sites.error.message }, { status: 400 });
  if (systems.error) return Response.json({ error: systems.error.message }, { status: 400 });
  const systemIds = (systems.data ?? []).map((system) => system.id);
  const siteIds = (sites.data ?? []).map((site) => site.id);
  const [components, pvStrings, connections, loads, assumptions, goals, siteEquipment] = await Promise.all([
    systemIds.length ? supabase.from("system_components").select("id,project_id,type,display_name,manufacturer,model,quantity,installation_location,serial_number,firmware_version,manual_url,specifications,notes,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("pv_arrays").select("id,project_id,name,manufacturer,panel_model,panel_type,supplier,purchased_on,installed_on,panel_watts,panel_count,strings,panels_per_string,orientation_degrees,tilt_degrees,cable_size_mm2,cable_length_m,connector_type,breaker_details,isolator_details,combiner_details,installation_notes,specifications,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("system_connections").select("id,project_id,source_ref,target_ref,name,connection_type,polarity,cable_size,cable_length,breaker_size,fuse_size,isolator,route,notes,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("loads").select("id,project_id,name,watts,quantity,hours_per_day,surge_watts,current_type,confidence,simultaneous").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("assumptions").select("id,project_id,label,value,reason,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("project_goals").select("id,project_id,text,priority").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    siteIds.length ? supabase.from("site_equipment").select("id,site_id,assigned_project_id,type,name,manufacturer,model,quantity,condition,status,specifications,notes").in("site_id", siteIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const detailError = components.error ?? pvStrings.error ?? connections.error ?? loads.error ?? assumptions.error ?? goals.error ?? siteEquipment.error;
  if (detailError) return Response.json({ error: detailError.message }, { status: 400 });
  const connectedSystems = (systems.data ?? []).map((system) => ({
    ...system,
    site: (sites.data ?? []).find((site) => site.id === system.site_id),
    components: (components.data ?? []).filter((item) => item.project_id === system.id),
    pvStrings: (pvStrings.data ?? []).filter((item) => item.project_id === system.id),
    connections: (connections.data ?? []).filter((item) => item.project_id === system.id),
    loads: (loads.data ?? []).filter((item) => item.project_id === system.id),
    assumptions: (assumptions.data ?? []).filter((item) => item.project_id === system.id),
    goals: (goals.data ?? []).filter((item) => item.project_id === system.id),
  }));
  let image: { data: string; mimeType: string } | undefined;
  let imagePath: string | undefined;
  if (imageFile) {
    if (parsed.data.projectId && !systemIds.includes(parsed.data.projectId))
      return Response.json({ error: "Power system not found." }, { status: 404 });
    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    image = { data: Buffer.from(bytes).toString("base64"), mimeType: imageFile.type };
    const extension = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
    const imageScope = parsed.data.projectId ?? "dashboard";
    imagePath = `${userId}/${imageScope}/wattson/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage.from("project-photos").upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploaded.error) return Response.json({ error: `Wattson could not store the image: ${uploaded.error.message}` }, { status: 400 });
  }
  let conversation = await supabase.from("user_conversations").select("id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (conversation.error) return Response.json({ error: conversation.error.message }, { status: 400 });
  if (!conversation.data) {
    const created = await supabase.from("user_conversations").insert({ owner_id: userId }).select("id").single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    conversation = { ...conversation, data: created.data };
  }
  const conversationId = conversation.data?.id;
  if (!conversationId) return Response.json({ error: "Could not open Wattson conversation." }, { status: 500 });
  const userContent = imageFile
    ? `${parsed.data.message}\n\n[Attached image: ${imageFile.name}]`
    : parsed.data.message;
  const inserted = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "user", content: userContent, structured_context: imagePath ? { imagePath } : {} });
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 400 });
  const recent = await supabase.from("user_chat_messages").select("role,content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(12);
  const history = (recent.data ?? []).reverse();
  const prior = history.at(-1)?.content === userContent ? history.slice(0, -1) : history;
  try {
    const result = await askGemini({
      message: parsed.data.message,
      project: dashboardProject(profile.data.home_location ?? ""),
      recentConversation: prior,
      questionnaireContext: {
        userAssessment: profile.data.onboarding_assessment ?? {},
        userTimezone: profile.data.timezone,
        sites: (sites.data ?? []).map((site) => ({ ...site, unassignedEquipment: (siteEquipment.data ?? []).filter((item) => item.site_id === site.id && !item.assigned_project_id) })),
        connectedSiteSystems: connectedSystems,
        scope: "This dashboard context contains the user's complete recorded component, PV string, load, assumption and connection records across their systems. Use those records when answering. Do not say technical records are unavailable merely because the synthetic dashboard project is empty. You may update a structured record after a clear user correction or confirmation. Every dashboard action must include the exact project_id from connectedSiteSystems. If the system or target is unclear, ask one focused question instead of taking an action.",
      },
      image,
      allowActions: true,
    });
    const ownedSystemIds = new Set(systemIds);
    const appliedActions: AppliedWattsonAction[] = [];
    const workspaceAction = result.actions.find((action) => action.name === "create_power_system_workspace");
    const utilityRelationship = confirmedUtilityRelationship(prior, parsed.data.message);
    const primaryOutcome = confirmedPrimaryOutcome(prior, parsed.data.message);
    const workspaceReady = utilityRelationship === "off_grid" || (utilityRelationship === "grid_connected" && Boolean(primaryOutcome));
    const prematureWorkspace = !systemIds.length && Boolean(workspaceAction) && !workspaceReady;
    if (!systemIds.length && workspaceReady && utilityRelationship) {
      const workspace = workspaceActionSchema.safeParse(workspaceAction?.arguments);
      const placeName = workspace.success ? workspace.data.place_name : "Home";
      const systemName = workspace.success ? workspace.data.system_name : "Home solar";
      const existingSite = (sites.data ?? [])[0];
      let siteId = existingSite?.id;
      let createdSiteId: string | undefined;
      if (!siteId) {
        const createdSite = await supabase.from("sites").insert({
          owner_id: userId,
          name: placeName,
          location: profile.data.home_location || null,
          timezone: profile.data.timezone || "UTC",
          location_source: "imported",
          location_confirmed: false,
        }).select("id").single();
        if (createdSite.error) throw createdSite.error;
        siteId = createdSite.data.id;
        createdSiteId = siteId;
      }
      try {
        const projectId = await createSystem(
          supabase,
          userId,
          siteId,
          systemName,
          workspaceProjectType(utilityRelationship, primaryOutcome),
          primaryOutcome ?? "Design a self-sufficient solar power system",
        );
        ownedSystemIds.add(projectId);
        appliedActions.push({ type: "workspace_created", summary: `Created ${systemName} at ${placeName}` });
        appliedActions.push(...(await applyWattsonActions(supabase, projectId, [
          { name: "record_design_discovery", arguments: { key: "utility_relationship", value: utilityRelationship === "off_grid" ? "No public electricity supply" : "Connected to public electricity", confidence: "user_confirmed" } },
          ...(primaryOutcome ? [{ name: "record_design_discovery", arguments: { key: "primary_outcome", value: primaryOutcome, confidence: "user_confirmed" } }] : []),
        ])));
      } catch (problem) {
        if (createdSiteId) await supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", userId);
        throw problem;
      }
    }
    const actionsBySystem = new Map<string, WattsonActionRequest[]>();
    for (const action of result.actions) {
      const projectId = actionProjectId(action);
      if (!projectId || !ownedSystemIds.has(projectId)) continue;
      actionsBySystem.set(projectId, [...(actionsBySystem.get(projectId) ?? []), action]);
    }
    let blockedArchitectureQuestion: string | undefined;
    let discoveryFollowup: string | undefined;
    const activeSystem = connectedSystems.find((item) => item.id === parsed.data.projectId)
      ?? (connectedSystems.length === 1 ? connectedSystems[0] : undefined);
    const assessment = (profile.data.onboarding_assessment ?? {}) as Record<string, unknown>;
    const guidedReview = assessment.lastGuidedDiscovery && typeof assessment.lastGuidedDiscovery === "object"
      ? assessment.lastGuidedDiscovery as Record<string, unknown>
      : undefined;
    const activeSettings = activeSystem?.settings && typeof activeSystem.settings === "object"
      ? activeSystem.settings as Record<string, unknown>
      : {};
    const recordedDiscovery = activeSettings.designDiscovery && typeof activeSettings.designDiscovery === "object"
      ? activeSettings.designDiscovery as Record<string, unknown>
      : {};
    let guidedUnknownIds = guidedReview && guidedReview.systemId === activeSystem?.id && Array.isArray(guidedReview.unknownIds)
      ? guidedReview.unknownIds.filter((value): value is string => typeof value === "string")
        .filter((questionId) => !Object.hasOwn(recordedDiscovery, actionKeyForQuestion(questionId)))
      : [];
    const guidedAnswers = guidedReview?.answers && typeof guidedReview.answers === "object"
      ? guidedReview.answers as Record<string, unknown>
      : {};
    if (guidedReview && guidedReview.systemId === activeSystem?.id) {
      for (const questionId of ["panel_area_dimensions", "panel_area_constraints", "orientation_and_pitch", "cooking_energy", "water_heating_energy", "space_heating_energy", "delivery_approach"]) {
        if (!Object.hasOwn(guidedAnswers, questionId) && !Object.hasOwn(recordedDiscovery, questionId) && !guidedUnknownIds.includes(questionId)) guidedUnknownIds.push(questionId);
      }
    }
    const activeDiscovery = guidedQuestion(guidedUnknownIds[0]) ?? nextRequiredDiscoveryQuestion(activeSystem?.settings);
    const userUncertain = userExpressesUncertainty(parsed.data.message);
    const resolvedGuidedIds = new Set<string>();
    for (const [projectId, actions] of actionsBySystem) {
      const system = connectedSystems.find((item) => item.id === projectId);
      const nextDiscovery = nextRequiredDiscoveryQuestion(system?.settings, actions);
      if (!userUncertain && actions.some((action) => action.name === "record_design_discovery"))
        discoveryFollowup = nextDiscovery?.[1];
      const safeActions = actions.filter((action) => {
        if (action.name === "record_design_discovery" && userUncertain) return false;
        if (action.name !== "record_design_preference" || !nextDiscovery) return true;
        blockedArchitectureQuestion = nextDiscovery[1];
        return false;
      });
      for (const action of safeActions) {
        if (action.name === "record_design_discovery" && action.arguments && typeof action.arguments === "object") {
          const key = (action.arguments as Record<string, unknown>).key;
          if (typeof key === "string") {
            for (const questionId of guidedUnknownIds) if (actionKeyForQuestion(questionId) === key) resolvedGuidedIds.add(questionId);
          }
        }
        if (action.name === "record_design_preference") resolvedGuidedIds.add("architecture_preference");
        if (action.name === "update_project_settings") resolvedGuidedIds.add("system_name");
      }
      appliedActions.push(...(await applyWattsonActions(supabase, projectId, safeActions)));
    }
    if (guidedReview && guidedReview.systemId === activeSystem?.id) {
      guidedUnknownIds = guidedUnknownIds.filter((questionId) => !resolvedGuidedIds.has(questionId));
      guidedReview.unknownIds = guidedUnknownIds;
      assessment.lastGuidedDiscovery = guidedReview;
      const reviewSaved = await supabase.from("profiles").update({ onboarding_assessment: assessment }).eq("id", userId);
      if (reviewSaved.error) throw reviewSaved.error;
      if (appliedActions.some((action) => action.type === "design_discovery_updated")) {
        const nextGuided = guidedQuestion(guidedUnknownIds[0]);
        if (nextGuided) discoveryFollowup = nextGuided[1];
      }
    }
    let updateSummary = appliedActions.map((action) => action.summary).join("; ");
    let autonomousContinuation: string | undefined;
    if (activeSystem && !guidedUnknownIds.length && !discoveryFollowup && !blockedArchitectureQuestion && appliedActions.some((action) => action.type === "design_discovery_updated" || action.type === "design_preference_updated")) {
      const refreshed = await supabase.from("projects").select("settings").eq("id", activeSystem.id).single();
      if (refreshed.error) throw refreshed.error;
      const continuation = await askGemini({
        message: `The user just answered: ${parsed.data.message}\nSaved in PVIntell: ${updateSummary}. Continue leading this new user now. Do not merely announce that discovery is complete and do not ask permission to continue. Respect the recorded DIY, shared-work or turnkey delivery choice. Do not assume a fully professional installation. Design from the site, loads, resilience goal and future needs—not from a budget. If enough information exists, create an evidence-led staged proposal with record_preliminary_design so it appears in the Design Calculator. Do not add proposed items to the installed overview or schematic. Clearly distinguish estimates from confirmed facts, explain the immediate next step, and end with exactly one focused question. If physical panel fit is not proven from usable dimensions, obstructions, clearances and panel dimensions, mark it unverified. Keep the response under 180 words.`,
        project: dashboardProject(profile.data.home_location ?? ""),
        recentConversation: prior,
        questionnaireContext: {
          userAssessment: assessment,
          userTimezone: profile.data.timezone,
          sites: sites.data ?? [],
          connectedSiteSystems: connectedSystems.map((system) => system.id === activeSystem.id ? { ...system, settings: refreshed.data.settings } : system),
          scope: "Lead the user from completed discovery into a practical preliminary design. Use record_preliminary_design only for proposed sizing. The Design Calculator is separate from the user-managed installed overview and schematic.",
        },
        allowActions: true,
      });
      const proposalActions = continuation.actions.filter((action) =>
        action.name === "record_preliminary_design" && actionProjectId(action) === activeSystem.id,
      );
      if (proposalActions.length) {
        appliedActions.push(...(await applyWattsonActions(supabase, activeSystem.id, proposalActions)));
        updateSummary = appliedActions.map((action) => action.summary).join("; ");
      }
      autonomousContinuation = continuation.message.trim() || undefined;
    }
    let message = autonomousContinuation ?? result.message.trim();
    if (!systemIds.length && !utilityRelationship)
      message = "Before I create the working design, is this house already connected to public electricity, or would solar need to supply all of its power without the grid?";
    else if (!systemIds.length && utilityRelationship === "grid_connected" && !primaryOutcome)
      message = "What matters most for this house: lowering electricity bills, keeping essential items running during outages, becoming less dependent on the grid, or a combination?";
    if (prematureWorkspace)
      message = utilityRelationship === "grid_connected"
        ? "What matters most for this house: lowering electricity bills, keeping essential items running during outages, becoming less dependent on the grid, or a combination?"
        : "Before I create the working design, is this house already connected to public electricity, or would solar need to supply all of its power without the grid?";
    const createdWorkspace = appliedActions.find((action) => action.type === "workspace_created");
    const architectureReply = appliedActions.some((action) => action.type === "design_preference_updated")
      ? proposedArchitectureReply(result.actions)
      : null;
    const discoveryReply = appliedActions.some((action) => action.type === "design_discovery_updated")
      ? discoveryFollowup
        ? `I’ve added that to the design discovery notes. ${discoveryFollowup}`
        : "I’ve added that to the design discovery notes. The basic energy and site discovery is now complete."
      : null;
    if (createdWorkspace)
      message = utilityRelationship === "off_grid"
        ? "I’ve opened a working design for this system, but I haven’t selected any equipment. What appliances, lights, pumps or tools must it be able to run?"
        : "I’ve opened a working design for this system, but I haven’t selected any equipment. Do you have a recent electricity bill showing your monthly or annual kWh use? You can type the figure or attach a clear photo.";
    if (blockedArchitectureQuestion)
      message = `We’re still in discovery, so I haven’t added an inverter arrangement yet. ${blockedArchitectureQuestion}`;
    if (userUncertain && activeDiscovery)
      message = `No problem—I haven’t saved that as an answer. ${discoveryGuidance(activeDiscovery[0])}`;
    if (guidedUnknownIds.length && !appliedActions.length && /\b(?:other|next|missed|continue|what now)\b/i.test(parsed.data.message)) {
      const nextGuided = guidedQuestion(guidedUnknownIds[0]);
      if (nextGuided) message = `You’re right—there ${guidedUnknownIds.length === 1 ? "is" : "are"} still ${guidedUnknownIds.length} unresolved item${guidedUnknownIds.length === 1 ? "" : "s"}. ${nextGuided[1]}`;
    }
    if (!guidedUnknownIds.length && activeDiscovery && !appliedActions.length && /\b(?:next|continue|what now)\b/i.test(parsed.data.message)) {
      message = `Here’s the next step: ${activeDiscovery[1]}`;
    }
    if (!message && architectureReply) message = architectureReply;
    if (!message && discoveryReply) message = discoveryReply;
    if (updateSummary && !createdWorkspace && message !== architectureReply && message !== discoveryReply)
      message = message
        ? `${message}\n\nUpdated in PVIntell: ${updateSummary}.`
        : `Done — ${updateSummary}.`;
    if (!message)
      message = result.actions.length
        ? "I couldn’t safely attach that change to a specific system. Tell me which system it belongs to."
        : "I didn’t produce a useful reply. Please send that once more.";
    const saved = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: message, structured_context: { provider: "gemini", model: result.model, citations: result.citations, usage: result.usage, actions: appliedActions, imagePath } });
    if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
    return Response.json({ message, citations: result.citations, actions: appliedActions });
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Wattson is unavailable." }, { status: 502 });
  }
}
