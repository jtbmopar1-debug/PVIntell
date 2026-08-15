import { redirect } from "next/navigation";
import { GuidedNewSystem } from "@/components/guided-new-system";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingAnswers } from "@/onboarding/assessment";

export default async function NewSystemDiscoveryPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const profile = await supabase.from("profiles").select("onboarding_status,onboarding_assessment").eq("id", userId).single();
  if (profile.error) throw new Error(profile.error.message);
  if (profile.data.onboarding_status !== "completed") redirect("/onboarding");
  const assessment = (profile.data.onboarding_assessment ?? {}) as OnboardingAnswers & { guidedNewSystem?: { answers?: DiscoveryAnswers; questionId?: string } };
  return <GuidedNewSystem profile={assessment} initialAnswers={assessment.guidedNewSystem?.answers ?? {}} initialQuestionId={assessment.guidedNewSystem?.questionId}/>;
}
