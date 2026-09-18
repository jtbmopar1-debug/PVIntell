import { z } from "zod";
import { applyWattsonActions, type AppliedWattsonAction, type WattsonActionRequest } from "@/ai/actions";
import { askGemini } from "@/ai/gemini";
import { discoveryGuidance, nextRequiredDiscoveryQuestion, userExpressesUncertainty } from "@/ai/discovery";
import type { Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import { newSystemQuestions } from "@/discovery/new-system";
import { captureSiteInventoryFromLabel, type InventoryPhotoCapture } from "@/ai/inventory-from-label";
import { extractEquipmentLabel } from "@/ai/equipment-label";
import { containsUnsupportedSettingsSetupAdvice, wattsonApplicationCapabilities } from "@/ai/application-capabilities";
import { conversationTitle, userConversationCount, WATTSON_CONVERSATION_LIMIT } from "@/ai/conversation-limit";
import { loadDailyLogContext } from "@/monitoring/daily-log-repository";
import { createSystem } from "@/data/cloud-project";
import { registerGalleryImage } from "@/gallery/register";
import { explicitInverterMention, nextNumberedName, requestedSchematicPlan, requestsSchematicCreation } from "@/ai/schematic-intent";
import {
  conversationStatePromptContext,
  parseWattsonConversationState,
  recordWattsonAssistantTurn,
  reduceWattsonUserTurn,
  removeAnsweredWattsonQuestions,
} from "@/ai/conversation-state";
import { actionsAllowedByDecision, consumeConfirmedPendingAction, pendingActionRequests, routeWattsonTurn } from "@/ai/conversation-router";
import { wattsonErrorDetail } from "@/ai/error-detail";
import { cachedConversationResponse, startedConversationRequest } from "@/ai/conversation-request";
import { attachImageToRecord, requestsExistingRecordAttachment, resolveRecordAttachmentTarget, type RecordAttachmentTarget } from "@/ai/record-attachment";
import { systemConfirmationReadiness } from "@/lib/system-confirmation-readiness";

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.uuid().optional(),
  siteId: z.uuid().optional(),
  conversationId: z.uuid().optional(),
  weatherContext: z.string().max(100000).optional(),
  requestId: z.uuid().optional(),
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
    ac_phase_arrangement: /\b(?:single[ -]?phase|split[ -]?phase|three[ -]?phase|3[ -]?phase|3ph|dc only|no ac)\b/i,
    nominal_ac_voltage: /\b(?:100|1[01]0|120|200|220|230|240|380|400|415|440|480)\s*v(?:olts?)?\b/i,
    everyday_needs: /\b(?:light|outlet|socket|tool|pump|fridge|freezer|refriger|appliance|equipment|machine|computer|charger)\w*\b/i,
    cooking_energy: /\b(?:no cooking|cook|oven|cooktop|induction|air\s*fryer|lpg|gas|wood|microwave|none)\b/i,
    water_heating_energy: /\b(?:no (?:hot )?water|water heat|water heater|cylinder|hwc|geyser|instant electric|heat pump|lpg|gas|solar hot|wetback|none)\b/i,
    space_heating_energy: /\b(?:no heat|heat pump|heater|heating|wood|fire|lpg|gas|boiler|none)\b/i,
    heavy_or_surge_loads: /\b(?:tool|pump|welder|compressor|motor|saw|oven|heater|ev|charger|none|nothing)\w*\b/i,
    generator_requirement: /\b(?:generator|genset|no generator|prepare for one)\b/i,
    generator_details: /\b(?:generator|genset).*(?:model|petrol|gasoline|diesel|lpg|propane|kw|kva|ats|start|phase|volt)/i,
    building_type: /\b(?:house|home|townhouse|apartment|unit|shed|workshop|garage|farm|cabin|building|pool|spa|jacuzzi|vehicle|motorhome|caravan|campervan|boat|marine)\b/i,
    property_authority: /\b(?:own|owner|rent|renter|landlord|body corporate|shared|permission|approval)\b/i,
    proposed_panel_location: /\b(?:roof|ground|frame|shed|garage|carport|wall|unsure|don'?t know)\b/i,
    delivery_approach: /\b(?:diy|myself|shared|trade|installer|turnkey|contractor)\b/i,
  };
  return patterns[key]?.test(message) ?? false;
}

function discoveryKeyFromAssistantQuestion(message: string | undefined) {
  if (!message) return null;
  const patterns: Array<[string, RegExp]> = [
    ["ac_phase_arrangement", /\bac phase arrangement|single-phase, split-phase, three-phase/i],
    ["nominal_ac_voltage", /\bnominal ac .*voltage|supply or inverter-output voltage/i],
    ["current_energy_use", /\b(?:existing|current) electricity use|recent bill|monitoring total/i],
    ["everyday_needs", /\bwhat should it power day to day|what .* intend to run/i],
    ["cooking_energy", /\bhow is cooking done|cooking method/i],
    ["water_heating_energy", /\bhow is water heated|water heating/i],
    ["space_heating_energy", /\bhow is .* heated|any heating/i],
    ["heavy_or_surge_loads", /\blargest appliances|larger tools|run at the same time/i],
    ["generator_requirement", /\binclude .*generator|generator supply|prepare for one later/i],
    ["generator_details", /\bwhat is known about the generator|generator.*make\/model/i],
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

function friendlyMonitoringReferences(message: string, systems: Array<{ id: string; name: string }>) {
  return message.replace(/\[([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]/gi, (_match, id: string) => {
    const system = systems.find((item) => item.id.toLowerCase() === id.toLowerCase());
    return system ? `(${system.name} live monitoring)` : "(PVIntell live monitoring)";
  });
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
    candidate = { message: form.get("message"), projectId: form.get("projectId") || undefined, siteId: form.get("siteId") || undefined, conversationId: form.get("conversationId") || undefined, weatherContext: form.get("weatherContext") || undefined, requestId: form.get("requestId") || undefined };
    const file = form.get("file");
    if (file instanceof File) imageFile = file;
  } else candidate = await request.json();
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) return Response.json({ error: "Enter a message for Wattson." }, { status: 400 });
  let selectedSiteWeather: unknown;
  if (parsed.data.weatherContext) {
    try { selectedSiteWeather = JSON.parse(parsed.data.weatherContext); }
    catch { return Response.json({ error: "The displayed weather forecast could not be read." }, { status: 400 }); }
  }
  if (imageFile && (!new Set(["image/jpeg", "image/png", "image/webp"]).has(imageFile.type) || !imageFile.size || imageFile.size > 8 * 1024 * 1024))
    return Response.json({ error: "Use a JPEG, PNG or WebP image smaller than 8 MB." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cachedRequest = await cachedConversationResponse(supabase, "user_chat_messages", undefined, parsed.data.requestId);
  if (cachedRequest) return Response.json(cachedRequest);
  const startedRequest = await startedConversationRequest(supabase, "user_chat_messages", undefined, parsed.data.requestId);
  if (startedRequest) return Response.json({ error: "That message is already being handled, so Wattson did not run its actions again.", conversationId: startedRequest.conversationId, retryable: false }, { status: 409 });
  const [profile, sites, systems, siteDiscoveries, selectedConversation] = await Promise.all([
    supabase.from("profiles").select("display_name,home_location,timezone,onboarding_assessment").eq("id", userId).single(),
    supabase.from("sites").select("id,name,location,timezone,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,description,mode,phase,location,system_voltage,settings,map_latitude,map_longitude,location_mode,map_location_updated_at").eq("owner_id", userId).order("created_at"),
    supabase.from("site_discoveries").select("site_id,status,answers,baseline_answers,impact_pending").eq("owner_id", userId),
    parsed.data.conversationId ? supabase.from("user_conversations").select("id,site_id,project_id,conversation_state").eq("id", parsed.data.conversationId).eq("owner_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (profile.error) return Response.json({ error: profile.error.message }, { status: 400 });
  if (sites.error) return Response.json({ error: sites.error.message }, { status: 400 });
  if (systems.error) return Response.json({ error: systems.error.message }, { status: 400 });
  if (siteDiscoveries.error || selectedConversation.error) return Response.json({ error: siteDiscoveries.error?.message ?? selectedConversation.error?.message ?? "Could not load discovery context." }, { status: 400 });
  const systemIds = (systems.data ?? []).map((system) => system.id);
  const siteIds = (sites.data ?? []).map((site) => site.id);
  const [components, pvStrings, connections, loads, assumptions, goals, siteEquipment, monitoringConnections, monitoringDevices, monitoringLatest] = await Promise.all([
    systemIds.length ? supabase.from("system_components").select("id,project_id,type,display_name,manufacturer,model,quantity,installation_location,serial_number,firmware_version,manual_url,specifications,notes,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("pv_arrays").select("id,project_id,name,manufacturer,panel_model,panel_type,supplier,purchased_on,installed_on,panel_watts,panel_count,strings,panels_per_string,orientation_degrees,tilt_degrees,cable_size_mm2,cable_length_m,connector_type,breaker_details,isolator_details,combiner_details,installation_notes,specifications,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("system_connections").select("id,project_id,source_ref,target_ref,name,connection_type,polarity,cable_size,cable_length,breaker_size,fuse_size,isolator,route,notes,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("loads").select("id,project_id,name,watts,quantity,hours_per_day,surge_watts,current_type,confidence,simultaneous").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("assumptions").select("id,project_id,label,value,reason,confidence").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("project_goals").select("id,project_id,text,priority").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    siteIds.length ? supabase.from("site_equipment").select("id,site_id,assigned_project_id,type,name,manufacturer,model,quantity,condition,status,specifications,notes").in("site_id", siteIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("monitoring_connections").select("id,project_id,provider,display_name,status,is_active,capabilities,last_success_at,last_failure_at,status_message").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("monitoring_devices").select("connection_id,project_id,provider_device_id,device_type,display_name,status,last_seen_at,mapped_component_id,mapped_pv_array_id").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("monitoring_latest_readings").select("connection_id,project_id,measured_at,received_at,pv_power_w,load_power_w,battery_power_w,battery_voltage_v,battery_current_a,battery_soc_percent,grid_power_w,inverter_state,generated_energy_today_wh,consumed_energy_today_wh").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const detailError = components.error ?? pvStrings.error ?? connections.error ?? loads.error ?? assumptions.error ?? goals.error ?? siteEquipment.error ?? monitoringConnections.error ?? monitoringDevices.error ?? monitoringLatest.error;
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
    monitoringConnections: (monitoringConnections.data ?? []).filter((item) => item.project_id === system.id).map((connection) => ({
      ...connection,
      devices: (monitoringDevices.data ?? []).filter((device) => device.connection_id === connection.id),
      latestReading: (monitoringLatest.data ?? []).find((reading) => reading.connection_id === connection.id),
    })),
  }));
  const directlyNamedSite = (sites.data ?? []).find((site) => new RegExp(
    `(?:^|\\b)${site.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`, "i",
  ).test(parsed.data.message));
  const conversationSiteId = directlyNamedSite?.id ?? parsed.data.siteId ?? selectedConversation.data?.site_id;
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
    try { await registerGalleryImage(supabase, { ownerId: userId, storagePath: imagePath, fileName: imageFile.name, mimeType: imageFile.type, source: "wattson" }); }
    catch (problem) { await supabase.storage.from("project-photos").remove([imagePath]); return Response.json({ error: problem instanceof Error ? problem.message : "Could not add the chat image to Gallery." }, { status: 409 }); }
  }
  const inventorySiteId = conversationSiteId ?? (systems.data ?? []).find((system) => system.id === parsed.data.projectId)?.site_id;
  let inventoryCapture: InventoryPhotoCapture | undefined;
  if (imagePath && imageBytes && imageFile) {
    const imageDecision = routeWattsonTurn(parsed.data.message, parseWattsonConversationState(selectedConversation.data?.conversation_state));
    if (imageDecision.mutationConsent && imageDecision.intent === "record_attachment" && inventorySiteId && !requestsExistingRecordAttachment(parsed.data.message)) {
      inventoryCapture = await captureSiteInventoryFromLabel({
        supabase,
        siteId: inventorySiteId,
        imagePath,
        imageBytes,
        mimeType: imageFile.type,
      });
    } else {
      try {
        inventoryCapture = {
          extraction: await extractEquipmentLabel(imageBytes, imageFile.type),
          saved: false,
          warning: "Image evidence was analysed for this conversation only; no Site equipment record was created.",
        };
      } catch (problem) {
        inventoryCapture = { saved: false, warning: problem instanceof Error ? problem.message : "Wattson could not read this equipment label." };
      }
    }
  }
  const conversation = parsed.data.conversationId
    ? await supabase.from("user_conversations").select("id,title").eq("id", parsed.data.conversationId).eq("owner_id", userId).maybeSingle()
    : { data: null, error: null };
  if (conversation.error) return Response.json({ error: conversation.error.message }, { status: 400 });
  if (parsed.data.conversationId && !conversation.data) return Response.json({ error: "That Wattson conversation was not found." }, { status: 404 });
  let conversationData = conversation.data;
  if (conversationData) {
    const contexts = await supabase.from("user_chat_messages").select("structured_context").eq("conversation_id", conversationData.id).order("created_at", { ascending: false }).limit(100);
    if (contexts.error) return Response.json({ error: contexts.error.message }, { status: 400 });
    const isDiscoveryConversation = (contexts.data ?? []).some((message) => message.structured_context?.kind === "discovery_help" || message.structured_context?.kind === "discovery_topic");
    if (isDiscoveryConversation) conversationData = null;
  }
  if (!conversationData) {
    if (await userConversationCount(supabase, userId) >= WATTSON_CONVERSATION_LIMIT)
      return Response.json({ error: `You have reached the ${WATTSON_CONVERSATION_LIMIT}-chat limit. Delete an old chat from Wattson chats before starting another.` }, { status: 409 });
    const created = await supabase.from("user_conversations").insert({ owner_id: userId, site_id: conversationSiteId, project_id: parsed.data.projectId }).select("id,conversation_state").single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    conversationData = { ...created.data, title: "Wattson dashboard" };
  }
  const conversationId = conversationData?.id;
  if (!conversationId) return Response.json({ error: "Could not open Wattson conversation." }, { status: 500 });
  const userContent = imageFile
    ? `${parsed.data.message}\n\n[Attached image: ${imageFile.name}]`
    : parsed.data.message;
  const inserted = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "user", content: userContent, structured_context: imagePath ? { imagePath } : {}, client_request_id: parsed.data.requestId });
  if (inserted.error) return Response.json({ error: inserted.error.message, conversationId }, { status: inserted.error.code === "23505" ? 409 : 400 });
  if (!conversationData?.title || conversationData.title === "Wattson dashboard")
    await supabase.from("user_conversations").update({ title: conversationTitle(parsed.data.message) }).eq("id", conversationId).eq("owner_id", userId);
  // Keep a useful replay window here. The explicit active state stored on each
  // assistant turn carries the subject and accepted/rejected decisions beyond it.
  const recent = await supabase.from("user_chat_messages").select("role,content,structured_context").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(40);
  const history = (recent.data ?? []).reverse();
  const prior = history.at(-1)?.content === userContent ? history.slice(0, -1) : history;
  const selectedSystemForState = connectedSystems.find((system) => system.id === parsed.data.projectId || system.id === selectedConversation.data?.project_id);
  const storedConversationState = conversationData && "conversation_state" in conversationData ? conversationData.conversation_state : selectedConversation.data?.conversation_state;
  let conversationState = reduceWattsonUserTurn(
    storedConversationState,
    parsed.data.message,
    {
      site: (sites.data ?? []).find((site) => site.id === conversationSiteId),
      system: selectedSystemForState ? { id: selectedSystemForState.id, name: selectedSystemForState.name } : undefined,
      image: imagePath ? { imagePath, mimeType: imageFile?.type, extraction: inventoryCapture?.extraction as Record<string, unknown> | undefined, warning: inventoryCapture?.warning } : undefined,
    },
  );
  const routeDecision = routeWattsonTurn(parsed.data.message, conversationState);
  conversationState.activeIntent = routeDecision.intent;
  const userStateSaved = await supabase.from("user_conversations").update({ conversation_state: conversationState }).eq("id", conversationId).eq("owner_id", userId);
  if (userStateSaved.error) return Response.json({ error: userStateSaved.error.message, conversationId }, { status: 400 });
  const attachmentSystemId = parsed.data.projectId ?? selectedConversation.data?.project_id ?? conversationState.activeSubject?.systemId;
  const attachmentSiteSystemIds = new Set(connectedSystems.filter((system) => !conversationSiteId || system.site_id === conversationSiteId).map((system) => system.id));
  const attachmentComponents = (components.data ?? []).filter((item) => attachmentSystemId ? item.project_id === attachmentSystemId : attachmentSiteSystemIds.has(item.project_id));
  const attachmentArrays = (pvStrings.data ?? []).filter((item) => attachmentSystemId ? item.project_id === attachmentSystemId : attachmentSiteSystemIds.has(item.project_id));
  const pendingTarget = routeDecision.pendingAction?.payload?.attachmentTarget;
  const storedTarget = pendingTarget && typeof pendingTarget === "object"
    && "kind" in pendingTarget && "id" in pendingTarget && "projectId" in pendingTarget && "name" in pendingTarget
    && ((pendingTarget as Record<string, unknown>).kind === "component" || (pendingTarget as Record<string, unknown>).kind === "pv_array")
    ? pendingTarget as RecordAttachmentTarget
    : undefined;
  const attachmentRequest = Boolean(imagePath && requestsExistingRecordAttachment(parsed.data.message))
    || Boolean(!imagePath && routeDecision.pendingAction?.kind === "attach_record" && routeDecision.mode === "execute");
  if (attachmentRequest) {
    const targetResult = storedTarget ? { target: storedTarget } : resolveRecordAttachmentTarget(parsed.data.message, attachmentComponents, attachmentArrays);
    const attachmentImagePath = imagePath ?? routeDecision.pendingAction?.payload?.imagePath;
    let responseMessage: string;
    if (!targetResult.target) {
      const choices = (targetResult.candidates ?? []).map((candidate) => candidate.name).join(", ");
      responseMessage = choices
        ? `I haven’t attached the image because more than one record matches. Which one do you mean: ${choices}?`
        : "I haven’t attached the image because I can’t identify one exact existing record. Which component or PV array should it belong to?";
    } else if (typeof attachmentImagePath !== "string") {
      responseMessage = "I haven’t attached anything because this conversation does not have an image available for that action.";
    } else {
      const attached = await attachImageToRecord(supabase, targetResult.target, attachmentImagePath);
      responseMessage = `${attached.summary}.`;
      conversationState.pendingAction = undefined;
      conversationState.completedActions.push({ kind: "attach_record", revision: conversationState.revision, description: attached.summary, systemId: targetResult.target.projectId, result: { imagePath: attachmentImagePath, attachmentTarget: targetResult.target } });
    }
    conversationState = recordWattsonAssistantTurn(conversationState, responseMessage);
    const attachmentStateSaved = await supabase.from("user_conversations").update({ conversation_state: conversationState }).eq("id", conversationId).eq("owner_id", userId);
    if (attachmentStateSaved.error) return Response.json({ error: attachmentStateSaved.error.message, conversationId }, { status: 400 });
    const attachmentReplySaved = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: responseMessage, structured_context: { evidenceRevision: conversationState.revision, imagePath: attachmentImagePath, attachmentTarget: targetResult.target }, response_to_request_id: parsed.data.requestId });
    if (attachmentReplySaved.error) return Response.json({ error: attachmentReplySaved.error.message, conversationId }, { status: 400 });
    return Response.json({ message: responseMessage, actions: targetResult.target ? [{ type: "record_attachment", summary: responseMessage }] : [], conversationId, imagePath: attachmentImagePath });
  }
  const dailyMonitorLog = await loadDailyLogContext(supabase, userId, { systemId: parsed.data.projectId, siteId: conversationSiteId ?? undefined });
  const priorAssistant = [...prior].reverse().find((item) => item.role === "assistant");
  const priorAssistantMessage = priorAssistant?.content;
  const priorStructuredContext = priorAssistant?.structured_context && typeof priorAssistant.structured_context === "object"
    ? priorAssistant.structured_context as Record<string, unknown> : {};
  if (routeDecision.intent === "schematic" && routeDecision.mode === "execute" && requestsSchematicCreation(parsed.data.message, priorAssistantMessage)) {
    const completedSchematic = [...conversationState.completedActions].reverse().find((action) => action.kind === "create_schematic");
    const existingSchematicId = completedSchematic?.systemId ?? (typeof priorStructuredContext.schematicId === "string" ? priorStructuredContext.schematicId : undefined);
    const existingSchematicUrl = typeof completedSchematic?.result?.actionUrl === "string"
      ? completedSchematic.result.actionUrl
      : typeof priorStructuredContext.actionUrl === "string" ? priorStructuredContext.actionUrl : undefined;
    if (existingSchematicId && existingSchematicUrl) {
      const responseMessage = "That proposed schematic has already been created. Open it below.";
      if (!completedSchematic) conversationState.completedActions.push({ kind: "create_schematic", revision: conversationState.revision, description: "Existing Wattson-created proposal schematic", siteId: conversationState.activeSubject?.siteId, systemId: existingSchematicId, result: { actionUrl: existingSchematicUrl } });
      conversationState = recordWattsonAssistantTurn(conversationState, responseMessage);
      const stateSaved = await supabase.from("user_conversations").update({ conversation_state: conversationState }).eq("id", conversationId).eq("owner_id", userId);
      if (stateSaved.error) return Response.json({ error: stateSaved.error.message, conversationId }, { status: 400 });
      const saved = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: responseMessage, structured_context: priorStructuredContext, response_to_request_id: parsed.data.requestId });
      if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
      return Response.json({ message: responseMessage, actions: [], conversationId, schematicId: existingSchematicId, actionUrl: existingSchematicUrl, actionLabel: "Open schematic" });
    }
    let createdSiteId: string | undefined;
    let createdSystemId: string | undefined;
    let createdSiteByRequest = false;
    let createdSystemByRequest = false;
    let createdArrayIds: string[] = [];
    let createdComponentIds: string[] = [];
    let createdConnectionIds: string[] = [];
    try {
      const currentSiteId = conversationState.activeSubject?.siteId ?? conversationSiteId ?? parsed.data.siteId;
      if (currentSiteId) createdSiteId = currentSiteId;
      else {
        const siteName = nextNumberedName("Site", (sites.data ?? []).map((site) => site.name));
        const createdSite = await supabase.from("sites").insert({ owner_id: userId, name: siteName, location: null, timezone: "UTC", location_source: "manual", location_confirmed: false }).select("id").single();
        if (createdSite.error) throw createdSite.error;
        createdSiteId = createdSite.data.id;
        createdSiteByRequest = true;
      }
      const associatedSystemId = conversationState.activeSubject?.association === "system"
        ? conversationState.activeSubject.systemId
        : undefined;
      createdSystemId = associatedSystemId;
      if (!createdSystemId) {
        const systemName = nextNumberedName("System", connectedSystems.filter((system) => system.site_id === createdSiteId).map((system) => system.name));
        createdSystemId = await createSystem(supabase, userId, createdSiteId!, systemName, "off-grid", "Proposed-system schematic created by Wattson; unconfirmed specifications are TBC.");
        createdSystemByRequest = true;
      }
      if (createdSystemByRequest) {
        const existingSettings = { autonomyDays: 2, priorities: [], startingGoal: "Proposed-system schematic created by Wattson; unconfirmed specifications are TBC.", goal: "Proposed-system schematic created by Wattson; unconfirmed specifications are TBC." };
        const proposedPhase = await supabase.from("projects").update({
          phase: "design",
          description: "Proposed-system schematic created by Wattson; unconfirmed specifications are TBC.",
          settings: { ...existingSettings, schematicOrigin: "wattson_proposal", systemStatus: "proposed", gridRelationship: "unconfirmed" },
          updated_at: new Date().toISOString(),
        }).eq("id", createdSystemId).eq("owner_id", userId);
        if (proposedPhase.error) throw proposedPhase.error;
      }
      const userConversationText = [...prior.filter((item) => item.role === "user").map((item) => item.content), parsed.data.message].join("\n");
      const currentPlan = requestedSchematicPlan(parsed.data.message);
      const schematicPlan = currentPlan.pv.totalPanels || currentPlan.components.length
        ? currentPlan
        : requestedSchematicPlan(userConversationText);
      const panelWatts = schematicPlan.pv.panelWatts
        ?? (Number(conversationState.facts.find((fact) => fact.key === "panel.rated_power_w")?.value ?? 0) || undefined);
      let createdArrayRows: Array<{ id: string }> = [];
      if (schematicPlan.pv.totalPanels || panelWatts) {
        const requestedArrays = schematicPlan.arrays.length ? schematicPlan.arrays : Array.from({ length: schematicPlan.pv.arrayCount }, (_, index) => ({ name: `PV${index + 1}`, panelCount: schematicPlan.pv.panelsPerArray, panelWatts, panelType: undefined, cableSizeMm2: undefined }));
        const arrayRows = requestedArrays.map((array, index) => ({
          project_id: createdSystemId,
          name: array.name ?? `PV${index + 1}`,
          panel_watts: array.panelWatts ?? panelWatts ?? null,
          panel_count: array.panelCount ?? null,
          strings: 1,
          panels_per_string: array.panelCount ?? null,
          panel_type: array.panelType ?? null,
          cable_size_mm2: array.cableSizeMm2 ?? null,
          specifications: {
            "Wiring arrangement": "series",
            "Panel Voc": "TBC",
            "Panel Vmp": "TBC",
            "Panel Isc": "TBC",
            "Panel Imp": "TBC",
            "Design status": "Conceptual — verify ratings before installation",
          },
          confidence: "estimated",
        }));
        const createdArray = await supabase.from("pv_arrays").insert(arrayRows).select("id");
        if (createdArray.error) throw createdArray.error;
        createdArrayRows = createdArray.data ?? [];
        createdArrayIds = createdArrayRows.map((row) => row.id);
      }
      const explicitInverter = explicitInverterMention(userConversationText);
      const componentRows: Array<Record<string, unknown>> = schematicPlan.components.map((component) => ({
        project_id: createdSystemId,
        type: component.type,
        display_name: component.type === "inverter" && explicitInverter?.manufacturer
          ? `${explicitInverter.manufacturer} ${component.displayName}`
          : component.displayName,
        quantity: component.quantity,
        specifications: {
          ...component.specifications,
          ...(component.type === "inverter" && explicitInverter?.ratedPowerW ? { "Rated power": `${explicitInverter.ratedPowerW} W` } : {}),
          "Unconfirmed specifications": "TBC",
        },
        notes: "Conceptual schematic item explicitly requested by the user; confirm exact model and ratings before installation.",
        confidence: "estimated",
      }));
      let createdComponentRows: Array<{ id: string; type: string; display_name: string }> = [];
      if (componentRows.length) {
        const createdComponents = await supabase.from("system_components").insert(componentRows).select("id,type,display_name");
        if (createdComponents.error) throw createdComponents.error;
        createdComponentRows = createdComponents.data ?? [];
        createdComponentIds = createdComponentRows.map((row) => row.id);
      }
      const nodeRefs = new Map<string, string>();
      createdArrayRows.forEach((row, index) => nodeRefs.set(`pv-${index + 1}`, `pv:${row.id}`));
      schematicPlan.components.forEach((component) => {
        const inserted = createdComponentRows.find((row) => row.display_name === (component.type === "inverter" && explicitInverter?.manufacturer ? `${explicitInverter.manufacturer} ${component.displayName}` : component.displayName));
        if (inserted) nodeRefs.set(component.key, `component:${inserted.id}`);
      });
      const connectionRows: Array<Record<string, unknown>> = schematicPlan.connections.flatMap((connection) => {
        const sourceRef = nodeRefs.get(connection.sourceKey);
        const targetRef = nodeRefs.get(connection.targetKey);
        return sourceRef && targetRef ? [{
          project_id: createdSystemId,
          source_ref: sourceRef,
          target_ref: targetRef,
          name: connection.name,
          connection_type: connection.connectionType ?? "dc",
          polarity: connection.polarity,
          cable_size: connection.cableDescription ?? (connection.cableSizeMm2 ? `${connection.cableSizeMm2} mm²` : null),
          breaker_size: connection.protection ?? null,
          notes: [connection.cableDescription, connection.protection, "Conceptual connection; verify supplied and missing ratings against the selected equipment."].filter(Boolean).join("; "),
          confidence: "estimated",
        }] : [];
      });
      if (connectionRows.length) {
        const createdConnections = await supabase.from("system_connections").insert(connectionRows).select("id");
        if (createdConnections.error) throw createdConnections.error;
        createdConnectionIds = (createdConnections.data ?? []).map((row) => row.id);
      }
      const schematicUrl = `/sites/${createdSiteId}/systems/${createdSystemId}/schematic`;
      const responseMessage = "Built as a proposed-system schematic. I marked the missing electrical ratings as TBC, so those details remain provisional until verified. It has not been marked installed or commissioned. Open it below.";
      conversationState.pendingAction = undefined;
      conversationState.activeSubject = { kind: "setup", description: "Proposed-system schematic requested in this conversation", association: "system", siteId: createdSiteId, systemId: createdSystemId };
      conversationState.completedActions.push({ kind: "create_schematic", revision: conversationState.revision, description: "Created proposed-system schematic", siteId: createdSiteId, systemId: createdSystemId, result: { actionUrl: schematicUrl } });
      conversationState = recordWattsonAssistantTurn(conversationState, responseMessage);
      const structuredContext = { evidenceRevision: conversationState.revision, schematicId: createdSystemId, actionUrl: schematicUrl, actionLabel: "Open schematic" };
      const linked = await supabase.from("user_conversations").update({ site_id: createdSiteId, project_id: createdSystemId }).eq("id", conversationId).eq("owner_id", userId);
      if (linked.error) throw linked.error;
      const stateSaved = await supabase.from("user_conversations").update({ conversation_state: conversationState }).eq("id", conversationId).eq("owner_id", userId);
      if (stateSaved.error) throw stateSaved.error;
      const saved = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: responseMessage, structured_context: structuredContext, response_to_request_id: parsed.data.requestId });
      if (saved.error) throw saved.error;
      return Response.json({ message: responseMessage, actions: [{ type: "workspace_created", summary: "Created conceptual schematic" }], conversationId, schematicId: createdSystemId, actionUrl: schematicUrl, actionLabel: "Open schematic" });
    } catch (problem) {
      const detail = wattsonErrorDetail(problem);
      if (createdSystemByRequest && createdSystemId) await supabase.from("projects").delete().eq("id", createdSystemId).eq("owner_id", userId);
      else {
        if (createdConnectionIds.length) await supabase.from("system_connections").delete().in("id", createdConnectionIds);
        if (createdComponentIds.length) await supabase.from("system_components").delete().in("id", createdComponentIds);
        if (createdArrayIds.length) await supabase.from("pv_arrays").delete().in("id", createdArrayIds);
      }
      if (createdSiteByRequest && createdSiteId) await supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", userId);
      const responseMessage = `I could not create the schematic because PVIntell returned this technical error: ${detail}`;
      await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: responseMessage, structured_context: { evidenceRevision: conversationState.revision, schematicCreationError: detail }, response_to_request_id: parsed.data.requestId });
      return Response.json({ message: responseMessage, actions: [], conversationId });
    }
  }
  try {
    const confirmedSiteLocation = (sites.data ?? []).find((site) => site.id === conversationSiteId && site.location_confirmed)?.location ?? "";
    const result = await askGemini({
      message: parsed.data.message,
      project: dashboardProject(confirmedSiteLocation),
      recentConversation: prior,
      questionnaireContext: {
        conversationState: conversationStatePromptContext(conversationState),
        applicationCapabilities: wattsonApplicationCapabilities(),
        dailyMonitorLog,
        userAssessment: profile.data.onboarding_assessment ?? {},
        userTimezone: profile.data.timezone,
        selectedSiteDiscovery: selectedSiteBrief ?? undefined,
        selectedSiteWeather,
        inventoryLabelCapture: inventoryCapture,
        sites: (sites.data ?? []).map((site) => ({
          ...site,
          unassignedEquipment: conversationState.activeSubject?.association === "unassociated"
            ? []
            : (siteEquipment.data ?? []).filter((item) => item.site_id === site.id && !item.assigned_project_id),
        })),
        connectedSiteSystems: connectedSystems.map((system) => conversationState.activeSubject?.association === "unassociated"
          ? {
              id: system.id,
              site_id: system.site_id,
              name: system.name,
              mode: system.mode,
              phase: system.phase,
              site: system.site,
              conversationRelationship: "retrieved-record-not-associated-with-active-subject; equipment details withheld",
            }
          : {
              ...system,
              conversationRelationship: conversationState.activeSubject?.systemId === system.id || selectedConversation.data?.project_id === system.id
                ? "explicitly-associated-with-active-subject"
                : "retrieved-record-not-associated-with-active-subject",
            }),
        scope: "Dashboard Wattson is a general solar and electrical assistant with selected-Site awareness. Answer the user's actual question directly first, whether it is general, educational, comparative, diagnostic or specific to a recorded Site/system. selectedSiteWeather is the exact full five-day hourly forecast currently available to PVIntell, including timestamps, timezone, irradiance, cloud cover, precipitation, wind, temperature and UV. For weather, solar-yield, charge-timing or day-specific questions such as ‘on Wednesday’, filter those timestamped hours in the supplied site timezone and use them rather than inventing a general weather narrative. Mention when the forecast was fetched when freshness matters. Explicitly distinguish measured monitoring readings from forecast values. Use the selected Site and its complete installed component, PV-array/string, load, assumption and connection records whenever the question concerns that Site, performance or improvement; do not make the user remind you what is already mounted. connectedSiteSystems may include map_latitude, map_longitude, location_mode and map_location_updated_at. A static system position is installation context. A mobile system position is only the user's last saved guide position: state that limitation when location materially affects the answer and never imply that a boat, vehicle or movable system is permanently there. For azimuth, tilt, yield or expansion questions, explicitly compare the recorded existing arrays with the location-based ideal and distinguish improving the existing installation from proposing a separate new array. Do not force an unrelated Site context onto a genuinely general question. A hypothetical design question is not a request to create a system. Only an explicit new-system request may offer the Start a new system flow; only an explicit schematic creation request may use the separate placeholder Site1/System1 shortcut handled before this prompt. Do not say technical records are unavailable merely because the synthetic dashboard project is empty. You may update an existing system record after a clear user correction or confirmation. Every dashboard action must include the exact project_id from connectedSiteSystems. If a requested Site-specific action has an unclear target after checking the records, ask one focused question instead of taking an action.",
      },
      image,
      allowActions: routeDecision.mutationConsent && !inventoryCapture?.saved,
    });
    const activeSubjectIsUnassociated = conversationState.activeSubject?.association === "unassociated";
    // A system-scoped conversation is already an explicit target. Requiring
    // every follow-up request to repeat projectId caused valid mutations to be
    // discarded whenever the Site contained more than one system.
    const contextualProjectId = parsed.data.projectId
      ?? conversationState.activeSubject?.systemId
      ?? selectedConversation.data?.project_id
      ?? undefined;
    const dashboardTargetIsExplicit = Boolean(contextualProjectId && systemIds.includes(contextualProjectId)) && !activeSubjectIsUnassociated;
    const dashboardTargetIsAmbiguous = !dashboardTargetIsExplicit && (connectedSystems.length > 1 || activeSubjectIsUnassociated);
    const componentReplacementRequested = /\breplace\b[\s\S]{0,120}\b(?:equipment|components?|batter(?:y|ies)|inverters?|panels?|controllers?|generators?)\b|\b(?:equipment|components?|batter(?:y|ies)|inverters?|panels?|controllers?|generators?)\b[\s\S]{0,120}\breplace\b/i.test(parsed.data.message);
    const ownedSystemIds = new Set(systemIds);
    const appliedActions: AppliedWattsonAction[] = [];
    const actionsBySystem = new Map<string, WattsonActionRequest[]>();
    const routedActions = pendingActionRequests(routeDecision);
    const candidateActions = routeDecision.pendingAction ? routedActions : result.actions;
    for (const action of actionsAllowedByDecision(candidateActions, routeDecision)) {
      const projectId = actionProjectId(action);
      if (!projectId || !ownedSystemIds.has(projectId)) continue;
      if (dashboardTargetIsAmbiguous && ["record_added_component", "update_system_component", "replace_system_components", "record_or_update_pv_array", "record_or_update_system_connection", "record_or_update_load", "record_system_knowledge"].includes(action.name)) continue;
      actionsBySystem.set(projectId, [...(actionsBySystem.get(projectId) ?? []), action]);
    }
    let blockedArchitectureQuestion: string | undefined;
    let discoveryFollowup: string | undefined;
    const assessment = (profile.data.onboarding_assessment ?? {}) as Record<string, unknown>;
    const guidedReview = assessment.lastGuidedDiscovery && typeof assessment.lastGuidedDiscovery === "object"
      ? assessment.lastGuidedDiscovery as Record<string, unknown>
      : undefined;
    const guidedSystemId = typeof guidedReview?.systemId === "string" ? guidedReview.systemId : undefined;
    const activeSystem = (!activeSubjectIsUnassociated ? connectedSystems.find((item) => item.id === parsed.data.projectId) : undefined)
      ?? (!activeSubjectIsUnassociated ? connectedSystems.find((item) => item.id === selectedConversation.data?.project_id) : undefined)
      ?? (!activeSubjectIsUnassociated ? connectedSystems.find((item) => item.site_id === conversationSiteId) : undefined)
      ?? (!activeSubjectIsUnassociated ? connectedSystems.find((item) => item.id === guidedSystemId) : undefined)
      ?? (!activeSubjectIsUnassociated && connectedSystems.length === 1 ? connectedSystems[0] : undefined);
    const activeSettings = activeSystem?.settings && typeof activeSystem.settings === "object"
      ? activeSystem.settings as Record<string, unknown>
      : {};
    const recordedDiscovery = activeSettings.designDiscovery && typeof activeSettings.designDiscovery === "object"
      ? activeSettings.designDiscovery as Record<string, unknown>
      : {};
    const monitoringOnlyRequested = Boolean(routeDecision.mutationConsent && activeSystem && completedSystemIntent(parsed.data.message));
    const confirmationReadiness = monitoringOnlyRequested && activeSystem ? await systemConfirmationReadiness(supabase, activeSystem.id) : undefined;
    const monitoringOnlyIntent = monitoringOnlyRequested && Boolean(confirmationReadiness?.ready);
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
    const lastAssistantMessage = priorAssistantMessage;
    const askedDiscoveryKey = discoveryKeyFromAssistantQuestion(lastAssistantMessage);
    const userUncertain = userExpressesUncertainty(parsed.data.message);
    const inferredNewBuilding = activeDiscovery?.[0] === "current_energy_use"
      ? newBuildingDescription(parsed.data.message)
      : null;
    if (routeDecision.mutationConsent && activeSystem && inferredNewBuilding) {
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
    if (routeDecision.mutationConsent && activeSystem && answerDiscoveryKey && !userUncertain && answerMatchesDiscovery(answerDiscoveryKey, parsed.data.message)) {
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
    const updateSummary = appliedActions.map((action) => action.summary).join("; ");
    let message = friendlyMonitoringReferences(result.message.trim(), connectedSystems);
    message = removeAnsweredWattsonQuestions(message, conversationState);
    if (containsUnsupportedSettingsSetupAdvice(message)) {
      message = `${message.replace(/[^.!?]*(?:go|head|navigate) to (?:the )?settings[^.!?]*[.!?]?|[^.!?]*open (?:the )?settings[^.!?]*[.!?]?/gi, "").trim()}${message.trim() ? "\n\n" : ""}You do not need generic Settings for this. I can keep working from the confirmed details in this conversation; a specific PVIntell page should be named only when its actual controls are needed.`.trim();
    }
    if (dashboardTargetIsAmbiguous && /would you like me to add[\s\S]*(?:installed-system|structured)[\s\S]*records/i.test(message)) {
      message = message.replace(/Would you like me to add[\s\S]*?\?\s*$/i, "Would you like me to add that to your structured installed-system records? If so, which Site and system should I use?");
    }
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
    if (monitoringOnlyRequested && !monitoringOnlyIntent)
      message = confirmationReadiness?.message ?? "Confirm every schematic record before commissioning.";
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
    if (componentReplacementRequested && !appliedActions.some((action) => action.type === "component_replaced"))
      message = dashboardTargetIsAmbiguous
        ? "I haven’t changed any equipment yet. Which Site and system contains the equipment you want replaced?"
        : "I haven’t changed those equipment records. I could not match every source item and the replacement to exact structured records, so I need one clarification rather than pretending it was completed.";
    if (!message)
      message = appliedActions.length ? `Done — ${updateSummary}.` : "I didn’t produce a useful reply. Please send that once more.";
    const startFirstSystem = routeDecision.intent === "new_system";
    if (startFirstSystem) {
      message = "Your first step is the guided system setup. It will create the Site and system record together, then lead you through what exists, what you need to power and where panels could go. Nothing will be treated as purchased or installed until you confirm it.";
      conversationState.pendingAction = { kind: "create_system", status: "offered", description: "Start guided system setup" };
    }
    if (inventoryCapture?.saved)
      message = `${message}\n\nI added ${inventoryCapture.equipmentName ?? "this equipment"} to this Site’s inventory from the label photo. I saved only visible label details and marked its physical condition as needing testing; you can review or correct the inventory record at any time.`;
    if (result.offeredAction && !inventoryCapture?.saved) {
      const proposedProjectId = result.offeredAction.action ? actionProjectId(result.offeredAction.action) : undefined;
      const latestImage = [...conversationState.evidence].reverse().find((item) => item.source === "image")?.data;
      const offeredSiteId = activeSystem?.site_id ?? conversationSiteId;
      const actionableRecord = result.offeredAction.action && proposedProjectId && ownedSystemIds.has(proposedProjectId);
      const offeredAttachmentTarget = result.offeredAction.kind === "attach_record"
        ? resolveRecordAttachmentTarget(`${parsed.data.message} ${result.offeredAction.description}`, attachmentComponents, attachmentArrays).target
        : undefined;
      const actionableImage = result.offeredAction.kind === "attach_record" && offeredSiteId && typeof latestImage?.imagePath === "string" && Boolean(offeredAttachmentTarget);
      if (actionableRecord || actionableImage) {
        conversationState.pendingAction = {
          kind: result.offeredAction.kind,
          status: "offered",
          description: result.offeredAction.description,
          siteId: offeredSiteId,
          systemId: proposedProjectId,
          payload: {
            action: result.offeredAction.action,
            imagePath: latestImage?.imagePath,
            mimeType: latestImage?.mimeType,
            attachmentTarget: offeredAttachmentTarget,
          },
        };
      }
    }
    const monitorModeLink = monitoringOnlyIntent && activeSystem
      ? `/sites/${activeSystem.site_id}/systems/${activeSystem.id}?view=monitor`
      : undefined;
    const proposedDesignLink = proposedDesignUpdated && activeSystem
      ? `/sites/${activeSystem.site_id}/systems/${activeSystem.id}/design`
      : undefined;
    const startSystemLink = startFirstSystem ? "/discovery/new-system" : undefined;
    if (routeDecision.mode === "execute" && routeDecision.pendingAction?.status === "confirmed") conversationState = consumeConfirmedPendingAction(conversationState);
    conversationState = recordWattsonAssistantTurn(conversationState, message);
    const stateSaved = await supabase.from("user_conversations").update({ conversation_state: conversationState, site_id: conversationState.activeSubject?.siteId ?? conversationSiteId }).eq("id", conversationId).eq("owner_id", userId);
    if (stateSaved.error) throw stateSaved.error;
    const saved = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: message, structured_context: { provider: "gemini", model: result.model, citations: result.citations, usage: result.usage, actions: appliedActions, imagePath, inventoryCapture, evidenceRevision: conversationState.revision, actionUrl: proposedDesignLink ?? monitorModeLink ?? startSystemLink, actionLabel: proposedDesignLink ? "Open proposed design" : monitorModeLink ? "Open monitor" : startSystemLink ? "Start guided setup" : undefined }, response_to_request_id: parsed.data.requestId });
    if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
    const proposedDesignUrl = proposedDesignUpdated && activeSystem
      ? `/sites/${activeSystem.site_id}/systems/${activeSystem.id}/design`
      : undefined;
    return Response.json({
      conversationId,
      message,
      citations: result.citations,
      actions: appliedActions,
      actionUrl: proposedDesignUrl ?? monitorModeLink ?? startSystemLink,
      actionLabel: proposedDesignUrl ? "Open proposed design" : monitorModeLink ? "Open monitor" : startSystemLink ? "Start guided setup" : undefined,
      inventoryEquipmentId: inventoryCapture?.equipmentId,
    });
  } catch (problem) {
    return Response.json({ error: `Wattson could not complete that request: ${wattsonErrorDetail(problem)}`, conversationId, retryable: true }, { status: 502 });
  }
}
