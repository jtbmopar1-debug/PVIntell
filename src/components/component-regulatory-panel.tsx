"use client";

import { BookOpenCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentRegulatoryBundle } from "@/regulations/component-regulatory-library";

export function ComponentRegulatoryPanel({ componentId, regulationsHref, bundle }: {
  componentId: string;
  regulationsHref: string;
  bundle: ComponentRegulatoryBundle;
}) {
  return <Link href={regulationsHref} data-component-id={componentId} className="card mt-5 flex items-center gap-3 p-5 transition hover:border-[#7ea8ce]">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff2c4] text-[#765918]"><BookOpenCheck size={20}/></span>
    <span className="min-w-0 flex-1">
      <span className="eyebrow">Component library</span>
      <strong className="mt-1 block text-sm">Rules &amp; requirements{bundle.jurisdiction.label ? ` · ${bundle.jurisdiction.label}` : ""}</strong>
      <span className="mt-1 block text-[10px] leading-4 text-muted">Open the local rules for component type and rating, mounting, enclosure, connections, protection and torque requirements.</span>
    </span>
    <ChevronRight size={18} className="shrink-0 text-brand"/>
  </Link>;
}
