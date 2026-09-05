import { ArrowLeft, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountLocationPlanner, type PlanningSite } from "@/components/account-location-planner";
import { BrandLogo } from "@/components/brand-logo";
import { DeleteAccountPanel } from "@/components/delete-account-panel";
import { PasswordField } from "@/components/password-field";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "./actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; setup?: string }> }) {
  const supabase = await createClient(); const { data, error } = await supabase.auth.getClaims(); const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");
  const notice = await searchParams;
  const [profile, siteRows, projectRows, projectLocationRows] = await Promise.all([
    supabase.from("profiles").select("display_name,email,home_location,timezone").eq("id", userId).single(),
    supabase.from("sites").select("id,name,location,latitude,longitude,timezone").eq("owner_id", userId).order("created_at"),
    supabase.from("projects").select("id,site_id,name,settings").eq("owner_id", userId),
    supabase.from("projects").select("id,map_latitude,map_longitude,location_mode,map_location_updated_at").eq("owner_id", userId),
  ]);
  if (profile.error) throw profile.error; if (siteRows.error) throw siteRows.error; if (projectRows.error) throw projectRows.error;
  const projectIds = (projectRows.data ?? []).map((project) => project.id);
  const arrayRows = projectIds.length ? await supabase.from("pv_arrays").select("project_id,name,orientation_degrees,tilt_degrees").in("project_id", projectIds) : { data: [], error: null };
  if (arrayRows.error) throw arrayRows.error;
  const locations = projectLocationRows.data ?? [];
  const sites: PlanningSite[] = (siteRows.data ?? []).map((site) => ({ id: site.id, name: site.name, location: site.location || "Location not set", latitude: site.latitude == null ? null : Number(site.latitude), longitude: site.longitude == null ? null : Number(site.longitude), timezone: site.timezone, systems: (projectRows.data ?? []).filter((project) => project.site_id === site.id).map((project) => { const mapped = locations.find((item) => item.id === project.id); const mobileDiscovery = JSON.stringify(project.settings ?? {}).toLowerCase().includes("mobile"); return { id: project.id, name: project.name, latitude: mapped?.map_latitude == null ? null : Number(mapped.map_latitude), longitude: mapped?.map_longitude == null ? null : Number(mapped.map_longitude), locationMode: mapped?.location_mode === "mobile" || (!mapped && mobileDiscovery) ? "mobile" as const : "static" as const, updatedAt: mapped?.map_location_updated_at ?? null }; }), arrays: (arrayRows.data ?? []).filter((array) => projectRows.data?.find((project) => project.id === array.project_id)?.site_id === site.id).map((array) => ({ name: array.name, azimuth: array.orientation_degrees == null ? null : Number(array.orientation_degrees), tilt: array.tilt_degrees == null ? null : Number(array.tilt_degrees) })) }));
  const email = profile.data.email || (typeof data?.claims?.email === "string" ? data.claims.email : "");
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div>
    <div className="mt-5"><div className="eyebrow">Your PVIntell identity</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Account</h1><p className="mt-1.5 text-xs text-muted">Your identity, sign-in security and location-based solar planning.</p></div>
    {(notice.error || notice.message || notice.setup === "password") ? <div className={`mt-4 rounded-xl border p-3 text-xs ${notice.error ? "border-[#e7c3b8] bg-[#fff1ed] text-[#8b432f]" : "border-[#b7cce1] bg-[#eaf2fb] text-[#175a96]"}`}>{notice.error ?? notice.message ?? "Google identity confirmed. You can add a PVIntell password below."}</div> : null}
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="card p-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><UserRound size={17}/></span><div><div className="text-xs font-bold">{profile.data.display_name || "PVIntell user"}</div><div className="mt-1 text-xs text-muted">{email}</div><div className="mt-1 text-[11px] text-muted">{profile.data.home_location || "Home location not recorded"} · {profile.data.timezone}</div></div></div></section><section className="card p-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><ShieldCheck size={17}/></span><div><div className="text-xs font-bold">Private account data</div><p className="mt-1 text-[12px] leading-5 text-muted">Your Sites, systems, maps and conversations are available only to your signed-in account.</p></div></div></section></div>
    <AccountLocationPlanner sites={sites}/>
    <section className="card mt-4 p-4 sm:p-5"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><KeyRound size={17}/></span><div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Set or change your password</h2><p className="mt-1 text-[12px] leading-5 text-muted">Adds email-and-password access. Google sign-in will still work.</p><form action={setPassword} className="mt-3 grid gap-3 sm:grid-cols-2"><PasswordField label="New password" name="password" autoComplete="new-password"/><PasswordField label="Confirm new password" name="passwordConfirm" autoComplete="new-password"/><button className="h-10 rounded-lg bg-brand px-4 text-xs font-bold text-white sm:col-span-2 sm:w-fit">Save password</button></form></div></div></section>
    <DeleteAccountPanel email={email}/>
  </div></main>;
}
