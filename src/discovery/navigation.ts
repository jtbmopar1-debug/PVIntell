import { visibleDiscoveryQuestions, type DiscoveryAnswers, type DiscoveryQuestion } from "./new-system";

export function nextVisibleQuestionId(questions: DiscoveryQuestion[], currentQuestionId: string) {
  const currentIndex = questions.findIndex((question) => question.id === currentQuestionId);
  return currentIndex >= 0 ? questions[currentIndex + 1]?.id : questions[0]?.id;
}

export function previousVisibleQuestionId(questions: DiscoveryQuestion[], currentQuestionId: string) {
  const currentIndex = questions.findIndex((question) => question.id === currentQuestionId);
  return currentIndex > 0 ? questions[currentIndex - 1]?.id : undefined;
}

export function routesToInstalledSystemCapture(knowledge: unknown) {
  return ["know_well", "know_main", "know_little", "know_nothing"].includes(String(knowledge));
}

export function proposalIntakeDiscoveryHrefs(systemId?: string, draftId?: string) {
  const discoveryHref = (questionId: string) => systemId
    ? `/discovery/new-system?edit=${systemId}&question=${questionId}`
    : draftId
      ? `/discovery/new-system?draft=${draftId}&question=${questionId}`
      : `/discovery/new-system?question=${questionId}`;
  return {
    previousQuestionHref: discoveryHref("existing_proposal_status"),
    discoveryBeginningHref: discoveryHref("site_name"),
  };
}

export function questionAfterProposalIntake(answers: DiscoveryAnswers) {
  return nextVisibleQuestionId(visibleDiscoveryQuestions(answers), "existing_proposal_status");
}
