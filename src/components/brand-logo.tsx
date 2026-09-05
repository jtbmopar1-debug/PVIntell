import Image from "next/image";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return <Image src="/pwa-icon.svg" alt="" aria-hidden="true" width={48} height={48} className={`${className} shrink-0`}/>;
}

export function BrandLogo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return <div className="flex items-center gap-2.5">
    <BrandMark className={compact ? "size-8" : "size-9"}/>
    <div className={compact ? "" : "hidden sm:block"}>
      <div className={`font-display font-extrabold tracking-[-.04em] ${compact ? "text-sm" : "text-[17px]"}`}>PVIntell</div>
      {!compact ? <div className={`text-[8px] font-bold uppercase tracking-[.17em] ${inverse ? "text-white/60" : "text-muted"}`}>Your solar. Answered.</div> : null}
    </div>
  </div>;
}
