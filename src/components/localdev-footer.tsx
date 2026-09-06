import Image from "next/image";
import Link from "next/link";

export function LocalDevFooter() {
  return <footer className="border-t border-line px-4 py-5 text-center"><div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 sm:flex-row"><nav aria-label="Legal and support" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-bold text-muted"><Link href="/privacy" className="hover:text-brand">Privacy</Link><Link href="/terms" className="hover:text-brand">Terms</Link><Link href="/help" className="hover:text-brand">Help &amp; contact</Link></nav><a href="https://localdev.co.nz" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[10px] font-semibold tracking-[.04em] text-muted transition hover:bg-white/60 hover:text-brand"><Image src="/brand/localdev-mark.png" alt="LocalDev" width={22} height={22} className="size-[22px] rounded-md object-cover"/>Proudly built by <span className="font-extrabold text-brand">LocalDev</span></a></div></footer>;
}
