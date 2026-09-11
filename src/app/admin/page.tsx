import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/admin/access";
import { AdminUsers, type AdminUserRow } from "@/components/admin-users";
import { BrandLogo } from "@/components/brand-logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const supabase = await createClient();
  const current = await supabase.auth.getUser();
  if (current.error || !current.data.user) redirect("/login?next=/admin");
  if (!isAdminEmail(current.data.user.email)) redirect("/dashboard");

  const admin = createAdminClient();
  const authUsers = [];
  for (let page = 1; ; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    authUsers.push(...result.data.users);
    if (result.data.users.length < 1000) break;
  }
  const ids = authUsers.map((user) => user.id);
  const profiles = ids.length ? await admin.from("profiles").select("id,display_name").in("id", ids) : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.display_name ?? ""]));
  const users: AdminUserRow[] = authUsers.map((user) => {
    const plan = user.app_metadata?.plan_status;
    return {
      id: user.id,
      email: user.email ?? "Email unavailable",
      name: names.get(user.id) || String(user.user_metadata?.display_name ?? user.user_metadata?.name ?? ""),
      createdAt: user.created_at,
      planStatus: typeof plan === "string" && plan.trim() ? plan.trim().replaceAll("_", " ") : "Testing",
      protected: isAdminEmail(user.email),
    };
  }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const query = await searchParams;
  const requestedSiteId = typeof query.site === "string" ? query.site.trim() : "";
  let inspectedSite: { id: string; name: string } | null = null;
  let inspectedSystems: Array<{ id: string; name: string; phase: string; mode: string }> = [];
  if (requestedSiteId) {
    const siteResult = await admin.from("sites").select("id,name").eq("id", requestedSiteId).maybeSingle();
    if (siteResult.error) throw siteResult.error;
    inspectedSite = siteResult.data;
    if (inspectedSite) {
      const systemsResult = await admin.from("projects").select("id,name,phase,mode").eq("site_id", inspectedSite.id).order("created_at");
      if (systemsResult.error) throw systemsResult.error;
      inspectedSystems = systemsResult.data ?? [];
    }
  }

  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-5xl">
    <div className="flex items-center justify-between"><Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Dashboard</Link><BrandLogo compact/></div>
    <header className="mt-7"><div className="eyebrow">Restricted administration</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Admin</h1><p className="mt-2 text-xs leading-5 text-muted">Review PVIntell accounts and inspect authorised test systems. Admin accounts are protected from deletion here.</p></header>
    <section className="card mt-5 overflow-hidden">
      <div className="border-b border-line p-4"><h2 className="text-sm font-extrabold">Find a test site</h2><p className="mt-1 text-[10px] text-muted">Enter a Site UUID to find its systems without changing customer ownership or row-level security.</p></div>
      <form method="get" className="flex flex-col gap-2 p-4 sm:flex-row"><input name="site" defaultValue={requestedSiteId} required placeholder="Site UUID" className="field flex-1"/><button type="submit" className="h-11 rounded-xl bg-brand px-5 text-xs font-bold text-white">Find site</button></form>
      {requestedSiteId && !inspectedSite ? <p role="status" className="border-t border-line bg-[#fff7dc] px-4 py-3 text-xs text-[#765400]">No site was found for that UUID.</p> : null}
      {inspectedSite ? <div className="border-t border-line p-4"><div className="rounded-xl bg-[#f5f8fb] p-3 text-xs"><strong>{inspectedSite.name}</strong><code className="mt-1 block text-[9px] text-muted">{inspectedSite.id}</code></div><div className="mt-3 space-y-2">{inspectedSystems.map((system) => <div key={system.id} className="flex flex-col justify-between gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-center"><div><strong className="text-xs">{system.name}</strong><span className="mt-1 block text-[10px] capitalize text-muted">{system.mode.replaceAll("_", " ")} · {system.phase.replaceAll("_", " ")}</span><code className="mt-1 block text-[9px] text-muted">{system.id}</code></div><Link href={`/admin/sites/${inspectedSite.id}/systems/${system.id}/schematic`} className="inline-flex h-9 items-center justify-center rounded-lg border border-brand bg-white px-3 text-[11px] font-bold text-brand">View proposed schematic</Link></div>)}{!inspectedSystems.length ? <p className="text-xs text-muted">This site has no systems.</p> : null}</div></div> : null}
    </section>
    <AdminUsers users={users}/>
  </div></main>;
}
