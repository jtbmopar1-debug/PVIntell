import { Fragment } from "react";

export function FormattedChatMessage({ content }: { content: string }) {
  const inline = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={`${index}:${part}`}>{part.slice(2, -2)}</strong> : <Fragment key={`${index}:${part}`}>{part}</Fragment>);
  return <div className="space-y-2 whitespace-normal">{content.split(/\r?\n/).map((line, index) => { const trimmed = line.trim(); if (!trimmed) return <div key={index} className="h-1"/>; const bullet = trimmed.match(/^[-*]\s+(.*)$/); return bullet ? <div key={index} className="flex gap-2"><span aria-hidden="true">•</span><span>{inline(bullet[1])}</span></div> : <p key={index}>{inline(trimmed)}</p>; })}</div>;
}
