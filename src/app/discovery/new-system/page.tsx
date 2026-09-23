import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { GuidedNewSystem } from "@/components/guided-new-system";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingAnswers } from "@/onboarding/assessment";

export default async function NewSystemDiscoveryPage({ searchParams }: { searchParams: Promise<{ edit?: string; stage?: string; draft?: string; new?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const profile = await supabase.from("profiles").select("onboarding_status,onboarding_assessment").eq("id", userId).single();
  if (profile.error) throw new Error(profile.error.message);
  if (profile.data.onboarding_status !== "completed") redirect("/onboarding");
  const sites = await supabase.from("sites").select("id,name,location,latitude,longitude,timezone,location_confirmed").eq("owner_id", userId).order("created_at");
  if (sites.error) throw new Error(sites.error.message);
  const assessment = (profile.data.onboarding_assessment ?? {}) as OnboardingAnswers & { guidedNewSystem?: { answers?: DiscoveryAnswers; questionId?: string } };
  const { edit, stage, draft, new: startNew } = await searchParams;
  if (startNew === "1") redirect(`/discovery/new-system?draft=${randomUUID()}`);
  let editAnswers: DiscoveryAnswers | undefined;
  let draftAnswers: DiscoveryAnswers | undefined;
  let draftQuestionId: string | undefined;
  let draftConversationId: string | undefined;
  let returnUrl: string | undefined;
  let proposedEquipment: Array<{ id: string; label: string; detail: string }> = [];
  if (edit) {
    const project = await supabase.from("projects").select("id,site_id,name,settings").eq("id", edit).eq("owner_id", userId).maybeSingle();
    if (!project.data) redirect("/dashboard");
    const [questionnaire, arrays, components, conversations] = await Promise.all([
      supabase.from("questionnaire_responses").select("answers").eq("project_id", edit).eq("template_key", "guided_new_system").maybeSingle(),
      supabase.from("pv_arrays").select("id,name,manufacturer,panel_model,panel_count,panel_watts").eq("project_id", edit),
      supabase.from("system_components").select("id,type,display_name,manufacturer,model,quantity,specifications").eq("project_id", edit),
      supabase.from("user_conversations").select("id").eq("project_id", edit).eq("owner_id", userId).order("updated_at", { ascending: false }),
    ]);
    if (questionnaire.error || arrays.error || components.error || conversations.error) throw new Error(questionnaire.error?.message ?? arrays.error?.message ?? components.error?.message ?? conversations.error?.message);
    editAnswers = (questionnaire.data?.answers ?? {}) as DiscoveryAnswers;
    const settings = (project.data.settings ?? {}) as Record<string, unknown>;
    if (settings.workflowOrigin === "discovery" && settings.schematicOrigin === "structured_proposal_intake") {
      const legacyAnswers = assessment.guidedNewSystem?.answers;
      if (legacyAnswers?.existing_proposal_status === "yes" && String(legacyAnswers.system_name ?? "").trim() === project.data.name) {
        const sharedMatches = Object.keys(legacyAnswers).filter((key) => editAnswers?.[key] !== undefined && JSON.stringify(editAnswers[key]) === JSON.stringify(legacyAnswers[key])).length;
        if (sharedMatches >= 3) {
          editAnswers = { ...editAnswers, ...legacyAnswers };
          draftQuestionId = assessment.guidedNewSystem?.questionId;
        }
      }
      const recordedEquipment = new Set(Array.isArray(editAnswers.proposal_intake_equipment) ? editAnswers.proposal_intake_equipment : []);
      if ((arrays.data ?? []).length) recordedEquipment.add("panels");
      for (const component of components.data ?? []) if (["inverter", "battery", "generator"].includes(component.type)) recordedEquipment.add(component.type);
      editAnswers.proposal_intake_equipment = [...recordedEquipment];
      proposedEquipment = [
        ...(arrays.data ?? []).map((array) => ({ id: array.id, label: array.name || "Panels / array", detail: [array.manufacturer, array.panel_model, `${Number(array.panel_count ?? 0)} × ${Number(array.panel_watts ?? 0)} W`].filter(Boolean).join(" · ") })),
        ...(components.data ?? []).filter((component) => ["inverter", "battery", "generator"].includes(component.type)).map((component) => {
          const specifications = component.specifications && typeof component.specifications === "object" ? component.specifications as Record<string, unknown> : {};
          const rating = specifications["Rated power"] ?? specifications["Nominal energy"] ?? specifications["Nominal voltage"];
          return { id: component.id, label: component.display_name || component.type, detail: [component.manufacturer, component.model, Number(component.quantity ?? 1) > 1 ? `Quantity ${component.quantity}` : undefined, rating].filter(Boolean).join(" · ") };
        }),
      ];
    }
    const conversationIds = (conversations.data ?? []).map((item) => item.id);
    if (conversationIds.length) {
      const messages = await supabase.from("user_chat_messages").select("conversation_id,structured_context").in("conversation_id", conversationIds).order("created_at", { ascending: false });
      if (messages.error) throw new Error(messages.error.message);
      draftConversationId = (messages.data ?? []).find((message) => message.structured_context?.kind === "discovery_help" || message.structured_context?.kind === "discovery_topic")?.conversation_id;
    }
    if (Array.isArray(editAnswers.proposal_intake_equipment) && editAnswers.site_id && !editAnswers.site_name) delete editAnswers.site_id;
    returnUrl = `/sites/${project.data.site_id}/systems/${project.data.id}`;
  }
  if (draft && !edit) {
    const savedDraft = await supabase.from("discovery_drafts").select("answers,question_id,conversation_id").eq("id", draft).eq("owner_id", userId).maybeSingle();
    if (savedDraft.error) throw new Error(savedDraft.error.message);
    draftAnswers = (savedDraft.data?.answers ?? {}) as DiscoveryAnswers;
    draftQuestionId = savedDraft.data?.question_id ?? undefined;
    draftConversationId = savedDraft.data?.conversation_id ?? undefined;
  }
  const discoveryScope = edit ? `system:${edit}` : draft ? `draft:${draft}` : "unsaved";
  return <GuidedNewSystem key={discoveryScope} profile={assessment} sites={sites.data ?? []} initialAnswers={editAnswers ?? draftAnswers ?? assessment.guidedNewSystem?.answers ?? {}} initialQuestionId={draftQuestionId ?? assessment.guidedNewSystem?.questionId} discoveryDraftId={draft} initialDiscoveryConversationId={draftConversationId} existingSystemId={edit} proposedEquipment={proposedEquipment} returnUrl={returnUrl} stageFilter={stage === "site" ? "site" : undefined}/>;
}
