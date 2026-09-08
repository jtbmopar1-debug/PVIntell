import { Fragment } from "react";

export function FormattedChatMessage({ content }: { content: string }) {
  const inline = (text: string) => {
    const normalized = text.replace(/^\*\*\*(.+)\*\*$/, "**$1**");
    return normalized.split(/(\*\*.+?\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={`${index}:${part}`}>{part.slice(2, -2)}</strong> : <Fragment key={`${index}:${part}`}>{part}</Fragment>);
  };
  return <div className="space-y-2 whitespace-normal">{content.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-1"/>;
    const heading = trimmed.match(/^#{1,6}\s*(.*)$/);
    if (heading) return <p key={index} className="pt-1 font-extrabold text-ink">{inline(heading[1])}</p>;
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) return <div key={index} className="flex gap-2"><span aria-hidden="true">•</span><span>{inline(bullet[1])}</span></div>;
    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) return <div key={index} className="flex gap-2"><span className="font-bold" aria-hidden="true">{numbered[1]}.</span><span>{inline(numbered[2])}</span></div>;
    return <p key={index}>{inline(trimmed)}</p>;
  })}</div>;
}
