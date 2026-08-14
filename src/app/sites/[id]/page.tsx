import { redirect } from "next/navigation";
import { SiteInventoryPage } from "@/components/site-inventory-page";
import { loadSiteInventory } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const { id } = await params;
  let workspace;
  try { workspace = await loadSiteInventory(supabase, id); }
  catch { redirect("/"); }
  return <SiteInventoryPage site={workspace.site} sites={workspace.sites} initialSystems={workspace.systems} equipment={workspace.equipment} email={typeof claims.data?.claims?.email === "string" ? claims.data.claims.email : ""}/>;
}
