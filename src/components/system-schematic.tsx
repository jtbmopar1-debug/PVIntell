"use client";

import {
  ArrowLeft,
  Ban,
  BatteryCharging,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Eye,
  EyeOff,
  Fuel,
  Home,
  Link2,
  MapPin,
  Menu,
  Plus,
  PlugZap,
  Save,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  ComponentSpec,
  Project,
  PVArray,
  Site,
  SystemConnection,
} from "@/domain/models";
import { DC_CABLE_IMAGE, EARTH_ELECTRODE_IMAGE, isCanonicalEquipmentImage, METER_BOARD_IMAGE, NON_COMMUNICATING_DIGITAL_METER_IMAGE, PLUG_IN_POWER_METER_IMAGE, POOL_CIRCULATION_PUMP_IMAGE, SMART_ELECTRICITY_METER_IMAGE } from "@/ui/assets";
import { BrandLogo } from "@/components/brand-logo";
import { SchematicWattsonChat } from "@/components/schematic-wattson-chat";
import { allHowToGuides } from "@/components/pvintell-workspace";
import { GRID_CONNECTION_IMAGE } from "@/ui/assets";
import { isVisibleInstalledAccessory, removeCoveredInferredLinks } from "@/schematic/installed-layout";
import { hasUnresolvedSuitabilityIssue } from "@/lib/suitability-status";
import { formatPower } from "@/lib/power-units";

type DiagramNode = {
  id: string;
  label: string;
  subtitle: string;
  kind:
    | "pv"
    | "battery"
    | "generator"
    | "grid"
    | "inverter"
    | "output"
    | "accessory"
    | "earth";
  href?: string;
  imageSrc?: string;
  proposed?: boolean;
  incompatible?: boolean;
  placement?: "pv-inline" | "battery-inline" | "busbar" | "general";
};

type ConnectionDetail = {
  id: string;
  label: string;
  sourceId: string;
  targetId: string;
  values: Array<[string, string]>;
  editHref?: string;
  unconfirmed?: boolean;
  saved?: SystemConnection;
  polarity?: SystemConnection["polarity"];
  connectionType?: SystemConnection["connectionType"];
  incompatible?: boolean;
};

type ConnectionView = "all" | "ac" | "dc" | "data" | "earth";

const nodeSize = { width: 180, height: 164 };
const columnX = { source: 55, inverter: 460, output: 865 };
const nodeStep = 190;
const gridSize = 20;

function text(value: unknown) {
  return value === undefined || value === null || value === ""
    ? undefined
    : String(value);
}

function componentHref(base: string, component?: ComponentSpec) {
  return component
    ? `${base}/equipment/${component.id}?returnTo=${encodeURIComponent(`${base}/schematic`)}`
    : undefined;
}

function componentRating(component: ComponentSpec) {
  const rawRating = text(
    component.specs[component.kind === "panel" ? "Panel wattage" : "Rated power"] ??
      component.specs["Rated output"] ??
      component.specs.continuousW,
  );
  const rating = rawRating && component.kind === "inverter" ? formatPower(rawRating) : rawRating && /^\d+(?:\.\d+)?$/.test(rawRating) ? `${rawRating} W` : rawRating;
  const quantity = component.quantity > 1 ? `${component.quantity} × ` : "";
  return rating
    ? `${quantity}${rating}`
    : component.quantity > 1
      ? `Qty ${component.quantity}`
      : undefined;
}

function componentSuitabilityUnresolved(component: ComponentSpec) {
  return hasUnresolvedSuitabilityIssue(component.notes, component.specs);
}

function arraySuitabilityUnresolved(array: PVArray) {
  return hasUnresolvedSuitabilityIssue(array.installationNotes, array.specifications);
}

const imageBase = "/schematic-components";

function componentImage(component: ComponentSpec) {
  const selectedImage = text(component.specs["Schematic image"]);
  const identity = [
    component.kind,
    component.name,
    component.manufacturer,
    component.model,
    component.specs["Chemistry"],
    component.specs["Connection type"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  // An MCB is a device, not its optional DIN-rail enclosure. Prefer the
  // canonical breaker image even when an older record saved the enclosure.
  if (component.kind === "protection" && /\bmcb\b|circuit breaker/.test(identity))
    return identity.includes("ac") || identity.includes("generator")
      ? `${imageBase}/ac-circuit-breaker-mcb.jpg`
      : `${imageBase}/dc-circuit-breaker-mcb.jpg`;
  if (isCanonicalEquipmentImage(selectedImage)) return selectedImage;
  if (component.kind === "inverter") {
    if (identity.includes("micro")) return `${imageBase}/microinverter.jpg`;
    if (identity.includes("string")) return `${imageBase}/string-inverter.jpg`;
    return `${imageBase}/hybrid-inverter.jpg`;
  }
  if (component.kind === "battery")
    return identity.includes("lead")
      ? `${imageBase}/lead-acid-battery.jpg`
      : `${imageBase}/lifepo4-battery-bank.jpg`;
  if (component.kind === "generator") return `${imageBase}/generator.jpg`;
  if (component.kind === "charger")
    return identity.includes("mppt") || identity.includes("solar charge")
      ? `${imageBase}/mppt-charge-controller.jpg`
      : `${imageBase}/dc-dc-battery-charger-unbranded.png`;
  if (component.kind === "combiner") return `${imageBase}/dc-combiner-box.jpg`;
  if (component.kind === "isolator")
    return identity.includes("ac")
      ? `${imageBase}/ac-disconnect-isolator.jpg`
      : `${imageBase}/dc-disconnect-isolator.jpg`;
  if (component.kind === "protection") {
    if (identity.includes("mrbf"))
      return "/guides/protection/mrbf-terminal-fuse.jpg";
    if (identity.includes("surge") || identity.includes("spd"))
      return `${imageBase}/surge-protection-device-spd.jpg`;
    if (identity.includes("fuse holder"))
      return `${imageBase}/dc-fuse-holder.jpg`;
    if (identity.includes("fuse")) return `${imageBase}/dc-fuse.jpg`;
    if (identity.includes("rcd") || identity.includes("rccb"))
      return `${imageBase}/rcd-rccb.jpg`;
    return identity.includes("ac")
      ? `${imageBase}/ac-circuit-breaker-mcb.jpg`
      : `${imageBase}/dc-circuit-breaker-mcb.jpg`;
  }
  if (component.kind === "meter") {
    if (identity.includes("plug-in") || identity.includes("plug in") || identity.includes("kill a watt")) return PLUG_IN_POWER_METER_IMAGE;
    if (identity.includes("meter board") || identity.includes("meter enclosure")) return METER_BOARD_IMAGE;
    if (identity.includes("non-communicating") || identity.includes("non communicating")) return NON_COMMUNICATING_DIGITAL_METER_IMAGE;
    if (identity.includes("smart")) return SMART_ELECTRICITY_METER_IMAGE;
    return `${imageBase}/energy-meter.jpg`;
  }
  if (component.kind === "monitoring")
    return identity.includes("coulometer") || identity.includes("junctek") || identity.includes("km140")
      ? "/guides/battery/battery-shunt-coulometer.png"
      : identity.includes("wifi")
      ? `${imageBase}/wifi-communication-module.jpg`
      : `${imageBase}/monitoring-device-data-logger.jpg`;
  if (component.kind === "cable")
    return identity.includes("pv") || identity.includes("solar")
      ? `${imageBase}/pv-cable-dc.jpg`
      : DC_CABLE_IMAGE;
  if (identity.includes("protective-earth") || identity.includes("protective earth") || identity.includes("earthing bar"))
    return `${imageBase}/earthing-ground-bar.jpg`;
  if (identity.includes("busbar")) return `${imageBase}/busbar.jpg`;
  if (
    identity.includes("grid connection") ||
    identity.includes("utility supply") ||
    identity.includes("mains connection")
  )
    return GRID_CONNECTION_IMAGE;
  if (
    identity.includes("earth electrode") ||
    identity.includes("earth peg") ||
    identity.includes("ground rod")
  )
    return EARTH_ELECTRODE_IMAGE;
  if (identity.includes("transfer") || identity.includes("changeover"))
    return `${imageBase}/automatic-transfer-switch-ats.jpg`;
  if (identity.includes("switchboard") || identity.includes("distribution"))
    return `${imageBase}/ac-distribution-board.jpg`;
  if (identity.includes("relay"))
    return `${imageBase}/smart-load-relay-controller.jpg`;
  if (identity.includes("pool") && (identity.includes("pump") || identity.includes("circulation") || identity.includes("filtration")))
    return POOL_CIRCULATION_PUMP_IMAGE;
  if (identity.includes("bms"))
    return `${imageBase}/bms-battery-management-system.jpg`;
  return undefined;
}

function nodeIcon(kind: DiagramNode["kind"]) {
  if (kind === "pv") return <Sun size={20} />;
  if (kind === "battery") return <BatteryCharging size={20} />;
  if (kind === "generator") return <Fuel size={20} />;
  if (kind === "grid") return <Zap size={20} />;
  if (kind === "inverter") return <PlugZap size={20} />;
  if (kind === "earth") return <ShieldCheck size={20} />;
  if (kind === "accessory") return <Zap size={20} />;
  return <Home size={20} />;
}

function NodeCard({
  node,
  x,
  y,
  connectingFrom,
  connectionMode,
  onConnectionStart,
  onConnectionDrop,
  onMoveStart,
  onMoveEnd,
}: {
  node: DiagramNode;
  x: number;
  y: number;
  connectingFrom?: string;
  connectionMode: boolean;
  onConnectionStart: (node: DiagramNode) => void;
  onConnectionDrop: (node: DiagramNode) => void;
  onMoveStart: (node: DiagramNode) => void;
  onMoveEnd?: (node: DiagramNode, clientX: number, clientY: number, svg: SVGSVGElement) => void;
}) {
  const router = useRouter();
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const suppressClick = useRef(false);
  return (
    <foreignObject x={x} y={y} width={nodeSize.width} height={nodeSize.height}>
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/pvintell-move-node", node.id);
          onMoveStart(node);
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          pointerStart.current = { x: event.clientX, y: event.clientY };
          suppressClick.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          const svg = event.currentTarget.closest("svg") as SVGSVGElement | null;
          if (start && svg && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
            suppressClick.current = true;
            onMoveStart(node);
            onMoveEnd?.(node, event.clientX, event.clientY, svg);
          }
          pointerStart.current = undefined;
        }}
        onClick={(event) => {
          if (suppressClick.current) { event.preventDefault(); suppressClick.current = false; return; }
          if (connectionMode) {
            event.preventDefault();
            connectingFrom ? onConnectionDrop(node) : onConnectionStart(node);
            return;
          }
          if (node.href) router.push(node.href);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          if (!connectingFrom) return;
          event.preventDefault();
          event.stopPropagation();
          onConnectionDrop(node);
        }}
        className={`relative flex h-full w-full touch-none flex-col items-center rounded-2xl border bg-transparent px-2 py-1 text-center transition hover:-translate-y-0.5 hover:bg-white/55 ${node.proposed ? "border-dashed border-[#8db4d8]" : "border-transparent"} ${connectingFrom === node.id ? "border-[#f6c945] bg-[#fff9df] ring-2 ring-[#f6c945]/35" : ""} ${node.href ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
      >
        {node.proposed && <span className="absolute left-1 top-1 z-10 rounded-full bg-[#fff6cf] px-2 py-1 text-[8px] font-extrabold uppercase tracking-wide text-[#8b6512]">Proposed</span>}
        {node.incompatible && <span className="absolute left-1/2 top-[58px] z-20 grid size-8 -translate-x-1/2 place-items-center rounded-full border-2 border-white bg-[#c9362b] text-white shadow-md" title="Suitability has not passed — open this technical card for details" aria-label="Suitability has not passed"><Ban size={18}/></span>}
        <span
          draggable
          title="Drag to another item to connect"
          onClick={(event) => {
            event.stopPropagation();
            connectingFrom ? onConnectionDrop(node) : onConnectionStart(node);
          }}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "link";
            event.dataTransfer.setData("text/pvintell-node", node.id);
            onConnectionStart(node);
          }}
          className="absolute right-0 top-[58px] grid size-10 cursor-crosshair place-items-center rounded-full border-2 border-white bg-brand text-base text-white shadow-md md:top-[66px] md:size-6 md:text-[11px]"
        >
          +
        </span>
        {node.imageSrc ? (
          <span className="grid h-[108px] w-[138px] place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_rgba(15,59,102,.13)] ring-1 ring-[#dbe3ec]">
            <Image
              src={node.imageSrc}
              alt=""
              width={160}
              height={120}
              draggable={false}
              className={node.imageSrc === GRID_CONNECTION_IMAGE ? "h-full w-full object-contain p-2" : "h-full w-full object-cover"}
            />
          </span>
        ) : (
          <span className={`grid h-[108px] w-[138px] place-items-center rounded-2xl shadow-[0_10px_24px_rgba(15,59,102,.1)] ${node.kind === "pv" ? "bg-[#fff3b4] text-[#9a6b00]" : "bg-[#eaf2fb] text-brand"}`}>
            {nodeIcon(node.kind)}
          </span>
        )}
        <strong className="mt-2 block max-w-full truncate text-[12px]">
          {node.label}
        </strong>
        <span className="mt-0.5 block max-w-full truncate text-[9px] text-muted">
          {node.subtitle}
        </span>
      </button>
    </foreignObject>
  );
}

function ConnectionPath({
  connection,
  positions,
  onOpen,
  showLabel,
  laneOffset = 0,
}: {
  connection: ConnectionDetail;
  positions: Map<string, { x: number; y: number }>;
  onOpen: (connection: ConnectionDetail) => void;
  showLabel: boolean;
  laneOffset?: number;
}) {
  const source = positions.get(connection.sourceId);
  const target = positions.get(connection.targetId);
  if (!source || !target) return null;
  const travelsRight = source.x <= target.x;
  const x1 = travelsRight ? source.x + nodeSize.width : source.x;
  const y1 = source.y + nodeSize.height / 2;
  const x2 = travelsRight ? target.x : target.x + nodeSize.width;
  const y2 = target.y + nodeSize.height / 2;
  const direction = travelsRight ? 1 : -1;
  const bend = Math.max(55, Math.abs(x2 - x1) * 0.45);
  const path = `M ${x1} ${y1} C ${x1 + direction * bend} ${y1 + laneOffset}, ${x2 - direction * bend} ${y2 + laneOffset}, ${x2} ${y2}`;
  const labelX = (x1 + x2) / 2 - 43;
  const labelY = (y1 + y2) / 2 - 13 + laneOffset;
  const isAc =
    connection.saved?.connectionType === "ac" ||
    connection.connectionType === "ac" ||
    connection.label.toLowerCase().includes("ac");
  const isEarth =
    connection.saved?.connectionType === "earth" ||
    connection.connectionType === "earth" ||
    connection.label.toLowerCase().includes("earth") ||
    connection.label.toLowerCase().includes("bond");
  const polarity = connection.saved?.polarity ?? connection.polarity ?? "na";
  const stroke = connection.unconfirmed
    ? "#9aabbc"
    : isEarth
      ? "#2d8a57"
    : isAc
      ? "#d99b13"
    : polarity === "positive"
      ? "#d64343"
      : polarity === "negative"
        ? "#202a35"
      : "#2f80c1";
  return (
    <g>
      {polarity === "pair" && !isAc && !isEarth && !connection.unconfirmed ? (
        <>
          <path d={path} fill="none" stroke="#d64343" strokeWidth="3" transform="translate(0,-3)" pointerEvents="none" />
          <path d={path} fill="none" stroke="#202a35" strokeWidth="3" transform="translate(0,3)" pointerEvents="none" />
        </>
      ) : (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeDasharray={connection.unconfirmed ? "7 7" : undefined}
          pointerEvents="none"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="16"
        className="cursor-pointer"
        onClick={() => onOpen(connection)}
      />
      {showLabel && (
        <foreignObject x={labelX} y={labelY} width="86" height="30">
          <button
            type="button"
            onClick={() => onOpen(connection)}
            title={connection.unconfirmed ? `Configure ${connection.label}` : connection.label}
            className={`h-7 w-full rounded-full border px-2 text-[8px] font-extrabold shadow-sm ${connection.unconfirmed ? "border-[#d94a3a] bg-[#fff1ee] text-[#a52f22]" : isAc ? "border-[#e4bd62] bg-white text-[#93630a]" : "border-[#8db4d8] bg-white text-brand"}`}
          >
            {connection.unconfirmed ? "Configure" : connection.label}
          </button>
        </foreignObject>
      )}
      {connection.incompatible && (
        <foreignObject x={(x1 + x2) / 2 - 15} y={(y1 + y2) / 2 - 15 + laneOffset} width="30" height="30">
          <button
            type="button"
            onClick={() => onOpen(connection)}
            title="Compatibility check failed — open this connection for details"
            aria-label="Compatibility check failed; open connection details"
            className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#c9362b] text-white shadow-md"
          >
            <Ban size={17}/>
          </button>
        </foreignObject>
      )}
    </g>
  );
}

function seriesPanelCount(array: PVArray) {
  return (array.strings ?? 1) === 1 && array.panelCount ? array.panelCount : array.panelsPerString;
}

function pvArrangement(array: PVArray) {
  const recordedArrangement = text(array.specifications["Wiring arrangement"]);
  if (recordedArrangement && /^(?:series|parallel)$/i.test(recordedArrangement)) return recordedArrangement.toLowerCase();
  const panelsInSeries = seriesPanelCount(array);
  if (array.strings && panelsInSeries)
    return `${array.strings} parallel string${array.strings === 1 ? "" : "s"} x ${panelsInSeries} panels in series`;
  if (panelsInSeries) return `${panelsInSeries} panels in series per string`;
  if (array.strings) return `${array.strings} parallel string${array.strings === 1 ? "" : "s"}`;
  return "Series/parallel layout not confirmed";
}

function pvConnectionLabel(array: PVArray) {
  if (!array.strings) return "PV DC";
  return `${array.strings} PV string${array.strings === 1 ? "" : "s"}`;
}

function pvDetails(array: PVArray): Array<[string, string]> {
  const panelsInSeries = seriesPanelCount(array);
  const stringVmp = panelsInSeries && array.maximumPowerVoltageV
    ? panelsInSeries * array.maximumPowerVoltageV
    : undefined;
  const stringVoc = panelsInSeries && array.openCircuitVoltageV
    ? panelsInSeries * array.openCircuitVoltageV
    : undefined;
  const arrayImp = array.strings && array.maximumPowerCurrentA
    ? array.strings * array.maximumPowerCurrentA
    : undefined;
  const arrayIsc = array.strings && array.shortCircuitCurrentA
    ? array.strings * array.shortCircuitCurrentA
    : undefined;
  return [
    ["Panels", `${array.panelCount ?? "?"} x ${array.panelWatts ?? "?"} W`],
    ["Arrangement", pvArrangement(array)],
    ["String Vmp", stringVmp ? `${stringVmp.toFixed(1)} V` : "Not confirmed"],
    ["String Voc", stringVoc ? `${stringVoc.toFixed(1)} V nameplate; cold correction still required` : "Not confirmed"],
    ["Array Imp", arrayImp ? `${arrayImp.toFixed(1)} A` : "Not confirmed"],
    ["Array Isc", arrayIsc ? `${arrayIsc.toFixed(1)} A` : "Not confirmed"],
    ["Cable", text(array.cableSizeMm2 && `${array.cableSizeMm2} mm²`) ?? "Not confirmed"],
    ["Cable length", text(array.cableLengthM && `${array.cableLengthM} m`) ?? "Not confirmed"],
    ["Breaker / fuse", text(array.breakerDetails) ?? "Not confirmed"],
    ["Isolator", text(array.isolatorDetails) ?? "Not confirmed"],
    ["Connectors", text(array.connectorType) ?? "Not confirmed"],
  ];
}

function componentDetails(components: ComponentSpec[]): Array<[string, string]> {
  const values: Array<[string, string]> = [];
  for (const component of components) {
    values.push(["Record", component.name]);
    if (component.location) values.push(["Location", component.location]);
    for (const [name, value] of Object.entries(component.specs)) {
      if (name === "Equipment record" || name === "Connection type") continue;
      values.push([name, String(value)]);
    }
  }
  return values.length ? values : [["Details", "Not confirmed in PVIntell"]];
}

export type SchematicAsset = {
  fileName: string;
  label: string;
  type: ComponentSpec["kind"];
  url: string;
};

type AssetGroup = "all" | "ac" | "dc" | "switching" | "solar" | "storage" | "generation" | "metering" | "other";

const assetGroups: Array<{ id: AssetGroup; label: string }> = [
  { id: "all", label: "All" },
  { id: "ac", label: "AC" },
  { id: "dc", label: "DC" },
  { id: "switching", label: "Switches & protection" },
  { id: "solar", label: "Solar & charging" },
  { id: "storage", label: "Storage" },
  { id: "generation", label: "Generation" },
  { id: "metering", label: "Metering & monitoring" },
  { id: "other", label: "Other" },
];

function schematicAssetGroups(asset: SchematicAsset): AssetGroup[] {
  const identity = `${asset.label} ${asset.fileName}`.toLowerCase();
  const groups = new Set<AssetGroup>();
  if (/\bac\b|alternating/.test(identity)) groups.add("ac");
  if (/\bdc\b|direct current|combiner|busbar|connector|cable|charge controller|mppt/.test(identity)) groups.add("dc");
  if (["isolator", "protection", "combiner"].includes(asset.type) || /switch|disconnect|breaker|fuse|rcd|rccb|surge|contactor|changeover|transfer/.test(identity)) groups.add("switching");
  if (["panel", "pv_string", "charger", "inverter"].includes(asset.type) || /solar|photovoltaic|\bpv\b|inverter|charger|mppt/.test(identity)) groups.add("solar");
  if (asset.type === "battery" || /battery|storage/.test(identity)) groups.add("storage");
  if (asset.type === "generator" || /generator|genset|turbine/.test(identity)) groups.add("generation");
  if (["meter", "monitoring"].includes(asset.type) || /meter|monitor|sensor|gateway|\bct\b/.test(identity)) groups.add("metering");
  if (!groups.size || asset.type === "other") groups.add("other");
  return [...groups];
}

export function SystemSchematic({
  project,
  site,
  sites,
  schematicAssets = [],
  initiallyAdding = false,
  initialConversationId,
  initialMessages = [],
}: {
  project: Project;
  site: Site;
  sites: Site[];
  schematicAssets?: SchematicAsset[];
  initiallyAdding?: boolean;
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
}) {
  const router = useRouter();
  async function askGuide(guide: (typeof allHowToGuides)[number], question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) {
    const response = await fetch("/api/wattson/guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question, siteId: site.id, guide, recentConversation, guideIndex: allHowToGuides.map(({ id, title, group, aliases }) => ({ id, title, group, aliases })) }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable"); return body;
  }
  const [selected, setSelected] = useState<ConnectionDetail>();
  const [connectingFrom, setConnectingFrom] = useState<DiagramNode>();
  const [connectionMode, setConnectionMode] = useState(false);
  const [draftEnds, setDraftEnds] = useState<{
    source: DiagramNode;
    target: DiagramNode;
  }>();
  const [adding, setAdding] = useState(initiallyAdding);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetGroup, setAssetGroup] = useState<AssetGroup>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setMovingNode] = useState<DiagramNode>();
  const [layoutMessage, setLayoutMessage] = useState("");
  const [showConnectionLabels, setShowConnectionLabels] = useState(false);
  const [connectionView, setConnectionView] = useState<ConnectionView>("all");
  const [editorConnectionType, setEditorConnectionType] = useState<SystemConnection["connectionType"]>("dc");
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasFrameWidth, setCanvasFrameWidth] = useState(1100);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wattsonOpen, setWattsonOpen] = useState(false);
  const [guidanceRequest, setGuidanceRequest] = useState<{ id: number; message: string; displayMessage?: string }>();

  const askWhatsNext = () => {
    setGuidanceRequest({
      id: Date.now(),
      displayMessage: "What’s next?",
      message: "What is the next smallest action to complete this system safely? Reply as a short working checklist, not a report. Start with **Okay, next we can:** and suggest one clear action such as confirming a panel model, checking inverter limits, sizing the generator, or completing a connection record. Then suggest at most two later actions. Use collaborative language, not commands. Use plain language. Do not list the whole system, raw electrical calculations, lifecycle background, URLs, or standards unless they are essential to the immediate action. Reassess the saved record every time this button is clicked. Do not mark anything installed, confirmed, or commissioned unless the records prove it.",
    });
    setWattsonOpen(true);
  };
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const initialCanvasFitDone = useRef(false);
  const [viewPreferencesReady, setViewPreferencesReady] = useState(false);
  const viewPreferencesKey = `pvintell:schematic-view:${project.id}`;
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(viewPreferencesKey);
        if (raw) {
          const saved = JSON.parse(raw) as {
            zoom?: unknown;
            connectionView?: unknown;
            showConnectionLabels?: unknown;
          };
          if (typeof saved.zoom === "number" && saved.zoom >= .3 && saved.zoom <= 1.4) {
            setCanvasZoom(saved.zoom);
            initialCanvasFitDone.current = true;
          }
          if (["all", "ac", "dc", "data", "earth"].includes(String(saved.connectionView)))
            setConnectionView(saved.connectionView as ConnectionView);
          if (typeof saved.showConnectionLabels === "boolean")
            setShowConnectionLabels(saved.showConnectionLabels);
        }
      } catch {
        window.localStorage.removeItem(viewPreferencesKey);
      } finally {
        setViewPreferencesReady(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewPreferencesKey]);
  useEffect(() => {
    if (!viewPreferencesReady) return;
    window.localStorage.setItem(viewPreferencesKey, JSON.stringify({
      zoom: canvasZoom,
      connectionView,
      showConnectionLabels,
    }));
  }, [canvasZoom, connectionView, showConnectionLabels, viewPreferencesKey, viewPreferencesReady]);
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const measureFrame = () => {
      setCanvasFrameWidth(Math.max(1, viewport.clientWidth));
    };
    const fitOnce = () => {
      measureFrame();
      if (!initialCanvasFitDone.current && window.innerWidth < 768) {
        setCanvasZoom(Math.max(.35, Math.min(1, viewport.clientWidth / 1100)));
        initialCanvasFitDone.current = true;
      }
    };
    const handleOrientationChange = () => {
      window.requestAnimationFrame(() => {
        measureFrame();
        if (window.innerWidth < 768) setCanvasZoom(Math.max(.35, Math.min(1, viewport.clientWidth / 1100)));
      });
    };
    const frame = window.requestAnimationFrame(fitOnce);
    const observer = new ResizeObserver(measureFrame);
    observer.observe(viewport);
    window.addEventListener("orientationchange", handleOrientationChange);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >(() =>
    Object.fromEntries(
      project.schematicPositions.map((position) => [
        position.nodeRef,
        { x: position.x, y: position.y },
      ]),
    ),
  );
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const schematicReturn = encodeURIComponent(`${base}/schematic`);
  const visibleAssets = schematicAssets.filter((asset) => {
    const search = assetSearch.trim().toLowerCase();
    const matchesSearch = !search || `${asset.label} ${asset.fileName}`.toLowerCase().includes(search);
    return matchesSearch && (assetGroup === "all" || schematicAssetGroups(asset).includes(assetGroup));
  });
  const diagram = useMemo(() => {
    const inverters = project.components.filter((item) => item.kind === "inverter");
    const batteries = project.components.filter((item) => item.kind === "battery");
    const generators = project.components.filter((item) => item.kind === "generator");
    const gridComponents = project.components.filter((item) => {
      const identity = `${item.name} ${item.notes ?? ""}`.toLowerCase();
      return (
        identity.includes("grid connection") ||
        identity.includes("utility supply") ||
        identity.includes("mains connection")
      );
    });
    const batteryLinks = project.components.filter(
      (item) =>
        (item.kind === "cable" && item.name.toLowerCase().includes("battery")) ||
        (item.kind === "protection" && item.name.toLowerCase().includes("battery")),
    );
    const acLinks = project.components.filter(
      (item) =>
        item.specs["Connection type"] === "Inverter to switchboard AC" ||
        item.name.toLowerCase().includes("switchboard ac connection"),
    );
    const upstreamAcName =
      text(acLinks[0]?.specs["Alternate / bypass source"]) ??
      text(acLinks[0]?.specs["Normal supply source"]);
    const earth = project.components.find(
      (item) =>
        item.specs["Equipment record"] === "System earthing and bonding" ||
        item.name.toLowerCase().includes("earthing / bonding"),
    );
    const accessories = project.components.filter(
      (item) =>
        !["inverter", "battery", "generator"].includes(item.kind) &&
        !(project.pvArrays.length > 0 && ["panel", "pv_string"].includes(item.kind)) &&
        isVisibleInstalledAccessory(item) &&
        item.id !== earth?.id &&
        !gridComponents.some((grid) => grid.id === item.id),
    );

    const sourceNodes: DiagramNode[] = [
      ...project.pvArrays.map((array) => ({
        id: `pv:${array.id}`,
        label: array.name,
        subtitle: `${array.panelCount ?? "?"} × ${array.panelWatts ?? "?"} W · ${pvArrangement(array)}`,
        kind: "pv" as const,
        href: `${base}/pv-strings/${array.id}`,
        imageSrc: `${imageBase}/solar-panel-pv-module.jpg`,
        proposed: array.confidence !== "confirmed",
        incompatible: arraySuitabilityUnresolved(array),
      })),
      ...batteries.flatMap((battery) => Array.from({ length: Math.max(1, battery.quantity) }, (_, index) => ({
        id: index ? `component:${battery.id}:unit-${index + 1}` : `component:${battery.id}`,
        label: battery.quantity > 1 ? `${battery.name} ${index + 1}` : battery.name,
        subtitle: [battery.manufacturer, battery.model].filter(Boolean).join(" · ") || "Battery",
        kind: "battery" as const,
        href: componentHref(base, battery),
        imageSrc: componentImage(battery),
        proposed: battery.status !== "confirmed",
        incompatible: componentSuitabilityUnresolved(battery),
      }))),
      ...generators.flatMap((generator) => Array.from({ length: Math.max(1, generator.quantity) }, (_, index) => ({
        id: index ? `component:${generator.id}:unit-${index + 1}` : `component:${generator.id}`,
        label: generator.quantity > 1 ? `${generator.name} ${index + 1}` : generator.name,
        subtitle: [componentRating(generator), generator.manufacturer, generator.model].filter(Boolean).join(" · ") || "Generator input",
        kind: "generator" as const,
        href: componentHref(base, generator),
        imageSrc: componentImage(generator),
        proposed: generator.status !== "confirmed",
        incompatible: componentSuitabilityUnresolved(generator),
      }))),
      ...gridComponents.flatMap((grid) => Array.from({ length: Math.max(1, grid.quantity) }, (_, index) => ({
        id: index ? `component:${grid.id}:unit-${index + 1}` : `component:${grid.id}`,
        label: grid.quantity > 1 ? `${grid.name} ${index + 1}` : grid.name,
        subtitle:
          [grid.manufacturer, grid.model].filter(Boolean).join(" · ") ||
          "Grid / utility AC source",
        kind: "grid" as const,
        href: componentHref(base, grid),
        imageSrc: GRID_CONNECTION_IMAGE,
        proposed: grid.status !== "confirmed",
      }))),
      ...(upstreamAcName && !gridComponents.length
        ? [
            {
              id: "input:upstream-ac",
              label: upstreamAcName,
              subtitle: "Upstream AC / bypass supply",
              kind: "grid" as const,
              href: componentHref(base, acLinks[0]),
              imageSrc: `${imageBase}/automatic-transfer-switch-ats.jpg`,
            },
          ]
        : []),
    ];
    const inverterNodes: DiagramNode[] = inverters.map((inverter) => ({
          id: `component:${inverter.id}`,
          label: inverter.name,
          subtitle: [componentRating(inverter), text(inverter.specs["Role / purpose"]), inverter.manufacturer, inverter.model].filter(Boolean).join(" · ") || "Inverter / charger",
          kind: "inverter" as const,
          href: componentHref(base, inverter),
          imageSrc: componentImage(inverter),
          proposed: inverter.status !== "confirmed",
          incompatible: componentSuitabilityUnresolved(inverter),
        }));
    const outputNode = undefined as DiagramNode | undefined;
    const earthNode: DiagramNode | undefined = earth
      ? {
          id: `component:${earth.id}`,
          label: earth.name,
          subtitle: text(earth.specs["Main earth bar / electrode location"]) ?? "System bonding record",
          kind: "earth",
          href: componentHref(base, earth),
          imageSrc: EARTH_ELECTRODE_IMAGE,
        }
      : undefined;
    const accessoryNodes: DiagramNode[] = accessories.flatMap((component) => {
      const context = `${component.name} ${component.notes ?? ""} ${JSON.stringify(component.specs)}`.toLowerCase();
      const inlineDevice = ["isolator", "protection", "combiner"].includes(
        component.kind,
      );
      const placement = component.name.toLowerCase().includes("busbar")
        ? "busbar"
        : inlineDevice && /pv|solar|string|array|mppt/.test(context)
          ? "pv-inline"
          : inlineDevice && /battery|bank|bms/.test(context)
            ? "battery-inline"
            : "general";
      return Array.from({ length: Math.max(1, component.quantity) }, (_, index) => ({
        id: index ? `component:${component.id}:unit-${index + 1}` : `component:${component.id}`,
        label: component.quantity > 1 ? `${component.name} ${index + 1}` : component.name,
        subtitle: [componentRating(component), component.manufacturer, component.model].filter(Boolean).join(" · ") || component.kind,
        kind: "accessory",
        href: componentHref(base, component),
        imageSrc: componentImage(component),
        proposed: component.status !== "confirmed",
        incompatible: componentSuitabilityUnresolved(component),
        placement,
      }));
    });

    const upperLeft = sourceNodes.filter((node) => node.kind === "pv");
    const lowerLeft = sourceNodes.filter((node) => node.kind === "battery");
    const upperRight = sourceNodes.filter(
      (node) => node.kind === "generator" || node.kind === "grid",
    );
    const pvInlineNodes = accessoryNodes.filter(
      (node) => node.placement === "pv-inline",
    );
    const batteryInlineNodes = accessoryNodes.filter(
      (node) => node.placement === "battery-inline",
    );
    const busbarNodes = accessoryNodes.filter(
      (node) => node.placement === "busbar",
    );
    const rightAccessoryNodes = accessoryNodes.filter(
      (node) => node.placement === "general",
    );
    const leftUpperBottom = 55 + upperLeft.length * nodeStep;
    const batteryStart = Math.max(405, leftUpperBottom + 45);
    const inverterStart = Math.max(235, 235 + (inverterNodes.length - 1) * -35);
    const inverterY = new Map(
      inverterNodes.map((node, index) => [node.id, inverterStart + index * nodeStep]),
    );
    const outputY = Math.max(405, 55 + upperRight.length * nodeStep + 45);
    const contentBottom = Math.max(
      650,
      batteryStart + lowerLeft.length * nodeStep,
      55 + upperRight.length * nodeStep,
      outputY + nodeStep + rightAccessoryNodes.length * nodeStep,
      batteryStart + busbarNodes.length * nodeStep,
      55 + pvInlineNodes.length * nodeStep,
      batteryStart + batteryInlineNodes.length * nodeStep,
      inverterStart + inverterNodes.length * nodeStep,
    );
    const earthY = contentBottom + 35;
    const height = contentBottom + (earthNode ? 190 : 70);
    const positions = new Map<string, { x: number; y: number }>();
    upperLeft.forEach((node, index) =>
      positions.set(node.id, { x: columnX.source, y: 55 + index * nodeStep }),
    );
    lowerLeft.forEach((node, index) =>
      positions.set(node.id, {
        x: columnX.source,
        y: batteryStart + index * nodeStep,
      }),
    );
    upperRight.forEach((node, index) =>
      positions.set(node.id, { x: columnX.output, y: 55 + index * nodeStep }),
    );
    for (const node of inverterNodes)
      positions.set(node.id, { x: columnX.inverter, y: inverterY.get(node.id)! });
    if (outputNode) positions.set(outputNode.id, { x: columnX.output, y: outputY });
    busbarNodes.forEach((node, index) =>
      positions.set(node.id, {
        x: 270,
        y: batteryStart + index * nodeStep,
      }),
    );
    pvInlineNodes.forEach((node, index) =>
      positions.set(node.id, {
        x: 270,
        y: 55 + index * nodeStep,
      }),
    );
    batteryInlineNodes.forEach((node, index) =>
      positions.set(node.id, {
        x: 270,
        y: batteryStart + (busbarNodes.length + index) * nodeStep,
      }),
    );
    rightAccessoryNodes.forEach((node, index) =>
      positions.set(node.id, {
        x: columnX.output,
        y: outputY + nodeStep + index * nodeStep,
      }),
    );
    if (earthNode)
      positions.set(earthNode.id, { x: columnX.inverter, y: earthY });

    function inverterFor(label: string, specName: string) {
      if (inverters.length === 1) return inverterNodes[0];
      const normalized = label.toLowerCase();
      const match = inverters.find((inverter) =>
        String(inverter.specs[specName] ?? "").toLowerCase().includes(normalized),
      );
      return match
        ? inverterNodes.find((node) => node.id === `component:${match.id}`)
        : undefined;
    }

    const connections: ConnectionDetail[] = [];
    const claimedDirectPairs = new Set<string>();
    for (const inlineNode of [...pvInlineNodes, ...batteryInlineNodes]) {
      const component = project.components.find(
        (item) => inlineNode.id === `component:${item.id}`,
      );
      if (!component) continue;
      const connectionContext = [
        component.specs["Circuit / equipment isolated"],
        component.specs["Connected from / upstream device"],
        component.specs["Connected to / downstream device"],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const possibleSources =
        inlineNode.placement === "pv-inline" ? upperLeft : lowerLeft;
      const source = possibleSources.find((node) =>
        connectionContext.includes(node.label.toLowerCase()),
      );
      const target = inverterNodes.find((node) =>
        connectionContext.includes(node.label.toLowerCase()),
      );
      if (!source || !target) continue;
      claimedDirectPairs.add(`${source.id}:${target.id}`);
      const details = componentDetails([component]);
      connections.push(
        {
          id: `inline-in:${component.id}`,
          label: inlineNode.placement === "pv-inline" ? "PV DC" : "Battery DC",
          sourceId: source.id,
          targetId: inlineNode.id,
          values: details,
          editHref: componentHref(base, component),
          polarity: "pair",
          connectionType: "dc",
          unconfirmed: true,
        },
        {
          id: `inline-out:${component.id}`,
          label: inlineNode.placement === "pv-inline" ? "PV DC" : "Battery DC",
          sourceId: inlineNode.id,
          targetId: target.id,
          values: details,
          editHref: componentHref(base, component),
          polarity: "pair",
          connectionType: "dc",
          unconfirmed: true,
        },
      );
    }
    for (const array of project.pvArrays) {
      const target = inverterFor(array.name, "PV strings / MPPT inputs handled");
      if (target && !claimedDirectPairs.has(`pv:${array.id}:${target.id}`))
        connections.push({
          id: `pv-link:${array.id}`,
          label: pvConnectionLabel(array),
          sourceId: `pv:${array.id}`,
          targetId: target.id,
          values: pvDetails(array),
          editHref: `${base}/pv-strings/${array.id}`,
          connectionType: "dc",
          unconfirmed: true,
        });
    }
    for (const battery of batteries) {
      const target = inverterFor(battery.name, "Battery bank connected");
      if (target)
        connections.push({
          id: `battery-link:${battery.id}`,
          label: "Battery DC",
          sourceId: `component:${battery.id}`,
          targetId: target.id,
          values: componentDetails(batteryLinks),
          editHref: componentHref(base, batteryLinks[0]),
          unconfirmed: true,
          connectionType: "dc",
        });
    }
    for (const generator of generators) {
      const assigned =
        inverters.length === 1
          ? inverterNodes[0]
          : inverterNodes.find((node) => {
              const inverter = inverters.find(
                (item) => node.id === `component:${item.id}`,
              );
              return Boolean(text(inverter?.specs["Generator charging role / input"]));
            });
      if (assigned)
        connections.push({
          id: `generator-link:${generator.id}`,
          label: "Generator AC",
          sourceId: `component:${generator.id}`,
          targetId: assigned.id,
          values: componentDetails([generator]),
          editHref: componentHref(base, generator),
          connectionType: "ac",
          unconfirmed: true,
        });
    }
    if (upstreamAcName) {
      const assigned =
        inverters.length === 1
          ? inverterNodes[0]
          : inverterNodes.find((node) => {
              const inverter = inverters.find(
                (item) => node.id === `component:${item.id}`,
              );
              return Boolean(
                text(inverter?.specs["Generator charging role / input"]) ||
                  text(inverter?.specs["AC output / switchboard supplied"]),
              );
            });
      if (assigned)
        connections.push({
          id: "upstream-ac-link",
          label: "AC input",
          sourceId: "input:upstream-ac",
          targetId: assigned.id,
          values: componentDetails(acLinks),
          editHref: componentHref(base, acLinks[0]),
          connectionType: "ac",
          unconfirmed: true,
        });
    }
    const explicitConnections: ConnectionDetail[] = project.connections.map(
      (connection) => {
        const endpointNames = [connection.sourceRef, connection.targetRef]
          .map((reference) => {
            if (reference.startsWith("component:"))
              return project.components.find(
                (component) => `component:${component.id}` === reference,
              )?.name;
            if (reference.startsWith("pv:"))
              return project.pvArrays.find(
                (array) => `pv:${array.id}` === reference,
              )?.name;
            return reference;
          })
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const effectiveConnectionType = connection.connectionType === "dc" && /\bAC\b/i.test(`${connection.name} ${endpointNames}`)
          ? "ac"
          : connection.connectionType;
        const polarity =
          connection.polarity && connection.polarity !== "na"
            ? connection.polarity
            : endpointNames.includes("positive")
              ? "positive"
              : endpointNames.includes("negative")
                ? "negative"
                : effectiveConnectionType === "dc"
                  ? "pair"
                  : "na";
        return {
        id: connection.id,
        label: connection.name,
        sourceId: connection.sourceRef,
        targetId: connection.targetRef,
        values: [
          ["Connection", effectiveConnectionType.toUpperCase()],
          ["Polarity", polarity],
          ["Cable size", connection.cableSize ?? "Not recorded"],
          ["Cable length", connection.cableLength ?? "Not recorded"],
          ["Breaker", connection.breakerSize ?? "Not recorded"],
          ["Fuse", connection.fuseSize ?? "Not recorded"],
          ["Isolator", connection.isolator ?? "Not recorded"],
          ["Route", connection.route ?? "Not recorded"],
          ["Notes", connection.notes ?? "Not recorded"],
        ],
        polarity,
        connectionType: effectiveConnectionType,
        saved: { ...connection, connectionType: effectiveConnectionType },
        incompatible: hasUnresolvedSuitabilityIssue(connection.notes),
      };
      },
    );
    const unmatchedInferredConnections = removeCoveredInferredLinks(connections, explicitConnections);
    const firstConnectionGuide = project.connections.length
      ? undefined
      : unmatchedInferredConnections.find((connection) => connection.unconfirmed);
    return {
      sourceNodes,
      inverterNodes,
      outputNode,
      accessoryNodes,
      earthNode,
      positions,
      connections: [
        ...(firstConnectionGuide ? [firstConnectionGuide] : []),
        ...explicitConnections,
      ],
      height,
    };
  }, [base, project.components, project.connections, project.pvArrays, schematicReturn]);

  const visibleConnections = diagram.connections.filter((connection) =>
    connectionView === "all" || connection.connectionType === connectionView,
  );

  function openConnectionEditor(connection: ConnectionDetail) {
    if (connection.saved) {
      setSelected(connection);
      setDraftEnds(undefined);
      return;
    }
    const nodes = [
      ...diagram.sourceNodes,
      ...diagram.inverterNodes,
      ...(diagram.outputNode ? [diagram.outputNode] : []),
      ...diagram.accessoryNodes,
      ...(diagram.earthNode ? [diagram.earthNode] : []),
    ];
    const source = nodes.find((node) => node.id === connection.sourceId);
    const target = nodes.find((node) => node.id === connection.targetId);
    if (!source || !target) return;
    setSelected(undefined);
    setDraftEnds({ source, target });
    setEditorConnectionType(connection.connectionType ?? "dc");
    setError("");
  }

  const canvasWidth = Math.max(1100, canvasFrameWidth / canvasZoom);
  const horizontalExpansion = canvasWidth / 1100;

  const displayPositions = useMemo(() => {
    const positions = new Map(diagram.positions);
    for (const [nodeRef, position] of Object.entries(positionOverrides))
      positions.set(nodeRef, position);
    // When an existing record's quantity is increased, only unit 1 has the
    // original saved position. Place the new physical-unit cards beside that
    // anchor instead of leaving their generic defaults at the canvas edge.
    for (const nodeRef of positions.keys()) {
      const unit = nodeRef.match(/^(component:[^:]+):unit-(\d+)$/);
      if (!unit || Object.hasOwn(positionOverrides, nodeRef)) continue;
      const anchor = positions.get(unit[1]);
      if (!anchor) continue;
      const unitNumber = Number(unit[2]);
      const step = unitNumber - 1;
      const direction = step % 2 ? 1 : -1;
      const distance = Math.ceil(step / 2) * 130;
      positions.set(nodeRef, {
        x: Math.max(20, Math.min(980, anchor.x + direction * distance)),
        y: anchor.y,
      });
    }
    return new Map(Array.from(positions, ([nodeRef, position]) => [
      nodeRef,
      { x: position.x * horizontalExpansion, y: position.y },
    ]));
  }, [diagram.positions, horizontalExpansion, positionOverrides]);
  const canvasHeight = Math.max(
    diagram.height,
    ...Array.from(displayPositions.values()).map(
      (position) => position.y + nodeSize.height + 60,
    ),
  );

  async function moveNode(
    nodeRef: string,
    x: number,
    y: number,
  ) {
    const boundedX = Math.max(
      gridSize,
      Math.min(1100 - nodeSize.width - gridSize, x),
    );
    const boundedY = Math.max(gridSize, Math.min(3900, y));
    const position = {
      x: Math.round(boundedX / gridSize) * gridSize,
      y: Math.round(boundedY / gridSize) * gridSize,
    };
    setPositionOverrides((current) => ({ ...current, [nodeRef]: position }));
    setMovingNode(undefined);
    setLayoutMessage("Saving layout…");
    try {
      const response = await fetch("/api/schematic-positions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, nodeRef, ...position }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save position");
      setLayoutMessage("Layout saved");
    } catch (problem) {
      setLayoutMessage(
        problem instanceof Error ? problem.message : "Could not save layout",
      );
    }
  }

  function moveNodeFromPointer(node: DiagramNode, clientX: number, clientY: number, svg: SVGSVGElement) {
    const bounds = svg.getBoundingClientRect();
    void moveNode(
      node.id,
      ((clientX - bounds.left) * (canvasWidth / bounds.width) - nodeSize.width / 2) / horizontalExpansion,
      (clientY - bounds.top) * (canvasHeight / bounds.height) - nodeSize.height / 2,
    );
  }

  async function tidyLayout() {
    const positions = Array.from(diagram.positions.entries()).map(
      ([nodeRef, position]) => ({ nodeRef, ...position }),
    );
    setPositionOverrides(
      Object.fromEntries(
        positions.map((position) => [
          position.nodeRef,
          { x: position.x, y: position.y },
        ]),
      ),
    );
    setLayoutMessage("Saving tidy layout…");
    window.requestAnimationFrame(() => {
      canvasViewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    });
    try {
      const response = await fetch("/api/schematic-positions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, positions }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save layout");
      setLayoutMessage("Tidy layout saved");
    } catch (problem) {
      setLayoutMessage(
        problem instanceof Error ? problem.message : "Could not save layout",
      );
    }
  }

  function completeConnection(target: DiagramNode) {
    if (!connectingFrom || connectingFrom.id === target.id) {
      setConnectingFrom(undefined);
      if (connectingFrom?.id === target.id) setConnectionMode(false);
      return;
    }
    const existing = diagram.connections.find((connection) =>
      connection.saved && (
        connection.sourceId === connectingFrom.id && connection.targetId === target.id ||
        connection.sourceId === target.id && connection.targetId === connectingFrom.id
      ),
    );
    if (existing) {
      setSelected(existing);
      setDraftEnds(undefined);
      setConnectingFrom(undefined);
      setConnectionMode(false);
      setError("");
      return;
    }
    setDraftEnds({ source: connectingFrom, target });
    setConnectingFrom(undefined);
    setConnectionMode(false);
    setError("");
  }

  async function saveConnection(formData: FormData) {
    const existing = selected?.saved;
    if (!existing && !draftEnds) return;
    setSaving(true);
    setError("");
    const payload = {
      projectId: project.id,
      sourceRef: existing?.sourceRef ?? draftEnds?.source.id,
      targetRef: existing?.targetRef ?? draftEnds?.target.id,
      name: formData.get("name"),
      connectionType: formData.get("connectionType"),
      polarity: formData.get("polarity"),
      cableSize: formData.get("cableSize"),
      cableLength: formData.get("cableLength"),
      breakerSize: formData.get("breakerSize"),
      fuseSize: formData.get("fuseSize"),
      isolator: formData.get("isolator"),
      route: formData.get("route"),
      notes: formData.get("notes"),
    };
    try {
      const response = await fetch(
        existing ? `/api/connections/${existing.id}` : "/api/connections",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save connection");
      if (body.compatibilityWarning) {
        setError(`Saved with warning: ${body.compatibilityWarning}`);
        setSelected((current) => current?.saved ? {
          ...current,
          saved: {
            ...current.saved,
            name: String(payload.name ?? ""),
            connectionType: payload.connectionType as SystemConnection["connectionType"],
            polarity: payload.polarity as SystemConnection["polarity"],
            cableSize: String(payload.cableSize ?? ""),
            cableLength: String(payload.cableLength ?? ""),
            breakerSize: String(payload.breakerSize ?? ""),
            fuseSize: String(payload.fuseSize ?? ""),
            isolator: String(payload.isolator ?? ""),
            route: String(payload.route ?? ""),
            notes: body.connection?.notes ?? String(payload.notes ?? ""),
            confidence: "estimated",
          },
          incompatible: hasUnresolvedSuitabilityIssue(body.connection?.notes),
        } : current);
        router.refresh();
        return;
      }
      setSelected(undefined);
      setDraftEnds(undefined);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save connection");
    } finally {
      setSaving(false);
    }
  }

  async function removeConnection(connection: SystemConnection) {
    if (!window.confirm(`Remove ${connection.name}? The equipment cards will be kept.`))
      return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/connections/${connection.id}?projectId=${project.id}`,
        { method: "DELETE" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not remove connection");
      setSelected(undefined);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not remove connection");
    } finally {
      setSaving(false);
    }
  }

  const editorConnection = selected?.saved;
  const editorOpen = Boolean(editorConnection || draftEnds);
  const draftEndpointNames = `${draftEnds?.source.label ?? ""} ${draftEnds?.target.label ?? ""}`.toLowerCase();
  const defaultConnectionType =
    draftEnds?.source.kind === "earth" ||
    draftEnds?.target.kind === "earth" ||
    draftEndpointNames.includes("earth") ||
    draftEndpointNames.includes("ground")
      ? "earth"
      : draftEnds?.source.kind === "pv" || draftEnds?.source.kind === "battery"
      ? "dc"
      : "ac";
  const defaultConnectionName = draftEnds
    ? draftEnds.source.kind === "earth" || draftEnds.target.kind === "earth"
      ? "Earth / bonding"
      : draftEnds.source.kind === "battery"
      ? "Battery DC"
      : draftEnds.source.kind === "pv"
        ? "PV DC"
        : "Connection"
    : "Connection";
  const endpointNames = draftEndpointNames;
  const defaultPolarity = endpointNames.includes("positive")
    ? "positive"
    : endpointNames.includes("negative")
      ? "negative"
      : defaultConnectionType === "dc"
        ? "pair"
        : "na";
  const allNodes = [
    ...diagram.sourceNodes,
    ...diagram.inverterNodes,
    ...(diagram.outputNode ? [diagram.outputNode] : []),
    ...diagram.accessoryNodes,
    ...(diagram.earthNode ? [diagram.earthNode] : []),
  ];
  const sourceLabel =
    draftEnds?.source.label ??
    allNodes.find((node) => node.id === editorConnection?.sourceRef)?.label ??
    "Source";
  const targetLabel =
    draftEnds?.target.label ??
    allNodes.find((node) => node.id === editorConnection?.targetRef)?.label ??
    "Destination";
  const editorEndpointNames = `${sourceLabel} ${targetLabel}`.toLowerCase();
  const editorPolarity =
    editorConnection?.polarity && editorConnection.polarity !== "na"
      ? editorConnection.polarity
      : editorEndpointNames.includes("positive")
        ? "positive"
        : editorEndpointNames.includes("negative")
          ? "negative"
          : (editorConnection?.connectionType ?? defaultConnectionType) === "dc"
            ? "pair"
            : "na";

  useEffect(() => {
    if (editorOpen) setEditorConnectionType(editorConnection?.connectionType ?? defaultConnectionType);
  }, [defaultConnectionType, editorConnection?.connectionType, editorOpen]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="system-workspace-header sticky top-0 z-50 border-b border-line bg-white/98 shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:px-6">
          <Link href="/dashboard" className="shrink-0"><BrandLogo /></Link>
          <details className="relative hidden shrink-0 md:block"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold text-brand"><MapPin size={13}/><span className="max-w-32 truncate">{site.name}</span><ChevronDown size={13}/></summary><div className="absolute left-0 top-11 z-50 w-64 rounded-2xl border border-line bg-white p-3 shadow-xl"><div className="eyebrow px-2 pb-2">My Sites</div>{sites.map((item) => <Link key={item.id} href={`/sites/${item.id}`} className={`block rounded-xl px-3 py-2 text-[11px] font-bold ${item.id === site.id ? "bg-[#fff6cf] text-brand" : "text-muted hover:bg-[#eef3f8]"}`}>{item.name}</Link>)}</div></details>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary navigation"><Link href={`/dashboard?site=${site.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Dashboard</Link><Link href={`/systems?site=${site.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Systems</Link><Link href={`/how-to?site=${site.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">How to</Link><Link href={`/monitor?site=${site.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Monitor</Link><Link href={`/tools?site=${site.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Tools</Link><Link href={`/settings?site=${site.id}`} className="rounded-xl bg-[#f6c945] px-3 py-2 text-[11px] font-extrabold text-brand">Settings</Link></nav>
          <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="ml-auto grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted md:hidden" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen}>{mobileMenuOpen ? <X size={17}/> : <Menu size={18}/>}</button>
        </div>
        {mobileMenuOpen ? <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white p-3 md:hidden" aria-label="Mobile navigation"><div className="grid gap-1"><Link href={`/dashboard?site=${site.id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Dashboard</Link><Link href={`/systems?site=${site.id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Systems</Link><Link href={`/how-to?site=${site.id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">How to</Link><Link href={`/monitor?site=${site.id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Monitor</Link><Link href={`/tools?site=${site.id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Tools</Link><Link href={`/settings?site=${site.id}`} onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-[#f6c945] px-3 py-2.5 text-xs font-extrabold text-brand">Settings</Link></div></nav> : null}
      </header>
    <main className="schematic-mobile-main px-5 py-7 md:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/systems?site=${project.siteId}`} className="inline-flex items-center gap-2 text-xs font-bold text-brand">
            <ArrowLeft size={15} /> Back to systems
          </Link>
          <div className="hidden">
            <button
              type="button"
              onClick={() => void tidyLayout()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand"
            >
              <WandSparkles size={14} /> Tidy layout
            </button>
            <button
              type="button"
              onClick={() => setShowConnectionLabels((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand"
            >
              {showConnectionLabels ? <EyeOff size={14} /> : <Eye size={14} />}
              {showConnectionLabels ? "Hide labels" : "Show labels"}
            </button>
            <button
              type="button"
              onClick={() => setAdding((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-bold text-brand"
            >
              <Plus size={14} /> Add item
            </button>
            {adding && (
              <div className="absolute right-0 top-12 z-30 w-[min(92vw,500px)] rounded-2xl border border-line bg-white p-3 shadow-2xl">
                <div className="px-1 pb-3">
                  <div className="eyebrow">Component library</div>
                  <input
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Search pictures and equipment"
                    className="field mt-2"
                  />
                </div>
                <div className="thin-scrollbar grid max-h-[460px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {visibleAssets.map((asset) => (
                    <button
                      key={asset.fileName}
                      type="button"
                      onClick={() =>
                        router.push(
                          `${base}/equipment/new?type=${asset.type}&name=${encodeURIComponent(asset.label)}&image=${encodeURIComponent(asset.url)}&returnTo=${schematicReturn}`,
                        )
                      }
                      className="flex min-h-20 items-center gap-3 rounded-xl border border-line p-2 text-left text-[10px] font-bold hover:border-[#7aa6d1] hover:bg-[#eef3f8]"
                    >
                      <Image
                        src={asset.url}
                        alt=""
                        width={70}
                        height={56}
                        className="h-14 w-[70px] shrink-0 rounded-lg object-contain p-1"
                      />
                      <span className="line-clamp-3">{asset.label}</span>
                    </button>
                  ))}
                </div>
                {!visibleAssets.length && (
                  <p className="px-2 py-6 text-center text-xs text-muted">
                    No matching schematic pictures.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `${base}/equipment/new?type=other&name=Other%20equipment&returnTo=${schematicReturn}`,
                    )
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-xs font-bold text-brand"
                >
                  <Plus size={14} /> Add without a library picture
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="schematic-page-intro my-7">
          <div>
            <div className="eyebrow">Live system map</div>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">
              {project.name} schematic
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Select equipment to open its technical card. Select a connection label to inspect its cable, protection, isolation and routing record.
            </p>
          </div>
          {project.designCalculator?.proposedAsBuiltDraft && <p className="mt-3 max-w-3xl rounded-xl border border-[#8ab0d2] bg-[#f2f8fe] px-3 py-2 text-xs leading-5 text-[#143c63]"><strong>Planning draft available:</strong> the reviewed proposed schematic is saved as a reference. This as-built map still shows only equipment and connections you have confirmed.</p>}
          <p className="mt-2 text-xs font-semibold text-brand">
            Drag a card to arrange it. To connect equipment, select Connect items and tap the two cards; desktop users can also drag a blue + handle.
          </p>
          {layoutMessage && (
            <p className="mt-2 text-[10px] font-semibold text-muted">{layoutMessage}</p>
          )}
        </div>

        <section className="card overflow-hidden">
          <div className="schematic-canvas-toolbar flex items-center gap-2 overflow-x-auto border-b border-line bg-[#fff9df] px-3 py-2">
            <button type="button" onClick={askWhatsNext} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#f6c945] px-3 text-[10px] font-extrabold text-brand"><CircleHelp size={13}/>What&apos;s next?</button>
            <button type="button" onClick={() => setWattsonOpen(true)} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-[10px] font-bold text-white"><Zap size={13}/>Work on this with Wattson</button>
            <div className="relative flex shrink-0 items-center gap-1.5">
              <label className="sr-only" htmlFor="installed-schematic-connection-view">Show schematic connections</label>
              <select id="installed-schematic-connection-view" value={connectionView} onChange={(event) => setConnectionView(event.target.value as ConnectionView)} className="h-9 rounded-lg border border-line bg-white px-2.5 text-[10px] font-bold text-brand" aria-label="Show schematic connections"><option value="all">All connections</option><option value="ac">AC only</option><option value="dc">DC only</option><option value="data">Comms only</option><option value="earth">Earth only</option></select>
              <button type="button" onClick={() => void tidyLayout()} aria-label="Tidy schematic layout" title="Tidy layout" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand"><WandSparkles size={13}/><span className="schematic-tool-label">Tidy layout</span></button>
              <button type="button" onClick={() => setShowConnectionLabels((value) => !value)} aria-label={showConnectionLabels ? "Hide connection labels" : "Show connection labels"} title={showConnectionLabels ? "Hide labels" : "Show labels"} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand">{showConnectionLabels ? <EyeOff size={13}/> : <Eye size={13}/>}<span className="schematic-tool-label">{showConnectionLabels ? "Hide labels" : "Show labels"}</span></button>
              <button type="button" onClick={() => setAdding((value) => !value)} aria-label="Add schematic item" title="Add item" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand"><Plus size={13}/><span className="schematic-tool-label">Add item</span></button>
              <button type="button" onClick={() => { setConnectionMode((value) => !value); setConnectingFrom(undefined); }} aria-pressed={connectionMode} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold ${connectionMode ? "border-brand bg-brand text-white" : "border-line bg-white text-brand"}`}><Link2 size={13}/><span>{connectionMode ? "Cancel connect" : "Connect items"}</span></button>
              {adding && <div className="component-library-modal fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="component-library-title"><button type="button" className="absolute inset-0 bg-[#071b2d]/55 backdrop-blur-[2px]" onClick={() => setAdding(false)} aria-label="Close component library"/><div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-white text-left normal-case tracking-normal shadow-2xl sm:max-h-[min(86dvh,760px)]"><div className="shrink-0 border-b border-line p-3 sm:p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div id="component-library-title" className="eyebrow">Component library</div><input autoFocus value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search pictures and equipment" className="field mt-2"/></div><button type="button" onClick={() => setAdding(false)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-[#eef3f8]" aria-label="Close component library"><X size={16}/></button></div><div className="thin-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Component groups">{assetGroups.map((group) => <button key={group.id} type="button" onClick={() => setAssetGroup(group.id)} aria-pressed={assetGroup === group.id} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold ${assetGroup === group.id ? "border-brand bg-brand text-white" : "border-line bg-white text-brand hover:bg-[#eef3f8]"}`}>{group.label}</button>)}</div></div><div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-2 sm:p-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{visibleAssets.map((asset) => <button key={asset.fileName} type="button" onClick={() => router.push(`${base}/equipment/new?type=${asset.type}&name=${encodeURIComponent(asset.label)}&image=${encodeURIComponent(asset.url)}&returnTo=${schematicReturn}`)} className="flex min-h-20 items-center gap-3 rounded-xl border border-line p-2 text-left text-[10px] font-bold hover:border-[#7aa6d1] hover:bg-[#eef3f8]"><Image src={asset.url} alt="" width={70} height={56} className="h-14 w-[70px] shrink-0 rounded-lg object-contain p-1"/><span className="line-clamp-3">{asset.label}</span></button>)}</div>{!visibleAssets.length && <p className="px-2 py-6 text-center text-xs text-muted">No matching schematic pictures in this group.</p>}<button type="button" onClick={() => router.push(`${base}/equipment/new?type=other&name=Other%20equipment&returnTo=${schematicReturn}`)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-xs font-bold text-brand"><Plus size={14}/>Add without a library picture</button></div></div></div>}
            </div>
            <div className="schematic-zoom-controls flex shrink-0 items-center gap-1 border-l border-line pl-2"><span className="mr-1 text-[9px] font-bold text-muted">Zoom</span><button type="button" onClick={() => setCanvasZoom((value) => Math.max(.3, Number((value - .1).toFixed(2))))} className="grid size-8 place-items-center rounded-lg border border-line bg-white" aria-label="Zoom out">−</button><button type="button" onClick={() => setCanvasZoom(1)} className="h-8 min-w-12 rounded-lg border border-line bg-white px-2 text-[9px] font-bold" aria-label="Reset zoom">{Math.round(canvasZoom * 100)}%</button><button type="button" onClick={() => setCanvasZoom((value) => Math.min(1.4, Number((value + .1).toFixed(2))))} className="grid size-8 place-items-center rounded-lg border border-line bg-white" aria-label="Zoom in">+</button></div>
          </div>
          {connectionMode ? <div className="border-b border-[#e3c65a] bg-[#fff4bd] px-4 py-3 text-xs font-bold text-brand" role="status">{connectingFrom ? `Selected ${connectingFrom.label}. Tap the destination card.` : "Tap the first item you want to connect."}</div> : null}
          <div className="schematic-rotate-hint"><Smartphone size={30} aria-hidden/><div><strong>Rotate your phone to view the schematic</strong><span>Landscape gives the system map a clear postcard-sized canvas.</span></div></div>
          <div ref={canvasViewportRef} className="schematic-mobile-canvas-content thin-scrollbar overflow-auto touch-auto bg-[radial-gradient(circle_at_50%_35%,rgba(246,201,69,.16),transparent_19rem),linear-gradient(#f8fbfe,#f3f7fb)]">
            <svg
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              style={{ width: canvasWidth * canvasZoom, height: canvasHeight * canvasZoom }}
              role="img"
              aria-label={`${project.name} system connection schematic`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const nodeRef = event.dataTransfer.getData(
                  "text/pvintell-move-node",
                );
                if (!nodeRef || connectingFrom) return;
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                const scaleX = canvasWidth / bounds.width;
                const scaleY = canvasHeight / bounds.height;
                void moveNode(
                  nodeRef,
                  ((event.clientX - bounds.left) * scaleX - nodeSize.width / 2) / horizontalExpansion,
                  (event.clientY - bounds.top) * scaleY - nodeSize.height / 2,
                );
              }}
            >
              <defs>
                <pattern
                  id="schematic-grid"
                  width={gridSize}
                  height={gridSize}
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="0.8" fill="#b9c9d8" />
                </pattern>
                <marker id="schematic-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#2f80c1" />
                </marker>
              </defs>
              <rect
                width={canvasWidth}
                height={canvasHeight}
                fill="url(#schematic-grid)"
                opacity="0.42"
                pointerEvents="none"
              />
              {visibleConnections.map((connection) => {
                const parallel = visibleConnections.filter((candidate) => candidate.sourceId === connection.sourceId && candidate.targetId === connection.targetId);
                const parallelIndex = parallel.findIndex((candidate) => candidate.id === connection.id);
                const laneOffset = parallel.length > 1 ? (parallelIndex - (parallel.length - 1) / 2) * 22 : 0;
                return (
                <ConnectionPath
                  key={connection.id}
                  connection={connection}
                  positions={displayPositions}
                  onOpen={openConnectionEditor}
                  showLabel={showConnectionLabels || connection.unconfirmed === true}
                  laneOffset={laneOffset}
                />
                );
              })}
              {diagram.sourceNodes.map((node) => {
                const position = displayPositions.get(node.id)!;
                return <NodeCard key={node.id} node={node} {...position} connectingFrom={connectingFrom?.id} connectionMode={connectionMode} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />;
              })}
              {diagram.inverterNodes.map((node) => {
                const position = displayPositions.get(node.id)!;
                return <NodeCard key={node.id} node={node} {...position} connectingFrom={connectingFrom?.id} connectionMode={connectionMode} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />;
              })}
              {diagram.outputNode && <NodeCard node={diagram.outputNode} {...displayPositions.get(diagram.outputNode.id)!} connectingFrom={connectingFrom?.id} connectionMode={connectionMode} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />}
              {diagram.accessoryNodes.map((node) => {
                const position = displayPositions.get(node.id)!;
                return <NodeCard key={node.id} node={node} {...position} connectingFrom={connectingFrom?.id} connectionMode={connectionMode} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />;
              })}
              {diagram.earthNode && (
                <NodeCard node={diagram.earthNode} {...displayPositions.get(diagram.earthNode.id)!} connectingFrom={connectingFrom?.id} connectionMode={connectionMode} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />
              )}
            </svg>
          </div>
        </section>

        {!diagram.sourceNodes.length && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-[#e6cc74] bg-[#fff8df] p-4 text-xs">
            <CircleAlert className="shrink-0 text-[#8b6512]" size={18} />
            Add PV strings, batteries or a generator and Wattson will place them into this schematic automatically.
          </div>
        )}
      </div>

      {selected && !selected.saved && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b2740]/50 p-5 backdrop-blur-sm">
          <section className="card w-full max-w-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Connection record</div>
                <h2 className="mt-2 text-xl font-extrabold">{selected.label}</h2>
              </div>
              <button type="button" onClick={() => setSelected(undefined)} className="grid size-9 place-items-center rounded-xl hover:bg-[#eef3f8]">
                <X size={17} />
              </button>
            </div>
            {selected.unconfirmed && (
              <div className="mt-4 rounded-xl bg-[#fff8df] p-3 text-[10px] text-[#765c1c]">
                Some connection details are not confirmed in PVIntell. This does not prove that protection or cabling is absent.
              </div>
            )}
            <dl className="mt-5 divide-y divide-line rounded-2xl border border-line px-4">
              {selected.values.map(([name, value], index) => (
                <div key={`${name}:${index}`} className="grid grid-cols-[140px_1fr] gap-4 py-3 text-xs">
                  <dt className="text-muted">{name}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex gap-3">
              {selected.editHref && (
                <Link href={selected.editHref} className="grid h-11 flex-1 place-items-center rounded-xl bg-brand text-xs font-bold text-white">
                  Open connection record
                </Link>
              )}
              <Link href={`${base}?view=wattson`} className="grid h-11 flex-1 place-items-center rounded-xl border border-line bg-white text-xs font-bold text-brand">
                Ask Wattson
              </Link>
            </div>
          </section>
        </div>
      )}
      {editorOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0b2740]/50 p-5 backdrop-blur-sm">
          <form
            key={`${editorConnection?.id ?? "new"}:${editorConnection?.cableSize ?? ""}:${editorConnection?.confidence ?? ""}`}
            action={saveConnection}
            className="card my-6 w-full max-w-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">
                  {editorConnection ? "Edit connection" : "New connection"}
                </div>
                <h2 className="mt-2 text-xl font-extrabold">
                  {sourceLabel} → {targetLabel}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  This link keeps its own cable, protection and routing record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(undefined);
                  setDraftEnds(undefined);
                  setError("");
                }}
                className="grid size-9 place-items-center rounded-xl hover:bg-[#eef3f8]"
              >
                <X size={17} />
              </button>
            </div>
            {error && (
              <div className="mt-4 rounded-xl border border-[#e8b4aa] bg-[#fff0ed] p-3 text-xs text-[#9b4033]">
                {error}
              </div>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Connection name
                <input name="name" required defaultValue={editorConnection?.name ?? defaultConnectionName} className="field" />
              </label>
              <label className="text-xs font-bold">
                Type
                <select name="connectionType" value={editorConnectionType} onChange={(event) => setEditorConnectionType(event.target.value as SystemConnection["connectionType"])} className="field">
                  <option value="dc">DC power</option>
                  <option value="ac">AC power</option>
                  <option value="data">Data / communications</option>
                  <option value="earth">Earth / bonding</option>
                  <option value="other">Other</option>
                </select>
              </label>
              {editorConnectionType === "dc" && <label className="text-xs font-bold">
                DC polarity
                <select name="polarity" defaultValue={editorConnection ? editorPolarity : defaultPolarity} className="field">
                  <option value="pair">Positive + negative pair</option>
                  <option value="positive">Positive cable</option>
                  <option value="negative">Negative cable</option>
                  <option value="na">Not applicable / unspecified</option>
                </select>
              </label>}
              {editorConnectionType !== "dc" && <input type="hidden" name="polarity" value="na"/>}
              <label className="text-xs font-bold">
                Cable size
                <input name="cableSize" defaultValue={editorConnection?.cableSize} placeholder="e.g. 35 mm² or 6 mm² TPS" className="field" />
              </label>
              <label className="text-xs font-bold">
                Cable length
                <input name="cableLength" defaultValue={editorConnection?.cableLength} placeholder="e.g. 2.5 m" className="field" />
              </label>
              <label className="text-xs font-bold">
                Breaker size / type
                <input name="breakerSize" defaultValue={editorConnection?.breakerSize} placeholder="e.g. 125 A DC breaker" className="field" />
              </label>
              <label className="text-xs font-bold">
                Fuse size / type
                <input name="fuseSize" defaultValue={editorConnection?.fuseSize} placeholder="e.g. 150 A Class T" className="field" />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Isolator / shutoff
                <input name="isolator" defaultValue={editorConnection?.isolator} placeholder="Rating, poles and location" className="field" />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Cable route
                <input name="route" defaultValue={editorConnection?.route} placeholder="Where the cable runs and how it is protected" className="field" />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Notes
                <textarea name="notes" defaultValue={editorConnection?.notes} rows={3} className="field py-3" />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button disabled={saving} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white disabled:opacity-60">
                <Save size={15} /> {saving ? "Saving…" : "Save connection"}
              </button>
              {editorConnection && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void removeConnection(editorConnection)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e8b4aa] px-5 text-xs font-bold text-[#9b4033]"
                >
                  <Trash2 size={15} /> Remove link
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
      <SchematicWattsonChat project={project} initialConversationId={initialConversationId} initialMessages={initialMessages} open={wattsonOpen} onClose={() => setWattsonOpen(false)} guidanceRequest={guidanceRequest}/>
    </div>
  );
}
