import { z } from "zod";
import type { HandoverModuleId } from "@/commissioning/handover-review";
import { createClient } from "@/lib/supabase/server";
import { systemConfirmationReadiness } from "@/lib/system-confirmation-readiness";

const detailsUpdateSchema = z.object({ name: z.string().trim().min(1).max(120), projectType: z.enum(["off-grid", "grid-tied", "hybrid"]) });
const lifecycleUpdateSchema = z.object({ phase: z.literal("monitor") });
const updateSchema = z.union([detailsUpdateSchema, lifecycleUpdateSchema]);
const mode = (type: z.infer<typeof detailsUpdateSchema>["projectType"]) => type === "grid-tied" ? "grid_tied" : type === "hybrid" ? "hybrid" : "off_grid";

type ProposalNode = { id?: string; label?: string; detail?: string; reviewed?: boolean };
type ProposalConnection = { kind?: string; configured?: boolean };

export function requiredHandoverModules(settings: Record<string, unknown>): HandoverModuleId[] {
  const calculator = (settings.designCalculator ?? {}) as Record<string, unknown>;
  const checklist = (calculator.proposedChecklist ?? {}) as Record<string, unknown>;
  if (checklist["proposed-schematic"] !== true) return [];
  const draft = (calculator.proposedAsBuiltDraft ?? {}) as { nodes?: ProposalNode[]; connections?: ProposalConnection[] };
  const nodes = (draft.nodes ?? []).filter((node) => node.reviewed);
  const connections = (draft.connections ?? []).filter((connection) => connection.configured);
  const designText = nodes.map((node) => `${node.id ?? ""} ${node.label ?? ""} ${node.detail ?? ""}`).join(" ").toLowerCase();
  const includes = (pattern: RegExp) => pattern.test(designText);
  const required: HandoverModuleId[] = [];
  if (nodes.some((node) => node.id === "solar" || node.id?.startsWith("solar-pv-"))) required.push("pv-array");
  if (connections.some((connection) => connection.kind === "solar-dc") || includes(/solar-safety|pv isolator|pv dc/)) required.push("pv-dc");
  if (includes(/battery|\bbms\b/)) required.push("battery");
  if (includes(/inverter|controller|\bmppt\b|optimiser|microinverter/)) required.push("inverter");
  if (connections.some((connection) => connection.kind === "ac") || includes(/switchboard|power board|grid supply|building power|safety switch/)) required.push("ac");
  if (includes(/generator|genset/)) required.push("generator");
  if (connections.some((connection) => connection.kind === "earth") || includes(/earth|\bbond\b|bonding|grounding|electrode/)) required.push("earthing");
  return required;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid system details." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if ("phase" in parsed.data) {
    const project = await supabase.from("projects").select("settings").eq("id", id).eq("owner_id", userId).maybeSingle();
    if (project.error) return Response.json({ error: project.error.message }, { status: 400 });
    if (!project.data) return Response.json({ error: "Power system not found." }, { status: 404 });
    const requiredModules = requiredHandoverModules((project.data.settings ?? {}) as Record<string, unknown>);
    if (!requiredModules.length) return Response.json({ error: "Accept and configure the proposed schematic before finishing handover." }, { status: 409 });

    const suitability = await systemConfirmationReadiness(supabase, id, { ignoreConfidence: true, proposalSettings: (project.data.settings ?? {}) as Record<string, unknown> });
    if (!suitability.ready) return Response.json({ error: suitability.message, blockers: suitability }, { status: 409 });

    const completed = await supabase.rpc("complete_system_handover", { target_project_id: id, required_modules: requiredModules });
    if (completed.error) return Response.json({ error: completed.error.message }, { status: 409 });
    return Response.json({ ok: true, phase: "monitor" });
  }

  const updated = await supabase.from("projects").update({ name: parsed.data.name, mode: mode(parsed.data.projectType) }).eq("id", id).eq("owner_id", userId).select("id").maybeSingle();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  if (!updated.data) return Response.json({ error: "Power system not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await supabase.rpc("delete_system_workspace", { target_project_id: id });
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
  const outcome = removed.data as { deleted?: boolean; siteDeleted?: boolean } | null;
  if (!outcome?.deleted) return Response.json({ error: "Power system not found." }, { status: 404 });
  return Response.json({ ok: true, siteDeleted: Boolean(outcome.siteDeleted) });
}
