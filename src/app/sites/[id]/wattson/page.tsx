import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Reopens the latest discovery conversation belonging to this Site. */
export default async function SiteWattsonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const site = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", userId).maybeSingle();
  if (!site.data) redirect("/dashboard");
  const conversation = await supabase.from("user_conversations").select("id").eq("owner_id", userId).eq("site_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  redirect(conversation.data?.id ? `/dashboard?site=${id}&conversation=${conversation.data.id}#wattson` : `/dashboard?site=${id}#wattson`);
}
