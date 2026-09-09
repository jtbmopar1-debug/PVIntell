import { z } from "zod";
import { askGemini } from "@/ai/gemini";
import { demoProject } from "@/data/demo-project";
import { createClient } from "@/lib/supabase/server";
import { userConversationCount, WATTSON_CONVERSATION_LIMIT } from "@/ai/conversation-limit";

const schema = z.object({
  message: z.string().trim().min(1).max(3000),
  conversationId: z.uuid().optional(),
  discoveryDraftId: z.uuid().optional(),
  siteId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  discoveryAnswers: z.record(z.string(), z.union([z.string().max(4000), z.number(), z.array(z.string().max(100)).max(20)])).optional(),
  question: z.object({
    id: z.string().max(120), title: z.string().max(500), stage: z.string().max(120), help: z.string().max(2000),
    options: z.array(z.object({ value: z.string().max(200), label: z.string().max(300), description: z.string().max(1000) })).max(30).optional(),
  }),
  recentConversation: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(8),
});

export async function POST(request: Request) {
  let rawPayload: unknown;
  let imageFile: File | undefined;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData();
    const payload = form.get("payload");
    const file = form.get("file");
    try { rawPayload = typeof payload === "string" ? JSON.parse(payload) : undefined; }
    catch { rawPayload = undefined; }
    if (file instanceof File) imageFile = file;
  } else rawPayload = await request.json();
  const parsed = schema.safeParse(rawPayload);
  if (!parsed.success) return Response.json({ error: "Invalid discovery help request." }, { status: 400 });
  if (imageFile && (!new Set(["image/jpeg", "image/png", "image/webp"]).has(imageFile.type) || !imageFile.size || imageFile.size > 8 * 1024 * 1024)) {
    return Response.json({ error: "Use a JPEG, PNG or WebP image smaller than 8 MB." }, { status: 400 });
  }
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });

  let location = "Location not set"; let siteName = "New system";
  if (parsed.data.siteId) {
    const site = await supabase.from("sites").select("id,name,location").eq("id", parsed.data.siteId).eq("owner_id", userId).maybeSingle();
    if (site.error || !site.data) return Response.json({ error: "Site not found." }, { status: 404 });
    location = site.data.location ?? location; siteName = site.data.name;
  }
  if (parsed.data.projectId) {
    const project = await supabase.from("projects").select("id,name,site_id").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
    if (project.error || !project.data) return Response.json({ error: "System not found." }, { status: 404 });
    siteName = project.data.name;
  }

  let conversationId = parsed.data.conversationId;
  if (!conversationId && parsed.data.discoveryDraftId) {
    const draft = await supabase.from("discovery_drafts").select("conversation_id").eq("id", parsed.data.discoveryDraftId).eq("owner_id", userId).maybeSingle();
    if (draft.error || !draft.data) return Response.json({ error: "Discovery draft not found." }, { status: 404 });
    conversationId = draft.data.conversation_id ?? undefined;
  }
  const helpContext = parsed.data.question.stage === "Build It" || parsed.data.question.id.startsWith("build_") ? "build" : parsed.data.question.stage === "Configure" || parsed.data.question.id.startsWith("configure_") ? "configure" : parsed.data.question.stage === "Schematic" || parsed.data.question.id.startsWith("schematic_") ? "schematic" : "discovery";
  const discoveryName = typeof parsed.data.discoveryAnswers?.system_name === "string" ? parsed.data.discoveryAnswers.system_name.trim() : "";
  const conversationName = discoveryName || (parsed.data.projectId ? siteName : "");
  const conversationTitle = helpContext === "discovery"
    ? conversationName ? `Discovery — ${conversationName}` : "Guided system discovery"
    : `${helpContext === "build" ? "Build It" : helpContext === "configure" ? "Configure" : "Schematic"} — ${parsed.data.question.title}`;
  if (!conversationId) {
    const existing = await supabase.from("user_conversations").select("id,title,site_id,project_id").eq("owner_id", userId).order("updated_at", { ascending: false }).limit(100);
    if (existing.error) return Response.json({ error: existing.error.message }, { status: 400 });
    const normalizedName = discoveryName.toLocaleLowerCase();
    conversationId = (existing.data ?? []).find((item) => {
      if (!/discovery/i.test(item.title ?? "")) return false;
      if (parsed.data.projectId && item.project_id === parsed.data.projectId) return true;
      if (parsed.data.siteId && item.site_id === parsed.data.siteId) return true;
      return Boolean(normalizedName && (item.title ?? "").toLocaleLowerCase().includes(normalizedName));
    })?.id;
  }
  const topicIntroduction = `${helpContext === "discovery" ? "Discovery topic" : helpContext === "build" ? "Build It item" : helpContext === "configure" ? "Configuration item" : "Schematic item"}: ${parsed.data.question.title}\n\nLet’s work only on this item. What part would you like me to explain or help you identify?`;
  if (conversationId) {
    const owned = await supabase.from("user_conversations").select("id").eq("id", conversationId).eq("owner_id", userId).maybeSingle();
    if (owned.error || !owned.data) return Response.json({ error: "Discovery chat not found." }, { status: 404 });
    await supabase.from("user_conversations").update({ title: conversationTitle }).eq("id", conversationId).eq("owner_id", userId);
    const recentSubjects = await supabase.from("user_chat_messages").select("structured_context").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(12);
    const latestQuestionId = (recentSubjects.data ?? []).map((message) => message.structured_context && typeof message.structured_context === "object" ? message.structured_context as Record<string, unknown> : {}).map((context) => typeof context.questionId === "string" ? context.questionId : context.question && typeof context.question === "object" && "id" in context.question ? String((context.question as Record<string, unknown>).id) : undefined).find(Boolean);
    if (latestQuestionId !== parsed.data.question.id) {
      await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: topicIntroduction, structured_context: { kind: "discovery_topic", questionId: parsed.data.question.id, question: parsed.data.question, discoveryAnswers: parsed.data.discoveryAnswers ?? {} } });
    }
  } else {
    if (await userConversationCount(supabase, userId) >= WATTSON_CONVERSATION_LIMIT) return Response.json({ error: `You have reached the ${WATTSON_CONVERSATION_LIMIT}-chat limit. Delete an old chat from Wattson chats before starting another.` }, { status: 409 });
    const created = await supabase.from("user_conversations").insert({ owner_id: userId, site_id: parsed.data.siteId ?? null, project_id: parsed.data.projectId ?? null, title: conversationTitle }).select("id").single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    conversationId = created.data.id;
    if (parsed.data.discoveryDraftId) {
      const linked = await supabase.from("discovery_drafts").update({ conversation_id: conversationId }).eq("id", parsed.data.discoveryDraftId).eq("owner_id", userId);
      if (linked.error) return Response.json({ error: linked.error.message }, { status: 400 });
    }
    await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: topicIntroduction, structured_context: { kind: "discovery_help", question: parsed.data.question, questionId: parsed.data.question.id, discoveryAnswers: parsed.data.discoveryAnswers ?? {} } });
  }
  if (parsed.data.siteId || parsed.data.projectId) {
    await supabase.from("user_conversations").update({ site_id: parsed.data.siteId ?? null, project_id: parsed.data.projectId ?? null, title: conversationTitle }).eq("id", conversationId).eq("owner_id", userId);
  }
  const image = imageFile ? { data: Buffer.from(await imageFile.arrayBuffer()).toString("base64"), mimeType: imageFile.type } : undefined;
  const userContent = imageFile ? `${parsed.data.message}\n\n[Attached image: ${imageFile.name}]` : parsed.data.message;
  const userWrite = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "user", content: userContent, structured_context: { kind: "discovery_help", questionId: parsed.data.question.id, imageName: imageFile?.name, mimeType: imageFile?.type } });
  if (userWrite.error) return Response.json({ error: userWrite.error.message }, { status: 400 });

  const question = parsed.data.question;
  const discoveryAnswers = parsed.data.discoveryAnswers ?? {};
  const customBatterySelected = question.id === "battery_chemistry" && discoveryAnswers.battery_chemistry === "custom_home_built";
  const salvagedEvBattery = customBatterySelected && /\b(?:tesla|wreck(?:ed|ing)?|salvag(?:e|ed)|crash(?:ed)?|vehicle|\bev\b|car\s+(?:battery|pack)|traction\s+(?:battery|pack))\b/i.test(parsed.data.message);
  if (salvagedEvBattery) {
    const message = "Do not use this battery in the build based on the information currently available. A salvaged vehicle battery—especially one with unknown crash, water, storage, handling or electrical history—must be treated as unsafe and unsuitable unless every safety-critical point is independently verified.\n\nI cannot recommend a BMS, inverter or wiring arrangement as a way around missing evidence. Reconsideration would require the exact pack/module identity and chemistry, traceable provenance, qualified physical and insulation assessment, verified cell/module condition, functioning BMS and contactors, isolation monitoring, pre-charge, thermal management, enclosure and protection, manufacturer operating limits, compatible inverter integration, documented test results, and any required professional inspection or approval.\n\nUntil all of that evidence is available and acceptable, choose a different battery for this system. You remain free to retain it in your own record, but PVIntell will keep it marked unverified and not recommended.";
    const assistantWrite = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: message, structured_context: { kind: "discovery_help", questionId: question.id, safetyDecision: "do_not_use", reason: "salvaged_ev_battery_unverified" } });
    if (assistantWrite.error) return Response.json({ error: assistantWrite.error.message }, { status: 400 });
    return Response.json({ conversationId, message, safetyDecision: "do_not_use" });
  }
  const utilityRelationship = discoveryAnswers.utility_relationship;
  const confirmedProjectType = utilityRelationship === "off_grid" ? "off-grid" : utilityRelationship === "grid_connected" ? "hybrid" : demoProject.projectType;
  const contextInstruction = (helpContext === "discovery"
    ? "This is discovery help. Once the user has a usable answer, tell them they can return to the questionnaire and confirm it manually."
    : helpContext === "configure"
      ? "This came from a configuration card. Say which value belongs in that card when useful, and refer back to the card—not the questionnaire."
      : helpContext === "schematic"
        ? "This came from the working schematic. Keep the selected component or connection and neighbouring items in view, and refer back to its schematic record—not the questionnaire."
        : "This came from Build It. Focus on implementation, parts, checks and recorded evidence, and refer back to this Build It item—not the questionnaire.")
    + " For a heat-pump photo, read the advertised heating capacity and model but do not use any input explicitly marked indoor-only. Keep this workflow simple: use heating capacity divided by 5 as the average-operating planning input. State the exact Heating size shown on label and resulting Average electrical input fields for the user. Keep the result visibly estimated and replace it with a representative measured average when available. Never present thermal capacity, indoor-only watts, an uncited model match, or the planning estimate as confirmed.";
  const result = await askGemini({
    project: { ...demoProject, id: parsed.data.projectId ?? `discovery-${conversationId}`, siteId: parsed.data.siteId, name: `${siteName} discovery help`, location, projectType: confirmedProjectType },
    recentConversation: parsed.data.recentConversation,
    allowActions: false,
    message: `You are in a dedicated phone-a-friend ${helpContext} chat. ${contextInstruction} Stay strictly on the active item until the user understands it and has a usable answer. The confirmed discovery answers below are authoritative context. Never contradict them, invent an unselected goal or priority, assume equipment that was not recorded, or substitute the demo project's defaults. Discuss generator operation only when the confirmed answers or the user's current message explicitly mention a generator. For a grid-connected system, explain battery reserve as outage backup while the grid is unavailable; do not describe it as normal off-grid autonomy. When helping with AC phase, never infer single-phase or three-phase from the number of switch or breaker toggles: older single-phase switchboards may contain linked multi-pole devices. Say most ordinary houses use single-phase power, commonly about 230 V in New Zealand and many countries or 110–120 V in some overseas systems, then direct the user to reliable supply records or equipment labelling if confirmation is needed. Teach in plain language and help the user identify evidence such as a label, measurement, bill or photo when that evidence is necessary to answer this exact question. When an image is attached, report visible evidence first and clearly distinguish it from anything requiring measurement or qualified inspection. Never declare a roof structurally suitable, electrical equipment safe, or an installation compliant from a photo alone. Ask one focused clarifying question only when the active question cannot yet be answered. The chat remains open: if the user voluntarily continues with another question about this same active subject, answer it fully and helpfully, but still do not manufacture a follow-up question merely to prolong the conversation. Never use a closing question to explore mounting conditions, equipment, loads, design details, or any other adjacent discovery subject. Do not save an answer or alter any project record from this help chat. Never claim certainty when facts are missing.\n\nConfirmed discovery answers:\n${JSON.stringify(discoveryAnswers)}\n\nActive question:\n${JSON.stringify(question)}\n\nUser message: ${parsed.data.message}`,
    image,
  });
  const assistantWrite = await supabase.from("user_chat_messages").insert({ conversation_id: conversationId, role: "assistant", content: result.message, structured_context: { kind: "discovery_help", questionId: question.id, provider: "gemini", model: result.model, citations: result.citations, usage: result.usage } });
  if (assistantWrite.error) return Response.json({ error: assistantWrite.error.message }, { status: 400 });
  return Response.json({ conversationId, message: result.message, citations: result.citations });
}
