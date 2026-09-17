"use client";

import { Camera, ImagePlus, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type GalleryImage = { id: string; fileName: string; source: "gallery" | "wattson"; createdAt: string; url: string };

export function GalleryManager({ images }: { images: GalleryImage[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError("");
    const data = new FormData(); data.set("file", file);
    const response = await fetch("/api/gallery", { method: "POST", body: data });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Could not add image."); else router.refresh();
    setBusy(false);
  }
  async function remove(image: GalleryImage) {
    if (!window.confirm(`Delete ${image.fileName} from Gallery?`)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/gallery?id=${image.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Could not delete image."); else router.refresh();
    setBusy(false);
  }
  async function rename(image: GalleryImage) {
    const fileName = window.prompt("Image name", image.fileName)?.trim();
    if (!fileName || fileName === image.fileName || busy) return;
    setBusy(true); setError("");
    const response = await fetch("/api/gallery", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: image.id, fileName }) });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Could not rename image."); else router.refresh();
    setBusy(false);
  }
  return <>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3"><div><strong className="text-sm">{images.length} of 30 images</strong><p className="mt-1 text-[10px] text-muted">Photos added here and sent to Wattson are kept together.</p></div><div className="flex gap-2"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-xs font-bold text-brand"><Camera size={16}/>Camera<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={busy || images.length >= 30} onChange={(event) => void upload(event.target.files?.[0])}/></label><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand px-3 text-xs font-bold text-white"><ImagePlus size={16}/>Gallery<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy || images.length >= 30} onChange={(event) => void upload(event.target.files?.[0])}/></label></div></div>
    {error ? <p className="mt-3 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">{error}</p> : null}
    {busy ? <p className="mt-3 flex items-center gap-2 text-xs text-muted"><LoaderCircle className="animate-spin" size={15}/>Updating Gallery…</p> : null}
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-line bg-white"><div className="relative aspect-square bg-[#eef3f8]"><Image src={item.url} alt={item.fileName} fill sizes="(max-width:640px) 50vw, 240px" className="object-contain"/></div><div className="p-2"><div className="flex min-w-0 items-center gap-1"><p className="min-w-0 flex-1 truncate text-[10px] font-bold">{item.fileName}</p><button type="button" disabled={busy} onClick={() => void rename(item)} className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-brand" aria-label={`Rename ${item.fileName}`} title="Rename image"><Pencil size={12}/></button></div><div className="mt-1 flex items-center justify-between gap-2"><span className="text-[9px] uppercase text-muted">{item.source === "wattson" ? "Wattson chat" : "Upload"}</span><button type="button" disabled={busy} onClick={() => void remove(item)} className="grid size-8 place-items-center rounded-lg border border-[#e5c1b8] text-[#9a4937]" aria-label={`Delete ${item.fileName}`}><Trash2 size={13}/></button></div></div></article>)}</div>
    {!images.length ? <div className="card mt-4 p-8 text-center"><ImagePlus className="mx-auto text-brand"/><h2 className="mt-3 text-base font-extrabold">No Gallery images yet</h2><p className="mt-1 text-xs text-muted">Upload a photo or attach one in a Wattson chat.</p></div> : null}
  </>;
}
