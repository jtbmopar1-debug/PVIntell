"use client";

import { Bot, CheckCircle2, ImagePlus, Send, X } from "lucide-react";
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
  guidanceRequest,
}: {
  project: Project;
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
  open: boolean;
  onClose: () => void;
  guidanceRequest?: { id: number; message: string; displayMessage?: string };
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File>();
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handledGuidanceRequestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open, sending]);

  async function send(messageOverride?: string, displayMessage?: string | false) {
    const isGuidanceShortcut = typeof messageOverride === "string";
    const guidanceContext = isGuidanceShortcut ? messageOverride.trim() : undefined;
    const message = (isGuidanceShortcut
      ? displayMessage || "Help me with this system"
      : input || (attachment ? "Please use this image as evidence for this system and schematic." : "")).trim();
    if (!message || sending) return;
    const visibleMessage = displayMessage === undefined ? message : displayMessage;
    if (visibleMessage) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "user",
        content: `${visibleMessage}${attachment ? `\n\n[Attached image: ${attachment.name}]` : ""}`,
        createdAt: new Date().toISOString(),
      }]);
    }
    if (!messageOverride) setInput("");
    setSending(true);
    try {
      const request = new FormData();
      request.set("message", message);
      request.set("projectId", project.id);
      request.set("project", JSON.stringify(project));
      request.set("requestId", crypto.randomUUID());
      request.set("surface", "schematic");
      if (guidanceContext && displayMessage !== undefined) request.set("guidanceContext", guidanceContext);
      if (conversationId) request.set("conversationId", conversationId);
      if (attachment) request.set("file", attachment);
      const response = await fetch("/api/wattson", { method: "POST", body: request });
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
      setAttachment(undefined);
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

  useEffect(() => {
    if (!open || !guidanceRequest || sending || handledGuidanceRequestRef.current === guidanceRequest.id) return;
    handledGuidanceRequestRef.current = guidanceRequest.id;
    void send(guidanceRequest.message, guidanceRequest.displayMessage ?? false);
    // `send` intentionally uses the current conversation and project context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidanceRequest, open]);

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
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-line bg-white p-3">
        {attachment ? <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#9bd2ad] bg-[#f2fbf5] px-3 py-2 text-xs font-semibold text-[#17603b]" role="status"><CheckCircle2 size={16}/><span className="min-w-0 flex-1"><strong className="block">Photo attached - ready to send</strong><span className="block truncate text-[10px] font-normal text-muted">{attachment.name}</span></span><button type="button" onClick={() => setAttachment(undefined)} className="grid size-7 place-items-center rounded-lg hover:bg-white" aria-label="Remove attached image"><X size={14}/></button></div> : null}
        <div className="flex items-end gap-2"><label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-white text-brand" title="Add a photo from your camera, gallery or files" aria-label="Add a photo from your camera, gallery or files"><ImagePlus size={18}/><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={sending} onChange={(event) => setAttachment(event.target.files?.[0])}/></label><textarea autoFocus value={input} onChange={(event) => setInput(event.target.value)} rows={4} placeholder="Tell Wattson what to change…" className="field mt-0 min-h-24 max-h-48 flex-1 resize-y py-3 text-sm leading-5"/><button disabled={(!input.trim() && !attachment) || sending} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40" aria-label="Send to Wattson"><Send size={17}/></button></div>
      </form>
    </section>
  );
}
