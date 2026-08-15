"use client";

import Image from "next/image";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const entries = [
  ["Solar panel (PV module)", "solar-panel-pv-module.jpg", "Solar", "Turns sunlight into DC electricity.", "Panels are joined into one or more PV strings before feeding a controller or inverter."],
  ["PV string", "solar-panel-pv-module.jpg", "Solar", "A group of solar panels electrically connected together.", "Each string has voltage and current limits that must suit the equipment it feeds."],
  ["Roof mounting system", "roof-mounting-system.jpg", "Solar", "Secures panels to the roof or another structure.", "Correct mounting protects the roof and resists local wind loads."],
  ["PV combiner box", "dc-combiner-box.jpg", "Solar", "Combines multiple PV strings into fewer outputs.", "It may also contain string protection, isolation and surge protection."],
  ["Hybrid inverter", "hybrid-inverter.jpg", "Conversion", "Combines several jobs, commonly converting battery DC to AC and managing grid, generator or solar inputs.", "It is compact and simple to operate, but concentrates several functions in one unit."],
  ["String inverter", "string-inverter.jpg", "Conversion", "Converts DC from one or more PV strings into AC electricity.", "Common in grid-connected solar systems without direct battery control."],
  ["Microinverter", "microinverter.jpg", "Conversion", "Converts DC to AC at each panel or small panel group.", "It can reduce the effect of uneven shade, but puts more electronics on the roof."],
  ["MPPT solar charge controller", "mppt-charge-controller.jpg", "Conversion", "Regulates solar power to charge a battery efficiently.", "A separate controller makes a system modular and can allow independent PV expansion."],
  ["LiFePO₄ battery bank", "lifepo4-battery-bank.jpg", "Storage", "Stores electricity using lithium iron phosphate cells.", "Its BMS limits charge, discharge and temperature conditions; manufacturer limits still matter."],
  ["Lead-acid battery", "lead-acid-battery.jpg", "Storage", "Stores electricity using lead-acid chemistry.", "It normally allows less usable depth of discharge than lithium and may require ventilation and maintenance."],
  ["Battery management system (BMS)", "bms-battery-management-system.jpg", "Storage", "Monitors and protects battery cells.", "It can limit or disconnect charging and loads when cell voltage, current or temperature leaves safe limits."],
  ["Busbar", "busbar.jpg", "Connections", "A solid common connection point for several high-current cables.", "Positive and negative busbars organise battery, inverter and charger connections separately."],
  ["DC cable", "pv-cable-dc.jpg", "Connections", "Carries direct current between solar, batteries and DC equipment.", "Cable size, insulation rating, length, routing and termination all affect suitability."],
  ["DC fuse", "dc-fuse.jpg", "Protection", "Opens a DC circuit when current exceeds its designed limit.", "The fuse and holder must suit the circuit voltage, fault current and cable being protected."],
  ["DC circuit breaker", "dc-circuit-breaker-mcb.jpg", "Protection", "Provides over-current protection and, when appropriately rated, switching for a DC circuit.", "An AC-only breaker must not be assumed suitable for DC."],
  ["DC isolator", "dc-disconnect-isolator.jpg", "Protection", "Provides a deliberate way to disconnect a DC source or circuit.", "Its voltage, current, pole arrangement and DC utilisation rating must match the installation."],
  ["AC circuit breaker", "ac-circuit-breaker-mcb.jpg", "Protection", "Protects an AC cable or circuit from excessive current.", "It is selected for the conductor, supply and fault conditions—not just the normal appliance load."],
  ["AC isolator", "ac-disconnect-isolator.jpg", "Protection", "Provides a visible or defined AC disconnection point.", "It allows equipment to be separated from an AC supply for appropriate work or emergency control."],
  ["RCD / RCCB", "rcd-rccb.jpg", "Protection", "Detects current leaking away from the intended circuit path.", "It reduces electric-shock risk but does not replace correct earthing or over-current protection."],
  ["Surge protection device (SPD)", "surge-protection-device-spd.jpg", "Protection", "Limits short voltage surges caused by events such as lightning or switching.", "Its type, placement, earthing path and voltage rating determine where it can help."],
  ["Automatic transfer switch (ATS)", "automatic-transfer-switch-ats.jpg", "AC distribution", "Changes a load between two AC sources.", "Its switching arrangement must prevent unsafe interaction between sources."],
  ["Distribution board / switchboard", "ac-distribution-board.jpg", "AC distribution", "Distributes AC electricity into protected final circuits.", "It normally contains breakers and other protective or isolation devices."],
  ["Generator", "generator.jpg", "Sources", "Produces AC electricity from fuel.", "It may run loads directly or supply an inverter/charger, subject to earthing, changeover and charging limits."],
  ["Grid connection", "grid-connection.svg", "Sources", "Connects a property to the public electricity network.", "Export, metering, isolation and approval requirements depend on the local network and jurisdiction."],
  ["Earth electrode", "earth-electrode.svg", "Earthing", "Connects an earthing system to the general mass of earth.", "Its role depends on the supply and earthing arrangement; it is not a substitute for correct protective bonding."],
  ["Earth bar", "earthing-ground-bar.jpg", "Earthing", "Provides a common termination point for protective earthing conductors.", "It helps keep exposed conductive parts connected to the intended fault-current path."],
  ["Energy meter", "energy-meter.jpg", "Monitoring", "Measures electrical energy entering, leaving or moving through a circuit.", "It can support billing, solar performance checks and load analysis."],
  ["CT clamp", "current-transformer-ct-clamp.jpg", "Monitoring", "Measures AC current without becoming part of the power conductor.", "Its direction and location affect whether readings show import, export, load or generation."],
  ["Monitoring data logger", "monitoring-device-data-logger.jpg", "Monitoring", "Collects operating data from power equipment.", "It sends readings to a local display or online monitoring service."],
] as const;

export function Glossary() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? entries.filter((entry) => entry.join(" ").toLowerCase().includes(needle)) : entries;
  }, [query]);
  return <div className="space-y-6">
    <div className="relative max-w-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="field mt-0 pl-11" placeholder="Search a component or term"/></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(([term, image, category, what, role]) => <article key={term} className="card overflow-hidden"><div className="grid h-44 place-items-center bg-white p-4"><Image src={`/schematic-components/${image}`} alt={term} width={240} height={160} className="h-full w-full object-contain"/></div><div className="border-t border-line p-5"><div className="eyebrow">{category}</div><h2 className="mt-2 text-base font-extrabold">{term}</h2><p className="mt-3 text-xs leading-5 text-ink">{what}</p><p className="mt-2 text-[11px] leading-5 text-muted">{role}</p></div></article>)}</div>
    {!visible.length && <div className="card p-8 text-sm text-muted">No glossary entries match “{query}”.</div>}
  </div>;
}
