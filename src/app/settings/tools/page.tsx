import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { CableProtectionCalculator } from "@/components/cable-protection-calculator";
import { createClient } from "@/lib/supabase/server";

export default async function ToolsPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><header className="mt-5"><div className="eyebrow">Calculators and utilities</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Tools</h1><p className="mt-1.5 text-xs text-muted">Standalone checks that are not tied to one system record.</p></header><CableProtectionCalculator/></div></main>;
}
