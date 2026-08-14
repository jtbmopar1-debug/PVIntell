import { PVIntellWorkspace } from "@/components/pvintell-workspace";
import { CreateFirstSite } from "@/components/create-first-site";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home({searchParams}:{searchParams:Promise<{welcome?:string}>}) {
  if (!getSupabaseConfig().configured) return <PVIntellWorkspace />;
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const userId=typeof data?.claims?.sub==="string"?data.claims.sub:null;
  if(error||!userId) redirect("/login");
  const query=await searchParams; const sites=await supabase.from("sites").select("id").order("created_at").limit(1);
  if(sites.error)throw sites.error;
  if(!sites.data?.length)return <CreateFirstSite/>;
  redirect(`/sites/${sites.data[0].id}${query.welcome==="google"?"?welcome=google":""}`);
}
