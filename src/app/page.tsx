import { PVIntellWorkspace } from "@/components/pvintell-workspace";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  if (!getSupabaseConfig().configured) return <PVIntellWorkspace />;
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const userId=typeof data?.claims?.sub==="string"?data.claims.sub:null;
  if(error||!userId) redirect("/login");
  const profile=await supabase.from("profiles").select("onboarding_status").eq("id",userId).single();
  if(profile.error)throw profile.error;
  redirect(profile.data.onboarding_status==="completed"?"/dashboard":"/onboarding");
}
