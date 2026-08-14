import { z } from "zod";
import { askGemini } from "@/ai/gemini";
import { applyWattsonActions, type AppliedWattsonAction } from "@/ai/actions";
import { MockAIProvider } from "@/ai/provider";
import type { Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.uuid(),
  project: z.custom<Project>(),
});

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

  const owned = await supabase
    .from("projects")
    .select("id,site_id")
    .eq("id", parsed.data.projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned.error || !owned.data)
    return Response.json({ error: "Project not found" }, { status: 404 });
  let image: { data: string; mimeType: string } | undefined;
  let imagePath: string | undefined;
  let imageUrl: string | undefined;
  if (imageFile) {
    const bytes = new Uint8Array(await imageFile.arrayBuffer());
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
    const signed = await supabase.storage
      .from("project-photos")
      .createSignedUrl(imagePath, 3600);
    imageUrl = signed.data?.signedUrl;
  }

  let conversation = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", parsed.data.projectId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (conversation.error)
    return Response.json(
      { error: conversation.error.message },
      { status: 400 },
    );
  if (!conversation.data) {
    const created = await supabase
      .from("conversations")
      .insert({
        project_id: parsed.data.projectId,
        title: "Wattson project discovery",
      })
      .select("id")
      .single();
    if (created.error)
      return Response.json({ error: created.error.message }, { status: 400 });
    conversation = { ...conversation, data: created.data };
  }

  const conversationId = conversation.data?.id;
  if (!conversationId)
    return Response.json(
      { error: "Could not create conversation" },
      { status: 500 },
    );
  const userInsert = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: parsed.data.message,
      structured_context: imagePath
        ? { imagePath, mimeType: imageFile?.type }
        : {},
    });
  if (userInsert.error)
    return Response.json({ error: userInsert.error.message }, { status: 400 });

  const recent = await supabase
    .from("chat_messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12);
  const history = (recent.data ?? []).reverse();
  const priorHistory =
    history.at(-1)?.role === "user" &&
    history.at(-1)?.content === parsed.data.message
      ? history.slice(0, -1)
      : history;
  const questionnaireResult = await supabase
    .from("questionnaire_responses")
    .select("template_key,status,answers")
    .eq("project_id", parsed.data.projectId);
  if (questionnaireResult.error)
    return Response.json(
      { error: questionnaireResult.error.message },
      { status: 400 },
    );
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
  const [siteComponentsResult, siteArraysResult] = siteSystemIds.length
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
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (siteComponentsResult.error || siteArraysResult.error)
    return Response.json(
      {
        error:
          siteComponentsResult.error?.message ?? siteArraysResult.error?.message,
      },
      { status: 400 },
    );
  const connectedSiteSystems = (siteSystemsResult.data ?? []).map((system) => ({
    ...system,
    selected: system.id === parsed.data.projectId,
    components: (siteComponentsResult.data ?? []).filter(
      (component) => component.project_id === system.id,
    ),
    pvStrings: (siteArraysResult.data ?? []).filter(
      (array) => array.project_id === system.id,
    ),
  }));

  let message: string;
  let citations: Array<{ title: string; url: string }> = [];
  let appliedActions: AppliedWattsonAction[] = [];
  let structuredContext: Record<string, unknown>;
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await askGemini({
        message: parsed.data.message,
        project: parsed.data.project,
        recentConversation: priorHistory,
        questionnaireContext: {
          responses: questionnaireResult.data ?? [],
          siteEquipment: equipmentResult.data ?? [],
          connectedSiteSystems,
        },
        image,
      });
      appliedActions = await applyWattsonActions(
        supabase,
        parsed.data.projectId,
        result.actions,
      );
      const updateSummary = appliedActions
        .map((action) => action.summary)
        .join("; ");
      message = result.message.trim();
      if (updateSummary)
        message = message
          ? `${message}\n\nUpdated in PVIntell: ${updateSummary}.`
          : `Done — ${updateSummary}.`;
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
      };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown Gemini error";
      return Response.json(
        { error: `Wattson could not reach Gemini: ${detail}` },
        { status: 502 },
      );
    }
  } else {
    message = await new MockAIProvider().sendMessage(parsed.data.message, {
      project: parsed.data.project,
    });
    structuredContext = { provider: "mock", projectId: parsed.data.projectId };
  }

  const assistantInsert = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: message,
      structured_context: structuredContext,
    });
  if (assistantInsert.error)
    return Response.json(
      { error: assistantInsert.error.message },
      { status: 400 },
    );
  return Response.json({
    message,
    provider: structuredContext.provider,
    citations,
    actions: appliedActions,
    imageUrl,
    imagePath,
  });
}
