"use client";

import { AlertTriangle, ArrowLeft, Check, ChevronRight, FileText, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComponentSpec, InstallationStep, Project, PVArray, Site, SystemConnection } from "@/domain/models";

type GuideSection = {
  tasks: string[];
  checks: string[];
  handoff: string;
};

const lower = (value: unknown) => String(value ?? "").toLowerCase();
const contains = (component: ComponentSpec, words: string[]) => {
  const text = lower(`${component.name} ${component.kind} ${component.notes} ${JSON.stringify(component.specs)}`);
  return words.some((word) => text.includes(word));
};

function stepGuide(title: string): GuideSection {
  const name = title.toLowerCase();
  if (name.includes("planning")) return {
    tasks: [
      "Confirm the proposed equipment locations against the Design Calculator and the as-built schematic.",
      "Measure mounting areas, equipment clearances, access space and every intended cable route.",
      "Mark penetrations, exposed runs, conduit routes, isolation points and locations needing weather or mechanical protection.",
      "Collect manufacturer installation manuals and confirm the exact models are suitable for the site conditions.",
      "Record network, property, building and electrical approvals that apply before purchasing or altering anything.",
    ],
    checks: ["Usable panel area and obstructions recorded", "Cable routes measured", "Equipment manuals attached", "Required approvals identified"],
    handoff: "Before electrical installation begins, consider having a suitably competent person review the design, protection choices and planned test sequence.",
  };
  if (name.includes("battery")) return {
    tasks: [
      "Confirm battery chemistry, nominal voltage, usable capacity, BMS limits and permitted series/parallel arrangement from the exact manual.",
      "Choose a stable, protected location with the manufacturer-required clearances, temperature range and ventilation.",
      "Confirm the enclosure or mounting can carry the recorded battery weight and remains protected from impact, moisture and unauthorised access.",
      "Plan equal-length battery conductors, polarity identification, cable support and protected routes to the busbar or inverter.",
      "Place the selected fuse or breaker and isolation device where the system design shows it; confirm every rating against the exact battery and inverter manuals.",
      "Treat final high-current termination, torque verification, testing and energisation as a separate controlled stage.",
    ],
    checks: ["Battery manual and BMS limits known", "Mounting and environmental limits met", "Cable and protection ratings recorded", "Isolation point accessible"],
    handoff: "Before energising, verify polarity, conductor protection, torque, BMS operation and safe connection yourself or with a competent person you choose.",
  };
  if (name.includes("dc protection")) return {
    tasks: [
      "Map each DC source and conductor section from the schematic; protection must be matched to the circuit it protects.",
      "Confirm conductor current capacity, voltage rating, installation method, ambient temperature and voltage-drop calculation.",
      "Check the exact equipment manual for required fusing, breaker type, interrupt rating, polarity and isolation arrangement.",
      "Plan conduit, glands, strain relief, edge protection and segregation wherever DC cabling crosses or enters structures.",
      "Locate isolators so they are accessible, correctly enclosed and unambiguous in an emergency.",
      "Prepare durable circuit, polarity and shutdown labels for the recorded topology.",
    ],
    checks: ["Every DC source has a recorded protection path", "Ratings match conductors and equipment", "Conduit/mechanical protection planned", "Isolation and labels identified"],
    handoff: "Verify the protection design, terminations and required tests before connecting a battery or PV source; involve a competent person if the limits or results are uncertain.",
  };
  if (name.includes("inverter")) return {
    tasks: [
      "Read the exact inverter manual and record its DC, AC, environmental, mounting and clearance limits.",
      "Confirm the wall or frame is non-combustible where required, structurally suitable and accessible for service.",
      "Mark separate routes for PV DC, battery DC, AC, communications and earth conductors to maintain required segregation.",
      "Mount the inverter in the specified orientation without blocking airflow, covers or isolation controls.",
      "Confirm the planned PV strings, battery voltage/current and AC supply/load arrangement fall within every inverter input limit.",
      "Keep final terminations, testing and connection as a distinct stage so every result can be checked before energisation.",
    ],
    checks: ["Exact manual available", "Clearances and mounting verified", "All input limits checked", "DC/AC isolation and protection recorded"],
    handoff: "Before connection, verify mounting, segregation, protection, earthing, settings and terminations; use independent help where your experience or test equipment is insufficient.",
  };
  if (name.includes("pv installation")) return {
    tasks: [
      "Confirm each PV string separately: module model, count, Voc, Isc, Vmp, Imp, temperature limits and inverter/MPPT assignment.",
      "Set out the array using the exact module dimensions, mounting-zone instructions, required access and verified edge/obstruction clearances.",
      "Confirm roof or ground structure suitability, waterproofing method, wind loading and mounting-system compatibility.",
      "Plan UV-resistant supported cable routes with no loose loops, sharp edges or connector strain; identify sections needing conduit or guarded entry.",
      "Use only confirmed compatible connectors and the specified crimp tooling; do not mate look-alike connectors from different families.",
      "Record the array-frame bonding, DC isolation/protection and shutdown labelling selected for this design.",
      "Keep strings isolated and unenergised for the required inspection and pre-power testing stage.",
    ],
    checks: ["String electrical limits calculated", "Physical fit verified", "Structure and mounting confirmed", "Cable/conduit route recorded", "Isolation, protection, bonding and labels recorded"],
    handoff: "Before energising the PV circuit, verify the completed work, record the checks performed and consider an independent check wherever you are unsure.",
  };
  if (name.includes("ac wiring")) return {
    tasks: [
      "Confirm the inverter output, grid or upstream input, backup circuits and changeover arrangement on the schematic.",
      "Record cable length, installation method, conductor size, protective device, RCD/RCBO requirements and isolation point for each AC connection.",
      "Plan segregated supported cable routes, suitable enclosures, glands, conduit and penetrations.",
      "Confirm neutral, earth and changeover arrangements against the inverter manual and the recorded system design.",
      "Prepare labels identifying multiple supplies, isolation points, backup circuits and shutdown sequence.",
    ],
    checks: ["AC topology recorded", "Cable and protection design confirmed", "Changeover/backup arrangement confirmed", "Labels and shutdown information prepared"],
    handoff: "AC work carries serious shock and fire risk. Check the local rules and use a suitably competent person for testing or final connection where needed.",
  };
  if (name.includes("communication")) return {
    tasks: [
      "List every required data link between inverter, BMS, meter, shunt, gateway and monitoring service.",
      "Confirm the specified cable type, pinout, termination and maximum length from each manufacturer.",
      "Route communications away from power conductors where required and protect exposed cable from moisture and damage.",
      "Label both ends before connection and record network addresses or device IDs without storing passwords in notes.",
      "Confirm each device is visible and data values are plausible before closing enclosures.",
    ],
    checks: ["Protocol and pinout confirmed", "Cable routes protected", "Both ends labelled", "All devices communicating"],
    handoff: "Consider a supplier or competent technical review for any communications link that controls protection, export limiting or battery safety.",
  };
  if (name.includes("configuration")) return {
    tasks: [
      "Back up the current configuration and record inverter, charger and BMS firmware versions.",
      "Use exact battery-manufacturer limits for charge voltage, current, temperature and state-of-charge boundaries.",
      "Set grid, generator, export, bypass and transfer behaviour only after confirming the recorded topology.",
      "Apply one change group at a time and record the reason, old value and new value.",
      "Test expected transitions without bypassing BMS, inverter or protective-device limits.",
    ],
    checks: ["Configuration backup saved", "Battery limits verified", "Operating priorities documented", "Change record completed"],
    handoff: "Check safety-critical grid, generator, battery and protection settings during commissioning before unattended operation.",
  };
  if (name.includes("pre-power")) return {
    tasks: [
      "Confirm the schematic matches the physical installation and every device has a unique label.",
      "Check that conductors are supported, protected, segregated and terminated to the manufacturer-specified preparation and torque.",
      "Confirm polarity, protective-device ratings, isolator positions, earthing/bonding and enclosure integrity.",
      "Collect manufacturer checklists, cable calculations, test plans, certificates and inspection requirements.",
      "Do not energise merely because visual checks pass; complete the appropriate electrical tests with suitable instruments and enough experience to interpret the results.",
    ],
    checks: ["As-built schematic complete", "Visual and torque checks recorded", "Protection and isolation confirmed", "Test results and supporting records ready"],
    handoff: "Complete or arrange the required electrical tests and record why the installation is considered safe before connection.",
  };
  return {
    tasks: [
      "Confirm every earlier build module is complete and all unresolved warnings are closed.",
      "Follow the manufacturer-defined energisation sequence for the exact inverter, battery and PV equipment.",
      "Record initial voltages, currents, frequencies, insulation/protection test results and device status before applying normal loads.",
      "Test isolation, backup transfer, shutdown, monitoring and expected failure behaviour without defeating safety controls.",
      "Save final settings, photographs, certificates, inspection records and baseline readings with the system.",
    ],
    checks: ["Final review and applicable checks complete", "Safe-to-connect decision recorded", "Startup sequence confirmed", "Baseline measurements saved", "Owner shutdown instructions available"],
    handoff: "Treat energisation and connection as a controlled final step, record who completed it, the checks performed and the measured results.",
  };
}

function stepDescription(title: string, fallback: string) {
  const name = title.toLowerCase();
  if (name.includes("planning")) return "Confirm locations, cable routes, access, manuals and the site-specific considerations you want recorded before work begins.";
  if (name.includes("battery")) return "Mount and document the battery system, its protection, conductors and isolation before connection.";
  if (name.includes("dc protection")) return "Work through the protection and isolation needed for each recorded DC conductor section.";
  if (name.includes("inverter")) return "Mount and document the inverter using its exact manual and the connections in this system design.";
  if (name.includes("pv installation")) return "Install and document each PV string, its mounting, cabling, isolation, protection and earthing.";
  if (name.includes("ac wiring")) return "Plan, complete and verify this system's AC supply, output, protection, isolation and changeover connections.";
  if (name.includes("communication")) return "Connect and verify the data links used by this system's inverter, battery, meters and monitoring devices.";
  if (name.includes("configuration")) return "Record and apply equipment settings that match the battery, sources, loads and intended operating strategy.";
  if (name.includes("pre-power")) return "Verify the physical system, protection, polarity, torque and test results before energising.";
  if (name.includes("commission")) return "Start the system in the equipment-defined sequence and record its initial measurements and behaviour.";
  return fallback;
}

function stepTitle(title: string) {
  return title.toLowerCase().includes("planning")
    ? "Planning & site preparation"
    : title;
}

function relevantRecords(project: Project, title: string) {
  const name = title.toLowerCase();
  const words = name.includes("battery") ? ["battery", "bms", "busbar"]
    : name.includes("pv") ? ["pv", "solar", "array", "string", "combiner", "isolator"]
      : name.includes("inverter") ? ["inverter", "charger"]
        : name.includes("ac wiring") ? ["ac", "switchboard", "changeover", "grid", "mains"]
          : name.includes("communication") ? ["monitor", "meter", "gateway", "bms", "communication"]
            : name.includes("configuration") ? ["inverter", "charger", "battery", "bms", "generator"]
              : name.includes("dc protection") ? ["protection", "isolator", "fuse", "breaker", "cable", "combiner"]
                : [];
  const components = words.length ? project.components.filter((item) => contains(item, words)) : project.components;
  const arrays = name.includes("pv") || name.includes("dc protection") || name.includes("planning") || name.includes("pre-power") || name.includes("commission") ? project.pvArrays : [];
  const connections = name.includes("planning") || name.includes("pre-power") || name.includes("commission")
    ? project.connections
    : project.connections.filter((connection) => words.some((word) => lower(`${connection.name} ${connection.connectionType} ${connection.notes}`).includes(word)));
  return { components, arrays, connections };
}

function missingItems(project: Project, step: InstallationStep) {
  const name = step.title.toLowerCase();
  const missing: string[] = [];
  const has = (words: string[]) => project.components.some((item) => contains(item, words));
  if (name.includes("battery")) {
    if (!has(["battery breaker", "battery fuse"])) missing.push("No battery fuse/breaker record is linked to this build yet.");
    if (!has(["battery cable"])) missing.push("Battery conductor size, length, lugs and route are not recorded.");
  }
  if (name.includes("pv") || name.includes("dc protection")) {
    for (const array of project.pvArrays) {
      if (!array.cableSizeMm2 || !array.cableLengthM) missing.push(`${array.name}: cable size or run length is incomplete.`);
      if (!array.isolatorDetails) missing.push(`${array.name}: PV isolation/shutoff details are not recorded.`);
      if (!array.breakerDetails) missing.push(`${array.name}: over-current protection has not been confirmed.`);
    }
    if (!project.pvArrays.length) missing.push("No PV strings are recorded for this system.");
  }
  if (name.includes("inverter") && !project.components.some((item) => item.kind === "inverter")) missing.push("No inverter is recorded.");
  if (name.includes("ac wiring") && !project.connections.some((item) => item.connectionType === "ac")) missing.push("No explicit AC connection is recorded on the schematic.");
  if ((name.includes("pre-power") || name.includes("commission")) && project.installationSteps.some((item) => item.id !== step.id && !item.complete)) missing.push("Earlier build modules are still marked incomplete.");
  if (!has(["earthing", "bonding", "earth electrode"]) && ["pv installation", "dc protection", "ac wiring", "pre-power checks", "commissioning"].some((value) => name.includes(value))) missing.push("System earthing/bonding details are not recorded.");
  return missing;
}

function RecordList({ project, components, arrays, connections }: { project: Project; components: ComponentSpec[]; arrays: PVArray[]; connections: SystemConnection[] }) {
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const records = [
    ...components.map((item) => ({ id: item.id, label: item.name, detail: [item.manufacturer, item.model].filter(Boolean).join(" · ") || item.kind, href: `${base}/equipment/${item.id}` })),
    ...arrays.map((item) => ({ id: item.id, label: item.name, detail: `${item.panelCount ?? "?"} × ${item.panelWatts ?? "?"} W panels`, href: `${base}/pv-strings/${item.id}` })),
    ...connections.map((item) => ({ id: item.id, label: item.name, detail: `${item.connectionType.toUpperCase()} connection`, href: `${base}/schematic` })),
  ];
  if (!records.length) return <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-xs text-muted">No matching equipment or connection records yet. Add the actual items in As-built overview or As-built schematic first.</p>;
  return <div className="mt-4 grid gap-2 md:grid-cols-2">{records.map((record) => <Link key={`${record.href}:${record.id}`} href={record.href} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 hover:border-[#79a9d1]"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand"><FileText size={14}/></span><span className="min-w-0"><strong className="block truncate text-xs">{record.label}</strong><span className="block truncate text-[10px] text-muted">{record.detail}</span></span><ChevronRight className="ml-auto shrink-0 text-brand" size={14}/></Link>)}</div>;
}

export function BuildStepGuide({ project, site, step, position }: { project: Project; site: Site; step: InstallationStep; position: number }) {
  const [complete, setComplete] = useState(step.complete);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const guide = useMemo(() => stepGuide(step.title), [step.title]);
  const records = useMemo(() => relevantRecords(project, step.title), [project, step.title]);
  const missing = useMemo(() => missingItems(project, step), [project, step]);
  const base = `/sites/${site.id}/systems/${project.id}`;

  async function toggleComplete() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/installation-steps/${step.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, complete: !complete }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save this step");
      setComplete(!complete); setMessage(!complete ? "Module marked complete" : "Module reopened");
    } catch (problem) { setMessage(problem instanceof Error ? problem.message : "Could not save this step"); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f4f7fa] text-ink"><div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
    <Link href={`${base}?view=build`} className="inline-flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={14}/>Back to Build</Link>
    <section className="card p-6 md:p-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-start"><div><div className="eyebrow">Build module {position} of {project.installationSteps.length}</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.045em] md:text-[40px]">{stepTitle(step.title)}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{stepDescription(step.title, step.description)}</p><p className="mt-2 text-xs text-muted">Prepared for <strong>{project.name}</strong> at {site.name} · {site.location}</p></div><button onClick={() => void toggleComplete()} disabled={saving} className={`flex h-11 shrink-0 items-center gap-2 rounded-xl px-5 text-xs font-bold ${complete ? "bg-[#dff3e8] text-[#16613a]" : "bg-brand text-white"} disabled:opacity-50`}><Check size={15}/>{complete ? "Completed" : saving ? "Saving…" : "Mark module complete"}</button></div>{message && <p className="mt-3 text-xs font-bold text-brand">{message}</p>}</section>

    <div className="grid gap-6 xl:grid-cols-[1fr_340px]"><div className="space-y-6">
      <section className="card p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><Wrench size={18}/></span><div><div className="eyebrow">Step-by-step</div><h2 className="mt-1 text-xl font-extrabold">Work sequence for this module</h2></div></div><ol className="mt-6 space-y-4">{guide.tasks.map((task, index) => <li key={task} className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#7da8ce] bg-white text-xs font-bold text-brand">{index + 1}</span><p className="pt-1 text-xs leading-5">{task}</p></li>)}</ol></section>
      <section className="card p-6"><div className="eyebrow">Your recorded system</div><h2 className="mt-2 text-xl font-extrabold">Equipment and connections involved</h2><RecordList project={project} {...records}/></section>
      <section className="card p-6"><div className="eyebrow">Before this module is closed</div><h2 className="mt-2 text-xl font-extrabold">Required checks</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{guide.checks.map((check) => <div key={check} className="flex gap-3 rounded-xl bg-[#f1f5f8] p-3 text-xs"><span className="mt-0.5 size-4 shrink-0 rounded border border-[#8aa8c2] bg-white"/>{check}</div>)}</div></section>
    </div><aside className="space-y-5">
      <section className="card border-[#efd98e] bg-[#fff9e3] p-5"><div className="flex items-center gap-2 text-[#765918]"><AlertTriangle size={17}/><strong className="text-sm">Items still to resolve</strong></div>{missing.length ? <ul className="mt-4 space-y-3">{missing.map((item) => <li key={item} className="text-[11px] leading-5 text-[#765918]">• {item}</li>)}</ul> : <p className="mt-3 text-[11px] leading-5 text-[#765918]">PVIntell found no obvious missing records for this module. That does not replace inspection or testing.</p>}</section>
      <section className="card p-5"><div className="flex items-center gap-2"><ShieldCheck className="text-brand" size={17}/><strong className="text-sm">Advice and final checks</strong></div><p className="mt-3 text-[11px] leading-5 text-muted">{guide.handoff}</p><p className="mt-3 text-[10px] leading-4 text-muted">PVIntell provides planning guidance. The user decides what work to undertake, based on their ability, the system risks and any requirements that apply at their location.</p></section>
    </aside></div>
  </div></main>;
}
