import { redirect } from "next/navigation";
import { PVIntellWorkspace } from "@/components/pvintell-workspace";
import { initialConversation } from "@/data/demo-project";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

export default async function ProposedSchematicPage({ params, searchParams }: PageProps<"/sites/[id]/systems/[systemId]/design/schematic">) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  const { id, systemId } = await params;
  const query = await searchParams;
  let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); }
  catch { redirect(`/sites/${id}`); }
  const { project, messages, site, sites, systems, questionnaireDrafts, siteEquipment } = workspace;
  return <PVIntellWorkspace key={`${project.id}:${project.updatedAt ?? ""}:proposed-schematic`} initialProject={project} initialMessages={messages.length ? messages : initialConversation} initialSite={site} sites={sites} systems={systems} initialQuestionnaires={questionnaireDrafts} initialSiteEquipment={siteEquipment} cloud systemPage initialView="proposed-schematic" showProposalIntro={query.proposal === "intro"} email={typeof claims.data?.claims?.email === "string" ? claims.data.claims.email : ""}/>;
}
