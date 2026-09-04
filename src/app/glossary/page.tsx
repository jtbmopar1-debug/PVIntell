import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Glossary } from "@/components/glossary";
import { createClient } from "@/lib/supabase/server";

export default async function GlossaryPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  return <main className="min-h-screen p-4 md:p-6"><div className="mx-auto max-w-[1320px]"><Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold text-brand"><ArrowLeft size={14}/>Back to dashboard</Link><header className="mt-4 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0a8] text-[#143c63]"><BookOpen size={19}/></span><div><div className="eyebrow">Learn the parts</div><h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-[-.045em] md:text-[32px]">Solar power glossary</h1><p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">Plain-language explanations and pictures of the equipment Wattson may discuss. Open this whenever a term is unfamiliar.</p></div></header><div className="mt-5"><Glossary/></div></div></main>;
}
