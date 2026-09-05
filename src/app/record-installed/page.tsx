import { redirect } from "next/navigation";
import { RecordInstalledSystem } from "@/components/record-installed-system";
import { createClient } from "@/lib/supabase/server";

export default async function RecordInstalledPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const sites = await supabase.from("sites").select("id,name").eq("owner_id", userId).order("created_at");
  if (sites.error) throw new Error(sites.error.message);
  return <RecordInstalledSystem sites={sites.data ?? []} initialSiteId={query.site}/>;
}
