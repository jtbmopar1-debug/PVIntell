import { redirect } from "next/navigation";
import { PVIntellWorkspace, type WorkspaceView } from "@/components/pvintell-workspace";
import { initialConversation } from "@/data/demo-project";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

const workspaceViews = new Set<WorkspaceView>(["wattson", "setup", "equipment", "weather", "design", "system", "build", "commission", "monitor"]);

export default async function PowerSystemPage({ params, searchParams }: { params: Promise<{ id: string; systemId: string }>; searchParams: Promise<{ view?: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const { id, systemId } = await params; const requestedView = (await searchParams).view as WorkspaceView | undefined; let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); } catch { redirect(`/sites/${id}`); }
  const { project, messages, site, sites, systems, questionnaireDrafts, siteEquipment } = workspace;
  return <PVIntellWorkspace key={`${project.id}:${project.updatedAt ?? ""}`} initialProject={project} initialMessages={messages.length ? messages : initialConversation} initialSite={site} sites={sites} systems={systems} initialQuestionnaires={questionnaireDrafts} initialSiteEquipment={siteEquipment} cloud systemPage initialView={requestedView && workspaceViews.has(requestedView) ? requestedView : "system"} email={typeof claims.data?.claims?.email === "string" ? claims.data.claims.email : ""}/>;
}
