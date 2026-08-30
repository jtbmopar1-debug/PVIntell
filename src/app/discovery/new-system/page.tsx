import { redirect } from "next/navigation";
import { GuidedNewSystem } from "@/components/guided-new-system";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingAnswers } from "@/onboarding/assessment";

export default async function NewSystemDiscoveryPage({ searchParams }: { searchParams: Promise<{ edit?: string; stage?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const profile = await supabase.from("profiles").select("onboarding_status,onboarding_assessment").eq("id", userId).single();
  if (profile.error) throw new Error(profile.error.message);
  if (profile.data.onboarding_status !== "completed") redirect("/onboarding");
  const sites = await supabase.from("sites").select("id,name").eq("owner_id", userId).order("created_at");
  if (sites.error) throw new Error(sites.error.message);
  const { edit, stage } = await searchParams;
  let editAnswers: DiscoveryAnswers | undefined;
  let returnUrl: string | undefined;
  if (edit) {
    const project = await supabase.from("projects").select("id,site_id").eq("id", edit).eq("owner_id", userId).maybeSingle();
    if (!project.data) redirect("/dashboard");
    const questionnaire = await supabase.from("questionnaire_responses").select("answers").eq("project_id", edit).eq("template_key", "guided_new_system").maybeSingle();
    if (questionnaire.error) throw new Error(questionnaire.error.message);
    editAnswers = (questionnaire.data?.answers ?? {}) as DiscoveryAnswers;
    returnUrl = `/sites/${project.data.site_id}/systems/${project.data.id}`;
  }
  const assessment = (profile.data.onboarding_assessment ?? {}) as OnboardingAnswers & { guidedNewSystem?: { answers?: DiscoveryAnswers; questionId?: string } };
  return <GuidedNewSystem profile={assessment} sites={sites.data ?? []} initialAnswers={editAnswers ?? assessment.guidedNewSystem?.answers ?? {}} initialQuestionId={edit ? undefined : assessment.guidedNewSystem?.questionId} existingSystemId={edit} returnUrl={returnUrl} stageFilter={stage === "site" ? "site" : undefined}/>;
}
