"use client";

import { ArrowRight, ImagePlus, Menu, RotateCcw, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import type { ChatMessage, Site, SystemSummary } from "@/domain/models";
import { useSolarWeather } from "@/weather/use-solar-weather";

export function WattsonPage({ sites, systems, initialSiteId, initialConversationId, initialMessages }: { sites: Site[]; systems: SystemSummary[]; initialSiteId?: string; initialConversationId?: string; initialMessages: ChatMessage[] }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(initialSiteId ?? sites[0]?.id ?? "");
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState(""); const [attachment, setAttachment] = useState<File>(); const [sending, setSending] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const site = sites.find((item) => item.id === siteId) ?? sites[0];
  const siteSystems = systems.filter((system) => system.siteId === siteId);
  const weather = useSolarWeather(site ?? { id: "none", name: "", location: "", timezone: "UTC", locationSource: "manual", locationConfirmed: false });
  const siteQuery = siteId ? `?site=${siteId}` : "";
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  async function send() {
    const message = input.trim() || (attachment ? "Please use this image as evidence." : ""); if (!message || sending) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString() }]); setInput(""); setSending(true);
    try {
      const data = new FormData(); data.set("message", message); if (siteId) data.set("siteId", siteId); if (conversationId) data.set("conversationId", conversationId); if (siteSystems.length === 1) data.set("projectId", siteSystems[0].id); if (attachment) data.set("file", attachment);
      if (weather.data) data.set("weatherContext", JSON.stringify({ site: weather.data.site, fetchedAt: weather.data.fetchedAt, allForecastHours: weather.data.hours }));
      const response = await fetch("/api/wattson/dashboard", { method: "POST", body: data }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
      if (body.conversationId) setConversationId(body.conversationId);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: body.message, citations: body.citations, actionUrl: body.actionUrl, actionLabel: body.actionLabel, createdAt: new Date().toISOString() }]); setAttachment(undefined);
    } catch (error) { setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "Wattson is unavailable.", createdAt: new Date().toISOString() }]); }
    finally { setSending(false); }
  }
  function newChat() { setConversationId(undefined); setMessages([]); setInput(""); setAttachment(undefined); }
  function changeSite(next: string) { setSiteId(next); router.push(`/wattson?site=${next}`); }

  return <div className="flex min-h-screen flex-col bg-canvas text-ink"><header className="sticky top-0 z-40 border-b border-line bg-white/95 shadow-sm backdrop-blur"><div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 md:px-6"><Link href={`/dashboard${siteQuery}`}><BrandLogo/></Link><select value={siteId} onChange={(event) => changeSite(event.target.value)} className="min-w-0 max-w-44 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-brand">{sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary navigation"><Link href={`/dashboard${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Dashboard</Link><Link href={`/systems${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Systems</Link><Link href={`/how-to${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">How to</Link><Link href={`/settings${siteQuery}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Settings</Link></nav><button onClick={() => setMenuOpen((open) => !open)} className="ml-auto grid size-10 place-items-center rounded-xl border border-line bg-white text-brand md:hidden" aria-label="Toggle navigation">{menuOpen ? <X size={18}/> : <Menu size={19}/>}</button></div>{menuOpen ? <nav className="grid gap-1 border-t border-line p-3 md:hidden"><Link href={`/dashboard${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">Dashboard</Link><Link href={`/systems${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">Systems</Link><Link href={`/how-to${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">How to</Link><Link href={`/settings${siteQuery}`} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-sm font-extrabold text-brand">Settings</Link></nav> : null}</header>
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-3 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><div><div className="eyebrow">Wattson · {site?.name ?? "Solar assistant"}</div><h1 className="mt-1 font-display text-2xl font-extrabold">Ask Wattson</h1><p className="mt-1 text-xs text-muted">Uses your Site records, live monitoring and the displayed five-day forecast.</p></div><button type="button" onClick={newChat} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-brand"><RotateCcw size={14}/>New chat</button></div>
      <section className="card flex min-h-[calc(100dvh-10.5rem)] flex-col overflow-hidden"><div className="thin-scrollbar flex-1 space-y-3 overflow-y-auto p-3 sm:p-5">{messages.length ? messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${message.role === "user" ? "bg-brand text-white" : "wattson-assistant-message bg-[#edf2f7] text-ink"}`}><FormattedChatMessage content={message.content}/>{message.actionUrl ? <Link href={message.actionUrl} className="mt-3 inline-flex items-center gap-2 font-bold text-brand">{message.actionLabel ?? "Open"}<ArrowRight size={13}/></Link> : null}</div></div>) : <div className="wattson-assistant-message max-w-2xl rounded-2xl bg-[#edf2f7] p-4 text-sm leading-6">Hi. Ask me about your weather, solar production, system records, a fault, or what to do next.</div>}{sending ? <div className="text-sm text-muted">Wattson is thinking…</div> : null}<div ref={bottom}/></div>
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-line bg-white p-3 sm:p-4">{attachment ? <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#edf2f7] px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)}><X size={14}/></button></div> : null}<div className="flex items-end gap-2"><label className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-white text-brand" aria-label="Add a photo from your camera, gallery or files"><ImagePlus size={19}/><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0])}/></label><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={3} placeholder="Ask Wattson…" className="field wattson-composer-input mt-0 min-h-20 flex-1 resize-none py-3 text-base leading-6"/><button disabled={sending || (!input.trim() && !attachment)} className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40"><Send size={18}/></button></div></form></section>
    </main></div>;
}
