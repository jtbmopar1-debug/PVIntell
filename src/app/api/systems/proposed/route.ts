import { z } from "zod";
import { createSystem } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

const optionalNumber = z.number().nonnegative().optional();
const arraySchema = z.object({ name: z.string().trim().min(1).max(80), manufacturer: z.string().trim().max(120).optional(), model: z.string().trim().max(120).optional(), panelType: z.enum(["monofacial", "bifacial", "thin-film", "flexible", "other", "unknown"]), panelCount: z.number().int().positive(), panelWatts: z.number().positive(), strings: z.number().int().positive().optional(), panelsPerString: z.number().int().positive().optional(), vmp: optionalNumber, voc: optionalNumber, imp: optionalNumber, isc: optionalNumber, mount: z.string().trim().max(120), location: z.string().trim().max(200).optional(), tilt: z.number().min(0).max(90).optional(), orientation: z.number().min(0).max(360).optional() });
const componentSchema = z.object({ type: z.enum(["inverter", "battery", "generator"]), name: z.string().trim().min(1).max(120), manufacturer: z.string().trim().max(120).optional(), model: z.string().trim().max(120).optional(), quantity: z.number().int().positive().max(100), rating: optionalNumber, voltage: optionalNumber, batteryVoltageMin: optionalNumber, batteryVoltageMax: optionalNumber, mpptMin: optionalNumber, mpptMax: optionalNumber, maxPvVoltage: optionalNumber, maxInputCurrent: optionalNumber, notes: z.string().trim().max(2000).optional() });
const schema = z.object({ siteId: z.string().min(1), siteName: z.string().trim().max(120).optional(), systemName: z.string().trim().min(1).max(120), projectType: z.enum(["off-grid", "grid-tied", "hybrid"]), arrays: z.array(arraySchema).max(100), components: z.array(componentSchema).max(100), acknowledgeWarnings: z.boolean().default(false) }).refine((value) => value.arrays.length + value.components.length > 0, "Add at least one proposed item.");

function compatibilityIssues(input: z.infer<typeof schema>) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const array of input.arrays) {
    if (array.strings && array.panelsPerString && array.strings * array.panelsPerString !== array.panelCount) blockers.push(`${array.name}: strings × panels per string must equal the array panel count.`);
    if (!array.manufacturer || !array.model || array.panelType === "unknown" || !array.voc || !array.vmp || !array.isc || !array.imp) warnings.push(`${array.name}: exact module model, panel type and Voc/Vmp/Isc/Imp are required to prove PV compatibility.`);
  }
  const inverters = input.components.filter((item) => item.type === "inverter");
  const batteries = input.components.filter((item) => item.type === "battery");
  if (input.arrays.length && !inverters.length) warnings.push("No inverter or controller has been specified for the proposed PV arrays.");
  for (const inverter of inverters) {
    if (!inverter.manufacturer || !inverter.model || !inverter.maxPvVoltage || !inverter.mpptMin || !inverter.mpptMax || !inverter.maxInputCurrent) warnings.push(`${inverter.name}: exact model and PV input limits are required to prove array compatibility.`);
    for (const array of input.arrays) {
      if (!array.panelsPerString) continue;
      const parallel = array.strings ?? 1;
      if (array.voc && inverter.maxPvVoltage && array.voc * array.panelsPerString > inverter.maxPvVoltage) blockers.push(`${array.name} exceeds ${inverter.name}'s maximum PV voltage before cold-temperature correction.`);
      if (array.vmp && inverter.mpptMin && array.vmp * array.panelsPerString < inverter.mpptMin) blockers.push(`${array.name} string Vmp is below ${inverter.name}'s MPPT range.`);
      if (array.vmp && inverter.mpptMax && array.vmp * array.panelsPerString > inverter.mpptMax) blockers.push(`${array.name} string Vmp is above ${inverter.name}'s MPPT range.`);
      if (array.isc && inverter.maxInputCurrent && array.isc * parallel > inverter.maxInputCurrent) blockers.push(`${array.name} short-circuit current exceeds ${inverter.name}'s recorded input-current limit.`);
    }
  }
  for (const battery of batteries) for (const inverter of inverters) {
    if (battery.voltage && inverter.batteryVoltageMin && battery.voltage < inverter.batteryVoltageMin) blockers.push(`${battery.name}'s nominal voltage is below ${inverter.name}'s battery range.`);
    if (battery.voltage && inverter.batteryVoltageMax && battery.voltage > inverter.batteryVoltageMax) blockers.push(`${battery.name}'s nominal voltage is above ${inverter.name}'s battery range.`);
    if (!battery.manufacturer || !battery.model || !battery.voltage) warnings.push(`${battery.name}: exact model, voltage, BMS limits and communications compatibility remain unverified.`);
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
  if (issues.warnings.length && !parsed.data.acknowledgeWarnings) return Response.json({ error: "Review the unresolved compatibility warnings before building the schematic.", warnings: issues.warnings }, { status: 409 });
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
    const project = await supabase.from("projects").update({ phase: "design", settings: {
      autonomyDays: 2,
      priorities: [],
      startingGoal: "User-specified proposed system",
      goal: "User-specified proposed system",
      schematicOrigin: "structured_proposal_intake",
      systemStatus: "proposed",
      ...(specifiedInverter ? { designCalculator: { inverterKw: specifiedInverter.rating, updatedBy: "user" } } : {}),
    } }).eq("id", systemId).eq("owner_id", userId);
    if (project.error) throw project.error;
    if (parsed.data.arrays.length) {
      const arrays = await supabase.from("pv_arrays").insert(parsed.data.arrays.map((array) => ({ project_id: systemId, name: array.name, manufacturer: array.manufacturer || null, panel_model: array.model || null, panel_type: array.panelType, panel_count: array.panelCount, panel_watts: array.panelWatts, strings: array.strings ?? null, panels_per_string: array.panelsPerString ?? null, maximum_power_voltage_v: array.vmp ?? null, open_circuit_voltage_v: array.voc ?? null, maximum_power_current_a: array.imp ?? null, short_circuit_current_a: array.isc ?? null, tilt_degrees: array.tilt ?? null, orientation_degrees: array.orientation ?? null, installation_notes: array.location || null, specifications: { "Mounting option": array.mount, "Proposal status": issues.warnings.length ? "Compatibility review pending" : "Compatibility checks passed" }, confidence: issues.warnings.length ? "estimated" : "confirmed" })));
      if (arrays.error) throw arrays.error;
    }
    if (parsed.data.components.length) {
      const components = await supabase.from("system_components").insert(parsed.data.components.map((component) => ({ project_id: systemId, type: component.type, display_name: component.name, manufacturer: component.manufacturer || null, model: component.model || null, quantity: component.quantity, notes: component.notes || null, specifications: { ...(component.rating ? { "Rated power": component.type === "inverter" ? `${component.rating} kW` : component.type === "battery" ? `${component.rating} Wh` : `${component.rating} W` } : {}), ...(component.voltage ? { "Nominal voltage": `${component.voltage} V` } : {}), ...(component.mpptMin ? { "MPPT minimum voltage": `${component.mpptMin} V` } : {}), ...(component.mpptMax ? { "MPPT maximum voltage": `${component.mpptMax} V` } : {}), ...(component.maxPvVoltage ? { "Maximum PV voltage": `${component.maxPvVoltage} V` } : {}), ...(component.maxInputCurrent ? { "Maximum PV input current": `${component.maxInputCurrent} A` } : {}), ...(component.batteryVoltageMin ? { "Battery voltage minimum": `${component.batteryVoltageMin} V` } : {}), ...(component.batteryVoltageMax ? { "Battery voltage maximum": `${component.batteryVoltageMax} V` } : {}), "Proposal status": issues.warnings.length ? "Compatibility review pending" : "Compatibility checks passed" }, confidence: issues.warnings.length ? "estimated" : "confirmed" })));
      if (components.error) throw components.error;
    }
    return Response.json({ siteId, systemId, url: `/sites/${siteId}/systems/${systemId}/schematic` }, { status: 201 });
  } catch (problem) {
    if (systemId) await supabase.from("projects").delete().eq("id", systemId).eq("owner_id", userId);
    if (createdSiteId) await supabase.from("sites").delete().eq("id", createdSiteId).eq("owner_id", userId);
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not build the proposed schematic." }, { status: 400 });
  }
}
