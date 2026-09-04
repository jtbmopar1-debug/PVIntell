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
  ["LiFePO₄ / LFP battery bank", "lifepo4-battery-bank.jpg", "Storage", "Stores electricity using lithium iron phosphate cells.", "Its BMS limits charge, discharge and temperature conditions; manufacturer limits still matter."],
  ["Flooded lead-acid / wet-cell battery", "/guides/battery/flooded-lead-acid.png", "Storage", "A serviceable lead-acid battery with liquid electrolyte and vent or filler caps.", "It can deliberately gas while charging and needs the maker's ventilation, upright installation, maintenance and charge settings."],
  ["AGM battery", "/guides/battery/agm-battery.png", "Storage", "A valve-regulated lead-acid battery whose electrolyte is held in absorbent glass mat.", "It is normally sealed and maintenance-free, but can still vent during failure or overcharge and is not the same charge profile as every gel battery."],
  ["Gel battery", "lead-acid-battery.jpg", "Storage", "A valve-regulated lead-acid battery whose electrolyte is immobilised as gel.", "Gel is not another name for AGM. Use the exact maker's current, absorption, float and temperature limits."],
  ["Sodium-ion / Na-ion battery (search alias: Na2)", "lifepo4-battery-bank.jpg", "Storage", "An emerging rechargeable battery family using sodium-based cell chemistry. 'Na2' is recognised as an informal search term, not presented as the technical abbreviation.", "The generic picture does not identify chemistry. Confirm the exact model, label, BMS, voltage window and inverter/charger compatibility."],
  ["Battery management system (BMS)", "bms-battery-management-system.jpg", "Storage", "Monitors and protects battery cells.", "It can limit or disconnect charging and loads when cell voltage, current or temperature leaves safe limits."],
  ["Battery shunt / coulometer / battery monitor", "/guides/battery/battery-shunt-coulometer.png", "Monitoring", "Measures current flowing into and out of a battery bank.", "It counts amp-hours to estimate state of charge. All charger and load negatives normally pass through the system side so no current bypasses its measurement."],
  ["Busbar", "busbar.jpg", "Connections", "A solid common connection point for several high-current cables.", "Positive and negative busbars organise battery, inverter and charger connections separately."],
  ["DC cable", "pv-cable-dc.jpg", "Connections", "Carries direct current between solar, batteries and DC equipment.", "Cable size, insulation rating, length, routing and termination all affect suitability."],
  ["gPV solar fuse / PV string fuse", "/guides/protection/gpv-cylindrical-fuse.png", "Protection", "A photovoltaic fuse cartridge designed for PV-source behaviour and high DC voltage.", "It commonly protects a PV string from damaging reverse current. Its gPV class, voltage, current, physical size and matching holder must all suit the design."],
  ["MEGA battery fuse", "/guides/protection/mega-battery-fuse.png", "Protection", "A compact bolt-down high-current fuse family used in many low-voltage battery systems.", "The exact fuse and holder must suit battery voltage, cable, surge behaviour and prospective fault current; it is not interchangeable with ANL or MIDI."],
  ["ANL battery fuse", "/guides/protection/anl-battery-fuse.png", "Protection", "An elongated bolt-down high-current battery fuse family.", "Its physical size, holder, voltage, time-current behaviour and interrupt rating differ from MEGA, MIDI and Class-T products."],
  ["Class-T high-interrupt fuse", "/guides/protection/class-t-battery-fuse.png", "Protection", "A compact current-limiting fuse family available with high interrupt ratings.", "It may suit high-fault-current battery and inverter circuits when the exact DC voltage, time-current curve, holder and interrupt rating pass the design."],
  ["MRBF terminal battery fuse", "/guides/protection/mrbf-terminal-fuse.jpg", "Protection", "A compact fuse mounted on a compatible battery terminal stud or purpose-built block.", "It is used in 12 V, 24 V and other DC battery systems only when its exact voltage, current, interrupt, terminal and environmental ratings suit the circuit."],
  ["MIDI compact DC fuse", "/guides/protection/midi-battery-fuse.png", "Protection", "A small bolt-down fuse often used for lower-current DC branches.", "It is common in vehicle, marine and low-voltage solar applications, but the exact version must cover the real 12, 24, 36, 48, 60 V or higher circuit maximum and fault current."],
  ["MINI / ATO-ATC / MAXI blade fuse", "/guides/protection/blade-fuse-sizes.png", "Protection", "A plug-in low-voltage DC fuse widely used in automotive, marine, caravan and solar auxiliary circuits.", "It can be entirely appropriate in a solar-equipped system, but many common versions are around 32 V maximum and are not PV-string or universal battery-main fuses."],
  ["Resettable DC circuit breaker", "/guides/protection/resettable-dc-breaker.png", "Protection", "A tripping overcurrent device that can be reset after the fault is investigated.", "It is not a fuse. Voltage, trip curve, interrupt capacity, switching duty and environmental rating decide where it can replace—or cannot replace—a fuse."],
  ["DC circuit breaker", "dc-circuit-breaker-mcb.jpg", "Protection", "Provides over-current protection and, when appropriately rated, switching for a DC circuit.", "An AC-only breaker must not be assumed suitable for DC."],
  ["DC isolator", "dc-disconnect-isolator.jpg", "Protection", "Provides a deliberate way to disconnect a DC source or circuit.", "Its voltage, current, pole arrangement and DC utilisation rating must match the installation."],
  ["AC circuit breaker", "ac-circuit-breaker-mcb.jpg", "Protection", "Protects an AC cable or circuit from excessive current.", "It is selected for the conductor, supply and fault conditions—not just the normal appliance load."],
  ["AC isolator", "ac-disconnect-isolator.jpg", "Protection", "Provides a visible or defined AC disconnection point.", "It allows equipment to be separated from an AC supply for appropriate work or emergency control."],
  ["RCD / RCCB", "rcd-rccb.jpg", "Protection", "Detects current leaking away from the intended circuit path.", "It reduces electric-shock risk but does not replace correct earthing or over-current protection."],
  ["Surge protection device (SPD)", "surge-protection-device-spd.jpg", "Protection", "Limits short voltage surges caused by events such as lightning or switching.", "Its type, placement, earthing path and voltage rating determine where it can help."],
  ["Automatic transfer switch (ATS)", "automatic-transfer-switch-ats.jpg", "AC distribution", "Changes a load between two AC sources.", "Its switching arrangement must prevent unsafe interaction between sources."],
  ["Unsafe backfeed", "automatic-transfer-switch-ats.jpg", "AC distribution", "Electricity feeding backwards into a circuit, switchboard, inverter output or grid line that should be isolated or supplied from another source.", "A generator, inverter or battery system must use a proper transfer switch, interlock, input/output separation and earthing/neutral arrangement so people and equipment are not exposed to unexpected live power."],
  ["Distribution board / switchboard", "ac-distribution-board.jpg", "AC distribution", "Distributes AC electricity into protected final circuits.", "It normally contains breakers and other protective or isolation devices."],
  ["Generator", "generator.jpg", "Sources", "Produces AC electricity from fuel.", "It may run loads directly or supply an inverter/charger, subject to earthing, changeover and charging limits."],
  ["Grid connection", "grid-connection.svg", "Sources", "Connects a property to the public electricity network.", "Export, metering, isolation and approval requirements depend on the local network and jurisdiction."],
  ["Earth electrode", "earth-electrode.svg", "Earthing", "Connects an earthing system to the general mass of earth.", "Its role depends on the supply and earthing arrangement; it is not a substitute for correct protective bonding."],
  ["Earth bar", "earthing-ground-bar.jpg", "Earthing", "Provides a common termination point for protective earthing conductors.", "It helps keep exposed conductive parts connected to the intended fault-current path."],
  ["Energy meter", "energy-meter.jpg", "Monitoring", "Measures electrical energy entering, leaving or moving through a circuit.", "It can support billing, solar performance checks and load analysis."],
  ["CT clamp", "current-transformer-ct-clamp.jpg", "Monitoring", "Measures AC current without becoming part of the power conductor.", "Its direction and location affect whether readings show import, export, load or generation."],
  ["Monitoring data logger", "monitoring-device-data-logger.jpg", "Monitoring", "Collects operating data from power equipment.", "It sends readings to a local display or online monitoring service."],
] as const;

function glossaryImage(image: string) {
  return image.startsWith("/") ? image : `/schematic-components/${image}`;
}

export function Glossary() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? entries.filter((entry) => entry.join(" ").toLowerCase().includes(needle)) : entries;
  }, [query]);
  return <div className="space-y-6">
    <div className="relative max-w-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="field mt-0 pl-11" placeholder="Search a component or term"/></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(([term, image, category, what, role]) => <article key={term} className="card overflow-hidden"><div className="grid h-44 place-items-center bg-white p-4"><Image src={glossaryImage(image)} alt={term} width={240} height={160} className="h-full w-full object-contain"/></div><div className="border-t border-line p-5"><div className="eyebrow">{category}</div><h2 className="mt-2 text-base font-extrabold">{term}</h2><p className="mt-3 text-xs leading-5 text-ink">{what}</p><p className="mt-2 text-[11px] leading-5 text-muted">{role}</p></div></article>)}</div>
    {!visible.length && <div className="card p-8 text-sm text-muted">No glossary entries match “{query}”.</div>}
  </div>;
}
