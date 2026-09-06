import { ArrowLeft, CircleHelp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { PvintellFaq } from "@/components/pvintell-faq";
import { createClient } from "@/lib/supabase/server";

export default async function FaqPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><header className="mt-7 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff0a8] text-brand"><CircleHelp size={20}/></span><div><div className="eyebrow">Help centre</div><h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-[-.045em] md:text-[32px]">How PVIntell and Wattson work</h1><p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">Answers about guided discovery, calculations, evidence, monitoring, saved chats and system records.</p></div></header><div className="mt-5"><PvintellFaq/></div></div></main>;
}
