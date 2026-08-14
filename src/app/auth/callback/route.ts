import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:Request){
  const url=new URL(request.url);const code=url.searchParams.get("code");let next=url.searchParams.get("next")??"/";if(!next.startsWith("/"))next="/";
  if(code){
    const supabase=await createClient();
    const {data,error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error){
      const createdAt=data.user?.created_at?new Date(data.user.created_at).getTime():0;
      const isNewGoogleUser=Boolean(createdAt&&Date.now()-createdAt<120_000);
      const destination=new URL(next,url.origin);
      if(isNewGoogleUser)destination.searchParams.set("welcome","google");
      return NextResponse.redirect(destination);
    }
  }
  return NextResponse.redirect(new URL("/login?error=Google+sign-in+failed",url.origin));
}
