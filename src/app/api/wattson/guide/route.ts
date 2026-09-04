import { z } from "zod";
import { askGemini } from "@/ai/gemini";
import { demoProject } from "@/data/demo-project";
import type { Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

const guideSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  group: z.string().min(1).max(160),
  summary: z.string().max(1200),
  aliases: z.array(z.string().max(120)).max(30).optional(),
  whatItIs: z.string().max(2400).optional(),
  whatItDoes: z.string().max(2400).optional(),
  usedFor: z.array(z.string().max(300)).max(30).optional(),
  types: z.array(z.object({
    name: z.string().max(180),
    description: z.string().max(1200),
    bestFor: z.string().max(800).optional(),
    watchFor: z.string().max(800).optional(),
  })).max(30).optional(),
  steps: z.array(z.string().max(1200)).max(40),
  source: z.string().max(1200),
  sourceUrl: z.url().optional(),
});

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  projectId: z.uuid().optional(),
  project: z.custom<Project>().optional(),
  siteId: z.uuid().optional(),
  guide: guideSchema,
  guideIndex: z.array(z.object({
    id: z.string().max(120),
    title: z.string().max(240),
    group: z.string().max(160),
    aliases: z.array(z.string().max(120)).max(30).optional(),
  })).max(250),
  recentConversation: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(3000),
  })).max(8).default([]),
}).superRefine((value, context) => {
  if (value.siteId || (value.projectId && value.project)) return;
  context.addIssue({ code: "custom", message: "A Site or project context is required" });
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Invalid guide question" }, { status: 400 });

  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string")
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  let project = parsed.data.project;
  if (parsed.data.projectId) {
    const owned = await supabase.from("projects").select("id").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
    if (owned.error || !owned.data)
      return Response.json({ error: "Project not found" }, { status: 404 });
  } else if (parsed.data.siteId) {
    const site = await supabase.from("sites").select("id,name,location").eq("id", parsed.data.siteId).eq("owner_id", userId).maybeSingle();
    if (site.error || !site.data)
      return Response.json({ error: "Site not found" }, { status: 404 });
    project = { ...demoProject, id: `guide-${site.data.id}`, siteId: site.data.id, name: `${site.data.name} guide help`, location: site.data.location ?? "Location not set" };
  }
  if (!project)
    return Response.json({ error: "Guide context is unavailable" }, { status: 400 });

  const { guide, guideIndex, message, recentConversation } = parsed.data;
  const result = await askGemini({
    project,
    recentConversation,
    allowActions: false,
    message: `Temporary How-to help session. Nothing in this session may be saved or used to update project records.

Active guide:
${JSON.stringify(guide)}

Available How-to guides for cross-references only:
${JSON.stringify(guideIndex)}

Answer only about this guide's subject and components directly connected to, carried by, protecting, feeding or controlled by it. A related term is in scope when understanding it helps the user understand this guide—for example, a conduit guide may explain a series-connected PV cable routed through that conduit. Explain the related item and its relationship. When the guide index contains a useful deeper guide, name its exact title so the user can search for it; do not invent a guide title. Do not start system discovery, change the design, invoke actions or turn the answer into a full project chat. Use plain language, identify what the item looks like when useful, and keep safety advice specific to the question.

User question: ${message}`,
  });

  // Deliberately no conversation or chat_messages writes: this is an ephemeral help request.
  return Response.json({ message: result.message, citations: result.citations });
}
