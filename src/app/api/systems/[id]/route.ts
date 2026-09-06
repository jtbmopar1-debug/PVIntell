import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const detailsUpdateSchema = z.object({ name: z.string().trim().min(1).max(120), projectType: z.enum(["off-grid", "grid-tied", "hybrid"]) });
const lifecycleUpdateSchema = z.object({ phase: z.literal("monitor") });
const updateSchema = z.union([detailsUpdateSchema, lifecycleUpdateSchema]);
const mode = (type: z.infer<typeof detailsUpdateSchema>["projectType"]) => type === "grid-tied" ? "grid_tied" : type === "hybrid" ? "hybrid" : "off_grid";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid system details." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if ("phase" in parsed.data) {
    const [steps, checks, projectRow, existingComponents, existingConnections] = await Promise.all([
      supabase.from("installation_steps").select("completed_at").eq("project_id", id),
      supabase.from("commissioning_records").select("result").eq("project_id", id),
      supabase.from("projects").select("settings").eq("id", id).maybeSingle(),
      supabase.from("system_components").select("notes").eq("project_id", id),
      supabase.from("system_connections").select("notes").eq("project_id", id),
    ]);
    if (steps.error || checks.error || projectRow.error || existingComponents.error || existingConnections.error) return Response.json({ error: steps.error?.message ?? checks.error?.message ?? projectRow.error?.message ?? existingComponents.error?.message ?? existingConnections.error?.message }, { status: 400 });
    const buildComplete = Boolean(steps.data?.length) && steps.data.every((step) => Boolean(step.completed_at));
    const commissioningPassed = Boolean(checks.data?.length) && checks.data.every((check) => check.result === "pass");
    if (!buildComplete || !commissioningPassed) return Response.json({ error: "Complete every build sheet and resolve all commissioning checks first." }, { status: 409 });

    const settings = (projectRow.data?.settings ?? {}) as Record<string, unknown>;
    const calculator = (settings.designCalculator ?? {}) as Record<string, unknown>;
    const draft = (calculator.proposedAsBuiltDraft ?? {}) as { nodes?: Array<{ id: string; label: string; detail: string; installed?: boolean }>; connections?: Array<{ from: string; to: string; label: string; kind: string; cableSizeMm2?: number; lengthM?: number; protectionAmps?: number }> };
    const installedNodes = (draft.nodes ?? []).filter((node) => node.installed);
    const existingNodeMarkers = new Set((existingComponents.data ?? []).map((row) => String(row.notes ?? "")).filter((value) => value.includes("[schematic-node:")));
    const componentType = (node: { id: string; label: string }) => node.id === "solar" ? "panel" : node.id.includes("battery") && !node.id.includes("safety") ? "battery" : node.id.includes("inverter") || node.id === "inverter" ? "inverter" : node.id.includes("safety") || node.id.includes("changeover") ? "isolator" : node.id === "grid-supply" ? "meter" : node.id === "switchboard" ? "load" : "protection";
    const newComponents = installedNodes.filter((node) => ![...existingNodeMarkers].some((notes) => notes.includes(`[schematic-node:${node.id}]`))).map((node) => ({
      project_id: id,
      type: componentType(node),
      display_name: node.label,
      quantity: node.id === "solar" ? Math.max(1, Number(calculator.panelCount ?? 1)) : 1,
      notes: `${node.detail}\n[schematic-node:${node.id}]`,
      specifications: { proposalNodeId: node.id },
      confidence: "confirmed",
    }));
    if (newComponents.length) {
      const promoted = await supabase.from("system_components").insert(newComponents);
      if (promoted.error) return Response.json({ error: promoted.error.message }, { status: 400 });
    }
    const installedIds = new Set(installedNodes.map((node) => node.id));
    const existingConnectionMarkers = new Set((existingConnections.data ?? []).map((row) => String(row.notes ?? "")));
    const newConnections = (draft.connections ?? []).filter((connection) => installedIds.has(connection.from) && installedIds.has(connection.to) && ![...existingConnectionMarkers].some((notes) => notes.includes(`[schematic-connection:${connection.from}:${connection.to}]`))).map((connection) => ({
      project_id: id,
      source_ref: `proposal:${connection.from}`,
      target_ref: `proposal:${connection.to}`,
      name: connection.label,
      connection_type: connection.kind === "solar-dc" || connection.kind === "battery-dc" ? "dc" : connection.kind,
      polarity: connection.kind === "solar-dc" || connection.kind === "battery-dc" ? "pair" : "na",
      cable_size: connection.cableSizeMm2 ? `${connection.cableSizeMm2} mm²` : null,
      cable_length: connection.lengthM ? `${connection.lengthM} m` : null,
      breaker_size: connection.protectionAmps ? `${connection.protectionAmps} A` : null,
      notes: `[schematic-connection:${connection.from}:${connection.to}]`,
      confidence: "confirmed",
    }));
    if (newConnections.length) {
      const promoted = await supabase.from("system_connections").insert(newConnections);
      if (promoted.error) return Response.json({ error: promoted.error.message }, { status: 400 });
    }
  }
  const changes = "phase" in parsed.data
    ? { phase: parsed.data.phase }
    : { name: parsed.data.name, mode: mode(parsed.data.projectType) };
  const updated = await supabase.from("projects").update(changes).eq("id", id).select("id").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 }); return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const removed = await supabase.from("projects").delete().eq("id", id).eq("owner_id", claims.data.claims.sub).select("id").single();
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 }); return Response.json({ ok: true });
}
