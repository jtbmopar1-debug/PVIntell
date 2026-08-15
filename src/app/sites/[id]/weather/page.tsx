import { redirect } from "next/navigation";
import { SiteInventoryPage } from "@/components/site-inventory-page";
import { loadSiteInventory } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

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
  if (systemIds.length) {
    const arrays = await supabase
      .from("pv_arrays")
      .select("panel_watts,panel_count")
      .in("project_id", systemIds);
    if (arrays.error) throw arrays.error;
    solarArrayKw =
      (arrays.data ?? []).reduce(
        (total, array) =>
          total +
          Number(array.panel_watts ?? 0) * Number(array.panel_count ?? 0),
        0,
      ) / 1000;
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
    />
  );
}
