import Image from "next/image";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return <Image src="/brand/pvintell-mark-compact.svg" alt="" aria-hidden="true" width={48} height={48} className={`${className} shrink-0`}/>;
}

export function BrandLogo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return <div className="flex items-center gap-3">
    <BrandMark className={compact ? "size-9" : "size-11"}/>
    <div className={compact ? "" : "hidden sm:block"}>
      <div className={`font-display font-extrabold leading-none tracking-[-.045em] ${compact ? "text-base" : "text-[19px]"}`}>PVIntell</div>
      {!compact ? <div className={`mt-1 whitespace-nowrap text-[8px] font-extrabold uppercase tracking-[.14em] ${inverse ? "text-white/65" : "text-muted"}`}>Your solar. Answered.</div> : null}
    </div>
  </div>;
}
