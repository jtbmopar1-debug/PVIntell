"use client";

import { notFound } from "next/navigation";
import { ComponentRegulationsPage } from "@/components/component-regulations-page";
import { allHowToGuides } from "@/components/pvintell-workspace";
import type { ComponentSpec } from "@/domain/models";
import { componentKindForGuide, resolveComponentRegulatoryBundle } from "@/regulations/component-regulatory-library";

export function HowToRegulationsRoute({ guideId, site, backHref }: {
  guideId: string;
  site: { id: string; name: string; location: string; locationConfirmed: boolean };
  backHref?: string;
}) {
  const guide = allHowToGuides.find((candidate) => candidate.id === guideId);
  if (!guide) notFound();
  const kind = componentKindForGuide(guide);
  const component: ComponentSpec = {
    id: guide.id,
    kind,
    name: guide.title,
    quantity: 1,
    status: "confirmed",
    specs: {},
  };
  const bundle = resolveComponentRegulatoryBundle({
    component,
    siteLocation: site.location,
    siteLocationConfirmed: site.locationConfirmed,
  });
  const siteQuery = `?site=${site.id}`;
  return <ComponentRegulationsPage
    siteId={site.id}
    systemId="how-to"
    component={component}
    bundle={bundle}
    guidanceApiUrl={`/api/regulations/guides/${encodeURIComponent(guide.id)}?site=${encodeURIComponent(site.id)}&jurisdiction=${encodeURIComponent(site.location)}`}
    guidanceRequestBody={{
      title: guide.title,
      group: guide.group,
      summary: guide.summary,
      before: guide.before ?? [],
      steps: guide.steps,
      checks: guide.checks ?? [],
    }}
    backHref={backHref ?? `/how-to${siteQuery}`}
    backLabel={backHref ? "Back to Rules & regulations" : "Back to the How-to library"}
  />;
}
