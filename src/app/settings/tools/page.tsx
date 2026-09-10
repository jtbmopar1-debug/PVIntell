import { ArrowLeft, Cable, ChevronDown, Compass, PlugZap, WalletCards, Waves } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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
    <div className="flex items-center justify-between"><Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Dashboard</Link><BrandLogo compact/></div>
    <header className="mt-4"><div className="eyebrow">Calculators and utilities</div><h1 className="mt-1.5 font-display text-xl font-extrabold tracking-[-.04em]">Tools</h1></header>

    <div className="mt-4 space-y-2">
    <ToolDisclosure icon={<WalletCards size={16}/>} eyebrow="Solar finances" title="Purchases, expenses & buy-back" description="Add costs or returns and keep an automatic running total for each system." defaultOpen={query.calculator === "finances"}>
      {siteProjects.length ? <>
        <nav className="flex flex-wrap gap-1.5" aria-label="Choose a system financial ledger">{siteProjects.map((project) => <Link key={project.id} href={`/tools?site=${project.site_id}&system=${project.id}&calculator=finances`} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${project.id === selectedProject?.id ? "border-brand bg-brand text-white" : "border-line bg-white text-brand hover:border-[#9db9d2]"}`}>{project.name}</Link>)}</nav>
        {selectedProject ? <SystemFinancials projectId={selectedProject.id} initialState={financials} compact/> : null}
      </> : <div className="rounded-lg border border-line p-3 text-[10px] text-muted">Create a solar system first, then return here to start its finance ledger.</div>}
    </ToolDisclosure>

    <ToolDisclosure icon={<PlugZap size={16}/>} eyebrow="Energy use" title="Appliance running calculator" description="Estimate combined daily energy use from appliance ratings and run times." defaultOpen={query.calculator === "appliances"}>
      <ToolBody><ApplianceRunningCalculator/></ToolBody>
    </ToolDisclosure>

    <ToolDisclosure icon={<Waves size={16}/>} eyebrow="Water heating" title="Pool and spa heater calculator" description="Estimate warm-up energy, heater output and electrical input." defaultOpen={query.calculator === "pool" || Boolean(calculatorReturnTo)}>
      <ToolBody><PoolHeatingCalculator locationLabel={initialLocation.label} returnTo={calculatorReturnTo}/></ToolBody>
    </ToolDisclosure>

    <ToolDisclosure icon={<Compass size={16}/>} eyebrow="Solar orientation" title="Azimuth & tilt calculator" description="Find a location-based starting direction and measure a surface with your phone." defaultOpen={query.calculator === "orientation"}>
      <div className="[&_.card]:rounded-lg [&_.card]:shadow-none [&_.field]:h-8 [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-3"><AzimuthCalculator initialLocation={initialLocation}/></div>
    </ToolDisclosure>

    <ToolDisclosure icon={<Cable size={16}/>} eyebrow="Electrical planning" title="Cable size & voltage-drop calculator" description="Check a planning conductor size and voltage drop for a circuit." defaultOpen={query.calculator === "cable"}>
      <ToolBody><CableProtectionCalculator/></ToolBody>
    </ToolDisclosure>
    </div>
  </div></main>;
}

function ToolDisclosure({ icon, eyebrow, title, description, defaultOpen, children }: { icon: ReactNode; eyebrow: string; title: string; description: string; defaultOpen?: boolean; children: ReactNode }) {
  return <details open={defaultOpen || undefined} className="card group overflow-hidden">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-3 sm:p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand">{icon}</span>
      <span className="min-w-0 flex-1"><span className="eyebrow">{eyebrow}</span><strong className="mt-1 block text-sm sm:text-base">{title}</strong><span className="mt-1 block text-[10px] leading-4 text-muted">{description}</span></span>
      <ChevronDown aria-hidden size={17} className="shrink-0 text-brand transition-transform group-open:rotate-180"/>
    </summary>
    <div className="border-t border-line p-3 sm:p-4">{children}</div>
  </details>;
}

function ToolBody({ children }: { children: ReactNode }) {
  return <div className="[&>section]:!mt-0 [&>section]:!rounded-lg [&>section]:!shadow-none">{children}</div>;
}
