import { redirect } from "next/navigation";
import { ComponentDetail } from "@/components/system-item-detail";
import { loadSiteWorkspace } from "@/data/cloud-project";
import type { ComponentSpec } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import { resolveComponentRegulatoryBundle } from "@/regulations/component-regulatory-library";
import { isCanonicalEquipmentImage } from "@/ui/assets";

const kinds = new Set<ComponentSpec["kind"]>(["panel","pv_string","battery","inverter","charger","generator","protection","isolator","cable","connector","combiner","meter","monitoring","load","other"]);

function panelComponent(array: import("@/domain/models").PVArray): ComponentSpec {
  const specs: Record<string, string | number> = { ...array.specifications };
  if (array.panelWatts) specs["Panel wattage"] = `${array.panelWatts} W`;
  if (array.panelType) specs["Cell technology"] = array.panelType;
  if (array.openCircuitVoltageV) specs["Open-circuit voltage (Voc)"] = `${array.openCircuitVoltageV} V`;
  if (array.maximumPowerVoltageV) specs["Maximum-power voltage (Vmp)"] = `${array.maximumPowerVoltageV} V`;
  if (array.shortCircuitCurrentA) specs["Short-circuit current (Isc)"] = `${array.shortCircuitCurrentA} A`;
  if (array.maximumPowerCurrentA) specs["Maximum-power current (Imp)"] = `${array.maximumPowerCurrentA} A`;
  return {
    id: array.id,
    kind: "panel",
    name: array.name,
    manufacturer: array.manufacturer,
    model: array.panelModel,
    quantity: 1,
    location: array.installationNotes?.replace(/^Installed location:\s*/i, ""),
    notes: array.installationNotes,
    photoUrl: array.labelPhotoPath,
    status: array.confidence,
    specs,
  };
}

export default async function EquipmentPage({ params, searchParams }: { params: Promise<{ id: string; systemId: string; itemId: string }>; searchParams: Promise<{ type?: string; name?: string; image?: string; returnTo?: string; proposalNode?: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  const { id, systemId, itemId } = await params; let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); } catch { redirect(`/sites/${id}`); }
  const savedComponent = itemId === "new" ? undefined : workspace.project.components.find((item) => item.id === itemId);
  const pvArray = itemId === "new" || savedComponent ? undefined : workspace.project.pvArrays.find((item) => item.id === itemId);
  const component = savedComponent ?? (pvArray ? panelComponent(pvArray) : undefined);
  if (itemId !== "new" && !component) redirect(`/sites/${id}/systems/${systemId}`);
  const query = await searchParams; const kind = kinds.has(query.type as ComponentSpec["kind"]) ? query.type as ComponentSpec["kind"] : "other";
  const schematicPath = `/sites/${id}/systems/${systemId}/schematic`;
  const designSchematicPath = `/sites/${id}/systems/${systemId}/design/schematic`;
  const returnTo = query.returnTo === schematicPath || query.returnTo === designSchematicPath ? query.returnTo : undefined;
  const proposal = Boolean(returnTo && ["discover", "design"].includes(workspace.project.phase));
  const proposalNodeId = proposal && workspace.project.designCalculator?.proposedAsBuiltDraft?.nodes?.some((node) => node.id === query.proposalNode)
    ? query.proposalNode
    : undefined;
  const schematicImage =
    isCanonicalEquipmentImage(query.image)
      ? query.image
      : undefined;
  const regulatoryBundle = savedComponent ? resolveComponentRegulatoryBundle({
    component: savedComponent,
    siteLocation: workspace.site.location,
    siteLocationConfirmed: workspace.site.locationConfirmed,
    relatedComponents: workspace.project.components,
    connections: workspace.project.connections,
  }) : undefined;
  return <ComponentDetail siteId={id} systemId={systemId} systemName={workspace.project.name} component={component} pvArray={pvArray} defaults={component ? undefined : { kind, name: query.name?.slice(0,120) || "New equipment", schematicImage }} returnTo={returnTo} proposal={proposal} proposalNodeId={proposalNodeId} proposalDesign={workspace.project.designCalculator} regulatoryBundle={regulatoryBundle}/>;
}
