import { redirect } from "next/navigation";
import { SystemsHub } from "@/components/systems-hub";
import type { DesignCalculatorState, Site, SystemSummary } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

export default async function SystemsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const [siteRows, systemRows, draftRows] = await Promise.all([
    supabase.from("sites").select("id,name,location,latitude,longitude,timezone,location_source,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,mode,phase,settings").eq("owner_id", userId).order("created_at"),
    supabase.from("discovery_drafts").select("id,status,question_id,answers,updated_at").eq("owner_id", userId).order("updated_at", { ascending: false }),
  ]);
  if (siteRows.error) throw siteRows.error;
  if (systemRows.error) throw systemRows.error;
  if (draftRows.error) throw draftRows.error;
  const sites: Site[] = (siteRows.data ?? []).map((site) => ({ id: site.id, name: site.name, location: site.location || "Location not set", latitude: site.latitude == null ? undefined : Number(site.latitude), longitude: site.longitude == null ? undefined : Number(site.longitude), timezone: site.timezone || "UTC", locationSource: site.location_source || "manual", locationConfirmed: Boolean(site.location_confirmed) }));
  const systems: SystemSummary[] = (systemRows.data ?? []).map((system) => {
    const settings = (system.settings ?? {}) as { designCalculator?: DesignCalculatorState };
    const completedAreas = system.phase === "discover" ? [] : ["setup"];
    if (settings.designCalculator?.proposedChecklist?.["proposed-schematic"]) completedAreas.push("proposed-schematic");
    return { id: system.id, siteId: system.site_id, name: system.name, projectType: String(system.mode).replace("_", "-") as SystemSummary["projectType"], phase: system.phase as SystemSummary["phase"], completedAreas };
  });
  const drafts = (draftRows.data ?? []).map((draft) => { const answers = (draft.answers ?? {}) as Record<string, unknown>; return { id: draft.id, siteId: typeof answers.site_id === "string" ? answers.site_id : undefined, name: typeof answers.system_name === "string" && answers.system_name.trim() ? answers.system_name.trim() : "New system", status: draft.status, questionId: draft.question_id }; });
  return <SystemsHub sites={sites} systems={systems} drafts={drafts} selectedSiteId={query.site}/>;
}
