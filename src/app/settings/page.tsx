import { ArrowLeft, BookOpen, ChevronRight, CircleHelp, CloudSun, FileText, Link2, LockKeyhole, LogOut, MessageSquareText, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeSettings } from "@/components/theme-settings";
import { BrandLogo } from "@/components/brand-logo";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const requestedSiteId = (await searchParams).site;
  const sites = await supabase.from("sites").select("id,name").eq("owner_id", userId).order("created_at");
  if (sites.error) throw sites.error;
  const weatherSite = sites.data?.find((site) => site.id === requestedSiteId) ?? sites.data?.[0];
  const weatherHref = weatherSite ? `/sites/${weatherSite.id}/weather` : "/dashboard";
  const settings = [
    { href: "/account", title: "Account & location", detail: "Identity, password, Sites and system map positions", icon: UserRound },
    { href: "/settings/preferences", title: "Preferences", detail: "Measurement units and installable app settings", icon: SlidersHorizontal },
    { href: "/settings/connections", title: "Connections", detail: "Match monitoring devices and services to systems", icon: Link2 },
    { href: weatherHref, title: "Solar weather", detail: weatherSite ? `Forecast and production outlook · ${weatherSite.name}` : "Forecast and production outlook", icon: CloudSun },
    { href: "/glossary", title: "Glossary", detail: "Plain-language solar, battery and electrical terms", icon: BookOpen },
    { href: "/wattson-chats", title: "Wattson chats", detail: "Review, continue or delete saved conversations", icon: MessageSquareText },
    { href: "/privacy", title: "Privacy", detail: "How your account, system and conversation data is handled", icon: LockKeyhole },
    { href: "/terms", title: "Terms", detail: "Service terms, paid plans and refund conditions", icon: FileText },
    { href: "/help", title: "Help & contact", detail: "Get help or contact pvintell1@gmail.com", icon: CircleHelp },
  ];
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Dashboard</Link><BrandLogo compact/></div><header className="mt-7"><div className="eyebrow">Your PVIntell</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Settings</h1><p className="mt-1.5 text-xs text-muted">Manage your account, preferences, forecasts, conversations, privacy and support.</p></header><section className="card mt-5 overflow-hidden"><div className="grid gap-2 p-3 sm:grid-cols-2">{settings.map(({ href, title, detail, icon: Icon }) => <Link key={href} href={href} className="group flex min-h-[74px] items-center gap-3 rounded-xl border border-line bg-white p-3 hover:border-[#9db9d2] hover:bg-[#f8fbfe]"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><Icon size={17}/></span><span className="min-w-0 flex-1"><strong className="block text-xs">{title}</strong><span className="mt-0.5 block text-[10px] leading-4 text-muted">{detail}</span></span><ChevronRight size={15} className="shrink-0 text-[#9aabba] group-hover:text-brand"/></Link>)}</div><div className="flex items-center gap-2 border-t border-line p-3"><form action="/auth/signout" method="post"><button className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-xs font-bold text-muted hover:border-[#9db9d2] hover:text-brand"><LogOut size={15}/>Sign out</button></form><ThemeSettings/></div></section></div></main>;
}
