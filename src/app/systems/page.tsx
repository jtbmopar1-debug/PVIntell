import { redirect } from "next/navigation";
import { SystemsHub } from "@/components/systems-hub";
import type { Site, SystemSummary } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

export default async function SystemsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const [siteRows, systemRows] = await Promise.all([
    supabase.from("sites").select("id,name,location,latitude,longitude,timezone,location_source,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,mode,phase").eq("owner_id", userId).order("created_at"),
  ]);
  if (siteRows.error) throw siteRows.error;
  if (systemRows.error) throw systemRows.error;
  const sites: Site[] = (siteRows.data ?? []).map((site) => ({ id: site.id, name: site.name, location: site.location || "Location not set", latitude: site.latitude == null ? undefined : Number(site.latitude), longitude: site.longitude == null ? undefined : Number(site.longitude), timezone: site.timezone || "UTC", locationSource: site.location_source || "manual", locationConfirmed: Boolean(site.location_confirmed) }));
  const systems: SystemSummary[] = (systemRows.data ?? []).map((system) => ({ id: system.id, siteId: system.site_id, name: system.name, projectType: String(system.mode).replace("_", "-") as SystemSummary["projectType"], phase: system.phase as SystemSummary["phase"] }));
  return <SystemsHub sites={sites} systems={systems} selectedSiteId={query.site}/>;
}
