import { redirect } from "next/navigation";
import { PVIntellWorkspace, type WorkspaceView } from "@/components/pvintell-workspace";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

const workspaceViews = new Set<WorkspaceView>(["wattson", "equipment", "weather", "design", "overview", "system", "build", "commission", "monitor"]);

export default async function PowerSystemPage({ params, searchParams }: { params: Promise<{ id: string; systemId: string }>; searchParams: Promise<{ view?: string; conversation?: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const { id, systemId } = await params; const query = await searchParams;
  if (query.view === "setup") redirect(`/sites/${id}/discovery`);
  const requestedView = query.view as WorkspaceView | undefined; let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId, query.conversation); } catch { redirect(`/sites/${id}`); }
  const { project, messages, conversationId, site, sites, systems, questionnaireDrafts, siteEquipment } = workspace;
  const installed = ["monitor", "diagnose", "maintain", "explain"].includes(project.phase);
  return <PVIntellWorkspace key={`${project.id}:${project.updatedAt ?? ""}:${conversationId ?? "latest"}`} initialProject={project} initialMessages={messages} initialConversationId={conversationId} initialSite={site} sites={sites} systems={systems} initialQuestionnaires={questionnaireDrafts} initialSiteEquipment={siteEquipment} cloud systemPage initialView={requestedView && workspaceViews.has(requestedView) ? requestedView : installed ? "overview" : "system"} email={typeof claims.data?.claims?.email === "string" ? claims.data.claims.email : ""}/>;
}
