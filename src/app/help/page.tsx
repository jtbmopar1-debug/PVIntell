import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SupportContactForm } from "@/components/support-contact-form";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export default async function HelpPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const email = claims.data?.claims?.email;
  if (claims.error || typeof claims.data?.claims?.sub !== "string" || typeof email !== "string") redirect("/login");

  return <main className="min-h-screen bg-canvas p-4 md:p-6"><article className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><header className="mt-7"><div className="eyebrow">Support</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Help and contact</h1><p className="mt-2 text-[12px] leading-5 text-muted">Ask about your account, billing, the PVIntell service or a technical problem.</p></header>
    <SupportContactForm email={email}/>
    <section className="card mt-4 divide-y divide-line"><div className="p-4 sm:p-5"><h2 className="text-sm font-extrabold">Technical and safety questions</h2><p className="mt-2 text-[12px] leading-5 text-muted">Wattson can explain recorded systems, equipment, planning and fault-finding context. If there is smoke, heat, arcing, damaged wiring, exposed conductors or another immediate hazard, stop using the affected equipment, keep people clear and contact the appropriate emergency or qualified local service.</p></div><div className="p-4 sm:p-5"><h2 className="text-sm font-extrabold">Response and records</h2><p className="mt-2 text-[12px] leading-5 text-muted">Support timing and plan entitlements will be published with the final pricing structure. Keep relevant screenshots, equipment model details and the exact wording of any error so the issue can be investigated efficiently.</p></div></section>
    <a href="mailto:pvintell1@gmail.com" className="mt-4 flex items-center gap-2 text-xs font-bold text-brand"><Mail size={14}/>Or email pvintell1@gmail.com directly</a>
  </article></main>;
}
