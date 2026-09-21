import { redirect } from "next/navigation";
import { ProposalIntake, type ProposalIntakeInitial } from "@/components/proposal-intake";
import { createClient } from "@/lib/supabase/server";

const specificationNumber = (specifications: unknown, key: string) => {
  const value = specifications && typeof specifications === "object" ? (specifications as Record<string, unknown>)[key] : undefined;
  const match = String(value ?? "").match(/[\d.]+/);
  return match ? Number(match[0]) : undefined;
};

const specificationText = (specifications: unknown, key: string) => {
  const value = specifications && typeof specifications === "object" ? (specifications as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : undefined;
};

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ site?: string; system?: string; from?: string; draft?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const sites = await supabase.from("sites").select("id,name,location").eq("owner_id", userId).order("created_at");
  if (sites.error) throw sites.error;
  let initialProposal: ProposalIntakeInitial | undefined;
  if (query.system) {
    const [project, arrays, components] = await Promise.all([
      supabase.from("projects").select("id,site_id,name,mode,settings").eq("id", query.system).eq("owner_id", userId).maybeSingle(),
      supabase.from("pv_arrays").select("id,name,manufacturer,panel_model,panel_type,panel_count,panel_watts,strings,panels_per_string,maximum_power_voltage_v,open_circuit_voltage_v,maximum_power_current_a,short_circuit_current_a,tilt_degrees,orientation_degrees,installation_notes,specifications").eq("project_id", query.system).order("created_at"),
      supabase.from("system_components").select("id,type,display_name,manufacturer,model,quantity,notes,specifications").eq("project_id", query.system).order("created_at"),
    ]);
    if (project.error || arrays.error || components.error) throw project.error ?? arrays.error ?? components.error;
    const settings = (project.data?.settings ?? {}) as { schematicOrigin?: string };
    if (!project.data || settings.schematicOrigin !== "structured_proposal_intake") redirect(`/systems${query.site ? `?site=${query.site}` : ""}`);
    initialProposal = {
      systemId: project.data.id,
      siteId: project.data.site_id,
      systemName: project.data.name,
      projectType: String(project.data.mode).replace("_", "-") as ProposalIntakeInitial["projectType"],
      arrays: (arrays.data ?? []).map((array) => ({ id: array.id, name: array.name, manufacturer: array.manufacturer ?? "", model: array.panel_model ?? "", panelType: array.panel_type ?? "unknown", panelCount: Number(array.panel_count ?? 0), panelWatts: Number(array.panel_watts ?? 0), strings: array.strings == null ? undefined : Number(array.strings), panelsPerString: array.panels_per_string == null ? undefined : Number(array.panels_per_string), vmp: array.maximum_power_voltage_v == null ? undefined : Number(array.maximum_power_voltage_v), voc: array.open_circuit_voltage_v == null ? undefined : Number(array.open_circuit_voltage_v), imp: array.maximum_power_current_a == null ? undefined : Number(array.maximum_power_current_a), isc: array.short_circuit_current_a == null ? undefined : Number(array.short_circuit_current_a), mount: specificationText(array.specifications, "Mounting option") ?? "", location: array.installation_notes ?? "", tilt: array.tilt_degrees == null ? undefined : Number(array.tilt_degrees), orientation: array.orientation_degrees == null ? undefined : Number(array.orientation_degrees) })),
      components: (components.data ?? []).filter((component) => ["inverter", "battery", "generator"].includes(component.type)).map((component) => ({ id: component.id, type: component.type as "inverter" | "battery" | "generator", name: component.display_name, manufacturer: component.manufacturer ?? "", model: component.model ?? "", quantity: Number(component.quantity ?? 1), rating: specificationNumber(component.specifications, "Rated power"), batteryKwh: specificationNumber(component.specifications, "Nominal energy"), batteryAh: specificationNumber(component.specifications, "Rated capacity"), batteryType: specificationText(component.specifications, "Battery type")?.replaceAll(" ", "_"), bmsCompatibility: specificationText(component.specifications, "BMS compatibility")?.replaceAll(" ", "_"), voltage: specificationNumber(component.specifications, component.type === "battery" ? "Nominal battery voltage" : "AC output voltage") ?? specificationNumber(component.specifications, "Nominal voltage"), batteryVoltageMin: specificationNumber(component.specifications, "Battery voltage minimum"), batteryVoltageMax: specificationNumber(component.specifications, "Battery voltage maximum"), inverterType: specificationText(component.specifications, "Inverter type")?.replaceAll(" ", "_") as "hybrid" | "grid_tied_string" | "off_grid_inverter_charger" | "battery_inverter" | "microinverter" | "other" | undefined, generatorFuelType: specificationText(component.specifications, "Fuel type")?.replaceAll(" ", "_") as "petrol" | "diesel" | "lpg" | "natural_gas" | "dual_fuel" | "other" | undefined, mpptInputs: specificationNumber(component.specifications, "MPPT count"), mpptMin: specificationNumber(component.specifications, "MPPT minimum voltage"), mpptMax: specificationNumber(component.specifications, "MPPT maximum voltage"), maxPvVoltage: specificationNumber(component.specifications, "Maximum PV voltage"), maxInputCurrent: specificationNumber(component.specifications, "Maximum PV input current"), notes: component.notes ?? "" })),
    };
  }
  return <ProposalIntake sites={sites.data ?? []} initialSiteId={query.site} initialProposal={initialProposal} discoveryContext={query.from === "discovery" ? { draftId: query.draft } : undefined}/>;
}
