import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SystemFinancials } from "@/components/system-financials";
import type { SystemFinancialsState } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

export default async function FinancialsPage({ params }: { params: Promise<{ id: string; systemId: string }> }) {
  const { id, systemId } = await params; const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub; if (claims.error || typeof userId !== "string") redirect("/login");
  const project = await supabase.from("projects").select("id,name,settings").eq("id", systemId).eq("site_id", id).eq("owner_id", userId).maybeSingle(); if (project.error || !project.data) redirect(`/systems?site=${id}`);
  const settings = (project.data.settings ?? {}) as { systemFinancials?: SystemFinancialsState }; const initialState = settings.systemFinancials ?? { currency: "NZD", entries: [] };
  return <main className="min-h-screen bg-canvas p-4 pb-20 md:p-6"><div className="mx-auto max-w-5xl"><div className="flex items-center justify-between"><Link href={`/systems?site=${id}`} className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Systems</Link><BrandLogo compact/></div><header className="mt-6"><div className="eyebrow">System financials · {project.data.name}</div><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em]">Costs & returns</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-muted">Keep a running record of purchases, other costs, rebates and energy buy-back payments. Amounts are recorded as transactions so the net system cost stays visible.</p></header><SystemFinancials projectId={systemId} initialState={initialState}/></div></main>;
}
