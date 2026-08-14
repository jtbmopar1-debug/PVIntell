import { PVIntellWorkspace } from "@/components/pvintell-workspace";
import { initialConversation } from "@/data/demo-project";
import { loadOrCreateProject } from "@/data/cloud-project";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  if (!getSupabaseConfig().configured) return <PVIntellWorkspace />;
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const userId=typeof data?.claims?.sub==="string"?data.claims.sub:null;
  if(error||!userId) redirect("/login");
  const {project,messages}=await loadOrCreateProject(supabase,userId);
  return <PVIntellWorkspace initialProject={project} initialMessages={messages.length?messages:initialConversation} cloud email={typeof data?.claims?.email==="string"?data.claims.email:""}/>;
}
