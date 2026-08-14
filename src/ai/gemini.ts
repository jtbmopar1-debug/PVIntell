import type { Project } from "@/domain/models";
import { wattsonActionTools, type WattsonActionRequest } from "./actions";

export interface WattsonCitation {
  title: string;
  url: string;
}

export interface GeminiUsage {
  inputTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
  totalTokens?: number;
  searches?: number;
}

export interface GeminiWattsonResult {
  message: string;
  citations: WattsonCitation[];
  model: string;
  searched: boolean;
  usage: GeminiUsage;
  actions: WattsonActionRequest[];
}

interface GeminiAnnotation {
  type?: string;
  title?: string;
  url?: string;
}
interface GeminiContent {
  type?: string;
  text?: string;
  annotations?: GeminiAnnotation[];
}
interface GeminiStep {
  type?: string;
  content?: GeminiContent[];
  name?: string;
  arguments?: unknown;
}
interface GeminiInteraction {
  output_text?: string;
  status?: string;
  steps?: GeminiStep[];
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
    total_tokens?: number;
    grounding_tool_count?: Array<{ type?: string; count?: number }>;
  };
  error?: { message?: string };
}

const regulatoryPattern =
  /\b(regulations?|regulatory|electrical code|standards?|as\s*\/\s*nzs|permit|consent|inspection|certificate|compliance|legal requirement|grid connection|export limit|worksafe|ewrb|authority|licensed|earthing|grounding)\b/i;
const currentInfoPattern =
  /\b(current|latest|today|recent|updated|effective date|datasheet|manual|recall|firmware|approved product|product availability|price)\b/i;
const technicalPattern =
  /\b(diagnos|fault|commission|design|calculate|cable|conductor|breaker|fuse|isolator|protection|inverter|battery|bms|mppt|string|voltage|current|surge|short circuit|fault current|grid|export|earthing|grounding|wiring|inspection|compliance)\b/i;

export function classifyWattsonRequest(message: string, location: string) {
  const regulatory = regulatoryPattern.test(message);
  const technical = regulatory || technicalPattern.test(message);
  const locationKnown =
    Boolean(location.trim()) && location.toLowerCase() !== "location not set";
  const search =
    currentInfoPattern.test(message) || (regulatory && locationKnown);
  return { regulatory, technical, search, locationKnown };
}

function parseInteraction(
  raw: GeminiInteraction,
  model: string,
  searchEnabled: boolean,
): GeminiWattsonResult {
  const outputBlocks = (raw.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string");
  const message =
    raw.output_text ??
    outputBlocks
      .map((block) => block.text)
      .join("\n")
      .trim();
  const actions = (raw.steps ?? [])
    .filter((step) => step.type === "function_call" && step.name)
    .map((step) => ({ name: step.name as string, arguments: step.arguments }));
  if (!message && !actions.length)
    throw new Error(
      raw.error?.message ??
        `Gemini returned no text (${raw.status ?? "unknown status"}).`,
    );
  const citations = Array.from(
    new Map(
      outputBlocks
        .flatMap((block) => block.annotations ?? [])
        .filter(
          (annotation) => annotation.type === "url_citation" && annotation.url,
        )
        .map((annotation) => [
          annotation.url as string,
          {
            title:
              annotation.title || new URL(annotation.url as string).hostname,
            url: annotation.url as string,
          },
        ]),
    ).values(),
  );
  const searchCount = raw.usage?.grounding_tool_count?.find(
    (item) => item.type === "google_search",
  )?.count;
  return {
    message,
    citations,
    model,
    searched: searchEnabled && Boolean(searchCount || citations.length),
    usage: {
      inputTokens: raw.usage?.total_input_tokens,
      outputTokens: raw.usage?.total_output_tokens,
      thoughtTokens: raw.usage?.total_thought_tokens,
      totalTokens: raw.usage?.total_tokens,
      searches: searchCount,
    },
    actions,
  };
}

export async function askGemini({
  message,
  project,
  recentConversation,
  questionnaireContext,
  image,
}: {
  message: string;
  project: Project;
  recentConversation: Array<{ role: string; content: string }>;
  questionnaireContext?: unknown;
  image?: { data: string; mimeType: string };
}): Promise<GeminiWattsonResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const route = classifyWattsonRequest(message, project.location);
  const model = route.technical
    ? (process.env.GEMINI_TECHNICAL_MODEL ?? "gemini-3.7-flash")
    : (process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite");
  const systemInstruction = `You are Wattson, PVIntell's project-aware solar power guide.
The user may be a complete beginner. Ask about ordinary life and desired outcomes rather than electrical terminology.
Treat the supplied PVIntell project as the source of truth. Clearly distinguish confirmed values from assumptions and estimates.
The context may include other power systems at the same physical site. Treat recorded AC feeds, bypasses, generators and shared equipment as dependencies between systems. "Mains" may mean an upstream PV/battery system rather than the public grid. Consider the effect of a recommendation on both the selected system and its upstream source.
The project may describe an already-built system. Understand and maintain that as-built record, including each physical inverter's separate role, PV strings, protection, isolation, cabling, changeover, generator connections, and earthing/bonding.
When discussing or reviewing an existing system, notice potentially serious safety gaps such as unconfirmed or apparently absent over-current protection, DC battery fusing, isolation, earthing/bonding, cable suitability, or changeover/interlocking. State these concerns prominently and recommend isolation or qualified inspection when warranted. Never treat an unrecorded field as proof that equipment is absent: say "not confirmed in PVIntell" and ask the user to verify it.
Keep responses concise, practical, and specific to this project. Do not claim live telemetry when the context says it is simulated.
Never make mains-voltage or high-current DC work sound trivial. Clearly identify work that needs a qualified or licensed professional.
Do not provide risky step-by-step instructions for live electrical work or bypassing protective devices.
The project's recorded jurisdiction/location is: ${project.location}.
For regulation, compliance, approval, or grid-connection claims, use current official regulator, government, network, or standards-body sources. Cite every material current claim. Do not invent or paraphrase inaccessible standards clauses as verified facts. If authoritative sources are missing, conflicting, paywalled, or the location is unknown, say what cannot be verified and ask for the missing detail or professional confirmation.
Never describe general guidance as a legal requirement.
For efficiency, cost, battery-life or operating-strategy comparisons, do not invent exact efficiencies, losses, cycle-life effects or prices. Use recorded manufacturer values or current cited authoritative data. Otherwise label figures as illustrative, show the assumptions or formula, and explain which missing facts could change the result. Do not call a strategy economically best without considering the true source of upstream energy, tariffs or fuel, conversion losses, battery throughput, reserve requirements and forecast solar/load conditions.
Do not assume battery chemistry from voltage or appearance. If chemistry, manufacturer limits or BMS behaviour are not confirmed in PVIntell, make the recommendation conditional and ask for them before recommending exact SOC, voltage or current thresholds.
When recommending control thresholds, distinguish everyday operating mode from emergency recovery mode. Account for hysteresis and avoid control hunting, but never change a safety-critical or operational setting without the user's explicit confirmation and an exact target component.
When an image is attached, inspect it conservatively. Extract only clearly visible label values and preserve their meaning. Never invent unreadable values. Only update a system record when the user identifies the target unambiguously or exactly one context item can match; otherwise ask which system item the image belongs to.`;
  const tools: unknown[] = [...wattsonActionTools];
  if (route.search)
    tools.unshift({ type: "google_search", search_types: ["web_search"] });
  const body: Record<string, unknown> = {
    model,
    store: false,
    system_instruction: systemInstruction,
    input: image
      ? [
          {
            type: "text",
            text: `Structured PVIntell context:\n${JSON.stringify({ project, questionnaireContext, recentConversation, telemetryStatus: "simulated telemetry only", requestClassification: route })}\n\nRespond to the latest user message and inspect the attached image:\n${message}`,
          },
          { type: "image", data: image.data, mime_type: image.mimeType },
        ]
      : `Structured PVIntell context:\n${JSON.stringify({ project, questionnaireContext, recentConversation, telemetryStatus: "simulated telemetry only", requestClassification: route })}\n\nRespond to the latest user message:\n${message}`,
    tools,
  };
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    },
  );
  const raw = (await response.json()) as GeminiInteraction;
  if (!response.ok)
    throw new Error(
      raw.error?.message ??
        `Gemini request failed with status ${response.status}.`,
    );
  return parseInteraction(raw, model, route.search);
}
