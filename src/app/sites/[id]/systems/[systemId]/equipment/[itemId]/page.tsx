import { redirect } from "next/navigation";
import { ComponentDetail } from "@/components/system-item-detail";
import { loadSiteWorkspace } from "@/data/cloud-project";
import type { ComponentSpec } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

const kinds = new Set<ComponentSpec["kind"]>(["panel","pv_string","battery","inverter","charger","generator","protection","isolator","cable","connector","combiner","meter","monitoring","load","other"]);

export default async function EquipmentPage({ params, searchParams }: { params: Promise<{ id: string; systemId: string; itemId: string }>; searchParams: Promise<{ type?: string; name?: string; image?: string; returnTo?: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  const { id, systemId, itemId } = await params; let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); } catch { redirect(`/sites/${id}`); }
  const component = itemId === "new" ? undefined : workspace.project.components.find((item) => item.id === itemId);
  if (itemId !== "new" && !component) redirect(`/sites/${id}/systems/${systemId}`);
  const query = await searchParams; const kind = kinds.has(query.type as ComponentSpec["kind"]) ? query.type as ComponentSpec["kind"] : "other";
  const schematicPath = `/sites/${id}/systems/${systemId}/schematic`;
  const returnTo = query.returnTo === schematicPath ? schematicPath : undefined;
  const schematicImage =
    query.image &&
    /^\/schematic-components\/[A-Za-z0-9._%()-]+$/.test(query.image) &&
    !query.image.includes("..")
      ? query.image
      : undefined;
  return <ComponentDetail siteId={id} systemId={systemId} systemName={workspace.project.name} component={component} defaults={component ? undefined : { kind, name: query.name?.slice(0,120) || "New equipment", schematicImage }} returnTo={returnTo}/>;
}
