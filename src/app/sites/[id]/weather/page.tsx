import { redirect } from "next/navigation";
import { SiteInventoryPage } from "@/components/site-inventory-page";
import { loadSiteInventory } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";
import type { SolarArrayForecastInput } from "@/weather/forecast";

export default async function SiteWeatherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");

  const { id } = await params;
  let workspace;
  try {
    workspace = await loadSiteInventory(supabase, id);
  } catch {
    redirect("/");
  }

  const systemIds = workspace.systems.map((system) => system.id);
  let solarArrayKw = 0;
  let solarArrays: SolarArrayForecastInput[] = [];
  if (systemIds.length) {
    const arrays = await supabase
      .from("pv_arrays")
      .select("panel_watts,panel_count,orientation_degrees,tilt_degrees")
      .in("project_id", systemIds);
    if (arrays.error) throw arrays.error;
    solarArrays = (arrays.data ?? []).flatMap((array) => {
      const capacityKw = Number(array.panel_watts ?? 0) * Number(array.panel_count ?? 0) / 1000;
      if (capacityKw <= 0) return [];
      return [{
        capacityKw,
        azimuthDegrees: array.orientation_degrees == null ? null : Number(array.orientation_degrees),
        tiltDegrees: array.tilt_degrees == null ? null : Number(array.tilt_degrees),
      }];
    });
    solarArrayKw = solarArrays.reduce((total, array) => total + array.capacityKw, 0);
  }

  return (
    <SiteInventoryPage
      site={workspace.site}
      sites={workspace.sites}
      initialSystems={workspace.systems}
      equipment={workspace.equipment}
      email={
        typeof claims.data?.claims?.email === "string"
          ? claims.data.claims.email
          : ""
      }
      weatherMode
      solarArrayKw={solarArrayKw}
      solarArrays={solarArrays}
    />
  );
}
