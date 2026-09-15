import { AWG_CABLE_SIZES } from "@/lib/cable-size-reference";

export function CableSizeReference() {
  return <section className="overflow-hidden rounded-xl border border-line bg-white">
    <div className="border-b border-line bg-[#eef5fc] p-4">
      <h3 className="text-sm font-extrabold">Cable size measurement &amp; AWG dictionary</h3>
      <p className="mt-1 text-[10px] leading-4 text-muted">AWG area and diameter are nominal conductor measurements. “Nearest metric” is only a physical-size comparison—not an electrical substitution or ampacity equivalence.</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[690px] border-collapse text-left text-[10px]">
        <thead className="bg-[#f8fafc] text-muted"><tr><th className="p-3">AWG size</th><th className="p-3">Accepted aliases</th><th className="p-3">Conductor area</th><th className="p-3">Solid-equivalent diameter</th><th className="p-3">Nearest common metric area</th></tr></thead>
        <tbody>{AWG_CABLE_SIZES.map((size) => <tr key={size.awg} className="border-t border-line"><th className="whitespace-nowrap p-3 font-extrabold">{size.awg}</th><td className="p-3">{size.aliases.join(", ")}</td><td className="whitespace-nowrap p-3">{size.areaMm2} mm²</td><td className="whitespace-nowrap p-3">{size.conductorDiameterMm} mm</td><td className="whitespace-nowrap p-3">{size.nearestMetricMm2} mm²</td></tr>)}</tbody>
      </table>
    </div>
    <div className="border-t border-[#efd98e] bg-[#fff9e3] p-3 text-[10px] leading-4 text-[#765918]">
      <strong>Do not identify cable size from outside diameter.</strong> Stranding, insulation, sheath and voltage rating change the finished diameter. In particular, 4 AWG (21.2 mm²) and 4/0 AWG (107.2 mm²) are different sizes. Read the jacket marking or exact datasheet, then verify conductor material and installation rating.
      <a className="ml-1 font-bold underline" href="https://store.astm.org/standards/b258" target="_blank" rel="noreferrer">ASTM B258 reference</a>
    </div>
  </section>;
}
