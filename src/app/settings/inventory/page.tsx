import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SiteEquipmentInventory } from "@/components/site-equipment";
import { loadSiteInventory } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

export default async function UnusedInventoryPage({ searchParams }: { searchParams: Promise<{ site?: string; edit?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const sites = await supabase.from("sites").select("id,name").eq("owner_id", userId).order("created_at");
  if (sites.error) throw sites.error;
  const selectedSite = sites.data?.find((site) => site.id === query.site) ?? sites.data?.[0];

  if (!selectedSite) return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><section className="card mt-6 p-6"><h1 className="font-display text-2xl font-extrabold">Unused Inventory</h1><p className="mt-2 text-xs leading-5 text-muted">Create a Site before recording equipment that may be used there.</p></section></div></main>;

  const workspace = await loadSiteInventory(supabase, selectedSite.id);
  const unused = workspace.equipment.filter((item) => !item.assignedProjectId);
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><div className="mt-6 flex flex-wrap gap-2">{sites.data?.map((site) => <Link key={site.id} href={`/settings/inventory?site=${site.id}`} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${site.id === selectedSite.id ? "border-brand bg-[#eef5fc] text-brand" : "border-line bg-white text-muted"}`}><MapPin size={13}/>{site.name}</Link>)}</div><div className="mt-5"><SiteEquipmentInventory siteId={selectedSite.id} projectId={workspace.systems[0]?.id} initialEquipment={unused} initialEditId={query.edit} title="Unused Inventory" description={`Equipment owned at ${selectedSite.name} that has not been assigned to a system. Discovery and proposals can reference these records without marking them installed.`}/></div></div></main>;
}
