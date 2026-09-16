import { redirect } from "next/navigation";
import { ProposalIntake } from "@/components/proposal-intake";
import { createClient } from "@/lib/supabase/server";

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const query = await searchParams;
  const sites = await supabase.from("sites").select("id,name,location").eq("owner_id", userId).order("created_at");
  if (sites.error) throw sites.error;
  return <ProposalIntake sites={sites.data ?? []} initialSiteId={query.site}/>;
}
