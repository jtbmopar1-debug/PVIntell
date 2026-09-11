import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/admin/access";
import { BrandLogo } from "@/components/brand-logo";
import { ProposedBuildSchematic } from "@/components/design-calculator";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminProposedSchematicPage({
  params,
}: PageProps<"/admin/sites/[siteId]/systems/[systemId]/schematic">) {
  const supabase = await createClient();
  const current = await supabase.auth.getUser();
  if (current.error || !current.data.user) redirect("/login");
  if (!isAdminEmail(current.data.user.email)) notFound();

  const { siteId, systemId } = await params;
  const admin = createAdminClient();
  let workspace;
  try {
    workspace = await loadSiteWorkspace(admin, siteId, systemId);
  } catch {
    notFound();
  }

  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-[1500px]">
    <div className="flex items-center justify-between"><Link href={`/admin?site=${siteId}`} className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Back to admin</Link><BrandLogo compact/></div>
    <div className="my-5 flex items-start gap-3 rounded-2xl border border-[#d6b95d] bg-[#fff7dc] p-4 text-xs leading-5 text-[#6d5000]"><LockKeyhole size={18} className="mt-0.5 shrink-0"/><div><strong className="block">Admin test inspection</strong>This schematic belongs to another account. Its data remains owner-protected; this page is available only to configured PVIntell administrators.</div></div>
    <ProposedBuildSchematic project={workspace.project} site={workspace.site}/>
  </div></main>;
}
