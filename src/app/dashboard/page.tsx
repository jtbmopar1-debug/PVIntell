import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import type { ChatMessage, Site, SystemSummary } from "@/domain/models";
import type { OnboardingAnswers } from "@/onboarding/assessment";
import { createClient } from "@/lib/supabase/server";
import type { SolarArrayForecastInput } from "@/weather/forecast";
import { conversationKind } from "@/ai/conversation-kind";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ site?: string; conversation?: string; start?: string; wattson?: string; welcome?: string }> }) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const { site: requestedSiteId, conversation: requestedConversationId, start, wattson, welcome } = await searchParams;
  const [profile, siteRows, systemRows, conversation, discoveryDraftRows] = await Promise.all([
    supabase.from("profiles").select("display_name,home_location,timezone,onboarding_status,onboarding_assessment,dashboard_default_site_id,dashboard_default_system_id").eq("id", userId).single(),
    supabase.from("sites").select("id,name,location,latitude,longitude,timezone,location_source,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,mode,phase").eq("owner_id", userId).order("created_at"),
    requestedConversationId
      ? supabase.from("user_conversations").select("id,site_id,project_id").eq("id", requestedConversationId).eq("owner_id", userId).maybeSingle()
      : supabase.from("user_conversations").select("id,site_id,project_id,title").eq("owner_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("discovery_drafts").select("id,status,question_id,answers,updated_at").eq("owner_id", userId).order("updated_at", { ascending: false }),
  ]);
  if (profile.error) throw profile.error;
  if (profile.data.onboarding_status !== "completed") redirect("/onboarding");
  if (siteRows.error) throw siteRows.error;
  if (systemRows.error) throw systemRows.error;
  if (discoveryDraftRows.error) throw discoveryDraftRows.error;
  const activeConversation = requestedConversationId
    ? conversation.data && !Array.isArray(conversation.data) ? conversation.data : undefined
    : Array.isArray(conversation.data) ? conversation.data.find((item) => conversationKind(item.title) === "dashboard") : undefined;
  const sites: Site[] = (siteRows.data ?? []).map((site) => ({
    id: site.id, name: site.name, location: site.location || "Location not set",
    latitude: site.latitude == null ? undefined : Number(site.latitude), longitude: site.longitude == null ? undefined : Number(site.longitude),
    timezone: site.timezone || profile.data.timezone || "UTC", locationSource: site.location_source || "manual", locationConfirmed: Boolean(site.location_confirmed),
  }));
  const systems: SystemSummary[] = (systemRows.data ?? []).map((system) => ({
    id: system.id, siteId: system.site_id, name: system.name,
    projectType: String(system.mode).replace("_", "-") as SystemSummary["projectType"], phase: system.phase as SystemSummary["phase"],
  }));
  const systemIds = systems.map((system) => system.id);
  const [arrays, activeConnections, installationSteps] = await Promise.all([
    systemIds.length ? supabase.from("pv_arrays").select("project_id,panel_watts,panel_count,orientation_degrees,tilt_degrees").in("project_id", systemIds) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("monitoring_connections").select("project_id").in("project_id", systemIds).eq("is_active", true) : Promise.resolve({ data: [], error: null }),
    systemIds.length ? supabase.from("installation_steps").select("id,project_id,position,completed_at").in("project_id", systemIds).order("position") : Promise.resolve({ data: [], error: null }),
  ]);
  if (arrays.error) throw arrays.error;
  if (activeConnections.error) throw activeConnections.error;
  if (installationSteps.error) throw installationSteps.error;
  const solarArraysBySite: Record<string, SolarArrayForecastInput[]> = Object.fromEntries(sites.map((site) => [site.id, (arrays.data ?? []).flatMap((array) => {
    const system = systems.find((item) => item.id === array.project_id);
    const capacityKw = Number(array.panel_watts ?? 0) * Number(array.panel_count ?? 0) / 1000;
    if (system?.siteId !== site.id || capacityKw <= 0) return [];
    return [{
      capacityKw,
      azimuthDegrees: array.orientation_degrees == null ? null : Number(array.orientation_degrees),
      tiltDegrees: array.tilt_degrees == null ? null : Number(array.tilt_degrees),
    }];
  })]));
  const solarBySite = Object.fromEntries(Object.entries(solarArraysBySite).map(([siteId, siteArrays]) => [siteId, siteArrays.reduce((sum, array) => sum + array.capacityKw, 0)]));
  let messages: ChatMessage[] = [];
  if (activeConversation?.id) {
    const rows = await supabase.from("user_chat_messages").select("id,role,content,created_at,structured_context").eq("conversation_id", activeConversation.id).order("created_at").limit(30);
    if (rows.error) throw rows.error;
    messages = (rows.data ?? []).filter((message) => String(message.content).trim()).map((message) => ({ id: message.id, role: message.role as ChatMessage["role"], content: message.content, createdAt: message.created_at, citations: Array.isArray(message.structured_context?.citations) ? message.structured_context.citations : undefined, actionUrl: typeof message.structured_context?.actionUrl === "string" ? message.structured_context.actionUrl : undefined, actionLabel: typeof message.structured_context?.actionLabel === "string" ? message.structured_context.actionLabel : undefined }));
  }
  const resumeHrefs = Object.fromEntries(systems.filter((system) => ["discover", "design", "build", "check", "commission"].includes(system.phase)).map((system) => {
    const unfinished = (installationSteps.data ?? []).find((step) => step.project_id === system.id && !step.completed_at);
    const href = system.phase === "discover" ? `/sites/${system.siteId}/discovery?system=${system.id}` : system.phase === "design" ? `/sites/${system.siteId}/systems/${system.id}/design` : unfinished ? `/sites/${system.siteId}/systems/${system.id}/build/${unfinished.id}` : `/sites/${system.siteId}/systems/${system.id}?view=build`;
    return [system.id, href];
  }));
  const defaultSystemSiteId = systems.find((system) => system.id === profile.data.dashboard_default_system_id)?.siteId;
  const initialSiteId = requestedSiteId ?? (requestedConversationId ? activeConversation?.site_id ?? undefined : undefined) ?? defaultSystemSiteId ?? profile.data.dashboard_default_site_id ?? activeConversation?.site_id ?? undefined;
  return <Dashboard profile={{ displayName: profile.data.display_name || "", location: profile.data.home_location || "", timezone: profile.data.timezone || "UTC", assessment: (profile.data.onboarding_assessment ?? {}) as OnboardingAnswers }} sites={sites} systems={systems} discoveryDrafts={(discoveryDraftRows.data ?? []).map((draft) => ({ id: draft.id, status: draft.status, questionId: draft.question_id, answers: (draft.answers ?? {}) as Record<string, string | number | string[]>, updatedAt: draft.updated_at }))} connectedSystemIds={(activeConnections.data ?? []).map((connection) => connection.project_id)} resumeHrefs={resumeHrefs} solarBySite={solarBySite} solarArraysBySite={solarArraysBySite} initialMessages={messages} conversationId={activeConversation?.id} initialSiteId={initialSiteId} autoStartProposal={start === "proposal" || wattson === "open"} showWelcome={welcome === "1"} email={typeof claims.data?.claims?.email === "string" ? claims.data.claims.email : ""} />;
}
