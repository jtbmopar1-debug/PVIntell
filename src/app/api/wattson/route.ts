import { z } from "zod";
import { askGemini } from "@/ai/gemini";
import { applyWattsonActions, type AppliedWattsonAction } from "@/ai/actions";
import { discoveryGuidance, nextRequiredDiscoveryQuestion, userExpressesUncertainty } from "@/ai/discovery";
import { MockAIProvider } from "@/ai/provider";
import type { Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import { isNewSystemSetupIntent, startHereLabel, startHereMessage, startHereUrl } from "@/ai/new-system-intent";
import { captureSiteInventoryFromLabel, type InventoryPhotoCapture } from "@/ai/inventory-from-label";
import { extractEquipmentLabel } from "@/ai/equipment-label";
import { containsUnsupportedSettingsSetupAdvice, wattsonApplicationCapabilities } from "@/ai/application-capabilities";
import {
  conversationStatePromptContext,
  parseWattsonConversationState,
  recordWattsonAssistantTurn,
  reduceWattsonUserTurn,
  removeAnsweredWattsonQuestions,
} from "@/ai/conversation-state";
import { actionsAllowedByDecision, consumeConfirmedPendingAction, pendingActionRequests, routeWattsonTurn } from "@/ai/conversation-router";
import { conversationTitle, userConversationCount, WATTSON_CONVERSATION_LIMIT } from "@/ai/conversation-limit";
import { loadMonitoringSnapshot } from "@/monitoring/repository";
import { buildMonitoringWattsonContext } from "@/monitoring/wattson-context";
import { loadDailyLogContext } from "@/monitoring/daily-log-repository";
import { requestsSchematicCreation } from "@/ai/schematic-intent";
import { registerGalleryImage } from "@/gallery/register";
import { loadWorkspace } from "@/data/cloud-project";
import { cachedConversationResponse, startedConversationRequest } from "@/ai/conversation-request";
import { attachImageToRecord, requestsExistingRecordAttachment, resolveRecordAttachmentTarget, type RecordAttachmentTarget } from "@/ai/record-attachment";
import { persistRequestedSchematic } from "@/ai/schematic-builder";
import { COMPONENT_REGULATORY_LIBRARY_VERSION, regulatoryJurisdictionKey } from "@/regulations/component-regulatory-library";
import { reconfigurePvTopology, requestedPvTopology } from "@/ai/pv-topology-editor";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.uuid(),
  project: z.custom<Project>(),
  conversationId: z.uuid().optional(),
  requestId: z.uuid().optional(),
  surface: z.enum(["schematic"]).optional(),
});

function proposedArchitectureReply(actions: Array<{ name: string; arguments: unknown }>) {
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
  return `I’ve added ${equipment} to the working design as a proposed item—it is not marked as purchased or installed. Before I develop the first sizing estimate, is there a firm budget or planned future expansion I need to allow for?`;
}

function completedSystemIntent(message: string) {
  return (
    /\b(?:completed|commissioned|already\s+(?:installed|built|operating|running|working)|in\s+place)\b/i.test(message) &&
    /\b(?:not\s+looking\s+to\s+(?:build|design)|not\s+(?:building|designing)|working\s+(?:very\s+)?well|monitor|as[- ]built|commissioned)\b/i.test(message)
  );
}

function structuredRecordChangeIntent(message: string) {
  return /\b(?:update|change|charge(?=\s+to\b)|correct|set|make|standardise|standardize|copy)\b/i.test(message) && /\b(?:records?|equipment|components?|batter(?:y|ies)|inverters?|panels?|pv\s*strings?|arrays?|connections?)\b/i.test(message);
}

function uniformExistingArrayUpdates(message: string, project: Project) {
  const match = message.match(/\b(?:change|charge|set|make|reconfigure)?\s*(?:them|it|the\s+(?:pv\s*)?arrays?)?\s*(?:to|as|into)?\s*(\d+)\s+(?:pv\s*)?arrays?\s+(?:of|with)\s+(\d+)(?:\s+panels?)?\b/i);
  if (!match) return [];
  const arrayCount = Number(match[1]);
  const panelsPerArray = Number(match[2]);
  if (!Number.isInteger(arrayCount) || !Number.isInteger(panelsPerArray) || arrayCount < 1 || panelsPerArray < 1 || project.pvArrays.length !== arrayCount) return [];
  return project.pvArrays.map((array) => ({
    name: "record_or_update_pv_array" as const,
    arguments: {
      operation: "update" as const,
      array_id: array.id,
      array_name: array.name,
      panel_count: panelsPerArray,
      strings: 1,
      panels_per_string: panelsPerArray,
    },
  }));
}

function requestedBulkCount(message: string) {
  const match = message.match(/\ball\s+(\d+)\b/i);
  if (match) return Number(match[1]);
  if (/\bboth\b/i.test(message)) return 2;
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const word = message.match(/\ball\s+(two|three|four|five|six)\b/i)?.[1].toLowerCase();
  return word ? words[word] : undefined;
}

export async function POST(request: Request) {
  let candidate: unknown;
  let imageFile: File | undefined;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData();
    const projectText = form.get("project");
    const file = form.get("file");
    try {
      candidate = {
        message: form.get("message"),
        projectId: form.get("projectId"),
        conversationId: form.get("conversationId") || undefined,
        requestId: form.get("requestId") || undefined,
        surface: form.get("surface") || undefined,
        project:
          typeof projectText === "string" ? JSON.parse(projectText) : null,
      };
    } catch {
      return Response.json(
        { error: "Invalid Wattson project context" },
        { status: 400 },
      );
    }
    if (file instanceof File) imageFile = file;
  } else candidate = await request.json();
  const parsed = requestSchema.safeParse(candidate);
  if (!parsed.success)
    return Response.json({ error: "Invalid Wattson request" }, { status: 400 });
  if (
    imageFile &&
    (!new Set(["image/jpeg", "image/png", "image/webp"]).has(imageFile.type) ||
      !imageFile.size ||
      imageFile.size > 8 * 1024 * 1024)
  )
    return Response.json(
      { error: "Use a JPEG, PNG or WebP image smaller than 8 MB." },
      { status: 400 },
    );

  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cachedRequest = await cachedConversationResponse(supabase, "chat_messages", undefined, parsed.data.requestId);
  if (cachedRequest) return Response.json(cachedRequest);
  const startedRequest = await startedConversationRequest(supabase, "chat_messages", undefined, parsed.data.requestId);
  if (startedRequest) return Response.json({ error: "That message is already being handled, so Wattson did not run its actions again.", conversationId: startedRequest.conversationId, retryable: false }, { status: 409 });

  const owned = await supabase
    .from("projects")
    .select("id,site_id")
    .eq("id", parsed.data.projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned.error || !owned.data)
    return Response.json({ error: "Project not found" }, { status: 404 });
  let conversation = parsed.data.conversationId
    ? await supabase.from("conversations").select("id,title,conversation_state").eq("project_id", parsed.data.projectId).eq("id", parsed.data.conversationId).maybeSingle()
    : await supabase.from("conversations").select("id,title,conversation_state").eq("project_id", parsed.data.projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (conversation.error)
    return Response.json({ error: conversation.error.message }, { status: 400 });
  if (parsed.data.conversationId && !conversation.data)
    return Response.json({ error: "That Wattson conversation was not found." }, { status: 404 });
  let image: { data: string; mimeType: string } | undefined;
  let imageBytes: Uint8Array | undefined;
  let imagePath: string | undefined;
  let imageUrl: string | undefined;
  if (imageFile) {
    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    imageBytes = bytes;
    image = {
      data: Buffer.from(bytes).toString("base64"),
      mimeType: imageFile.type,
    };
    const extension =
      imageFile.type === "image/png"
        ? "png"
        : imageFile.type === "image/webp"
          ? "webp"
          : "jpg";
    imagePath = `${userId}/${parsed.data.projectId}/wattson/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage
      .from("project-photos")
      .upload(imagePath, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      });
    if (uploaded.error)
      return Response.json(
        {
          error: `Wattson could not store the image: ${uploaded.error.message}`,
        },
        { status: 400 },
      );
    try { await registerGalleryImage(supabase, { ownerId: userId, storagePath: imagePath, fileName: imageFile.name, mimeType: imageFile.type, source: "wattson" }); }
    catch (problem) { await supabase.storage.from("project-photos").remove([imagePath]); return Response.json({ error: problem instanceof Error ? problem.message : "Could not add the chat image to Gallery." }, { status: 409 }); }
    const signed = await supabase.storage
      .from("project-photos")
      .createSignedUrl(imagePath, 3600);
    imageUrl = signed.data?.signedUrl;
  }
  if (!conversation.data) {
    if (await userConversationCount(supabase, userId) >= WATTSON_CONVERSATION_LIMIT)
      return Response.json({ error: `You have reached the ${WATTSON_CONVERSATION_LIMIT}-chat limit. Delete an old chat from Wattson chats before starting another.` }, { status: 409 });
    const created = await supabase
      .from("conversations")
      .insert({
        project_id: parsed.data.projectId,
        title: "Wattson project discovery",
      })
      .select("id,conversation_state")
      .single();
    if (created.error)
      return Response.json({ error: created.error.message }, { status: 400 });
    conversation = { ...conversation, data: { ...created.data, title: "Wattson project discovery" } };
  }

  const conversationId = conversation.data?.id;
  if (!conversationId)
    return Response.json(
      { error: "Could not create conversation" },
      { status: 500 },
    );
  let inventoryCapture: InventoryPhotoCapture | undefined;
  if (imagePath && imageBytes && imageFile) {
    const imageDecision = routeWattsonTurn(parsed.data.message, parseWattsonConversationState(conversation.data?.conversation_state));
    if (imageDecision.mutationConsent && imageDecision.intent === "record_attachment" && !requestsExistingRecordAttachment(parsed.data.message)) {
      inventoryCapture = await captureSiteInventoryFromLabel({ supabase, siteId: owned.data.site_id, imagePath, imageBytes, mimeType: imageFile.type });
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
  // The browser project snapshot is transport compatibility only. Reload the
  // canonical record so stale UI state cannot replace confirmed database facts.
  const canonicalProject = (await loadWorkspace(supabase, parsed.data.projectId, conversationId)).project;
  const userInsert = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: parsed.data.message,
      structured_context: imagePath
        ? { imagePath, mimeType: imageFile?.type }
        : {},
      client_request_id: parsed.data.requestId,
    });
  if (userInsert.error)
    return Response.json({ error: userInsert.error.message, conversationId }, { status: userInsert.error.code === "23505" ? 409 : 400 });
  if (!conversation.data?.title || /^Wattson (?:project discovery|conversation)$/i.test(conversation.data.title))
    await supabase.from("conversations").update({ title: conversationTitle(parsed.data.message) }).eq("id", conversationId);

  const recent = await supabase
    .from("chat_messages")
    .select("role,content,structured_context")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(40);
  const history = (recent.data ?? []).reverse();
  const priorHistory =
    history.at(-1)?.role === "user" &&
    history.at(-1)?.content === parsed.data.message
      ? history.slice(0, -1)
      : history;
  const priorAssistantMessage = [...priorHistory].reverse().find((item) => item.role === "assistant")?.content ?? "";
  let conversationState = reduceWattsonUserTurn(conversation.data?.conversation_state, parsed.data.message, {
    site: { id: owned.data.site_id, name: canonicalProject.location || "Current Site" },
    system: { id: parsed.data.projectId, name: canonicalProject.name },
    image: imagePath ? { imagePath, mimeType: imageFile?.type, extraction: inventoryCapture?.extraction as Record<string, unknown> | undefined, warning: inventoryCapture?.warning } : undefined,
  });
  if (parsed.data.surface === "schematic") {
    conversationState.activeSubject = {
      kind: "setup",
      description: `${canonicalProject.name} schematic`,
      association: "system",
      siteId: owned.data.site_id,
      siteName: canonicalProject.location || "Current Site",
      systemId: parsed.data.projectId,
      systemName: canonicalProject.name,
    };
  }
  const routeDecision = routeWattsonTurn(parsed.data.message, conversationState);
  conversationState.activeIntent = routeDecision.intent;
  const userStateSaved = await supabase.from("conversations").update({ conversation_state: conversationState }).eq("id", conversationId);
  if (userStateSaved.error) return Response.json({ error: userStateSaved.error.message, conversationId }, { status: 400 });
  const topologyRequest = parsed.data.surface === "schematic" && routeDecision.mutationConsent ? requestedPvTopology(parsed.data.message) : null;
  if (topologyRequest) {
    try {
      const topology = await reconfigurePvTopology(supabase, parsed.data.projectId, topologyRequest);
      conversationState.completedActions.push({ kind: "record_equipment", revision: conversationState.revision, description: topology.summary, siteId: owned.data.site_id, systemId: parsed.data.projectId });
      const stateSaved = await supabase.from("conversations").update({ conversation_state: conversationState }).eq("id", conversationId);
      if (stateSaved.error) throw stateSaved.error;
      const replySaved = await supabase.from("chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: topology.summary, structured_context: { evidenceRevision: conversationState.revision, topologyRequest }, response_to_request_id: parsed.data.requestId });
      if (replySaved.error) throw replySaved.error;
      return Response.json({ conversationId, message: topology.summary, actions: [{ type: "pv_topology_updated", summary: topology.summary }] });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The topology could not be updated";
      const message = `I haven’t changed the schematic because the complete PV topology could not be saved safely. ${detail}`;
      await supabase.from("chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: message, structured_context: { evidenceRevision: conversationState.revision, topologyRequest, topologyError: detail }, response_to_request_id: parsed.data.requestId });
      return Response.json({ conversationId, message, actions: [] });
    }
  }
  if (routeDecision.intent === "schematic" && routeDecision.mode === "execute" && requestsSchematicCreation(parsed.data.message, priorAssistantMessage)) {
    const schematicId = parsed.data.projectId;
    const actionUrl = `/sites/${owned.data.site_id}/systems/${schematicId}/schematic`;
    const completed = conversationState.completedActions.some((action) => action.kind === "create_schematic" && action.systemId === schematicId);
    let message = "It is already built. Open the schematic below.";
    let schematicAction: Record<string, unknown> | undefined;
    if (!completed) {
      try {
        const built = await persistRequestedSchematic({
          supabase,
          projectId: schematicId,
          message: parsed.data.message,
          priorUserText: priorHistory.filter((item) => item.role === "user").map((item) => item.content).join("\n"),
          fallbackPanelWatts: Number(conversationState.facts.find((fact) => fact.key === "panel.rated_power_w")?.value ?? 0) || undefined,
        });
        const pvSummary = built.arrayIds.length && built.panelsPerArray
          ? `${built.arrayCount} strings of ${built.panelsPerArray}${built.panelWatts ? ` × ${built.panelWatts} W` : " panels"}`
          : undefined;
        message = `Built the requested installed-system schematic${pvSummary ? ` with ${pvSummary}` : ""}. Missing electrical ratings remain TBC until verified. Open it below.`;
        schematicAction = { type: "schematic_built", summary: "Created requested schematic records", ...built };
      } catch (problem) {
        const detail = problem instanceof Error ? problem.message : "Unknown schematic creation error";
        const errorMessage = `I could not create the schematic because PVIntell returned this technical error: ${detail}`;
        await supabase.from("chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: errorMessage, structured_context: { evidenceRevision: conversationState.revision, schematicCreationError: detail }, response_to_request_id: parsed.data.requestId });
        return Response.json({ conversationId, message: errorMessage, actions: [] });
      }
    }
    conversationState.pendingAction = undefined;
    if (!completed) {
      conversationState.completedActions.push({ kind: "create_schematic", revision: conversationState.revision, description: "Created installed-system schematic", siteId: owned.data.site_id, systemId: schematicId, result: { actionUrl } });
    }
    conversationState = recordWattsonAssistantTurn(conversationState, message);
    const stateSaved = await supabase.from("conversations").update({ conversation_state: conversationState }).eq("id", conversationId);
    if (stateSaved.error) return Response.json({ error: stateSaved.error.message }, { status: 400 });
    const saved = await supabase.from("chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: message, structured_context: { evidenceRevision: conversationState.revision, schematicId, actionUrl, actionLabel: "Open schematic" }, response_to_request_id: parsed.data.requestId });
    if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
    return Response.json({ conversationId, message, schematicId, actionUrl, actionLabel: "Open schematic", actions: schematicAction ? [schematicAction] : [] });
  }
  if (routeDecision.intent === "new_system" && isNewSystemSetupIntent(parsed.data.message)) {
    const message = startHereMessage();
    conversationState.pendingAction = { kind: "create_system", status: "offered", description: "Start guided system setup" };
    conversationState = recordWattsonAssistantTurn(conversationState, message);
    const stateSaved = await supabase.from("conversations").update({ conversation_state: conversationState }).eq("id", conversationId);
    if (stateSaved.error) return Response.json({ error: stateSaved.error.message }, { status: 400 });
    const saved = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: message,
      structured_context: { kind: "start_here_handoff", evidenceRevision: conversationState.revision, actionUrl: startHereUrl, actionLabel: startHereLabel },
      response_to_request_id: parsed.data.requestId,
    });
    if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
    return Response.json({ conversationId, message, actionUrl: startHereUrl, actionLabel: startHereLabel, actions: [] });
  }
  const questionnaireResult = await supabase
    .from("questionnaire_responses")
    .select("template_key,status,answers")
    .eq("project_id", parsed.data.projectId);
  if (questionnaireResult.error)
    return Response.json(
      { error: questionnaireResult.error.message },
      { status: 400 },
    );
  const profileResult = await supabase
    .from("profiles")
    .select("home_location,timezone,onboarding_assessment")
    .eq("id", userId)
    .single();
  if (profileResult.error)
    return Response.json(
      { error: profileResult.error.message },
      { status: 400 },
    );
  const siteResult = await supabase
    .from("sites")
    .select("id,name,location,location_confirmed")
    .eq("id", owned.data.site_id)
    .eq("owner_id", userId)
    .single();
  if (siteResult.error)
    return Response.json({ error: siteResult.error.message }, { status: 400 });
  const equipmentResult = await supabase
    .from("site_equipment")
    .select(
      "id,type,name,manufacturer,model,quantity,condition,status,specifications,assigned_project_id",
    )
    .eq("site_id", owned.data.site_id);
  if (equipmentResult.error)
    return Response.json(
      { error: equipmentResult.error.message },
      { status: 400 },
    );
  const siteSystemsResult = await supabase
    .from("projects")
    .select("id,name,mode,phase,system_voltage,settings")
    .eq("site_id", owned.data.site_id);
  if (siteSystemsResult.error)
    return Response.json(
      { error: siteSystemsResult.error.message },
      { status: 400 },
    );
  const siteSystemIds = (siteSystemsResult.data ?? []).map(
    (system) => system.id,
  );
  const [siteComponentsResult, siteArraysResult, siteConnectionsResult] = siteSystemIds.length
    ? await Promise.all([
        supabase
          .from("system_components")
          .select(
            "id,project_id,type,display_name,manufacturer,model,quantity,installation_location,specifications,notes,confidence",
          )
          .in("project_id", siteSystemIds),
        supabase
          .from("pv_arrays")
          .select(
            "id,project_id,name,manufacturer,panel_model,panel_type,panel_watts,panel_count,specifications,confidence",
          )
          .in("project_id", siteSystemIds),
        supabase
          .from("system_connections")
          .select(
            "id,project_id,source_ref,target_ref,name,connection_type,polarity,cable_size,cable_length,breaker_size,fuse_size,isolator,route,notes,confidence",
          )
          .in("project_id", siteSystemIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  const connectionTableMissing =
    siteConnectionsResult.error?.code === "PGRST205" ||
    siteConnectionsResult.error?.code === "42P01";
  if (
    siteComponentsResult.error ||
    siteArraysResult.error ||
    (siteConnectionsResult.error && !connectionTableMissing)
  )
    return Response.json(
      {
        error:
          siteComponentsResult.error?.message ??
          siteArraysResult.error?.message ??
          siteConnectionsResult.error?.message,
      },
      { status: 400 },
    );
  const attachmentComponents = (siteComponentsResult.data ?? []).filter((component) => component.project_id === parsed.data.projectId);
  const attachmentArrays = (siteArraysResult.data ?? []).filter((array) => array.project_id === parsed.data.projectId);
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
    let attachmentMessage: string;
    if (!targetResult.target) {
      const choices = (targetResult.candidates ?? []).map((candidate) => candidate.name).join(", ");
      attachmentMessage = choices
        ? `I haven’t attached the image because more than one record matches. Which one do you mean: ${choices}?`
        : "I haven’t attached the image because I can’t identify one exact existing record. Which component or PV array should it belong to?";
    } else if (typeof attachmentImagePath !== "string") {
      attachmentMessage = "I haven’t attached anything because this conversation does not have an image available for that action.";
    } else {
      const attached = await attachImageToRecord(supabase, targetResult.target, attachmentImagePath);
      attachmentMessage = `${attached.summary}.`;
      conversationState.pendingAction = undefined;
      conversationState.completedActions.push({ kind: "attach_record", revision: conversationState.revision, description: attached.summary, siteId: owned.data.site_id, systemId: targetResult.target.projectId, result: { imagePath: attachmentImagePath, attachmentTarget: targetResult.target } });
    }
    conversationState = recordWattsonAssistantTurn(conversationState, attachmentMessage);
    const attachmentStateSaved = await supabase.from("conversations").update({ conversation_state: conversationState }).eq("id", conversationId);
    if (attachmentStateSaved.error) return Response.json({ error: attachmentStateSaved.error.message, conversationId }, { status: 400 });
    const attachmentReplySaved = await supabase.from("chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: attachmentMessage, structured_context: { evidenceRevision: conversationState.revision, imagePath: attachmentImagePath, attachmentTarget: targetResult.target }, response_to_request_id: parsed.data.requestId });
    if (attachmentReplySaved.error) return Response.json({ error: attachmentReplySaved.error.message, conversationId }, { status: 400 });
    return Response.json({ conversationId, message: attachmentMessage, actions: targetResult.target ? [{ type: "record_attachment", summary: attachmentMessage }] : [], imagePath: attachmentImagePath, imageUrl });
  }
  const connectedSiteSystems = (siteSystemsResult.data ?? []).map((system) => ({
    ...system,
    selected: system.id === parsed.data.projectId,
    components: (siteComponentsResult.data ?? []).filter(
      (component) => component.project_id === system.id,
    ),
    pvStrings: (siteArraysResult.data ?? []).filter(
      (array) => array.project_id === system.id,
    ),
    connections: (siteConnectionsResult.data ?? []).filter(
      (connection) => connection.project_id === system.id,
    ),
  }));
  const activeSubjectIsUnassociated = conversationState.activeSubject?.association === "unassociated";
  const groundedProject = activeSubjectIsUnassociated
    ? {
        ...canonicalProject,
        name: "Saved project context withheld — active setup is not associated",
        description: "",
        goal: "",
        priorities: [],
        loads: [],
        assumptions: [],
        components: [],
        connections: [],
        designCalculator: undefined,
        designDiscovery: undefined,
        pvArrays: [],
        installationSteps: [],
        commissioning: [],
      }
    : canonicalProject;
  const groundedSiteEquipment = activeSubjectIsUnassociated ? [] : equipmentResult.data ?? [];
  const groundedSiteSystems = connectedSiteSystems.map((system) => activeSubjectIsUnassociated
    ? {
        id: system.id,
        name: system.name,
        mode: system.mode,
        phase: system.phase,
        system_voltage: system.system_voltage,
        selected: system.selected,
        conversationRelationship: "retrieved-record-not-associated-with-active-subject; equipment details withheld",
      }
    : {
        ...system,
        conversationRelationship: conversationState.activeSubject?.systemId === system.id || system.selected
          ? "explicitly-associated-with-active-subject"
          : "retrieved-record-not-associated-with-active-subject",
      });
  const selectedSystem = connectedSiteSystems.find((system) => system.id === parsed.data.projectId);
  let currentRegulatoryGuidance: Array<Record<string, unknown>> = [];
  if (siteResult.data.location_confirmed && siteResult.data.location) {
    const regulatoryCache = await supabase
      .from("component_regulatory_guidance")
      .select("component_kind,jurisdiction_label,guidance_markdown,citations,checked_at,refresh_after,topic_library_version")
      .eq("owner_id", userId)
      .eq("jurisdiction_key", regulatoryJurisdictionKey(siteResult.data.location))
      .eq("topic_library_version", COMPONENT_REGULATORY_LIBRARY_VERSION)
      .gt("refresh_after", new Date().toISOString());
    if (!regulatoryCache.error) currentRegulatoryGuidance = regulatoryCache.data ?? [];
  }
  const monitoringOnlyIntent = routeDecision.mutationConsent && completedSystemIntent(parsed.data.message);
  let phaseMovedToMonitor = false;
  if (monitoringOnlyIntent && selectedSystem?.phase !== "monitor") {
    const phaseUpdated = await supabase.from("projects").update({ phase: "monitor" }).eq("id", parsed.data.projectId).eq("owner_id", userId);
    if (phaseUpdated.error) return Response.json({ error: phaseUpdated.error.message }, { status: 400 });
    if (selectedSystem) selectedSystem.phase = "monitor";
    canonicalProject.phase = "monitor";
    phaseMovedToMonitor = true;
  }

  let message: string;
  let citations: Array<{ title: string; url: string }> = [];
  let appliedActions: AppliedWattsonAction[] = [];
  if (phaseMovedToMonitor) appliedActions.push({ type: "settings_updated", summary: "Set system phase to monitor" });
  let structuredContext: Record<string, unknown>;
  if (process.env.GEMINI_API_KEY) {
    try {
      let monitoringContext: unknown;
      try {
        monitoringContext = buildMonitoringWattsonContext(await loadMonitoringSnapshot(supabase, userId, owned.data.site_id, parsed.data.projectId));
      } catch { /* Monitoring must not break non-monitoring Wattson conversations. */ }
      const result = await askGemini({
        message: parsed.data.message,
        project: {
          ...groundedProject,
          location: siteResult.data.location_confirmed && siteResult.data.location
            ? siteResult.data.location
            : "Location not set",
        },
        recentConversation: priorHistory,
        questionnaireContext: {
          conversationState: conversationStatePromptContext(conversationState),
          applicationCapabilities: wattsonApplicationCapabilities(),
          dailyMonitorLog: activeSubjectIsUnassociated ? undefined : await loadDailyLogContext(supabase, userId, { systemId: parsed.data.projectId, siteId: owned.data.site_id }),
          onboardingLocation: profileResult.data.home_location,
          userTimezone: profileResult.data.timezone,
          userAssessment: profileResult.data.onboarding_assessment ?? {},
          selectedSite: siteResult.data,
          responses: activeSubjectIsUnassociated ? [] : questionnaireResult.data ?? [],
          siteEquipment: groundedSiteEquipment,
          inventoryLabelCapture: inventoryCapture,
          connectedSiteSystems: groundedSiteSystems,
          currentRegulatoryGuidance,
        },
        monitoringContext: activeSubjectIsUnassociated ? undefined : monitoringContext,
        image,
        allowActions: routeDecision.mutationConsent && !inventoryCapture?.saved,
      });
      const systemSettings = selectedSystem?.settings;
      const monitoringOnlySystem = monitoringOnlyIntent || selectedSystem?.phase === "monitor";
      const currentDiscovery = monitoringOnlySystem ? undefined : nextRequiredDiscoveryQuestion(systemSettings);
      const nextDiscovery = monitoringOnlySystem ? undefined : nextRequiredDiscoveryQuestion(systemSettings, result.actions);
      const blockedArchitecture = result.actions.some((action) => action.name === "record_design_preference") && nextDiscovery;
      const uncertainDiscovery = userExpressesUncertainty(parsed.data.message) && Boolean(currentDiscovery);
      const recordChangeRequested = structuredRecordChangeIntent(parsed.data.message);
      const routedActions = pendingActionRequests(routeDecision);
      const deterministicArrayUpdates = uniformExistingArrayUpdates(parsed.data.message, canonicalProject);
      const candidateActions = deterministicArrayUpdates.length ? deterministicArrayUpdates : routeDecision.pendingAction ? routedActions : result.actions;
      const toolActions = await applyWattsonActions(
        supabase,
        parsed.data.projectId,
        actionsAllowedByDecision(candidateActions, routeDecision).filter((action) =>
          !activeSubjectIsUnassociated
          && !(monitoringOnlySystem && ["record_design_discovery", "record_design_preference", "record_preliminary_design", "record_proposed_component"].includes(action.name))
          &&
          (action.name !== "record_design_preference" || !blockedArchitecture)
          && (action.name !== "record_design_discovery" || !uncertainDiscovery)
          && !(recordChangeRequested && action.name === "record_system_knowledge")
        ),
      );
      appliedActions = [...appliedActions, ...toolActions];
      const updateSummary = appliedActions
        .map((action) => action.summary)
        .join("; ");
      message = result.message.trim();
      const architectureReply = appliedActions.some(
        (action) => action.type === "design_preference_updated",
      )
        ? proposedArchitectureReply(result.actions)
        : null;
      const discoveryReply = appliedActions.some(
        (action) => action.type === "design_discovery_updated",
      )
        ? nextDiscovery
          ? `I’ve added that to the design discovery notes. ${nextDiscovery[1]}`
          : "I’ve added that to the design discovery notes. The basic energy and site discovery is now complete."
        : null;
      if (!message && architectureReply) message = architectureReply;
      if (!message && discoveryReply) message = discoveryReply;
      if (blockedArchitecture)
        message = `We’re still in discovery, so I haven’t added an inverter arrangement yet. ${blockedArchitecture[1]}`;
      if (uncertainDiscovery)
        message = `No problem—I haven’t saved that as an answer. ${currentDiscovery ? discoveryGuidance(currentDiscovery[0]) : "Tell me which part is unclear and I’ll explain it another way."}`;
      if (monitoringOnlyIntent)
        message = `Understood - I’ve set ${selectedSystem?.name ?? canonicalProject.name} to monitor mode. I won’t run design discovery or build prompts for this system; Wattson will treat it as a commissioned as-built installation for monitoring, diagnostics and record-keeping.`;
      if (updateSummary && message !== architectureReply && message !== discoveryReply)
        message = message
          ? `${message}\n\nUpdated in PVIntell: ${updateSummary}.`
          : `Done — ${updateSummary}.`;
      if (recordChangeRequested) {
        const recordUpdates = appliedActions.filter((action) => ["component_updated", "pv_array_updated", "connection_updated", "settings_updated"].includes(action.type));
        const requestedCount = requestedBulkCount(parsed.data.message);
        if (!recordUpdates.length) {
          message = "I haven’t changed those records. I could not map that request to the exact structured records and fields, so I need one clarification rather than pretending it was completed.";
        } else if (requestedCount && recordUpdates.length < requestedCount) {
          message = `I updated ${recordUpdates.length} of the ${requestedCount} requested records, so this is not complete yet. ${recordUpdates.map((action) => action.summary).join("; ")}.`;
        }
      }
      if (!message)
        message = result.actions.length
          ? "I couldn’t safely apply that change to a specific record. Tell me which item it belongs to."
          : "I didn’t produce a useful reply. Please send that once more.";
      message = removeAnsweredWattsonQuestions(message, conversationState);
      if (containsUnsupportedSettingsSetupAdvice(message)) {
        const withoutSettingsAdvice = message.replace(/[^.!?]*(?:go|head|navigate) to (?:the )?settings[^.!?]*[.!?]?|[^.!?]*open (?:the )?settings[^.!?]*[.!?]?/gi, "").trim();
        message = `${withoutSettingsAdvice}${withoutSettingsAdvice ? "\n\n" : ""}You do not need generic Settings for this. I can keep working from the confirmed details in this conversation; a specific PVIntell page should be named only when its actual controls are needed.`;
      }
      if (result.offeredAction && !inventoryCapture?.saved) {
        const latestImage = [...conversationState.evidence].reverse().find((item) => item.source === "image")?.data;
        const offeredAction = result.offeredAction.action;
        const actionTargetsThisSystem = offeredAction?.arguments && typeof offeredAction.arguments === "object"
          && (!("project_id" in offeredAction.arguments) || (offeredAction.arguments as Record<string, unknown>).project_id === parsed.data.projectId);
        const offeredAttachmentTarget = result.offeredAction.kind === "attach_record"
          ? resolveRecordAttachmentTarget(`${parsed.data.message} ${result.offeredAction.description}`, attachmentComponents, attachmentArrays).target
          : undefined;
        const actionableImage = result.offeredAction.kind === "attach_record" && typeof latestImage?.imagePath === "string" && Boolean(offeredAttachmentTarget);
        if (actionTargetsThisSystem || actionableImage) {
          conversationState.pendingAction = {
            kind: result.offeredAction.kind,
            status: "offered",
            description: result.offeredAction.description,
            siteId: owned.data.site_id,
            systemId: parsed.data.projectId,
            payload: { action: offeredAction, imagePath: latestImage?.imagePath, mimeType: latestImage?.mimeType, attachmentTarget: offeredAttachmentTarget },
          };
        }
      }
      citations = result.citations;
      structuredContext = {
        provider: "gemini",
        projectId: parsed.data.projectId,
        model: result.model,
        searched: result.searched,
        citations,
        usage: result.usage,
        actions: appliedActions,
        imagePath,
        inventoryCapture,
        evidenceRevision: conversationState.revision,
      };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown Gemini error";
      return Response.json(
        { error: `Wattson could not reach Gemini: ${detail}`, conversationId, retryable: true },
        { status: 502 },
      );
    }
  } else {
    message = await new MockAIProvider().sendMessage(parsed.data.message, {
      project: groundedProject,
    });
    structuredContext = { provider: "mock", projectId: parsed.data.projectId, evidenceRevision: conversationState.revision };
  }
  if (inventoryCapture?.saved)
    message = `${message}\n\nI added ${inventoryCapture.equipmentName ?? "this equipment"} to this Site’s inventory from the label photo. I saved only visible label details and marked its physical condition as needing testing; you can review or correct the inventory record at any time.`;

  if (routeDecision.mode === "execute" && routeDecision.pendingAction?.status === "confirmed") conversationState = consumeConfirmedPendingAction(conversationState);
  conversationState = recordWattsonAssistantTurn(conversationState, message);
  const stateSaved = await supabase.from("conversations").update({ conversation_state: conversationState }).eq("id", conversationId);
  if (stateSaved.error) return Response.json({ error: stateSaved.error.message }, { status: 400 });

  const assistantInsert = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: message,
      structured_context: structuredContext,
      response_to_request_id: parsed.data.requestId,
    });
  if (assistantInsert.error)
    return Response.json(
      { error: assistantInsert.error.message },
      { status: 400 },
    );
  return Response.json({
    conversationId,
    message,
    provider: structuredContext.provider,
    citations,
    actions: appliedActions,
    imageUrl,
    imagePath,
    inventoryEquipmentId: inventoryCapture?.equipmentId,
  });
}
