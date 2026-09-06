"use client";

import { ArrowLeft, Check, ChevronDown, MessageSquare, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import type { Project, Site } from "@/domain/models";
import { allHowToGuides, type NoviceHowToGuide } from "@/components/pvintell-workspace";

const mountLabels: Record<string, string> = { main_roof: "Main roof", other_roof: "Garage, shed or another roof", ground: "Ground-mounted frame", fence: "Fence or vertical screen", wall_facade: "Wall or building facade", carport_pergola: "Carport, pergola or canopy", curved_lightweight: "Curved or weight-limited surface", mobile: "Vehicle, boat or movable structure" };

function solarGuideIds(locations: string[]) {
  const roof = locations.some((value) => value.includes("roof") || value === "curved_lightweight");
  const ground = locations.includes("ground");
  return [
    ...(roof ? ["roof-find-structure", "roof-asphalt-shingle"] : []),
    ...(ground ? ["ground-mount-foundations"] : []),
    ...(locations.includes("carport_pergola") ? ["carport-pergola-canopy"] : []),
    "rails-splices-module-clamps",
    "read-module-label",
    "connector-compatibility",
    "pv-cable-selection-sizing",
    "pv-cable-support-management",
    "conduit-containment-types",
    ...(roof ? ["roof-entries-flashing"] : []),
    "earth-electrodes-bonding-difference",
  ];
}

const connectionGuideIds: Record<string, string[]> = {
  "pv-connection": ["pv-series-versus-parallel", "pv-cable-selection-sizing", "connector-compatibility", "pv-cable-support-management", "conduit-containment-types", "roof-entries-flashing", "dc-load-break-isolators", "pv-combiner-boxes", "surge-protection", "labels-photos-records"],
  "battery-connection": ["battery-cables-lugs", "cable-splicing-terminations-dc-ac", "balanced-parallel-battery-wiring", "dc-fuse-types", "resettable-dc-circuit-breakers", "battery-contactors-precharge", "enclosures-glands-blanking-plugs", "torque-tools", "labels-photos-records"],
  "ac-connection": ["cable-route-planning", "conduit-containment-types", "ac-breakers-isolators", "rcd-rcbo-selection", "backup-loads-changeover", "cable-splicing-terminations-dc-ac", "labels-photos-records"],
  "earth-connection": ["earth-electrodes-bonding-difference", "cable-route-planning", "cable-splicing-terminations-dc-ac", "labels-photos-records"],
  battery: ["battery-enclosures-racks", "battery-bank-layout", "battery-bms", "battery-temperature-management", "labels-photos-records"],
  inverter: ["inverter-types", "cable-route-planning", "enclosures-glands-blanking-plugs", "torque-tools", "labels-photos-records"],
  "battery-safety": ["dc-fuse-types", "resettable-dc-circuit-breakers", "dc-load-break-isolators", "enclosures-glands-blanking-plugs", "labels-photos-records"],
  "solar-safety": ["dc-load-break-isolators", "enclosures-glands-blanking-plugs", "labels-photos-records"],
  switchboard: ["ac-breakers-isolators", "rcd-rcbo-selection", "labels-photos-records"],
  "ac-safety": ["ac-breakers-isolators", "rcd-rcbo-selection", "labels-photos-records"],
  "grid-changeover": ["backup-loads-changeover", "ac-breakers-isolators", "labels-photos-records"],
};

const subjectTitles: Record<string, string> = { solar: "Solar panel installation", battery: "Battery storage installation", inverter: "Hybrid inverter installation", "battery-safety": "Battery fuse and isolation", "solar-safety": "PV isolation", switchboard: "Building power board", "ac-safety": "Building supply protection", "grid-changeover": "Grid changeover and isolation", "pv-connection": "PV DC cable and connection", "battery-connection": "Battery DC cable, lugs and protection", "ac-connection": "AC cable, changeover and protection", "earth-connection": "Earthing and bonding connection" };

export function ComponentBuildWorkspace({ project, site, itemId }: { project: Project; site: Site; itemId: string }) {
  const regionalContext = `${site.location} ${site.timezone ?? ""}`.toLowerCase();
  const isNewZealand = regionalContext.includes("new zealand") || regionalContext.includes("auckland") || site.timezone === "Pacific/Auckland";
  const isPvSubject = itemId === "solar" || itemId === "pv-connection";
  const regionalPurchaseNote = isNewZealand && isPvSubject
    ? <>PV array cabling and its containment and identification must comply with the currently cited New Zealand requirements. Do not buy ordinary unmarked conduit on the assumption it will pass: confirm the required containment duty and durable <strong>SOLAR</strong> identification for the actual route before purchase and inspection.</>
    : <>Before buying parts for this job, check the current requirements published for <strong>{site.location || "this Site"}</strong>. Wattson must identify the applicable country, local authority, electricity network, inspection boundary and cited standards, then distinguish a legal requirement from manufacturer guidance or good practice.</>;
  const mountingLocations = project.designCalculator?.mountingLocations?.length
    ? project.designCalculator.mountingLocations
    : String(project.designDiscovery?.proposed_panel_location?.value ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const ids = itemId === "solar" ? solarGuideIds(mountingLocations) : connectionGuideIds[itemId] ?? ["labels-photos-records"];
  const guides = useMemo(() => ids.map((id) => allHowToGuides.find((guide) => guide.id === id)).filter((guide): guide is NoviceHowToGuide => Boolean(guide)), [ids.join("|")]);
  const [chatGuide, setChatGuide] = useState<NoviceHowToGuide>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const base = `/sites/${site.id}/systems/${project.id}`;

  async function send() {
    if (!chatGuide || !input.trim() || busy) return;
    const message = input.trim();
    const recentConversation = [...messages, { role: "user" as const, content: message }];
    setMessages(recentConversation); setInput(""); setBusy(true);
    try {
      const response = await fetch("/api/wattson/discovery-help", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, conversationId, siteId: site.id, projectId: project.id, discoveryAnswers: project.designDiscovery ?? {}, question: { id: `build_${itemId}_${chatGuide.id}`, title: `${project.name}: ${chatGuide.title}`, stage: "Build It", help: `Answer as backup to this how-to guide for ${subjectTitles[itemId] ?? itemId}. Use the saved Site region and system proposal. State applicable regional purchasing and inspection constraints before generic advice, and distinguish verified rules from guidance. ${isNewZealand && isPvSubject ? "For this New Zealand PV route, explicitly warn that ordinary unmarked conduit may fail inspection and verify containment duty and SOLAR identification against the currently cited AS/NZS 5033 edition before purchase." : ""} Guide: ${JSON.stringify(chatGuide)}` }, recentConversation: recentConversation.slice(-8) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
      setConversationId(body.conversationId); setMessages((current) => [...current, { role: "assistant", content: body.message }]);
    } catch (problem) { setMessages((current) => [...current, { role: "assistant", content: problem instanceof Error ? problem.message : "Wattson is unavailable" }]); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
    <aside className="rounded-2xl border border-[#e6b84c] bg-[#fff7d6] p-4 text-[11px] leading-5 text-[#684d0d]"><strong className="block text-xs">Pre-purchase check · {site.location || "saved Site region"}</strong>{regionalPurchaseNote}</aside>
    <Link href={`${base}/design/schematic`} className="inline-flex items-center gap-2 text-xs font-bold text-brand"><ArrowLeft size={15}/> Back to {project.name} schematic</Link>
    <header className="overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-[#edf6ff] to-[#fff8d8] p-6"><div className="eyebrow">Build this with Wattson</div><h1 className="mt-2 text-3xl font-extrabold">{project.name} · {subjectTitles[itemId] ?? "Component installation"}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Install system components in the order that suits the real build. Inside this component, follow safety-dependent tasks in sequence. The guides lead; Wattson is available as backup.</p>{isPvSubject ? <div className="mt-4 flex flex-wrap gap-2">{mountingLocations.length ? mountingLocations.map((value) => <span key={value} className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#17603b] shadow-sm">{mountLabels[value] ?? value}</span>) : <span className="rounded-full border border-[#d94a3a] bg-[#fff1ee] px-3 py-1.5 text-[10px] font-bold text-[#a52f22]">Mounting location needs confirmation</span>}</div> : null}</header>
    <section className="space-y-3">{guides.map((guide, index) => <details key={guide.id} className="card overflow-hidden" open={index === 0}><summary className="flex cursor-pointer list-none items-center gap-4 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{index + 1}</span><span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[#f4f7fa]"><Image src={guide.image} alt="" fill sizes="64px" className="object-contain p-1"/></span><span className="min-w-0 flex-1"><span className="eyebrow">{guide.group}</span><strong className="mt-1 block text-sm">{guide.title}</strong><span className="mt-1 block text-[10px] leading-4 text-muted">{guide.summary}</span></span><ChevronDown size={18} className="text-brand"/></summary><div className="border-t border-line bg-[#f8fafc] p-5"><div className="grid gap-4 lg:grid-cols-2"><div><h3 className="text-xs font-extrabold">Before you start</h3><ul className="mt-3 space-y-2">{guide.before?.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-muted"><Check size={14} className="mt-1 shrink-0 text-[#288253]"/>{item}</li>)}</ul></div><div><h3 className="text-xs font-extrabold">Walk through it</h3><ol className="mt-3 space-y-2">{guide.steps.map((item, step) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-muted"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#e7f0fb] text-[9px] font-bold text-brand">{step + 1}</span>{item}</li>)}</ol></div></div><div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4"><button type="button" onClick={() => { setChatGuide(guide); setMessages([{ role: "assistant", content: `I’m here as backup for “${guide.title}”. Ask about this guide or how it applies to ${project.name}.` }]); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[11px] font-bold text-white"><MessageSquare size={14}/> Ask Wattson about this step</button><p className="text-[9px] leading-4 text-muted">{guide.source}</p></div></div></details>)}</section>
    {chatGuide ? <aside className="fixed inset-x-3 bottom-3 z-[90] mx-auto flex max-h-[70dvh] max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-line bg-[#eef5fc] p-4"><div><div className="eyebrow">Wattson · backup help</div><h2 className="mt-1 text-sm font-extrabold">{chatGuide.title}</h2></div><button onClick={() => setChatGuide(undefined)} className="text-xs font-bold text-brand">Close</button></div><div className="thin-scrollbar min-h-40 flex-1 space-y-3 overflow-y-auto p-4">{messages.map((message, index) => <div key={index} className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-5 ${message.role === "user" ? "ml-auto bg-brand text-white" : "bg-[#eef3f8]"}`}><FormattedChatMessage content={message.content}/></div>)}{busy ? <p className="text-xs text-muted">Wattson is checking this guide against your system…</p> : null}</div><div className="flex gap-2 border-t border-line p-3"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} className="min-h-12 flex-1 resize-none rounded-xl border border-line p-3 text-xs" placeholder="Ask about this installation step…"/><button onClick={() => void send()} disabled={!input.trim() || busy} className="grid w-12 place-items-center rounded-xl bg-brand text-white disabled:opacity-40"><Send size={17}/></button></div></aside> : null}
  </main>;
}
