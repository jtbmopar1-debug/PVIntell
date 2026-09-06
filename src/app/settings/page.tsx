import { ArrowLeft, BookOpen, Calculator, ChevronRight, CircleHelp, CloudSun, FileText, Link2, LockKeyhole, LogOut, MessageSquareText, SlidersHorizontal, UserRound, Wrench } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeSettings } from "@/components/theme-settings";
import { BrandLogo } from "@/components/brand-logo";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const requestedSiteId = (await searchParams).site;
  const [sites, projects, profile, discoveryDrafts] = await Promise.all([
    supabase.from("sites").select("id,name").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,phase").eq("owner_id", userId).order("created_at"),
    supabase.from("profiles").select("onboarding_assessment").eq("id", userId).single(),
    supabase.from("discovery_drafts").select("id,answers").eq("owner_id", userId).order("updated_at", { ascending: false }),
  ]);
  if (sites.error) throw sites.error; if (projects.error) throw projects.error; if (profile.error) throw profile.error; if (discoveryDrafts.error) throw discoveryDrafts.error;
  const weatherSite = sites.data?.find((site) => site.id === requestedSiteId) ?? sites.data?.[0];
  const weatherHref = weatherSite ? `/sites/${weatherSite.id}/weather` : "/dashboard";
  const resumable = (projects.data ?? []).find((project) => project.site_id === weatherSite?.id && ["discover", "design", "build", "check", "commission"].includes(project.phase));
  const steps = resumable && ["build", "check", "commission"].includes(resumable.phase) ? await supabase.from("installation_steps").select("id,completed_at").eq("project_id", resumable.id).order("position") : { data: [], error: null };
  if (steps.error) throw steps.error;
  const unfinished = steps.data?.find((step) => !step.completed_at);
  const guidedDraft = (profile.data.onboarding_assessment as { guidedNewSystem?: { status?: string; questionId?: string | null; answers?: Record<string, unknown> } } | null)?.guidedNewSystem;
  const hasGuidedDraft = guidedDraft?.status === "draft" && Boolean(guidedDraft.questionId || Object.keys(guidedDraft.answers ?? {}).length);
  const legacyDraftName = typeof guidedDraft?.answers?.system_name === "string" ? guidedDraft.answers.system_name.trim() : "";
  const resumeHref = hasGuidedDraft ? "/discovery/new-system" : !resumable ? undefined : resumable.phase === "discover" ? `/sites/${resumable.site_id}/discovery` : resumable.phase === "design" ? `/sites/${resumable.site_id}/systems/${resumable.id}/design` : unfinished ? `/sites/${resumable.site_id}/systems/${resumable.id}/build/${unfinished.id}` : `/sites/${resumable.site_id}/systems/${resumable.id}?view=build`;
  const settings = [
    ...(resumeHref ? [{ href: resumeHref, title: hasGuidedDraft && legacyDraftName ? `Continue System Build — ${legacyDraftName}` : resumable?.name ? `Continue System Build — ${resumable.name}` : "Continue System Build", detail: hasGuidedDraft ? "Return to the exact discovery question where you left off." : `Return to the last saved work for ${resumable?.name}.`, icon: Wrench, highlight: true }] : []),
    ...(discoveryDrafts.data ?? []).map((draft) => {
      const answers = (draft.answers ?? {}) as Record<string, unknown>;
      const name = typeof answers.system_name === "string" && answers.system_name.trim() ? answers.system_name.trim() : "System Build";
      return { href: `/discovery/new-system?draft=${draft.id}`, title: `Continue System Build — ${name}`, detail: "Return to the exact discovery question where you left off.", icon: Wrench, highlight: true };
    }),
    { href: "/account", title: "Account & location", detail: "Identity, password, Sites and system map positions", icon: UserRound },
    { href: "/onboarding?edit=1", title: "Onboarding answers", detail: "Review how Wattson adapts to your experience, situation and goals", icon: CircleHelp },
    { href: "/settings/preferences", title: "Preferences", detail: "Measurement units and installable app settings", icon: SlidersHorizontal },
    { href: `/settings/tools${requestedSiteId ? `?site=${requestedSiteId}` : ""}`, title: "Tools", detail: "Solar finances, azimuth, panel tilt, cable sizing and voltage drop", icon: Calculator },
    { href: "/settings/connections", title: "Connections", detail: "Match monitoring devices and services to systems", icon: Link2 },
    { href: weatherHref, title: "Solar weather", detail: weatherSite ? `Forecast and production outlook · ${weatherSite.name}` : "Forecast and production outlook", icon: CloudSun },
    { href: "/glossary", title: "Glossary", detail: "Plain-language solar, battery and electrical terms", icon: BookOpen },
    { href: "/wattson-chats", title: "Wattson chats", detail: "Review, continue or delete saved conversations", icon: MessageSquareText },
    { href: "/faq", title: "PVIntell & Wattson FAQ", detail: "How discovery, calculations, chats, monitoring and records work", icon: CircleHelp },
    { href: "/privacy", title: "Privacy", detail: "How your account, system and conversation data is handled", icon: LockKeyhole },
    { href: "/terms", title: "Terms", detail: "Service terms, paid plans and refund conditions", icon: FileText },
    { href: "/help", title: "Help & contact", detail: "Get help or contact pvintell1@gmail.com", icon: CircleHelp, highlight: false },
  ];
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Dashboard</Link><BrandLogo compact/></div><header className="mt-7"><div className="eyebrow">Your PVIntell</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Settings</h1><p className="mt-1.5 text-xs text-muted">Manage your account, preferences, forecasts, conversations, privacy and support.</p></header><section className="card mt-5 overflow-hidden"><div className="grid gap-2 p-3 sm:grid-cols-2">{settings.map(({ href, title, detail, icon: Icon, highlight }) => <Link key={href} href={href} className={`group flex min-h-[74px] items-center gap-3 rounded-xl border p-3 ${highlight ? "border-[#e5b92e] bg-[#f6c945] hover:bg-[#f9d65b]" : "border-line bg-white hover:border-[#9db9d2] hover:bg-[#f8fbfe]"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-lg text-brand ${highlight ? "bg-white/55" : "bg-[#eaf2fb]"}`}><Icon size={17}/></span><span className="min-w-0 flex-1"><strong className="block text-xs">{title}</strong><span className={`mt-0.5 block text-[10px] leading-4 ${highlight ? "text-[#3f5870]" : "text-muted"}`}>{detail}</span></span><ChevronRight size={15} className="shrink-0 text-[#7890a5] group-hover:text-brand"/></Link>)}</div><div className="flex items-center gap-2 border-t border-line p-3"><form action="/auth/signout" method="post"><button className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-xs font-bold text-muted hover:border-[#9db9d2] hover:text-brand"><LogOut size={15}/>Sign out</button></form><ThemeSettings/></div></section></div></main>;
}
