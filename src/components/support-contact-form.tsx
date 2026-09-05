"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { FormEvent, useState } from "react";

export function SupportContactForm({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true); setError(""); setSent(false);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your message could not be sent.");
      form.reset(); setSent(true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return <section className="card mt-5 overflow-hidden">
    <div className="border-b border-line p-4 sm:p-5"><h2 className="text-sm font-extrabold">Send PVIntell a message</h2><p className="mt-1 text-[11px] leading-4 text-muted">Questions, feedback and ideas for improving PVIntell are always welcome. We will reply to <strong className="text-ink">{email}</strong>. Never include passwords, API keys or payment-card details.</p></div>
    <form onSubmit={submit} className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
      <label className="block text-[11px] font-bold">What is this about?<select name="category" defaultValue="technical" className="field" disabled={sending}><option value="technical">Technical question</option><option value="account">Account</option><option value="billing">Billing</option><option value="feedback">Feedback or suggestion</option><option value="other">Something else</option></select></label>
      <label className="block text-[11px] font-bold">Site or system <span className="font-normal text-muted">(optional)</span><input name="context" maxLength={160} className="field" placeholder="e.g. River Views - Shed" disabled={sending}/></label>
      <label className="block text-[11px] font-bold sm:col-span-2">Subject<input name="subject" required minLength={3} maxLength={120} className="field" placeholder="A short summary" disabled={sending}/></label>
      <label className="block text-[11px] font-bold sm:col-span-2">How can we help?<textarea name="message" required minLength={20} maxLength={5000} rows={7} className="field min-h-32 py-3 text-[12px] leading-5" placeholder="Tell us what happened, what you expected, and the exact wording of any error." disabled={sending}/></label>
      <label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between"><p aria-live="polite" className={`text-[11px] font-semibold ${error ? "text-[#a7442d]" : "text-[#237847]"}`}>{error || (sent ? "Message sent. PVIntell support will reply by email." : "")}</p><button type="submit" disabled={sending} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-bold text-white disabled:opacity-50">{sending ? <LoaderCircle size={15} className="animate-spin"/> : sent ? <CheckCircle2 size={15}/> : <Send size={15}/>} {sending ? "Sending..." : sent ? "Send another" : "Send message"}</button></div>
    </form>
  </section>;
}
