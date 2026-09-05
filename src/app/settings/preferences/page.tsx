import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MeasurementUnitsSettings } from "@/components/measurement-units-settings";
import { PwaInstallCard } from "@/components/pwa-install-card";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export default async function PreferencesPage() {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><div className="mt-5"><div className="eyebrow">App preferences</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Preferences</h1><p className="mt-1.5 text-xs text-muted">Choose how PVIntell displays measurements and behaves on this device.</p></div><PwaInstallCard/><MeasurementUnitsSettings/></div></main>;
}
