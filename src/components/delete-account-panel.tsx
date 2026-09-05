"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

const confirmationPhrase = "DELETE MY ACCOUNT";

export function DeleteAccountPanel({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !deleting) setOpen(false); };
    document.addEventListener("keydown", close); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [open, deleting]);
  function close() { if (!deleting) { setOpen(false); setTyped(""); setAcknowledged(false); setError(""); } }
  async function deleteAccount() {
    setDeleting(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: typed }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your account could not be deleted.");
      window.location.assign("/login?message=Your%20PVIntell%20account%20and%20data%20have%20been%20deleted.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Your account could not be deleted."); setDeleting(false); }
  }
  const enabled = acknowledged && typed === confirmationPhrase && !deleting;
  return <>
    <section className="mt-4 rounded-[14px] border border-[#e4b8ad] bg-[#fffaf8] p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fff0eb] text-[#a7442d]"><AlertTriangle size={17}/></span><div><h2 className="text-sm font-bold">Delete account</h2><p className="mt-1 max-w-xl text-[12px] leading-5 text-muted">Permanently removes your sign-in, Sites, systems, equipment, photos, settings and Wattson conversations.</p></div></div><button type="button" onClick={() => setOpen(true)} className="h-10 shrink-0 rounded-lg border border-[#d9917e] bg-white px-4 text-xs font-bold text-[#9a3520]">Delete my account</button></div></section>
    {open ? <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#071d31]/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="card w-full max-w-md bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="eyebrow !text-[#a7442d]">Permanent account deletion</div><h2 id="delete-account-title" className="mt-2 text-lg font-extrabold">Are you absolutely sure?</h2></div><button type="button" onClick={close} disabled={deleting} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line"><X size={17}/></button></div><div className="mt-4 rounded-xl border border-[#e4b8ad] bg-[#fff0eb] p-3 text-[12px] leading-5 text-[#7f3422]"><strong>This cannot be reversed.</strong> Your account and information will not be retrievable after deletion. This includes every Site, system record, uploaded photo and Wattson chat associated with <strong>{email}</strong>.</div><p className="mt-4 text-[12px] leading-5 text-muted">PVIntell will not keep your personal setup or conversations. Any future anonymised contribution to Wattson would require a separate, explicit consent before deletion.</p><label className="mt-4 flex items-start gap-2 text-[12px] leading-5"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1"/><span>I understand that my full account and data will be permanently deleted.</span></label><label className="mt-4 block text-[11px] font-bold">Type <span className="select-all text-[#a7442d]">{confirmationPhrase}</span> to confirm<input autoFocus value={typed} onChange={(event) => setTyped(event.target.value)} disabled={deleting} className="field" autoComplete="off"/></label>{error ? <p className="mt-3 text-[11px] font-semibold text-[#a7442d]">{error}</p> : null}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} disabled={deleting} className="h-10 rounded-lg border border-line px-4 text-xs font-bold">Keep my account</button><button type="button" onClick={deleteAccount} disabled={!enabled} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#a7442d] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={15}/>{deleting ? "Deleting permanently…" : "Permanently delete account"}</button></div></section></div> : null}
  </>;
}
