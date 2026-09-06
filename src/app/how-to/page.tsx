import { redirect } from "next/navigation";
import { HowToLibrary } from "@/components/how-to-library";
import { createClient } from "@/lib/supabase/server";

export default async function HowToPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const { site: requestedSiteId } = await searchParams;
  const sites = await supabase.from("sites").select("id,name,location").eq("owner_id", userId).order("created_at");
  if (sites.error) throw sites.error;
  const selected = sites.data?.find((site) => site.id === requestedSiteId) ?? sites.data?.[0];
  return <HowToLibrary siteId={selected?.id} siteName={selected?.name} location={selected?.location ?? undefined}/>;
}
