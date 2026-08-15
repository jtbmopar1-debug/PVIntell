import { redirect } from "next/navigation";
import { PVIntellWorkspace } from "@/components/pvintell-workspace";
import { initialConversation } from "@/data/demo-project";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

export default async function DesignCalculatorPage({ params }: { params: Promise<{ id: string; systemId: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const { id, systemId } = await params;
  let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); }
  catch { redirect(`/sites/${id}`); }
  const { project, messages, site, sites, systems, questionnaireDrafts, siteEquipment } = workspace;
  return <PVIntellWorkspace key={`${project.id}:${project.updatedAt ?? ""}`} initialProject={project} initialMessages={messages.length ? messages : initialConversation} initialSite={site} sites={sites} systems={systems} initialQuestionnaires={questionnaireDrafts} initialSiteEquipment={siteEquipment} cloud systemPage initialView="design" email={typeof claims.data?.claims?.email === "string" ? claims.data.claims.email : ""}/>;
}
