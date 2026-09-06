import { redirect } from "next/navigation";
import { ComponentBuildWorkspace } from "@/components/component-build-workspace";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

export default async function ComponentBuildPage({ params }: { params: Promise<{ id: string; systemId: string; itemId: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  const { id, systemId, itemId } = await params;
  let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); }
  catch { redirect(`/sites/${id}`); }
  return <ComponentBuildWorkspace project={workspace.project} site={workspace.site} itemId={itemId}/>;
}
