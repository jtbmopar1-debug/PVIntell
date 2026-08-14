import { redirect } from "next/navigation";
import { PVStringDetail } from "@/components/pv-string-detail";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

export default async function StringPage({ params }: { params: Promise<{ id: string; systemId: string; stringId: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  const { id, systemId, stringId } = await params; let workspace;
  try { workspace = await loadSiteWorkspace(supabase, id, systemId); } catch { redirect(`/sites/${id}`); }
  const string = stringId === "new" ? undefined : workspace.project.pvArrays.find((item) => item.id === stringId);
  if (stringId !== "new" && !string) redirect(`/sites/${id}/systems/${systemId}`);
  return <PVStringDetail siteId={id} systemId={systemId} systemName={workspace.project.name} string={string}/>;
}
