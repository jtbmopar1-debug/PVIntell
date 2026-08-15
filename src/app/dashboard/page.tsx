import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import type { ChatMessage, Site, SystemSummary } from "@/domain/models";
import type { OnboardingAnswers } from "@/onboarding/assessment";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const profile = await supabase.from("profiles").select("display_name,home_location,timezone,onboarding_status,onboarding_assessment").eq("id", userId).single();
  if (profile.error) throw profile.error;
  if (profile.data.onboarding_status !== "completed") redirect("/onboarding");
  const [siteRows, systemRows, conversation] = await Promise.all([
    supabase.from("sites").select("id,name,location,latitude,longitude,timezone,location_source,location_confirmed").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,mode,phase").eq("owner_id", userId).order("created_at"),
    supabase.from("user_conversations").select("id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (siteRows.error) throw siteRows.error;
  if (systemRows.error) throw systemRows.error;
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
  const arrays = systemIds.length ? await supabase.from("pv_arrays").select("project_id,panel_watts,panel_count").in("project_id", systemIds) : { data: [], error: null };
  if (arrays.error) throw arrays.error;
  const solarBySite = Object.fromEntries(sites.map((site) => [site.id, (arrays.data ?? []).reduce((sum, array) => {
    const system = systems.find((item) => item.id === array.project_id);
    return system?.siteId === site.id ? sum + Number(array.panel_watts ?? 0) * Number(array.panel_count ?? 0) / 1000 : sum;
  }, 0)]));
  let messages: ChatMessage[] = [];
  if (conversation.data?.id) {
    const rows = await supabase.from("user_chat_messages").select("id,role,content,created_at,structured_context").eq("conversation_id", conversation.data.id).order("created_at").limit(30);
    if (rows.error) throw rows.error;
    messages = (rows.data ?? []).filter((message) => String(message.content).trim()).map((message) => ({ id: message.id, role: message.role as ChatMessage["role"], content: message.content, createdAt: message.created_at, citations: Array.isArray(message.structured_context?.citations) ? message.structured_context.citations : undefined }));
  }
  return <Dashboard profile={{ displayName: profile.data.display_name || "", location: profile.data.home_location || "", timezone: profile.data.timezone || "UTC", assessment: (profile.data.onboarding_assessment ?? {}) as OnboardingAnswers }} sites={sites} systems={systems} solarBySite={solarBySite} initialMessages={messages} email={typeof claims.data?.claims?.email === "string" ? claims.data.claims.email : ""} />;
}
