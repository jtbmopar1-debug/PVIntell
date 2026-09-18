import { z } from "zod";
import { createSystem } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

const optionalNumber = z.number().nonnegative().optional();
const arraySchema = z.object({ name: z.string().trim().min(1).max(80), manufacturer: z.string().trim().max(120).optional(), model: z.string().trim().max(120).optional(), panelType: z.enum(["monofacial", "bifacial", "thin-film", "flexible", "other", "unknown"]), panelCount: z.number().int().positive(), panelWatts: z.number().positive(), strings: z.number().int().positive().optional(), panelsPerString: z.number().int().positive().optional(), vmp: optionalNumber, voc: optionalNumber, imp: optionalNumber, isc: optionalNumber, mount: z.string().trim().max(120), location: z.string().trim().max(200).optional(), tilt: z.number().min(0).max(90).optional(), orientation: z.number().min(0).max(360).optional() });
const componentSchema = z.object({ type: z.enum(["inverter", "battery", "generator"]), name: z.string().trim().min(1).max(120), manufacturer: z.string().trim().max(120).optional(), model: z.string().trim().max(120).optional(), quantity: z.number().int().positive().max(100), rating: optionalNumber, batteryKwh: optionalNumber, batteryAh: optionalNumber, capacityInputBasis: z.enum(["kWh", "Ah"]).optional(), batteryType: z.string().trim().max(80).optional(), bmsCompatibility: z.string().trim().max(80).optional(), voltage: optionalNumber, batteryVoltageMin: optionalNumber, batteryVoltageMax: optionalNumber, mpptMin: optionalNumber, mpptMax: optionalNumber, maxPvVoltage: optionalNumber, maxInputCurrent: optionalNumber, notes: z.string().trim().max(2000).optional() });
const schema = z.object({ systemId: z.string().uuid().optional(), siteId: z.string().min(1), siteName: z.string().trim().max(120).optional(), systemName: z.string().trim().min(1).max(120), projectType: z.enum(["off-grid", "grid-tied", "hybrid"]), arrays: z.array(arraySchema).max(100), components: z.array(componentSchema).max(100), acknowledgeWarnings: z.boolean().default(false), discoveryContext: z.object({ draftId: z.string().uuid().optional(), continueDiscovery: z.boolean().default(false) }).optional() }).refine((value) => value.arrays.length + value.components.length > 0, "Add at least one proposed item.");

const arrayRows = (projectId: string, input: z.infer<typeof schema>, warnings: string[]) => input.arrays.map((array) => ({ project_id: projectId, name: array.name, manufacturer: array.manufacturer || null, panel_model: array.model || null, panel_type: array.panelType, panel_count: array.panelCount, panel_watts: array.panelWatts, strings: array.strings ?? null, panels_per_string: array.panelsPerString ?? null, maximum_power_voltage_v: array.vmp ?? null, open_circuit_voltage_v: array.voc ?? null, maximum_power_current_a: array.imp ?? null, short_circuit_current_a: array.isc ?? null, tilt_degrees: array.tilt ?? null, orientation_degrees: array.orientation ?? null, installation_notes: array.location || null, specifications: { "Mounting option": array.mount, "Proposal status": warnings.length ? "Compatibility review pending" : "Compatibility checks passed" }, confidence: warnings.length ? "estimated" : "confirmed" }));

const componentRows = (projectId: string, input: z.infer<typeof schema>, warnings: string[]) => input.components.map((component) => ({ project_id: projectId, type: component.type, display_name: component.name, manufacturer: component.manufacturer || null, model: component.model || null, quantity: component.quantity, notes: component.notes || null, specifications: { ...(component.rating ? { "Rated power": component.type === "inverter" ? `${component.rating} kW` : `${component.rating} W` } : {}), ...(component.type === "battery" && component.batteryKwh ? { "Nominal energy": `${component.batteryKwh} kWh` } : {}), ...(component.type === "battery" && component.batteryAh ? { "Rated capacity": `${component.batteryAh} Ah` } : {}), ...(component.type === "battery" && component.batteryType ? { "Battery type": component.batteryType.replaceAll("_", " ") } : {}), ...(component.type === "battery" && component.bmsCompatibility ? { "BMS compatibility": component.bmsCompatibility.replaceAll("_", " ") } : {}), ...(component.voltage ? { "Nominal voltage": `${component.voltage} V` } : {}), ...(component.mpptMin ? { "MPPT minimum voltage": `${component.mpptMin} V` } : {}), ...(component.mpptMax ? { "MPPT maximum voltage": `${component.mpptMax} V` } : {}), ...(component.maxPvVoltage ? { "Maximum PV voltage": `${component.maxPvVoltage} V` } : {}), ...(component.maxInputCurrent ? { "Maximum PV input current": `${component.maxInputCurrent} A` } : {}), ...(component.batteryVoltageMin ? { "Battery voltage minimum": `${component.batteryVoltageMin} V` } : {}), ...(component.batteryVoltageMax ? { "Battery voltage maximum": `${component.batteryVoltageMax} V` } : {}), "Proposal status": warnings.length ? "Compatibility review pending" : "Compatibility checks passed" }, confidence: warnings.length ? "estimated" : "confirmed" }));

function compatibilityIssues(input: z.infer<typeof schema>) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const array of input.arrays) {
    if (array.strings && array.panelsPerString && array.strings * array.panelsPerString !== array.panelCount) blockers.push(`${array.name}: strings × panels per string must equal the array panel count.`);
    const missing = [!array.manufacturer && "manufacturer", !array.model && "exact model", array.panelType === "unknown" && "panel type", !array.voc && "Voc", !array.vmp && "Vmp", !array.isc && "Isc", !array.imp && "Imp"].filter(Boolean);
    if (missing.length) warnings.push(`${array.name}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} incomplete.`);
  }
  const inverters = input.components.filter((item) => item.type === "inverter");
  const batteries = input.components.filter((item) => item.type === "battery");
  if (input.arrays.length && !inverters.length) warnings.push("No inverter or controller has been specified for the proposed PV arrays.");
  for (const inverter of inverters) {
    const missing = [!inverter.manufacturer && "manufacturer", !inverter.model && "exact model", !inverter.maxPvVoltage && "maximum PV voltage", !inverter.mpptMin && "MPPT minimum", !inverter.mpptMax && "MPPT maximum", !inverter.maxInputCurrent && "maximum PV input current", batteries.length > 0 && !inverter.batteryVoltageMin && "battery voltage minimum", batteries.length > 0 && !inverter.batteryVoltageMax && "battery voltage maximum"].filter(Boolean);
    if (missing.length) warnings.push(`${inverter.name}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} incomplete.`);
    for (const array of input.arrays) {
      if (!array.panelsPerString) continue;
      const parallel = array.strings ?? 1;
      if (array.voc && inverter.maxPvVoltage && array.voc * array.panelsPerString > inverter.maxPvVoltage) blockers.push(`${array.name} exceeds ${inverter.name}'s maximum PV voltage before cold-temperature correction.`);
      if (array.vmp && inverter.mpptMin && array.vmp * array.panelsPerString < inverter.mpptMin) blockers.push(`${array.name} string Vmp is below ${inverter.name}'s MPPT range.`);
      if (array.vmp && inverter.mpptMax && array.vmp * array.panelsPerString > inverter.mpptMax) blockers.push(`${array.name} string Vmp is above ${inverter.name}'s MPPT range.`);
      if (array.isc && inverter.maxInputCurrent && array.isc * parallel > inverter.maxInputCurrent) blockers.push(`${array.name} short-circuit current exceeds ${inverter.name}'s recorded input-current limit.`);
    }
  }
  for (const battery of batteries) {
    const missing = [!battery.model && "exact model", !battery.batteryType && "battery type", !battery.voltage && "nominal voltage", !battery.bmsCompatibility && "BMS compatibility"].filter(Boolean);
    if (missing.length) warnings.push(`${battery.name}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} incomplete.`);
    for (const inverter of inverters) {
      if (battery.voltage && inverter.batteryVoltageMin && battery.voltage < inverter.batteryVoltageMin) blockers.push(`${battery.name}'s nominal voltage is below ${inverter.name}'s battery range.`);
      if (battery.voltage && inverter.batteryVoltageMax && battery.voltage > inverter.batteryVoltageMax) blockers.push(`${battery.name}'s nominal voltage is above ${inverter.name}'s battery range.`);
    }
  }
  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the proposed equipment." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const issues = compatibilityIssues(parsed.data);
  if (issues.blockers.length) return Response.json({ error: "The proposed equipment has compatibility failures.", blockers: issues.blockers, warnings: issues.warnings }, { status: 422 });
  let siteId = parsed.data.siteId;
  let createdSiteId: string | undefined;
  let systemId: string | undefined;
  try {
    if (siteId === "__new__") {
      if (!parsed.data.siteName) return Response.json({ error: "Enter a Site name." }, { status: 400 });
      const profile = await supabase.from("profiles").select("home_location,timezone").eq("id", userId).single();
      if (profile.error) throw profile.error;
      const site = await supabase.from("sites").insert({ owner_id: userId, name: parsed.data.siteName, location: profile.data.home_location || null, timezone: profile.data.timezone || "UTC", location_source: "imported", location_confirmed: false }).select("id").single();
      if (site.error) throw site.error;
      siteId = site.data.id;
      createdSiteId = siteId;
    } else {
      const owned = await supabase.from("sites").select("id").eq("id", siteId).eq("owner_id", userId).maybeSingle();
      if (owned.error || !owned.data) return Response.json({ error: "Site not found." }, { status: 404 });
    }
    systemId = await createSystem(supabase, userId, siteId, parsed.data.systemName, parsed.data.projectType, "User-specified proposed system; not installed or commissioned.");
    const specifiedInverter = parsed.data.components.find((component) => component.type === "inverter" && component.rating);
    const fromDiscovery = Boolean(parsed.data.discoveryContext);
    const project = await supabase.from("projects").update({ phase: parsed.data.discoveryContext?.continueDiscovery ? "discover" : "design", settings: {
      autonomyDays: 2,
      priorities: [],
      startingGoal: "User-specified proposed system",
      goal: "User-specified proposed system",
      schematicOrigin: "structured_proposal_intake",
      workflowOrigin: fromDiscovery ? "discovery" : "proposed-plan",
      systemStatus: "proposed",
      ...(specifiedInverter ? { designCalculator: { inverterKw: specifiedInverter.rating, updatedBy: "user" } } : {}),
    } }).eq("id", systemId).eq("owner_id", userId);
    if (project.error) throw project.error;
    if (parsed.data.arrays.length) {
      const arrays = await supabase.from("pv_arrays").insert(arrayRows(systemId, parsed.data, issues.warnings));
      if (arrays.error) throw arrays.error;
    }
    if (parsed.data.components.length) {
      const components = await supabase.from("system_components").insert(componentRows(systemId, parsed.data, issues.warnings));
      if (components.error) throw components.error;
    }
    if (parsed.data.discoveryContext) {
      let discoveryAnswers: Record<string, unknown> = {};
      let conversationId: string | null = null;
      if (parsed.data.discoveryContext.draftId) {
        const draft = await supabase.from("discovery_drafts").select("answers,conversation_id").eq("id", parsed.data.discoveryContext.draftId).eq("owner_id", userId).maybeSingle();
        if (draft.error || !draft.data) throw draft.error ?? new Error("Discovery draft not found.");
        discoveryAnswers = (draft.data.answers ?? {}) as Record<string, unknown>;
        conversationId = draft.data.conversation_id;
      } else {
        const profile = await supabase.from("profiles").select("onboarding_assessment").eq("id", userId).single();
        if (profile.error) throw profile.error;
        const assessment = (profile.data.onboarding_assessment ?? {}) as { guidedNewSystem?: { answers?: Record<string, unknown> } };
        discoveryAnswers = assessment.guidedNewSystem?.answers ?? {};
      }
      const questionnaire = await supabase.from("questionnaire_responses").upsert({ project_id: systemId, template_key: "guided_new_system", template_version: 1, status: "draft", answers: { ...discoveryAnswers, existing_proposal_status: "yes", site_id: siteId, system_name: parsed.data.systemName } }, { onConflict: "project_id,template_key" });
      if (questionnaire.error) throw questionnaire.error;
      if (conversationId) {
        const linkedConversation = await supabase.from("user_conversations").update({ site_id: siteId, project_id: systemId }).eq("id", conversationId).eq("owner_id", userId);
        if (linkedConversation.error) throw linkedConversation.error;
      }
      if (parsed.data.discoveryContext.draftId) {
        const removedDraft = await supabase.from("discovery_drafts").delete().eq("id", parsed.data.discoveryContext.draftId).eq("owner_id", userId);
        if (removedDraft.error) throw removedDraft.error;
      }
      return Response.json({ siteId, systemId, url: parsed.data.discoveryContext.continueDiscovery ? `/discovery/new-system?edit=${systemId}` : `/sites/${siteId}/systems/${systemId}/schematic` }, { status: 201 });
    }
    return Response.json({ siteId, systemId, url: `/sites/${siteId}/systems/${systemId}/schematic` }, { status: 201 });
  } catch (problem) {
    if (systemId) await supabase.from("projects").delete().eq("id", systemId).eq("owner_id", userId);
    if (createdSiteId) await supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", userId);
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not build the proposed schematic." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.systemId) return Response.json({ error: parsed.success ? "System is required." : parsed.error.issues[0]?.message ?? "Check the proposed equipment." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const issues = compatibilityIssues(parsed.data);
  if (issues.blockers.length) return Response.json({ error: "The proposed equipment has compatibility failures.", blockers: issues.blockers, warnings: issues.warnings }, { status: 422 });
  const project = await supabase.from("projects").select("id,site_id,settings").eq("id", parsed.data.systemId).eq("owner_id", userId).maybeSingle();
  const settings = (project.data?.settings ?? {}) as Record<string, unknown>;
  if (project.error || !project.data || settings.schematicOrigin !== "structured_proposal_intake") return Response.json({ error: "Proposed plan not found." }, { status: 404 });
  if (parsed.data.siteId !== project.data.site_id) return Response.json({ error: "A saved proposed plan cannot be moved to another Site." }, { status: 400 });
  const oldArrays = await supabase.from("pv_arrays").select("id").eq("project_id", parsed.data.systemId);
  const oldComponents = await supabase.from("system_components").select("id").eq("project_id", parsed.data.systemId);
  if (oldArrays.error || oldComponents.error) return Response.json({ error: oldArrays.error?.message ?? oldComponents.error?.message }, { status: 400 });
  const insertedArrays = parsed.data.arrays.length ? await supabase.from("pv_arrays").insert(arrayRows(parsed.data.systemId, parsed.data, issues.warnings)).select("id") : { data: [], error: null };
  if (insertedArrays.error) return Response.json({ error: insertedArrays.error.message }, { status: 400 });
  const insertedComponents = parsed.data.components.length ? await supabase.from("system_components").insert(componentRows(parsed.data.systemId, parsed.data, issues.warnings)).select("id") : { data: [], error: null };
  if (insertedComponents.error) {
    if (insertedArrays.data?.length) await supabase.from("pv_arrays").delete().in("id", insertedArrays.data.map((row) => row.id));
    return Response.json({ error: insertedComponents.error.message }, { status: 400 });
  }
  const specifiedInverter = parsed.data.components.find((component) => component.type === "inverter" && component.rating);
  const previousCalculator = settings.designCalculator && typeof settings.designCalculator === "object" ? settings.designCalculator as Record<string, unknown> : {};
  const updatedSettings = { ...settings, systemStatus: "proposed", schematicOrigin: "structured_proposal_intake", ...(specifiedInverter ? { designCalculator: { ...previousCalculator, inverterKw: specifiedInverter.rating, updatedBy: "user" } } : {}) };
  const updated = await supabase.from("projects").update({ name: parsed.data.systemName, mode: parsed.data.projectType.replace("-", "_"), phase: "design", settings: updatedSettings }).eq("id", parsed.data.systemId).eq("owner_id", userId);
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 400 });
  if (oldArrays.data?.length) await supabase.from("pv_arrays").delete().in("id", oldArrays.data.map((row) => row.id));
  if (oldComponents.data?.length) await supabase.from("system_components").delete().in("id", oldComponents.data.map((row) => row.id));
  return Response.json({ siteId: project.data.site_id, systemId: parsed.data.systemId, warnings: issues.warnings, url: `/sites/${project.data.site_id}/systems/${parsed.data.systemId}/schematic` });
}
