"use client";

import { ArrowLeft, Package, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function RecordInstalledSystem({ sites, initialSiteId }: { sites: Array<{ id: string; name: string }>; initialSiteId?: string }) {
  const router = useRouter();
  const validInitialSite = sites.some((site) => site.id === initialSiteId) ? initialSiteId : sites[0]?.id;
  const [siteId, setSiteId] = useState(validInitialSite ?? "__new__");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(formData: FormData) {
    setSaving(true);
    setError("");
    try {
      const voltage = String(formData.get("systemVoltage") ?? "").trim();
      const response = await fetch("/api/systems/installed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, siteName: formData.get("siteName"), systemName: formData.get("systemName"), projectType: formData.get("projectType"), systemVoltage: voltage ? Number(voltage) : undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create the installed system.");
      router.push(body.url);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not create the installed system.");
      setSaving(false);
    }
  }

  return <div className="min-h-screen bg-canvas text-ink"><header className="border-b border-line bg-white"><div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 md:px-5"><Link href="/dashboard"><BrandLogo/></Link><Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={14}/>Dashboard</Link></div></header><main className="mx-auto max-w-2xl p-4 md:p-6"><div className="eyebrow">As-built record</div><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em]">Record an installed system</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Use this for equipment that is already installed. It creates an operational system record without a proposed-design or discovery project.</p><form action={save} className="card mt-6 p-5 md:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Package size={18}/></span><div><div className="text-sm font-extrabold">System details</div><div className="text-[10px] text-muted">You can add technical details and photos next.</div></div></div>{error ? <div className="mt-4 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">{error}</div> : null}<div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold sm:col-span-2">Site<select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="field"><option value="__new__">Create a new Site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>{siteId === "__new__" ? <label className="text-xs font-bold sm:col-span-2">Site name<input name="siteName" required className="field" placeholder="e.g. River Views"/></label> : null}<label className="text-xs font-bold sm:col-span-2">System name<input name="systemName" required className="field" placeholder="e.g. Main House System"/></label><label className="text-xs font-bold">System type<select name="projectType" defaultValue="off-grid" className="field"><option value="off-grid">Off-grid</option><option value="hybrid">Hybrid</option><option value="grid-tied">Grid-tied</option></select></label><label className="text-xs font-bold">System voltage <span className="font-normal text-muted">(optional)</span><input name="systemVoltage" type="number" min="1" step="1" className="field" placeholder="e.g. 48"/></label></div><button disabled={saving} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:opacity-45"><Plus size={15}/>{saving ? "Creating…" : "Create installed system"}</button></form></main></div>;
}
