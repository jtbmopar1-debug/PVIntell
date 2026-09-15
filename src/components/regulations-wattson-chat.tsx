"use client";

import { Bot, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import type { ChatMessage } from "@/domain/models";

export function RegulationsWattsonChat({ open, onClose, siteId, title, context }: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  title: string;
  context: string;
}) {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const explained = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(message: string, showUser = true) {
    const clean = message.trim();
    if (!clean || sending) return;
    if (showUser) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: clean, createdAt: new Date().toISOString() }]);
    setInput("");
    setSending(true);
    try {
      const response = await fetch("/api/wattson/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: clean, siteId, conversationId, requestId: crypto.randomUUID() }),
      });
      const body = await response.json();
      if (typeof body.conversationId === "string") setConversationId(body.conversationId);
      if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: body.message, citations: body.citations, createdAt: new Date().toISOString() }]);
    } catch (problem) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: problem instanceof Error ? problem.message : "Wattson is unavailable.", createdAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!open || explained.current) return;
    explained.current = true;
    const timer = window.setTimeout(() => void send(`Explain these rules for ${title} in plain language. Preserve important limits, conditions and jurisdiction qualifications; do not omit safety-critical requirements or invent missing facts.\n\nRules shown on this page:\n${context}`, false), 0);
    return () => window.clearTimeout(timer);
    // This is deliberately a one-time explanation for this mounted rules page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, open, sending]);

  if (!open) return null;
  return <section className="fixed inset-x-2 bottom-2 z-[90] flex max-h-[min(78dvh,720px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[min(430px,calc(100vw-2rem))]" role="dialog" aria-label={`Ask Wattson about ${title}`}>
    <header className="flex items-start gap-3 border-b border-line bg-[linear-gradient(105deg,#eaf3fb,#fff6ce)] p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><Bot size={17}/></span><div className="min-w-0 flex-1"><div className="eyebrow">Rules-specific Wattson</div><h2 className="mt-1 truncate text-sm font-extrabold">Explain {title}</h2><p className="mt-1 text-[10px] leading-4 text-muted">This regulations page stays open while you ask follow-up questions.</p></div><button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted" aria-label="Close rules chat"><X size={16}/></button></header>
    <div className="thin-scrollbar min-h-40 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">{messages.map((message) => <div key={message.id} className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-5 ${message.role === "user" ? "ml-auto bg-brand text-white" : "wattson-assistant-message bg-[#eef3f8] text-ink"}`}><FormattedChatMessage content={message.content}/></div>)}{sending ? <p className="text-xs font-semibold text-muted">Wattson is explaining the local rules…</p> : null}<div ref={bottomRef}/></div>
    <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="flex items-end gap-2 border-t border-line bg-white p-3"><textarea autoFocus value={input} onChange={(event) => setInput(event.target.value)} rows={2} placeholder="Ask about these rules…" className="field mt-0 min-h-14 flex-1 resize-none py-3 text-sm leading-5"/><button disabled={!input.trim() || sending} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Send to Wattson"><Send size={17}/></button></form>
  </section>;
}
