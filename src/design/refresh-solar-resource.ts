import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSiteSolarResource } from "@/weather/solar-resource";

export async function refreshProjectSolarResource(
  supabase: SupabaseClient,
  ownerId: string,
  projectId: string,
  siteId: string,
  standalone: boolean,
) {
  const [site, project] = await Promise.all([
    supabase.from("sites").select("latitude,longitude").eq("id", siteId).eq("owner_id", ownerId).maybeSingle(),
    supabase.from("projects").select("settings").eq("id", projectId).eq("owner_id", ownerId).maybeSingle(),
  ]);
  if (site.error) throw site.error;
  if (project.error) throw project.error;
  if (!site.data || typeof site.data.latitude !== "number" || typeof site.data.longitude !== "number") {
    throw new Error("Confirm the Site map pin before calculating its solar resource.");
  }
  if (!project.data) throw new Error("Power system not found.");
  const resource = await loadSiteSolarResource(site.data.latitude, site.data.longitude, standalone);
  const settings = { ...((project.data.settings ?? {}) as Record<string, unknown>) };
  settings.peakSunHours = resource.peakSunHours;
  settings.solarResource = { ...resource, latitude: site.data.latitude, longitude: site.data.longitude, calculatedAt: new Date().toISOString() };
  const saved = await supabase.from("projects").update({ settings }).eq("id", projectId).eq("owner_id", ownerId);
  if (saved.error) throw saved.error;
  return resource;
}
