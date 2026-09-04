import { PVIntellWorkspace } from "@/components/pvintell-workspace";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig.configured) {
    if (process.env.NODE_ENV === "development") return <PVIntellWorkspace />;
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#f3f6fa] p-6">
        <section className="card max-w-md p-6 text-center">
          <div className="eyebrow">Service configuration</div>
          <h1 className="mt-2 font-display text-xl font-extrabold text-ink">PVIntell is not connected</h1>
          <p className="mt-2 text-xs leading-5 text-muted">
            The production data service is not configured for this deployment. No demonstration system has been loaded.
          </p>
          <p className="mt-3 rounded-lg bg-[#eef3f8] px-3 py-2 font-mono text-[9px] leading-4 text-muted">
            Missing from this build: {supabaseConfig.missing.join(", ")}
          </p>
        </section>
      </main>
    );
  }
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const userId=typeof data?.claims?.sub==="string"?data.claims.sub:null;
  if(error||!userId) redirect("/login");
  const profile=await supabase.from("profiles").select("onboarding_status").eq("id",userId).single();
  if(profile.error)throw profile.error;
  redirect(profile.data.onboarding_status==="completed"?"/dashboard":"/onboarding");
}
