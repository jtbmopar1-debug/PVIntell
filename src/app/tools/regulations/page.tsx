import { redirect } from "next/navigation";
import { ComponentRegulationsPage } from "@/components/component-regulations-page";
import { HowToRegulationsRoute } from "@/components/how-to-regulations-route";
import { RulesRegulationsHub, type RulesHubComponent, type RulesHubSite } from "@/components/rules-regulations-hub";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";
import type { ComponentSpec } from "@/domain/models";
import { resolveComponentRegulatoryBundle, type ComponentRegulatoryBundle } from "@/regulations/component-regulatory-library";

export default async function RulesAndRegulationsPage({ searchParams }: {
  searchParams: Promise<{ site?: string; system?: string; component?: string; guide?: string; jurisdiction?: string }>;
}) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const [siteRows, projectRows, profileRow] = await Promise.all([
    supabase.from("sites").select("id,name,location,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name").eq("owner_id", userId).order("created_at"),
    supabase.from("profiles").select("home_location").eq("id", userId).single(),
  ]);
  if (siteRows.error) throw siteRows.error;
  if (projectRows.error) throw projectRows.error;
  if (profileRow.error) throw profileRow.error;
  const sites: RulesHubSite[] = (siteRows.data ?? []).map((site) => ({ id: site.id, name: site.name, location: site.location || "Location not set", locationConfirmed: Boolean(site.location_confirmed) }));
  const selectedSite = sites.find((site) => site.id === query.site) ?? sites[0];
  const selectedJurisdiction = query.jurisdiction?.trim() || profileRow.data.home_location?.trim() || selectedSite?.location || "";

  if (selectedSite && query.guide)
    return <HowToRegulationsRoute guideId={query.guide} site={{ ...selectedSite, location: selectedJurisdiction, locationConfirmed: Boolean(selectedJurisdiction) }} backHref={`/settings/regulations?site=${selectedSite.id}&jurisdiction=${encodeURIComponent(selectedJurisdiction)}`}/>;

  if (selectedSite && query.system && query.component) {
    const ownedProject = (projectRows.data ?? []).find((project) => project.id === query.system && project.site_id === selectedSite.id);
    if (ownedProject) {
      let selectedComponent: ComponentSpec | undefined;
      let selectedBundle: ComponentRegulatoryBundle | undefined;
      try {
        const workspace = await loadSiteWorkspace(supabase, selectedSite.id, ownedProject.id);
        const component = workspace.project.components.find((candidate) => candidate.id === query.component);
        if (component) {
          const bundle = resolveComponentRegulatoryBundle({ component, siteLocation: selectedJurisdiction, siteLocationConfirmed: Boolean(selectedJurisdiction), relatedComponents: workspace.project.components, connections: workspace.project.connections });
          selectedComponent = component;
          selectedBundle = bundle;
        }
      } catch { /* Fall through to the safe hub rather than exposing record lookup details. */ }
      if (selectedComponent && selectedBundle) return <ComponentRegulationsPage siteId={selectedSite.id} systemId={ownedProject.id} component={selectedComponent} bundle={selectedBundle} guidanceApiUrl={`/api/components/${selectedComponent.id}/regulations?jurisdiction=${encodeURIComponent(selectedJurisdiction)}`} backHref={`/settings/regulations?site=${selectedSite.id}&jurisdiction=${encodeURIComponent(selectedJurisdiction)}`} backLabel="Back to Rules & regulations"/>;
    }
  }

  const projectIds = (projectRows.data ?? []).map((project) => project.id);
  const componentRows = projectIds.length
    ? await supabase.from("system_components").select("id,project_id,type,display_name").in("project_id", projectIds).order("display_name")
    : { data: [], error: null };
  if (componentRows.error) throw componentRows.error;
  const components: RulesHubComponent[] = (componentRows.data ?? []).flatMap((component) => {
    const project = (projectRows.data ?? []).find((candidate) => candidate.id === component.project_id);
    return project ? [{ id: component.id, siteId: project.site_id, systemId: project.id, systemName: project.name, kind: component.type, name: component.display_name }] : [];
  });
  return <RulesRegulationsHub sites={sites} components={components} initialSiteId={selectedSite?.id} homeLocation={profileRow.data.home_location ?? ""}/>;
}
