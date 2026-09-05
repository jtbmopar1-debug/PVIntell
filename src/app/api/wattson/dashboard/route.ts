import { z } from "zod";
import { applyWattsonActions, type AppliedWattsonAction, type WattsonActionRequest } from "@/ai/actions";
import { askGemini } from "@/ai/gemini";
import { discoveryGuidance, nextRequiredDiscoveryQuestion, userExpressesUncertainty } from "@/ai/discovery";
import type { Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import { newSystemQuestions } from "@/discovery/new-system";
import { captureSiteInventoryFromLabel, type InventoryPhotoCapture } from "@/ai/inventory-from-label";
import { conversationTitle, userConversationCount, WATTSON_CONVERSATION_LIMIT } from "@/ai/conversation-limit";

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.uuid().optional(),
  siteId: z.uuid().optional(),
  conversationId: z.uuid().optional(),
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

function newBuildingDescription(message: string) {
  if (!/\b(?:new|not yet built|being built|under construction)\b/i.test(message)) return null;
  const match = message.match(/\b(shed|workshop|garage|cabin|tiny home|house|home|building)\b/i);
  if (!match) return null;
  const label = match[1].toLowerCase();
  return `New ${label}; no existing electricity-use history`;
}

function completedSystemIntent(message: string) {
  return (
    /\b(?:completed|commissioned|already\s+(?:installed|built|operating|running|working)|in\s+place)\b/i.test(message) &&
    /\b(?:not\s+looking\s+to\s+(?:build|design)|not\s+(?:building|designing)|working\s+(?:very\s+)?well|monitor|as[- ]built|commissioned)\b/i.test(message)
  );
}

function systemNameFromBuilding(description: string) {
  const value = description.split(";")[0].replace(/^New\s+/i, "").trim();
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function answerMatchesDiscovery(key: string, message: string) {
  const patterns: Record<string, RegExp> = {
    current_energy_use: /\b(?:kwh|kilowatt|bill|usage|consumption|unpowered|no (?:existing )?(?:use|power|history)|new (?:shed|building|home|house|workshop))\b/i,
    everyday_needs: /\b(?:light|outlet|socket|tool|pump|fridge|freezer|refriger|appliance|equipment|machine|computer|charger)\w*\b/i,
    cooking_energy: /\b(?:no cooking|cook|oven|cooktop|induction|lpg|gas|wood|microwave|none)\b/i,
    water_heating_energy: /\b(?:no (?:hot )?water|water heat|cylinder|instant electric|heat pump|lpg|gas|solar hot|wetback|none)\b/i,
    space_heating_energy: /\b(?:no heat|heat pump|heater|heating|wood|fire|lpg|gas|boiler|none)\b/i,
    heavy_or_surge_loads: /\b(?:tool|pump|welder|compressor|motor|saw|oven|heater|ev|charger|none|nothing)\w*\b/i,
    building_type: /\b(?:house|home|townhouse|apartment|unit|shed|workshop|garage|farm|cabin|building)\b/i,
    property_authority: /\b(?:own|owner|rent|renter|landlord|body corporate|shared|permission|approval)\b/i,
    proposed_panel_location: /\b(?:roof|ground|frame|shed|garage|carport|wall|unsure|don'?t know)\b/i,
    delivery_approach: /\b(?:diy|myself|shared|trade|installer|turnkey|contractor)\b/i,
  };
  return patterns[key]?.test(message) ?? false;
}

function discoveryKeyFromAssistantQuestion(message: string | undefined) {
  if (!message) return null;
  const patterns: Array<[string, RegExp]> = [
    ["current_energy_use", /\b(?:existing|current) electricity use|recent bill|monitoring total/i],
    ["everyday_needs", /\bwhat should it power day to day|what .* intend to run/i],
    ["cooking_energy", /\bhow is cooking done|cooking method/i],
    ["water_heating_energy", /\bhow is water heated|water heating/i],
    ["space_heating_energy", /\bhow is .* heated|any heating/i],
    ["heavy_or_surge_loads", /\blargest appliances|larger tools|run at the same time/i],
    ["building_type", /\bwhat kind of building|building or property/i],
    ["property_authority", /\bdo you own|rent it|landlord|body corporate/i],
    ["proposed_panel_location", /\bwhere might panels fit|panel location/i],
  ];
  return patterns.find(([, pattern]) => pattern.test(message))?.[0] ?? null;
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
  return `I’ve added ${equipment} to the proposed Design Calculator. It is proposed only—not purchased or installed—and the overview and schematic are unchanged. Next I need the largest load: look for a small rating label or sticker on the compressor or welder and send a clear photo; it usually shows watts (W), kilowatts (kW), amps (A), or a model number. If you cannot find it, tell me the make/model or simply say “I don’t know” and I’ll show you another way to estimate it.`;
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
    goal: "Answer the user's general question, using the selected Site and its recorded systems when that context is relevant.",
    priorities: [],
    systemVoltage: 0,
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
    candidate = { message: form.get("message"), projectId: form.get("projectId") || undefined, siteId: form.get("siteId") || undefined, conversationId: form.get("conversationId") || undefined };
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
  const [profile, sites, systems, siteDiscoveries, selectedConversation] = await Promise.all([
    supabase.from("profiles").select("display_name,home_location,timezone,onboarding_assessment").eq("id", userId).single(),
    supabase.from("sites").select("id,name,location,timezone,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,description,mode,phase,location,system_voltage,settings,map_latitude,map_longitude,location_mode,map_location_updated_at").eq("owner_id", userId).order("created_at"),
    supabase.from("site_discoveries").select("site_id,status,answers,baseline_answers,impact_pending").eq("owner_id", userId),
    parsed.data.conversationId ? supabase.from("user_conversations").select("id,site_id,project_id").eq("id", parsed.data.conversationId).eq("owner_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (profile.error) return Response.json({ error: profile.error.message }, { status: 400 });
  if (sites.error) return Response.json({ error: sites.error.message }, { status: 400 });
  if (systems.error) return Response.json({ error: systems.error.message }, { status: 400 });
  if (siteDiscoveries.error || selectedConversation.error) return Response.json({ error: siteDiscoveries.error?.message ?? selectedConversation.error?.message ?? "Could not load discovery context." }, { status: 400 });
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
  const conversationSiteId = parsed.data.siteId ?? selectedConversation.data?.site_id;
  const selectedSiteBrief = (siteDiscoveries.data ?? []).find((item) => item.site_id === conversationSiteId && item.status === "completed");
  let image: { data: string; mimeType: string } | undefined;
  let imageBytes: Uint8Array | undefined;
  let imagePath: string | undefined;
  if (imageFile) {
    if (parsed.data.projectId && !systemIds.includes(parsed.data.projectId))
      return Response.json({ error: "Power system not found." }, { status: 404 });
    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    imageBytes = bytes;
    image = { data: Buffer.from(bytes).toString("base64"), mimeType: imageFile.type };
    const extension = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
    const imageScope = parsed.data.projectId ?? "dashboard";
    imagePath = `${userId}/${imageScope}/wattson/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage.from("project-photos").upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploaded.error) return Response.json({ error: `Wattson could not store the image: ${uploaded.error.message}` }, { status: 400 });
  }
  const inventorySiteId = conversationSiteId ?? (systems.data ?? []).find((system) => system.id === parsed.data.projectId)?.site_id;
  let inventoryCapture: InventoryPhotoCapture | undefined;
  if (inventorySiteId && imagePath && imageBytes && imageFile) {
    inventoryCapture = await captureSiteInventoryFromLabel({
      supabase,
      siteId: inventorySiteId,
      imagePath,
      imageBytes,
      mimeType: imageFile.type,
    });
  }
  let conversation = parsed.data.conversationId
    ? await supabase.from("user_conversations").select("id,title").eq("id", parsed.data.conversationId).eq("owner_id", userId).maybeSingle()
    : await supabase.from("user_conversations").select("id,title").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (conversation.error) return Response.json({ error: conversation.error.message }, { status: 400 });
  if (parsed.data.conversationId && !conversation.data) return Response.json({ error: "That Wattson conversation was not found." }, { status: 404 });
  if (!conversation.data) {
    if (await userConversationCount(supabase, userId) >= WATTSON_CONVERSATION_LIMIT)
      return Response.json({ error: `You have reached the ${WATTSON_CONVERSATION_LIMIT}-chat limit. Delete an old chat from Wattson chats before starting another.` }, { status: 409 });
    const created = await supabase.from("user_conversations").insert({ owner_id: userId, site_id: conversationSiteId, project_id: parsed.data.projectId }).select("id").single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    conversation = { ...conversation, data: { ...created.data, title: "Wattson dashboard" } };
  }
  const conversationId = conversation.data?.id;
  if (!conversationId) return Response.json({ error: "Could not open Wattson conversation." }, { status: 500 });
  const userContent = imageFile
    ? `${parsed.data.message}\n\n[Attached image: ${imageFile.name}]`
    : parsed.data.message;
  const inserted = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "user", content: userContent, structured_context: imagePath ? { imagePath } : {} });
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 400 });
  if (!conversation.data?.title || conversation.data.title === "Wattson dashboard")
    await supabase.from("user_conversations").update({ title: conversationTitle(parsed.data.message) }).eq("id", conversationId).eq("owner_id", userId);
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
        selectedSiteDiscovery: selectedSiteBrief ?? undefined,
        inventoryLabelCapture: inventoryCapture,
        sites: (sites.data ?? []).map((site) => ({ ...site, unassignedEquipment: (siteEquipment.data ?? []).filter((item) => item.site_id === site.id && !item.assigned_project_id) })),
        connectedSiteSystems: connectedSystems,
        scope: "Dashboard Wattson is a general solar and electrical assistant with selected-Site awareness. Answer the user's actual question directly first, whether it is general, educational, comparative, diagnostic or specific to a recorded Site/system. Use the selected Site and its complete installed component, PV-array/string, load, assumption and connection records whenever the question concerns that Site, performance or improvement; do not make the user remind you what is already mounted. connectedSiteSystems may include map_latitude, map_longitude, location_mode and map_location_updated_at. A static system position is installation context. A mobile system position is only the user's last saved guide position: state that limitation when location materially affects the answer and never imply that a boat, vehicle or movable system is permanently there. For azimuth, tilt, yield or expansion questions, explicitly compare the recorded existing arrays with the location-based ideal and distinguish improving the existing installation from proposing a separate new array. Do not force an unrelated Site context onto a genuinely general question. A hypothetical design question is not a request to create a system. Never start system discovery, create a workspace, or redirect to Start here from dashboard chat; the dedicated Start a new system flow owns that job. Do not say technical records are unavailable merely because the synthetic dashboard project is empty. You may update an existing system record after a clear user correction or confirmation. Every dashboard action must include the exact project_id from connectedSiteSystems. If a requested Site-specific action has an unclear target only after checking the records, ask one focused question instead of taking an action.",
      },
      image,
      allowActions: true,
    });
    const ownedSystemIds = new Set(systemIds);
    const appliedActions: AppliedWattsonAction[] = [];
    const actionsBySystem = new Map<string, WattsonActionRequest[]>();
    for (const action of result.actions) {
      const projectId = actionProjectId(action);
      if (!projectId || !ownedSystemIds.has(projectId)) continue;
      actionsBySystem.set(projectId, [...(actionsBySystem.get(projectId) ?? []), action]);
    }
    let blockedArchitectureQuestion: string | undefined;
    let discoveryFollowup: string | undefined;
    const assessment = (profile.data.onboarding_assessment ?? {}) as Record<string, unknown>;
    const guidedReview = assessment.lastGuidedDiscovery && typeof assessment.lastGuidedDiscovery === "object"
      ? assessment.lastGuidedDiscovery as Record<string, unknown>
      : undefined;
    const guidedSystemId = typeof guidedReview?.systemId === "string" ? guidedReview.systemId : undefined;
    const activeSystem = connectedSystems.find((item) => item.id === parsed.data.projectId)
      ?? connectedSystems.find((item) => item.id === selectedConversation.data?.project_id)
      ?? connectedSystems.find((item) => item.site_id === conversationSiteId)
      ?? connectedSystems.find((item) => item.id === guidedSystemId)
      ?? (connectedSystems.length === 1 ? connectedSystems[0] : undefined);
    const activeSettings = activeSystem?.settings && typeof activeSystem.settings === "object"
      ? activeSystem.settings as Record<string, unknown>
      : {};
    const recordedDiscovery = activeSettings.designDiscovery && typeof activeSettings.designDiscovery === "object"
      ? activeSettings.designDiscovery as Record<string, unknown>
      : {};
    const monitoringOnlyIntent = Boolean(activeSystem && completedSystemIntent(parsed.data.message));
    if (monitoringOnlyIntent && activeSystem && activeSystem.phase !== "monitor") {
      const phaseUpdated = await supabase.from("projects").update({ phase: "monitor" }).eq("id", activeSystem.id).eq("owner_id", userId);
      if (phaseUpdated.error) throw phaseUpdated.error;
      activeSystem.phase = "monitor";
      appliedActions.push({ type: "settings_updated", summary: "Set system phase to monitor" });
    }
    let guidedUnknownIds = monitoringOnlyIntent || selectedSiteBrief ? [] : guidedReview && guidedReview.systemId === activeSystem?.id && Array.isArray(guidedReview.unknownIds)
      ? guidedReview.unknownIds.filter((value): value is string => typeof value === "string")
        .filter((questionId) => !Object.hasOwn(recordedDiscovery, actionKeyForQuestion(questionId)))
      : [];
    const guidedAnswers = selectedSiteBrief?.answers && typeof selectedSiteBrief.answers === "object"
      ? selectedSiteBrief.answers as Record<string, unknown>
      : guidedReview?.answers && typeof guidedReview.answers === "object"
      ? guidedReview.answers as Record<string, unknown>
      : {};
    if (!monitoringOnlyIntent && guidedReview && guidedReview.systemId === activeSystem?.id) {
      for (const questionId of ["panel_area_dimensions", "panel_area_constraints", "orientation_and_pitch", "cooking_energy", "water_heating_energy", "space_heating_energy", "delivery_approach"]) {
        if (!Object.hasOwn(guidedAnswers, questionId) && !Object.hasOwn(recordedDiscovery, questionId) && !guidedUnknownIds.includes(questionId)) guidedUnknownIds.push(questionId);
      }
    }
    const activeDiscovery = monitoringOnlyIntent || activeSystem?.phase === "monitor" || selectedSiteBrief ? undefined : guidedQuestion(guidedUnknownIds[0]) ?? nextRequiredDiscoveryQuestion(activeSystem?.settings);
    const lastAssistantMessage = [...prior].reverse().find((item) => item.role === "assistant")?.content;
    const askedDiscoveryKey = discoveryKeyFromAssistantQuestion(lastAssistantMessage);
    const userUncertain = userExpressesUncertainty(parsed.data.message);
    const inferredNewBuilding = activeDiscovery?.[0] === "current_energy_use"
      ? newBuildingDescription(parsed.data.message)
      : null;
    if (activeSystem && inferredNewBuilding) {
      const existing = actionsBySystem.get(activeSystem.id) ?? [];
      const recordedKeys = new Set(existing.flatMap((action) => {
        if (action.name !== "record_design_discovery" || !action.arguments || typeof action.arguments !== "object") return [];
        const key = (action.arguments as Record<string, unknown>).key;
        return typeof key === "string" ? [key] : [];
      }));
      const inferredActions: WattsonActionRequest[] = [];
      if (!recordedKeys.has("building_type")) inferredActions.push({
        name: "record_design_discovery",
        arguments: { project_id: activeSystem.id, key: "building_type", value: inferredNewBuilding.split(";")[0], confidence: "user_confirmed" },
      });
      if (!recordedKeys.has("current_energy_use")) inferredActions.push({
        name: "record_design_discovery",
        arguments: { project_id: activeSystem.id, key: "current_energy_use", value: "No existing consumption history; size from planned loads", confidence: "user_confirmed" },
      });
      inferredActions.push({
        name: "update_project_settings",
        arguments: { project_id: activeSystem.id, system_name: systemNameFromBuilding(inferredNewBuilding) },
      });
      if (inferredActions.length) actionsBySystem.set(activeSystem.id, [...existing, ...inferredActions]);
    }
    const recordedBuildingEntry = recordedDiscovery.building_type;
    const recordedBuildingValue = recordedBuildingEntry && typeof recordedBuildingEntry === "object" && "value" in recordedBuildingEntry
      ? String((recordedBuildingEntry as Record<string, unknown>).value ?? "")
      : "";
    if (activeSystem && !inferredNewBuilding && /^new\s+(?:shed|workshop|garage|cabin|tiny home|house|home|building)\b/i.test(recordedBuildingValue)) {
      const desiredName = systemNameFromBuilding(recordedBuildingValue);
      if (!activeSystem.name.toLowerCase().includes(desiredName.toLowerCase())) {
        const existing = actionsBySystem.get(activeSystem.id) ?? [];
        actionsBySystem.set(activeSystem.id, [...existing, {
          name: "update_project_settings",
          arguments: { project_id: activeSystem.id, system_name: desiredName },
        }]);
      }
    }
    const answerDiscoveryKey = askedDiscoveryKey ?? activeDiscovery?.[0];
    if (activeSystem && answerDiscoveryKey && !userUncertain && answerMatchesDiscovery(answerDiscoveryKey, parsed.data.message)) {
      const existing = actionsBySystem.get(activeSystem.id) ?? [];
      const alreadyRecorded = existing.some((action) => action.name === "record_design_discovery"
        && action.arguments && typeof action.arguments === "object"
        && (action.arguments as Record<string, unknown>).key === answerDiscoveryKey);
      if (!alreadyRecorded) actionsBySystem.set(activeSystem.id, [...existing, {
        name: "record_design_discovery",
        arguments: { project_id: activeSystem.id, key: answerDiscoveryKey, value: parsed.data.message, confidence: "user_confirmed" },
      }]);
    }
    const resolvedGuidedIds = new Set<string>();
    for (const [projectId, actions] of actionsBySystem) {
      const system = connectedSystems.find((item) => item.id === projectId);
      const monitoringOnlySystem = system?.phase === "monitor" || (monitoringOnlyIntent && system?.id === activeSystem?.id);
      // A completed Site brief is the authoritative discovery gate for this
      // conversation. Do not reopen generic system questions from stale
      // settings while reviewing its proposed architecture.
      const nextDiscovery = monitoringOnlySystem || (selectedSiteBrief && system?.site_id === conversationSiteId)
        ? undefined
        : nextRequiredDiscoveryQuestion(system?.settings, actions);
      if (!userUncertain && actions.some((action) => action.name === "record_design_discovery"))
        discoveryFollowup = nextDiscovery?.[1];
      const safeActions = actions.filter((action) => {
        if (monitoringOnlySystem && ["record_design_discovery", "record_design_preference", "record_preliminary_design", "record_proposed_component"].includes(action.name)) return false;
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
          selectedSiteDiscovery: selectedSiteBrief ?? undefined,
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
    const architectureReply = appliedActions.some((action) => action.type === "design_preference_updated")
      ? proposedArchitectureReply(result.actions)
      : null;
    const discoveryReply = appliedActions.some((action) => action.type === "design_discovery_updated")
      ? discoveryFollowup
        ? `I’ve added that to the design discovery notes. ${discoveryFollowup}`
        : "I’ve added that to the design discovery notes. The basic energy and site discovery is now complete."
      : null;
    if (blockedArchitectureQuestion)
      message = `We’re still in discovery, so I haven’t added an inverter arrangement yet. ${blockedArchitectureQuestion}`;
    if (userUncertain && activeDiscovery)
      message = `No problem—I haven’t saved that as an answer. ${discoveryGuidance(activeDiscovery[0])}`;
    if (inferredNewBuilding && activeSystem && discoveryFollowup)
      message = `Got it—I’ve set up ${systemNameFromBuilding(inferredNewBuilding)} as the working power system under ${activeSystem.site?.name ?? "the current site"}. Because it is new, we’ll size it from what you intend to run rather than a previous bill. ${discoveryFollowup}`;
    if (guidedUnknownIds.length && !appliedActions.length && /\b(?:other|next|missed|continue|what now)\b/i.test(parsed.data.message)) {
      const nextGuided = guidedQuestion(guidedUnknownIds[0]);
      if (nextGuided) message = `You’re right—there ${guidedUnknownIds.length === 1 ? "is" : "are"} still ${guidedUnknownIds.length} unresolved item${guidedUnknownIds.length === 1 ? "" : "s"}. ${nextGuided[1]}`;
    }
    if (!guidedUnknownIds.length && activeDiscovery && !appliedActions.length && /\b(?:next|continue|what now)\b/i.test(parsed.data.message)) {
      message = `Here’s the next step: ${activeDiscovery[1]}`;
    }
    if (monitoringOnlyIntent && activeSystem)
      message = `Understood - I’ve set ${activeSystem.name} to monitor mode. I won’t run design discovery or build prompts for this system; Wattson will treat it as a commissioned as-built installation for monitoring, diagnostics and record-keeping.`;
    if (!message && architectureReply) message = architectureReply;
    if (!message && discoveryReply) message = discoveryReply;
    const proposedDesignUpdated = appliedActions.some((action) =>
      action.type === "design_preference_updated" || action.type === "preliminary_design_updated" || action.type === "component_proposed",
    );
    if (proposedDesignUpdated && (!message || /^done\s*[—-]/i.test(message)))
      message = "I’ve updated the proposed design only; nothing has been marked purchased or installed. I’m taking you to the Design Calculator now, where you can see the proposed arrangement, the evidence behind it, and the next item Wattson needs to validate.";
    if (updateSummary && !inferredNewBuilding && message !== architectureReply && message !== discoveryReply)
      message = message
        ? `${message}\n\nUpdated in PVIntell: ${updateSummary}.`
        : `Done — ${updateSummary}.`;
    if (!message)
      message = result.actions.length
        ? "I couldn’t safely attach that change to a specific system. Tell me which system it belongs to."
        : "I didn’t produce a useful reply. Please send that once more.";
    if (inventoryCapture?.saved)
      message = `${message}\n\nI added ${inventoryCapture.equipmentName ?? "this equipment"} to this Site’s inventory from the label photo. I saved only visible label details and marked its physical condition as needing testing; you can review or correct the inventory record at any time.`;
    const existingProposedDesign = Boolean(
      activeSystem?.settings && typeof activeSystem.settings === "object" &&
      (activeSystem.settings as Record<string, unknown>).designCalculator,
    );
    const asksToContinueProposal = /\b(?:next|now what|what now|continue|show|open|proposal|proposed|design)\b/i.test(parsed.data.message);
    if (!proposedDesignUpdated && existingProposedDesign && asksToContinueProposal) {
      message = "Your proposed design is ready in the Design Calculator. I’m taking you there now — it is separate from the as-built overview and schematic, so nothing there is being treated as installed.";
    }
    const monitorModeLink = monitoringOnlyIntent && activeSystem
      ? `/sites/${activeSystem.site_id}/systems/${activeSystem.id}?view=monitor`
      : undefined;
    const proposedDesignLink = (proposedDesignUpdated || (existingProposedDesign && asksToContinueProposal)) && activeSystem
      ? `/sites/${activeSystem.site_id}/systems/${activeSystem.id}/design`
      : undefined;
    const saved = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: message, structured_context: { provider: "gemini", model: result.model, citations: result.citations, usage: result.usage, actions: appliedActions, imagePath, inventoryCapture, actionUrl: proposedDesignLink ?? monitorModeLink, actionLabel: proposedDesignLink ? "Open proposed design" : monitorModeLink ? "Open monitor" : undefined } });
    if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
    const proposedDesignUrl = (proposedDesignUpdated || (existingProposedDesign && asksToContinueProposal)) && activeSystem
      ? `/sites/${activeSystem.site_id}/systems/${activeSystem.id}/design`
      : undefined;
    return Response.json({
      conversationId,
      message,
      citations: result.citations,
      actions: appliedActions,
      actionUrl: proposedDesignUrl ?? monitorModeLink,
      actionLabel: proposedDesignUrl ? "Open proposed design" : monitorModeLink ? "Open monitor" : undefined,
      inventoryEquipmentId: inventoryCapture?.equipmentId,
    });
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Wattson is unavailable." }, { status: 502 });
  }
}
