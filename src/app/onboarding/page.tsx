import { redirect } from "next/navigation";
import { OnboardingAssessment } from "@/components/onboarding-assessment";
import type { OnboardingAnswers } from "@/onboarding/assessment";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const profile = await supabase
    .from("profiles")
    .select("display_name,home_location,timezone,onboarding_status,onboarding_assessment")
    .eq("id", userId)
    .single();
  if (profile.error) throw profile.error;
  if (profile.data.onboarding_status === "completed") redirect("/dashboard");
  const saved = (profile.data.onboarding_assessment ?? {}) as OnboardingAnswers;
  return (
    <OnboardingAssessment
      initialAnswers={{
        ...saved,
        displayName: saved.displayName || profile.data.display_name || "",
        location: saved.location || profile.data.home_location || "",
        timezone:
          saved.timezone ||
          (profile.data.timezone !== "UTC" ? profile.data.timezone : ""),
      }}
    />
  );
}
