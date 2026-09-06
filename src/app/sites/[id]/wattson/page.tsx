import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Opens Wattson with this Site selected. */
export default async function SiteWattsonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const site = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", userId).maybeSingle();
  if (!site.data) redirect("/dashboard");
  redirect(`/wattson?site=${id}`);
}
