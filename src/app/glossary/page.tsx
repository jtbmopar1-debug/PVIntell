import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Glossary } from "@/components/glossary";
import { createClient } from "@/lib/supabase/server";

export default async function GlossaryPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  return <main className="min-h-screen p-5 md:p-8"><div className="mx-auto max-w-[1320px]"><Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/>Back to dashboard</Link><header className="mt-7 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff0a8] text-[#143c63]"><BookOpen size={22}/></span><div><div className="eyebrow">Learn the parts</div><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[42px]">Solar power glossary</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Plain-language explanations and pictures of the equipment Wattson may discuss. Open this whenever a term is unfamiliar.</p></div></header><div className="mt-8"><Glossary/></div></div></main>;
}
