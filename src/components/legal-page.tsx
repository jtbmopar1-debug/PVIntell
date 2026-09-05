import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export type LegalSection = { title: string; paragraphs: string[] };

export function LegalPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: LegalSection[] }) {
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><article className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><header className="mt-7"><div className="eyebrow">{eyebrow}</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">{title}</h1><p className="mt-2 text-[12px] leading-5 text-muted">{intro}</p><p className="mt-2 text-[10px] text-muted">Effective 5 September 2026</p></header><div className="card mt-5 divide-y divide-line">{sections.map((section) => <section key={section.title} className="p-4 sm:p-5"><h2 className="text-sm font-extrabold">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-2 text-[12px] leading-5 text-muted">{paragraph}</p>)}</section>)}</div><a href="mailto:pvintell1@gmail.com" className="mt-4 flex items-center gap-2 text-xs font-bold text-brand"><Mail size={14}/>pvintell1@gmail.com</a></article></main>;
}
