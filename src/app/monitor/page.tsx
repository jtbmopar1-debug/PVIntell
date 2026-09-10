import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DailyMonitor, type MonitorSystem } from "@/components/daily-monitor";

export default async function MonitorPage({ searchParams }: { searchParams: Promise<{ system?: string; site?: string }> }) {
  const db = await createClient(); const claims = await db.auth.getClaims(); const ownerId = claims.data?.claims?.sub;
  if (claims.error || typeof ownerId !== "string") redirect("/login");
  const [projects, sites, params] = await Promise.all([
    db.from("projects").select("id,site_id,name,phase").eq("owner_id", ownerId).order("name"),
    db.from("sites").select("id,name,location,latitude,longitude,timezone").eq("owner_id", ownerId),
    searchParams,
  ]);
  if (projects.error || sites.error) throw new Error("Could not load your systems");
  const ids = projects.data.map((project) => project.id);
  const arrays = ids.length ? await db.from("pv_arrays").select("project_id,panel_watts,panel_count,orientation_degrees,tilt_degrees").in("project_id", ids) : { data: [], error: null };
  if (arrays.error) throw new Error("Could not load recorded arrays");
  const systems: MonitorSystem[] = projects.data.flatMap((project) => {
    const site = sites.data.find((item) => item.id === project.site_id);
    if (!site) return [];
    return [{ id: project.id, name: project.name, phase: project.phase,
      site: { id: site.id, name: site.name, location: site.location ?? "", latitude: site.latitude ?? undefined, longitude: site.longitude ?? undefined, timezone: site.timezone || "UTC", locationSource: "manual", locationConfirmed: false },
      arrays: (arrays.data ?? []).filter((array) => array.project_id === project.id).flatMap((array) => {
        const capacityKw = Number(array.panel_watts) * Number(array.panel_count) / 1000;
        return capacityKw > 0 ? [{ capacityKw, azimuthDegrees: array.orientation_degrees, tiltDegrees: array.tilt_degrees }] : [];
      }),
    }];
  });
  return <DailyMonitor systems={systems} initialSystemId={systems.find((system) => system.id === params.system)?.id ?? systems.find((system) => system.site.id === params.site)?.id}/>;
}
