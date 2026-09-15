"use client";

import { Bot, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import type { ChatMessage, Project } from "@/domain/models";

export function SchematicWattsonChat({
  project,
  initialConversationId,
  initialMessages = [],
  open,
  onClose,
}: {
  project: Project;
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    }]);
    setInput("");
    setSending(true);
    try {
      const response = await fetch("/api/wattson", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          projectId: project.id,
          project,
          conversationId,
          requestId: crypto.randomUUID(),
          surface: "schematic",
        }),
      });
      const body = await response.json();
      if (typeof body.conversationId === "string") setConversationId(body.conversationId);
      if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: body.message,
        citations: body.citations,
        actionUrl: body.actionUrl,
        actionLabel: body.actionLabel,
        createdAt: new Date().toISOString(),
      }]);
      if (body.actions?.length) router.refresh();
    } catch (problem) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: problem instanceof Error ? problem.message : "Wattson is unavailable.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;
  return (
    <section className="fixed inset-x-2 bottom-2 z-[90] flex h-[min(82dvh,780px)] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[calc(100dvh-2rem)] sm:w-[min(620px,calc(100vw-2rem))]" role="dialog" aria-label={`Work on ${project.name} schematic with Wattson`}>
      <header className="flex items-start gap-3 border-b border-line bg-[linear-gradient(105deg,#eaf3fb,#fff6ce)] p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><Bot size={17}/></span>
        <div className="min-w-0 flex-1"><div className="eyebrow">Schematic-specific Wattson</div><h2 className="mt-1 truncate text-sm font-extrabold">Work on {project.name}</h2><p className="mt-1 text-[10px] leading-4 text-muted">The schematic stays open. Ask to add, update or reconfigure its recorded items and connections.</p></div>
        <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted" aria-label="Close schematic chat"><X size={16}/></button>
      </header>
      <div className="thin-scrollbar min-h-40 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!messages.length ? <div className="wattson-assistant-message rounded-2xl bg-[#eef3f8] px-4 py-3 text-xs leading-5">I have this schematic and its current equipment, arrays and connections. Tell me what you want to change.</div> : messages.map((message) => <div key={message.id} className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-5 ${message.role === "user" ? "ml-auto bg-brand text-white" : "wattson-assistant-message bg-[#eef3f8] text-ink"}`}><FormattedChatMessage content={message.content}/></div>)}
        {sending ? <p className="text-xs font-semibold text-muted">Wattson is checking the schematic…</p> : null}
        <div ref={bottomRef}/>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-line bg-white p-3">
        <textarea autoFocus value={input} onChange={(event) => setInput(event.target.value)} rows={4} placeholder="Tell Wattson what to change…" className="field mt-0 min-h-24 max-h-48 flex-1 resize-y py-3 text-sm leading-5"/>
        <button disabled={!input.trim() || sending} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Send to Wattson"><Send size={17}/></button>
      </form>
    </section>
  );
}
