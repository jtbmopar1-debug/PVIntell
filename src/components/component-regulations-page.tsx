"use client";

import { ArrowLeft, BookOpenCheck, LoaderCircle, MessageSquareText, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import { RegulationsWattsonChat } from "@/components/regulations-wattson-chat";
import type { ComponentSpec } from "@/domain/models";
import type { ComponentRegulatoryBundle } from "@/regulations/component-regulatory-library";

type Guidance = {
  guidance_markdown: string;
  citations: Array<{ title?: string; url?: string }>;
  checked_at: string;
  refresh_after: string;
  jurisdiction_label: string;
};

export function ComponentRegulationsPage({
  siteId,
  systemId,
  component,
  bundle,
  guidanceApiUrl,
  guidanceRequestBody,
  backHref,
  backLabel,
}: {
  siteId: string;
  systemId: string;
  component: ComponentSpec;
  bundle: ComponentRegulatoryBundle;
  guidanceApiUrl?: string;
  guidanceRequestBody?: Record<string, unknown>;
  backHref?: string;
  backLabel?: string;
}) {
  const [loading, setLoading] = useState(bundle.jurisdiction.confirmed);
  const [guidance, setGuidance] = useState<Guidance>();
  const [error, setError] = useState("");
  const [wattsonOpen, setWattsonOpen] = useState(false);

  async function loadCurrent(forceRefresh = false) {
    if (!bundle.jurisdiction.confirmed) return;
    setLoading(true);
    setError("");
    try {
      if (!forceRefresh) {
        const cachedResponse = await fetch(guidanceApiUrl ?? `/api/components/${component.id}/regulations`, { cache: "no-store" });
        const cachedBody = await cachedResponse.json();
        if (!cachedResponse.ok) throw new Error(cachedBody.error ?? "Could not load the component rules");
        if (cachedBody.guidance) {
          setGuidance(cachedBody.guidance);
          return;
        }
      }
      const apiUrl = guidanceApiUrl ?? `/api/components/${component.id}/regulations`;
      const response = await fetch(`${apiUrl}${forceRefresh ? `${apiUrl.includes("?") ? "&" : "?"}refresh=true` : ""}`, {
        method: "POST",
        headers: guidanceRequestBody ? { "content-type": "application/json" } : undefined,
        body: guidanceRequestBody ? JSON.stringify(guidanceRequestBody) : undefined,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not check the component rules");
      setGuidance(body.guidance);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not check the component rules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void loadCurrent(), 0);
    return () => window.clearTimeout(loadTimer);
  // The component and jurisdiction are fixed for this routed page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const componentHref = backHref ?? `/sites/${siteId}/systems/${systemId}/equipment/${component.id}`;
  const wattsonContext = guidance?.guidance_markdown ?? [...bundle.appliesHere, ...bundle.mayApply, ...bundle.manufacturerRequirements].map((topic) => `${topic.title}: ${topic.purpose}`).join("\n");

  return <main className="min-h-screen bg-[#f5f7fa] px-4 py-6 sm:px-6 md:px-10 md:py-8">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={componentHref} className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/>{backLabel ?? `Back to ${component.name}`}</Link>
        {bundle.jurisdiction.confirmed ? <button type="button" disabled={loading} onClick={() => void loadCurrent(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand disabled:opacity-50"><RefreshCcw size={14}/>Refresh local rules</button> : null}
      </div>

      <header className="my-6 rounded-2xl border border-line bg-[linear-gradient(110deg,#eef5fc,#fff8d9)] p-5 sm:p-7">
        <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><BookOpenCheck size={22}/></span><div><div className="eyebrow">{bundle.componentLabel}</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em] sm:text-3xl">Rules &amp; requirements for {component.name}</h1><p className="mt-2 text-sm leading-6 text-muted">{bundle.jurisdiction.label ? `Applies to the confirmed Site location: ${bundle.jurisdiction.label}.` : "No Site jurisdiction is confirmed, so only the global component checklist can be shown."}</p></div></div>
      </header>

      {!bundle.jurisdiction.confirmed ? <div className="rounded-2xl border border-[#e6cc74] bg-[#fff9df] p-5 text-sm leading-6 text-[#624b14]"><strong>Confirm the Site location first.</strong> PVIntell will not guess a country or apply the account/device location as law for this system.</div> : null}

      {loading ? <div className="card flex min-h-44 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle size={20} className="animate-spin text-brand"/>Loading the current local rules for this component…</div> : null}
      {error ? <div className="rounded-2xl border border-[#e3b9b1] bg-[#fff0eb] p-5 text-sm text-[#913e31]"><strong>The local rule detail could not be loaded.</strong><p className="mt-1">{error}</p><button type="button" onClick={() => void loadCurrent()} className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white">Try again</button></div> : null}

      {guidance ? <section className="card p-5 sm:p-7">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f5ed] text-[#17603b]"><ShieldCheck size={18}/></span><div><h2 className="text-base font-extrabold">Local component rules</h2><p className="mt-1 text-xs text-muted">Resolved for this equipment type, application details and confirmed Site location.</p></div></div>
        <div className="mt-5 text-sm leading-6"><FormattedChatMessage content={guidance.guidance_markdown}/></div>
      </section> : null}

      {!guidance && !loading ? <section className="mt-5 grid gap-4 md:grid-cols-2">
        <RuleTopics title="Component selection, size and application" topics={bundle.appliesHere}/>
        <RuleTopics title="Location-dependent or conditional rules" topics={bundle.mayApply}/>
        <div className="card p-5 md:col-span-2"><h2 className="text-sm font-extrabold">Exact product requirements</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{bundle.manufacturerRequirements.map((item) => <article key={item.id} className="rounded-xl border border-line bg-[#f8fafc] p-4"><strong className="text-xs">{item.title}</strong><p className="mt-1 text-[11px] leading-5 text-muted">{item.purpose}</p></article>)}</div></div>
      </section> : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4"><p className="max-w-2xl text-[11px] leading-5 text-muted">The page combines the component-type rule set with this record&apos;s application, connected equipment and confirmed Site jurisdiction. Unknown details remain visible instead of being guessed.</p><button type="button" onClick={() => setWattsonOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-white"><MessageSquareText size={15}/>Explain in plain language</button></div>
      <RegulationsWattsonChat open={wattsonOpen} onClose={() => setWattsonOpen(false)} siteId={siteId} title={component.name} context={wattsonContext}/>
    </div>
  </main>;
}

function RuleTopics({ title, topics }: { title: string; topics: ComponentRegulatoryBundle["appliesHere"] }) {
  return <section className="card p-5"><h2 className="text-sm font-extrabold">{title}</h2><div className="mt-3 space-y-3">{topics.map((item) => <article key={item.id} className="rounded-xl border border-line bg-[#f8fafc] p-4"><strong className="text-xs">{item.title}</strong><p className="mt-1 text-[11px] leading-5 text-muted">{item.purpose}</p>{item.missingFacts.length ? <p className="mt-2 text-[10px] leading-4 text-[#8b6512]">Component detail still needed: {item.missingFacts.join(", ")}.</p> : null}{item.relatedEquipment.length ? <p className="mt-2 text-[10px] leading-4 text-brand">Related equipment: {item.relatedEquipment.join(", ")}.</p> : null}</article>)}</div></section>;
}
