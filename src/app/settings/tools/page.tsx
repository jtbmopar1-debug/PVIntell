import { ArrowLeft, Compass, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplianceRunningCalculator } from "@/components/appliance-running-calculator";
import { AzimuthCalculator } from "@/components/azimuth-calculator";
import { BrandLogo } from "@/components/brand-logo";
import { CableProtectionCalculator } from "@/components/cable-protection-calculator";
import { PoolHeatingCalculator } from "@/components/pool-heating-calculator";
import { SystemFinancials } from "@/components/system-financials";
import type { SystemFinancialsState } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ site?: string; system?: string; calculator?: string; returnTo?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");

  const query = await searchParams;
  const [sites, projects] = await Promise.all([
    supabase.from("sites").select("id,name,location,latitude,longitude").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,settings").eq("owner_id", userId).order("created_at"),
  ]);
  if (sites.error) throw sites.error;
  if (projects.error) throw projects.error;

  const site = sites.data?.find((item) => item.id === query.site) ?? sites.data?.[0];
  const siteProjects = (projects.data ?? []).filter((project) => !site || project.site_id === site.id);
  const selectedProject = siteProjects.find((project) => project.id === query.system) ?? siteProjects[0];
  const projectSettings = (selectedProject?.settings ?? {}) as { systemFinancials?: SystemFinancialsState };
  const financials = projectSettings.systemFinancials ?? { currency: "NZD", entries: [] };
  const initialLocation = { latitude: Number(site?.latitude ?? 0), longitude: Number(site?.longitude ?? 0), label: site?.location || site?.name || "Enter a location" };
  const calculatorReturnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : undefined;

  return <main className="min-h-screen bg-canvas p-3 md:p-5"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div>
    <header className="mt-4"><div className="eyebrow">Calculators and utilities</div><h1 className="mt-1.5 font-display text-xl font-extrabold tracking-[-.04em]">Tools</h1></header>

    <section className="card mt-4 p-3 sm:p-4">
      <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><WalletCards size={15}/></span><div><div className="eyebrow">Solar finances</div><h2 className="mt-1 text-base font-extrabold">Purchases, expenses &amp; buy-back</h2></div></div>
      <p className="mt-1.5 text-[10px] leading-4 text-muted">Add costs or returns and keep an automatic running total for each system.</p>
      {siteProjects.length ? <>
        <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Choose a system financial ledger">{siteProjects.map((project) => <Link key={project.id} href={`/settings/tools?site=${project.site_id}&system=${project.id}`} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${project.id === selectedProject?.id ? "border-brand bg-brand text-white" : "border-line bg-white text-brand hover:border-[#9db9d2]"}`}>{project.name}</Link>)}</nav>
        {selectedProject ? <SystemFinancials projectId={selectedProject.id} initialState={financials} compact/> : null}
      </> : <div className="mt-3 rounded-lg border border-line p-3 text-[10px] text-muted">Create a solar system first, then return here to start its finance ledger.</div>}
    </section>

    <ApplianceRunningCalculator/>

    <PoolHeatingCalculator locationLabel={initialLocation.label} returnTo={calculatorReturnTo}/>

    <section className="card mt-4 overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line p-3 sm:px-4"><span className="grid size-8 place-items-center rounded-lg bg-[#fff1ac] text-brand"><Compass size={15}/></span><div><div className="eyebrow">Solar orientation</div><h2 className="mt-1 text-base font-extrabold">Azimuth &amp; tilt calculator</h2></div></div>
      <div className="px-3 pb-3 sm:px-4 [&_.card]:rounded-lg [&_.card]:shadow-none [&_.field]:h-8 [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-3"><AzimuthCalculator initialLocation={initialLocation}/></div>
    </section>

    <CableProtectionCalculator/>
  </div></main>;
}
