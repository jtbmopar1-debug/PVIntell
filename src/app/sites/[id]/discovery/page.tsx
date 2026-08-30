import { notFound, redirect } from "next/navigation";
import { GuidedNewSystem } from "@/components/guided-new-system";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingAnswers } from "@/onboarding/assessment";

export default async function SiteDiscoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const [profile, site, sites, discovery] = await Promise.all([
    supabase.from("profiles").select("onboarding_status,onboarding_assessment").eq("id", userId).single(),
    supabase.from("sites").select("id,name").eq("id", id).eq("owner_id", userId).maybeSingle(),
    supabase.from("sites").select("id,name").eq("owner_id", userId).order("created_at"),
    supabase.from("site_discoveries").select("answers,question_id").eq("site_id", id).eq("owner_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (profile.data.onboarding_status !== "completed") redirect("/onboarding");
  if (site.error) throw new Error(site.error.message);
  if (!site.data) notFound();
  if (sites.error) throw new Error(sites.error.message);
  if (discovery.error) throw new Error(discovery.error.message);
  const assessment = (profile.data.onboarding_assessment ?? {}) as OnboardingAnswers;
  return <GuidedNewSystem profile={assessment} sites={sites.data ?? []} initialAnswers={(discovery.data?.answers ?? {}) as DiscoveryAnswers} initialQuestionId={discovery.data?.question_id ?? undefined} siteDiscoveryId={id} returnUrl={`/sites/${id}`} />;
}
