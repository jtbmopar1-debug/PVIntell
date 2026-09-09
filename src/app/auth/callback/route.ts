import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:Request){
  const url=new URL(request.url);const code=url.searchParams.get("code");const passwordSetup=url.searchParams.get("flow")==="password_setup";let next=passwordSetup?"/account?setup=password#password":url.searchParams.get("next")??"/dashboard";if(!next.startsWith("/")||next.startsWith("//"))next="/dashboard";
  if(code){
    const supabase=await createClient();
    const {data,error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error){
      const createdAt=data.user?.created_at?new Date(data.user.created_at).getTime():0;
      const isNewGoogleUser=Boolean(createdAt&&Date.now()-createdAt<120_000);
      const profile=await supabase.from("profiles").select("onboarding_status").eq("id",data.user.id).maybeSingle();
      const needsOnboarding=profile.data?.onboarding_status!=="completed";
      if(needsOnboarding) await supabase.from("profiles").update({theme_preference:"light"}).eq("id",data.user.id);
      const destination=new URL(needsOnboarding?"/onboarding":next,url.origin);
      if(isNewGoogleUser&&needsOnboarding)destination.searchParams.set("welcome","google");
      return NextResponse.redirect(destination);
    }
  }
  return NextResponse.redirect(new URL("/login?error=Google+sign-in+failed",url.origin));
}
