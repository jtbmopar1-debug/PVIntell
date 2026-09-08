"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type FaqItem = { question: string; answer: string };
type FaqGroup = { title: string; items: FaqItem[] };

const groups: FaqGroup[] = [
  { title: "Getting started", items: [
    { question: "What is PVIntell?", answer: "PVIntell helps you discover, design, record, understand and monitor solar, battery and related power systems. It keeps Site facts, equipment evidence, calculations, schematics and Wattson conversations together." },
    { question: "What is Wattson?", answer: "Wattson is PVIntell’s solar and electrical assistant. It explains unfamiliar subjects, uses the facts saved for the selected Site or system, and helps turn evidence into a practical design or system record." },
    { question: "What can Wattson do?", answer: "Wattson can explain solar and electrical concepts, guide discovery, use recorded Site and system facts, inspect visible evidence in photos, read clear equipment labels, help with calculations and compare proposed or installed equipment. In Discovery Chat, take a photo or choose one from your gallery and ask a direct question such as ‘Is this roof area suitable?’ Wattson will identify what the image supports and what still needs measurement, documentation or qualified inspection. It cannot certify structural safety, electrical safety, compliance or approval from a photo alone." },
    { question: "Should I start a new system or record installed equipment?", answer: "Start a new system when you want guided discovery and a proposed design. Record installed equipment when the system already exists and you want an as-built record, schematic and monitoring without inventing a past design journey." },
    { question: "What is the difference between a Site and a system?", answer: "A Site is the physical place and can contain several independent power systems, such as a house, studio and shed. Each system has its own equipment, design, schematic, monitoring connections and lifecycle." },
    { question: "Can I leave and continue a build later?", answer: "Yes. Discovery answers and progress are saved as you go. Continue System Build returns to the last saved discovery, design or installation step." },
    { question: "Can I have more than one unfinished discovery?", answer: "Yes. Each new discovery is saved as a separate draft. The dashboard and Settings hub show a Continue tile for each draft, while Start another system opens a separate build without overwriting work already in progress. Plan allowances may limit the number of drafts, Sites or systems in future." },
    { question: "Why does PVIntell ask onboarding questions?", answer: "Onboarding lets Wattson adapt its language, depth and guidance to your experience and situation. You can review or change those answers from Settings." },
  ]},
  { title: "Discovery and design", items: [
    { question: "Why are there so many discovery questions?", answer: "Solar and battery sizing depends on location, available mounting area, energy use, peak demand, backup expectations and equipment constraints. PVIntell asks for these separately so Wattson does not fill gaps with guesses." },
    { question: "What happens when I choose Ask Wattson during discovery?", answer: "A subject-specific Discovery Chat opens for that question. It explains the topic without advancing the questionnaire or selecting an answer for you. You return to the question and confirm the answer manually." },
    { question: "Do Discovery Chats use a separate saved-chat slot for every question?", answer: "No. Help topics from one active guided-discovery run are grouped into one saved conversation, with a title divider for each discovery subject." },
    { question: "Does selecting several appliances mean they all run at once?", answer: "No. A multi-select answer says the appliances may be present. PVIntell separately confirms the highest combination that can realistically overlap before calculating peak inverter demand." },
    { question: "How are daily energy and peak power different?", answer: "Daily energy in kWh influences solar generation and battery capacity. Simultaneous power in kW and motor-start surges influence inverter output. A system must satisfy both." },
    { question: "How does Wattson avoid double-counting energy?", answer: "Wattson separates end use, upstream replenishment, conversion losses and simultaneous loads. For example, it accounts for EV charging input rather than adding the vehicle’s full battery capacity again, and separates spa-bath use from hot-water-cylinder recovery." },
    { question: "Why are AC voltage, phase and battery voltage asked separately?", answer: "They describe different parts of the system. AC may be single-phase, split-phase or three-phase at region-specific voltages, while the battery/DC system may use another nominal voltage entirely." },
    { question: "Will Wattson automatically include a generator?", answer: "No. Generator supply is an explicit choice for grid-connected and off-grid systems. Wattson must not infer a generator from a general backup, resilience or overnight-reserve goal." },
    { question: "Are future loads treated as current consumption?", answer: "No. Future EVs, buildings, tools or other loads are recorded as expansion requirements. PVIntell can preserve capacity and connection options without pretending they consume energy today." },
  ]},
  { title: "Calculations and evidence", items: [
    { question: "Are Wattson’s calculations based on typical appliance guesses?", answer: "Not when a design decision depends on them. Wattson seeks bills, monitoring, rating labels, model specifications, measurements or clearly marked planning estimates, and keeps uncertainty visible." },
    { question: "What evidence can I provide?", answer: "Useful evidence includes electricity bills, equipment labels and manuals, photos, dimensions, measured voltage or power from suitable devices, monitoring exports and confirmed operating schedules." },
    { question: "What if I do not know an appliance’s power use?", answer: "Check its input label or manual. For a suitable plug-connected appliance, Wattson may suggest a correctly rated plug-in power meter. Many smart switches also log live watts and accumulated kWh." },
    { question: "How is inverter size determined?", answer: "PVIntell considers the highest credible simultaneous continuous load, motor and compressor starting surges, phase arrangement, operating limits and appropriate headroom—not daily kWh alone." },
    { question: "How is battery size determined?", answer: "Battery sizing considers required usable energy, reserve duration, allowed depth of discharge, conversion losses, charge/discharge limits, temperature, ageing assumptions and backup scope." },
    { question: "How is expected solar production estimated?", answer: "PVIntell combines recorded array size and geometry with Site location and weather/solar information. Results remain estimates because shade, soiling, temperature, equipment limits and local conditions change real output." },
    { question: "Can I correct an assumption later?", answer: "Yes. Replace estimates with measured or documented values as they become available. The system record should become more exact through design, installation and commissioning." },
  ]},
  { title: "Wattson chats and photos", items: [
    { question: "Does Wattson know which Site I am viewing?", answer: "Yes, when opened from a Site-aware screen. Wattson receives the selected Site and relevant system context, but it should not apply one system’s facts to another without an unambiguous target." },
    { question: "Why are saved chats limited?", answer: "The account currently retains up to 25 conversations to control storage and AI-service usage. Discovery help from one guided run counts as one conversation rather than one per question." },
    { question: "Can I continue an old conversation?", answer: "Yes. Open Wattson chats from Settings to review, continue or delete a saved conversation." },
    { question: "Can Wattson read a photo?", answer: "You can attach or take photos in supported chat and inventory flows. Wattson can extract visible label information and discuss visible evidence, but unclear or hidden details remain unverified." },
    { question: "Will Wattson redirect me while answering?", answer: "No. Wattson should answer in the persistent chat. It may tell you where more detail is available or provide an optional link, but it should not cut off a conversation with an automatic redirect." },
    { question: "Does deleting a chat delete saved system facts?", answer: "No. Deleting a conversation removes the chat text. Confirmed facts already written to system records or account settings remain unless edited or deleted separately." },
  ]},
  { title: "Monitoring and connections", items: [
    { question: "Can PVIntell connect to Bluetooth monitoring equipment?", answer: "Supported browsers and devices can connect to compatible Bluetooth equipment after an explicit user action. The connection remains local to the device and browser session while PVIntell is open." },
    { question: "Why must I approve a Bluetooth connection?", answer: "Browsers require the user to choose and authorise a nearby device. PVIntell cannot silently scan or reconnect to arbitrary Bluetooth devices." },
    { question: "Can one Site have several monitoring methods?", answer: "Yes. A system can retain multiple saved connection methods, such as Bluetooth and a manufacturer cloud or Wi-Fi service. Only the selected active source supplies that system at a given time." },
    { question: "Can the same model of monitor be assigned to different systems?", answer: "Yes, but each saved connection must be deliberately matched to the correct Site and system. Device names alone may not be unique, so identifiers and user confirmation matter." },
    { question: "Why might state of charge be missing?", answer: "Some monitors or protocol versions report voltage and current without a usable state-of-charge value. PVIntell shows Not reported rather than inventing a percentage." },
    { question: "How much monitoring history is retained?", answer: "Live values may update frequently on screen, while database samples are intentionally limited to a short rolling history so temporary telemetry does not grow indefinitely." },
  ]},
  { title: "Existing systems, troubleshooting and additions", items: [
    { question: "Can Wattson help me understand an existing system?", answer: "Yes. Record the installed equipment as an as-built system, including model labels, settings, array details, protection, cables and connections where known. Wattson can then explain how the recorded parts work together without pretending the system went through PVIntell discovery or design." },
    { question: "Can Wattson help troubleshoot or find a fault?", answer: "Yes. Wattson can compare symptoms, alarms, monitoring trends, settings, equipment documentation and the as-built schematic to suggest a safe diagnostic path and likely causes. It should distinguish observations from conclusions and ask for missing evidence rather than inventing a fault." },
    { question: "What information should I provide when something is not working?", answer: "Record the exact symptom, when it began, alarm or fault codes, which loads or system states trigger it, recent changes, photos of displays or labels, and relevant monitoring values. Exact equipment models and a current schematic make troubleshooting substantially more reliable." },
    { question: "Can Wattson tell me to open equipment or work on live wiring?", answer: "No. Wattson can guide safe user checks such as reading a display, reviewing monitoring, checking documented external controls or gathering photos. Isolation, covers, terminals, live testing and regulated electrical work must follow the equipment instructions and be handled by an appropriately qualified person." },
    { question: "What if the monitoring data looks wrong?", answer: "First confirm the active monitoring connection, timestamp, units, sensor direction and whether every relevant source and load is measured. Wattson can compare the reading with inverter displays, utility meters or a suitable independent measurement and identify discrepancies that need investigation." },
    { question: "Can PVIntell calculate an addition to an existing system?", answer: "Yes. Keep the existing installation as the as-built baseline, then record the proposed panels, battery, inverter, charger, generator, EV charger, loads or other addition separately. PVIntell can calculate the combined operating case without rewriting proposed equipment as already installed." },
    { question: "What must be checked before adding panels or batteries?", answer: "The calculation should check electrical compatibility, inverter and controller input limits, string voltage and current across temperature conditions, battery voltage and protocol, charge and discharge limits, available protection and cable capacity, physical space, phase arrangement, network rules and manufacturer requirements." },
    { question: "How does PVIntell assess whether an existing inverter can carry new loads?", answer: "It compares the recorded inverter's continuous and surge ratings with the highest credible combination of existing and proposed simultaneous loads, including motor or compressor starts. It also checks phase, voltage, output limits and backup-circuit scope rather than relying only on daily energy use." },
    { question: "How does PVIntell assess extra solar or battery capacity?", answer: "Extra solar is compared with usable mounting area, solar conditions, controller or inverter limits and expected energy demand. Extra battery capacity is compared with usable energy, charge and discharge power, existing battery compatibility, reserve goals and the energy available to recharge it." },
    { question: "Will proposed additions appear in the live as-built schematic?", answer: "Not until they are actually installed and confirmed. Proposed additions should remain clearly labelled in the design and calculation records; the as-built schematic continues to represent what physically exists." },
  ]},
  { title: "Records, safety and responsibility", items: [
    { question: "What is an as-built record?", answer: "It records what was actually installed: equipment, settings, protection, cables, connections and approved changes. It is different from a proposal or planning schematic." },
    { question: "Does a proposed schematic prove the system is safe or approved?", answer: "No. It is a planning record that must be checked against exact equipment instructions, Site conditions and applicable requirements before work proceeds." },
    { question: "Does PVIntell replace an electrician or engineer?", answer: "No. PVIntell supports planning, evidence and records. Work requiring licensed, authorised or specialist people must still be performed or verified by them." },
    { question: "Who checks local consent and regulatory requirements?", answer: "The user is ultimately responsible for checking local-authority consent requirements, regulations, bylaws, network rules and required professional approvals before installation work begins." },
    { question: "Why does PVIntell flag ground, fence, wall or canopy arrays?", answer: "Local authorities may treat these arrangements differently depending on location, size, height, boundaries and Site controls. PVIntell flags the need to check without pretending to make a universal consent determination." },
    { question: "Where can I read the legal and privacy information?", answer: "Privacy and Terms are available from the Settings hub. They explain data handling, service limitations and user responsibilities." },
  ]},
];

export function PvintellFaq() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return groups;
    return groups.map((group) => ({ ...group, items: group.items.filter((item) => `${item.question} ${item.answer}`.toLocaleLowerCase().includes(needle)) })).filter((group) => group.items.length);
  }, [query]);
  return <div className="space-y-5">
    <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="field mt-0 pl-11" placeholder="Search how PVIntell works"/></div>
    {visible.map((group) => <section key={group.title}><h2 className="mb-2 text-sm font-extrabold text-brand">{group.title}</h2><div className="card divide-y divide-line">{group.items.map((item) => <details key={item.question} className="group p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-extrabold"><span>{item.question}</span><span className="text-lg font-normal text-brand group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-[12px] leading-6 text-muted">{item.answer}</p></details>)}</div></section>)}
    {!visible.length ? <div className="card p-8 text-center text-sm text-muted">No FAQ answers match “{query}”.</div> : null}
  </div>;
}
