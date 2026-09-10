import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/admin/access";
import { AdminUsers, type AdminUserRow } from "@/components/admin-users";
import { BrandLogo } from "@/components/brand-logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
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

  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-5xl">
    <div className="flex items-center justify-between"><Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Dashboard</Link><BrandLogo compact/></div>
    <header className="mt-7"><div className="eyebrow">Restricted administration</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Admin</h1><p className="mt-2 text-xs leading-5 text-muted">Review PVIntell accounts and permanently remove unwanted users. Admin accounts are protected from deletion here.</p></header>
    <AdminUsers users={users}/>
  </div></main>;
}
