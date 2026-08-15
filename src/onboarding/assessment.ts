export type OnboardingAnswers = {
  displayName?: string;
  location?: string;
  timezone?: string;
  experience?: "new" | "some" | "experienced" | "professional";
  electricalConfidence?: "learn" | "basic" | "confident" | "qualified";
  history?: string[];
  currentSituation?: string[];
  goals?: string[];
  notes?: string;
};

export type OnboardingProfile = {
  status: "pending" | "in_progress" | "completed";
  answers: OnboardingAnswers;
};

export function isOnboardingComplete(value: unknown) {
  return value === "completed";
}
