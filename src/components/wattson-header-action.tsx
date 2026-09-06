"use client";

import Link from "next/link";

export function WattsonHeaderAction({ siteId, onClick }: { siteId?: string; onClick?: () => void }) {
  const className = "inline-flex h-11 shrink-0 items-center rounded-2xl bg-brand px-5 text-[11px] font-extrabold text-white shadow-sm transition hover:-translate-y-0.5";
  const content = <span>Ask Wattson</span>;
  if (onClick) return <button id="wattson" type="button" onClick={onClick} className={className}>{content}</button>;
  return <Link href={`/wattson${siteId ? `?site=${siteId}` : ""}`} className={className}>{content}</Link>;
}
