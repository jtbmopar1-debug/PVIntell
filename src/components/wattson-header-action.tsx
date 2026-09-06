"use client";

import { Bot } from "lucide-react";
import Link from "next/link";

export function WattsonHeaderAction({ siteId, onClick }: { siteId?: string; onClick?: () => void }) {
  const className = "inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-brand px-4 text-[11px] font-extrabold text-white shadow-sm transition hover:-translate-y-0.5";
  const content = <><Bot size={18}/><span>Ask Wattson</span></>;
  if (onClick) return <button id="wattson" type="button" onClick={onClick} className={className}>{content}</button>;
  return <Link href={`/dashboard?${siteId ? `site=${siteId}&` : ""}wattson=open#wattson`} className={className}>{content}</Link>;
}
