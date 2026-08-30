import { redirect } from "next/navigation";
import { BuildStepGuide } from "@/components/build-step-guide";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

export default async function BuildStepPage({
  params,
}: {
  params: Promise<{ id: string; systemId: string; stepId: string }>;
}) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  const { id, systemId, stepId } = await params;
  let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); }
  catch { redirect(`/sites/${id}`); }
  const step = workspace.project.installationSteps.find((item) => item.id === stepId);
  if (!step) redirect(`/sites/${id}/systems/${systemId}?view=build`);
  const position = workspace.project.installationSteps.findIndex((item) => item.id === stepId) + 1;
  return <BuildStepGuide project={workspace.project} site={workspace.site} step={step} position={position}/>;
}
