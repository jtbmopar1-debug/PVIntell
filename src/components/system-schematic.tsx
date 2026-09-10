"use client";

import {
  ArrowLeft,
  BatteryCharging,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  Fuel,
  Home,
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
  ComponentSpec,
  Project,
  PVArray,
  Site,
  SystemConnection,
} from "@/domain/models";
import { BrandLogo } from "@/components/brand-logo";
import { allHowToGuides } from "@/components/pvintell-workspace";

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
};

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

const imageBase = "/schematic-components";

function componentImage(component: ComponentSpec) {
  const selectedImage = text(component.specs["Schematic image"]);
  if (selectedImage?.startsWith(`${imageBase}/`)) return selectedImage;
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
  if (component.kind === "meter") return `${imageBase}/energy-meter.jpg`;
  if (component.kind === "monitoring")
    return identity.includes("wifi")
      ? `${imageBase}/wifi-communication-module.jpg`
      : `${imageBase}/monitoring-device-data-logger.jpg`;
  if (identity.includes("busbar")) return `${imageBase}/busbar.jpg`;
  if (
    identity.includes("grid connection") ||
    identity.includes("utility supply") ||
    identity.includes("mains connection")
  )
    return `${imageBase}/grid-connection.svg`;
  if (
    identity.includes("earth electrode") ||
    identity.includes("earth peg") ||
    identity.includes("ground rod")
  )
    return `${imageBase}/earth-electrode.svg`;
  if (identity.includes("transfer") || identity.includes("changeover"))
    return `${imageBase}/automatic-transfer-switch-ats.jpg`;
  if (identity.includes("switchboard") || identity.includes("distribution"))
    return `${imageBase}/ac-distribution-board.jpg`;
  if (identity.includes("relay"))
    return `${imageBase}/smart-load-relay-controller.jpg`;
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
  onConnectionStart,
  onConnectionDrop,
  onMoveStart,
  onMoveEnd,
}: {
  node: DiagramNode;
  x: number;
  y: number;
  connectingFrom?: string;
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
        <span
          draggable
          title="Drag to another item to connect"
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "link";
            event.dataTransfer.setData("text/pvintell-node", node.id);
            onConnectionStart(node);
          }}
          className="absolute right-0 top-[66px] grid size-6 cursor-crosshair place-items-center rounded-full border-2 border-white bg-brand text-[11px] text-white shadow-md"
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
              className="h-full w-full object-cover"
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
}: {
  connection: ConnectionDetail;
  positions: Map<string, { x: number; y: number }>;
  onOpen: (connection: ConnectionDetail) => void;
  showLabel: boolean;
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
  const path = `M ${x1} ${y1} C ${x1 + direction * bend} ${y1}, ${x2 - direction * bend} ${y2}, ${x2} ${y2}`;
  const labelX = (x1 + x2) / 2 - 43;
  const labelY = (y1 + y2) / 2 - 13;
  const isAc =
    connection.saved?.connectionType === "ac" ||
    connection.label.toLowerCase().includes("ac");
  const isEarth =
    connection.saved?.connectionType === "earth" ||
    connection.label.toLowerCase().includes("earth") ||
    connection.label.toLowerCase().includes("bond");
  const polarity = connection.saved?.polarity ?? connection.polarity ?? "na";
  const stroke = connection.unconfirmed
    ? "#9aabbc"
    : polarity === "positive"
      ? "#d64343"
      : polarity === "negative"
        ? "#202a35"
    : isEarth
      ? "#2d8a57"
    : isAc
      ? "#d99b13"
      : "#2f80c1";
  return (
    <g>
      {polarity === "pair" && !connection.unconfirmed ? (
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
            className={`h-7 w-full rounded-full border bg-white px-2 text-[8px] font-extrabold shadow-sm ${connection.unconfirmed ? "border-dashed text-muted" : isAc ? "border-[#e4bd62] text-[#93630a]" : "border-[#8db4d8] text-brand"}`}
          >
            {connection.label}
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

export function SystemSchematic({
  project,
  site,
  sites,
  schematicAssets = [],
}: {
  project: Project;
  site: Site;
  sites: Site[];
  schematicAssets?: SchematicAsset[];
}) {
  const router = useRouter();
  async function askGuide(guide: (typeof allHowToGuides)[number], question: string, recentConversation: Array<{ role: "user" | "assistant"; content: string }>) {
    const response = await fetch("/api/wattson/guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question, siteId: site.id, guide, recentConversation, guideIndex: allHowToGuides.map(({ id, title, group, aliases }) => ({ id, title, group, aliases })) }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable"); return body;
  }
  const [selected, setSelected] = useState<ConnectionDetail>();
  const [connectingFrom, setConnectingFrom] = useState<DiagramNode>();
  const [draftEnds, setDraftEnds] = useState<{
    source: DiagramNode;
    target: DiagramNode;
  }>();
  const [adding, setAdding] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setMovingNode] = useState<DiagramNode>();
  const [layoutMessage, setLayoutMessage] = useState("");
  const [showConnectionLabels, setShowConnectionLabels] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const fit = () => {
      if (window.innerWidth < 768) setCanvasZoom(Math.max(.45, Math.min(1, viewport.clientWidth / 1100)));
    };
    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("orientationchange", fit);
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
  const visibleAssets = schematicAssets.filter((asset) =>
    asset.label.toLowerCase().includes(assetSearch.trim().toLowerCase()),
  );
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
        (!["cable", "connector"].includes(item.kind) ||
          text(item.specs["Schematic image"])?.startsWith(`${imageBase}/`)) &&
        item.id !== earth?.id &&
        !gridComponents.some((grid) => grid.id === item.id),
    );

    const sourceNodes: DiagramNode[] = [
      ...project.pvArrays.map((array) => ({
        id: `pv:${array.id}`,
        label: array.name,
        subtitle: `${array.panelCount ?? "?"} x ${array.panelWatts ?? "?"} W; ${pvArrangement(array)}`,
        kind: "pv" as const,
        href: `${base}/pv-strings/${array.id}`,
        imageSrc: `${imageBase}/solar-panel-pv-module.jpg`,
        proposed: array.confidence !== "confirmed",
      })),
      ...batteries.map((battery) => ({
        id: `component:${battery.id}`,
        label: battery.name,
        subtitle: [battery.manufacturer, battery.model].filter(Boolean).join(" · ") || "Battery bank",
        kind: "battery" as const,
        href: componentHref(base, battery),
        imageSrc: componentImage(battery),
        proposed: battery.status !== "confirmed",
      })),
      ...generators.map((generator) => ({
        id: `component:${generator.id}`,
        label: generator.name,
        subtitle: [generator.manufacturer, generator.model].filter(Boolean).join(" · ") || "Generator input",
        kind: "generator" as const,
        href: componentHref(base, generator),
        imageSrc: componentImage(generator),
        proposed: generator.status !== "confirmed",
      })),
      ...gridComponents.map((grid) => ({
        id: `component:${grid.id}`,
        label: grid.name,
        subtitle:
          [grid.manufacturer, grid.model].filter(Boolean).join(" · ") ||
          "Grid / utility AC source",
        kind: "grid" as const,
        href: componentHref(base, grid),
        imageSrc: `${imageBase}/grid-connection.svg`,
        proposed: grid.status !== "confirmed",
      })),
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
    const inverterNodes: DiagramNode[] = inverters.length
      ? inverters.map((inverter) => ({
          id: `component:${inverter.id}`,
          label: inverter.name,
          subtitle:
            text(inverter.specs["Role / purpose"]) ??
            text(
              [inverter.manufacturer, inverter.model]
                .filter(Boolean)
                .join(" · "),
            ) ??
            "Inverter / charger",
          kind: "inverter" as const,
          href: componentHref(base, inverter),
          imageSrc: componentImage(inverter),
          proposed: inverter.status !== "confirmed",
        }))
      : [
          {
            id: "inverter:unrecorded",
            label: "Inverter not recorded",
            subtitle: "Add the system inverter to complete this path",
            kind: "inverter" as const,
            href: `${base}/equipment/new?type=inverter&name=Inverter%201&returnTo=${schematicReturn}`,
          },
        ];
    const outputNode: DiagramNode = {
      id: "output:switchboard",
      label: "Switchboard and loads",
      subtitle: acLinks.length
        ? text(acLinks[0].specs["Destination switchboard / breaker panel"]) ?? "AC distribution"
        : "AC output connection not confirmed",
      kind: "output",
      href:
        componentHref(base, acLinks[0]) ??
        `${base}/equipment/new?type=other&name=${encodeURIComponent("Switchboard and loads")}&returnTo=${schematicReturn}`,
      imageSrc: `${imageBase}/ac-distribution-board.jpg`,
    };
    const earthNode: DiagramNode | undefined = earth
      ? {
          id: `component:${earth.id}`,
          label: earth.name,
          subtitle: text(earth.specs["Main earth bar / electrode location"]) ?? "System bonding record",
          kind: "earth",
          href: componentHref(base, earth),
          imageSrc: `${imageBase}/earth-electrode.svg`,
        }
      : undefined;
    const accessoryNodes: DiagramNode[] = accessories.map((component) => {
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
      return {
        id: `component:${component.id}`,
        label: component.name,
        subtitle:
          [component.manufacturer, component.model].filter(Boolean).join(" · ") ||
          component.kind,
        kind: "accessory",
        href: componentHref(base, component),
        imageSrc: componentImage(component),
        proposed: component.status !== "confirmed",
        placement,
      };
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
    positions.set(outputNode.id, { x: columnX.output, y: outputY });
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
        },
        {
          id: `inline-out:${component.id}`,
          label: inlineNode.placement === "pv-inline" ? "PV DC" : "Battery DC",
          sourceId: inlineNode.id,
          targetId: target.id,
          values: details,
          editHref: componentHref(base, component),
          polarity: "pair",
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
          unconfirmed: !batteryLinks.length,
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
        const polarity =
          connection.polarity && connection.polarity !== "na"
            ? connection.polarity
            : endpointNames.includes("positive")
              ? "positive"
              : endpointNames.includes("negative")
                ? "negative"
                : connection.connectionType === "dc"
                  ? "pair"
                  : "na";
        return {
        id: connection.id,
        label: connection.name,
        sourceId: connection.sourceRef,
        targetId: connection.targetRef,
        values: [
          ["Connection", connection.connectionType.toUpperCase()],
          ["Polarity", polarity],
          ["Cable size", connection.cableSize ?? "Not recorded"],
          ["Cable length", connection.cableLength ?? "Not recorded"],
          ["Breaker", connection.breakerSize ?? "Not recorded"],
          ["Fuse", connection.fuseSize ?? "Not recorded"],
          ["Isolator", connection.isolator ?? "Not recorded"],
          ["Route", connection.route ?? "Not recorded"],
          ["Notes", connection.notes ?? "Not recorded"],
        ],
        saved: connection,
        polarity,
      };
      },
    );
    const explicitPairs = new Set(
      explicitConnections.map(
        (connection) => `${connection.sourceId}:${connection.targetId}`,
      ),
    );
    return {
      sourceNodes,
      inverterNodes,
      outputNode,
      accessoryNodes,
      earthNode,
      positions,
      connections: [
        ...connections.filter(
          (connection) =>
            !explicitPairs.has(
              `${connection.sourceId}:${connection.targetId}`,
            ),
        ),
        ...explicitConnections,
      ],
      height,
    };
  }, [base, project.components, project.connections, project.pvArrays, schematicReturn]);

  const displayPositions = useMemo(() => {
    const positions = new Map(diagram.positions);
    for (const [nodeRef, position] of Object.entries(positionOverrides))
      positions.set(nodeRef, position);
    return positions;
  }, [diagram.positions, positionOverrides]);
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
      (clientX - bounds.left) * (1100 / bounds.width) - nodeSize.width / 2,
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
      return;
    }
    setDraftEnds({ source: connectingFrom, target });
    setConnectingFrom(undefined);
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
    diagram.outputNode,
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

  return (
    <div className="min-h-screen bg-canvas">
      <header className="system-workspace-header sticky top-0 z-50 border-b border-line bg-white/98 shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:px-6">
          <Link href="/dashboard" className="shrink-0"><BrandLogo /></Link>
          <Link href={`${base}?view=wattson`} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-brand px-4 text-[11px] font-extrabold text-white"><Zap size={18}/>Ask Wattson</Link>
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
                        className="h-14 w-[70px] shrink-0 rounded-lg object-cover"
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
          <div className="eyebrow">Live system map</div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">
            {project.name} schematic
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Select equipment to open its technical card. Select a connection label to inspect its cable, protection, isolation and routing record.
          </p>
          {project.designCalculator?.proposedAsBuiltDraft && <p className="mt-3 max-w-3xl rounded-xl border border-[#8ab0d2] bg-[#f2f8fe] px-3 py-2 text-xs leading-5 text-[#143c63]"><strong>Planning draft available:</strong> the reviewed proposed schematic is saved as a reference. This as-built map still shows only equipment and connections you have confirmed.</p>}
          <p className="mt-2 text-xs font-semibold text-brand">
            Drag a card to arrange the system; it snaps to the grid when dropped. Drag its blue + handle onto another item to create a saved connection.
          </p>
          {layoutMessage && (
            <p className="mt-2 text-[10px] font-semibold text-muted">{layoutMessage}</p>
          )}
        </div>

        <section className="card overflow-hidden">
          <div className="schematic-canvas-toolbar flex items-center gap-2 overflow-x-auto border-b border-line bg-[#fff9df] px-3 py-2">
            <div className="schematic-column-labels flex min-w-0 flex-1 items-center gap-5 text-[9px] font-bold uppercase tracking-[.1em] text-muted"><span>Sources and storage</span><span className="ml-auto hidden md:inline">Inverter / charger</span><span className="ml-auto hidden md:inline">AC distribution</span></div>
            <div className="relative flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => void tidyLayout()} aria-label="Tidy schematic layout" title="Tidy layout" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand"><WandSparkles size={13}/><span className="schematic-tool-label">Tidy layout</span></button>
              <button type="button" onClick={() => setShowConnectionLabels((value) => !value)} aria-label={showConnectionLabels ? "Hide connection labels" : "Show connection labels"} title={showConnectionLabels ? "Hide labels" : "Show labels"} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand">{showConnectionLabels ? <EyeOff size={13}/> : <Eye size={13}/>}<span className="schematic-tool-label">{showConnectionLabels ? "Hide labels" : "Show labels"}</span></button>
              <button type="button" onClick={() => setAdding((value) => !value)} aria-label="Add schematic item" title="Add item" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand"><Plus size={13}/><span className="schematic-tool-label">Add item</span></button>
              {adding && <div className="absolute right-0 top-11 z-30 w-[min(92vw,500px)] rounded-2xl border border-line bg-white p-3 text-left normal-case tracking-normal shadow-2xl"><div className="px-1 pb-3"><div className="eyebrow">Component library</div><input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search pictures and equipment" className="field mt-2"/></div><div className="thin-scrollbar grid max-h-[460px] grid-cols-2 gap-2 overflow-y-auto pr-1">{visibleAssets.map((asset) => <button key={asset.fileName} type="button" onClick={() => router.push(`${base}/equipment/new?type=${asset.type}&name=${encodeURIComponent(asset.label)}&image=${encodeURIComponent(asset.url)}&returnTo=${schematicReturn}`)} className="flex min-h-20 items-center gap-3 rounded-xl border border-line p-2 text-left text-[10px] font-bold hover:border-[#7aa6d1] hover:bg-[#eef3f8]"><Image src={asset.url} alt="" width={70} height={56} className="h-14 w-[70px] shrink-0 rounded-lg object-cover"/><span className="line-clamp-3">{asset.label}</span></button>)}</div>{!visibleAssets.length && <p className="px-2 py-6 text-center text-xs text-muted">No matching schematic pictures.</p>}<button type="button" onClick={() => router.push(`${base}/equipment/new?type=other&name=Other%20equipment&returnTo=${schematicReturn}`)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-xs font-bold text-brand"><Plus size={14}/>Add without a library picture</button></div>}
            </div>
            <div className="schematic-zoom-controls flex shrink-0 items-center gap-1 border-l border-line pl-2"><span className="mr-1 text-[9px] font-bold text-muted">Zoom</span><button type="button" onClick={() => setCanvasZoom((value) => Math.max(.45, Number((value - .1).toFixed(2))))} className="grid size-8 place-items-center rounded-lg border border-line bg-white" aria-label="Zoom out">−</button><button type="button" onClick={() => setCanvasZoom(1)} className="h-8 min-w-12 rounded-lg border border-line bg-white px-2 text-[9px] font-bold" aria-label="Reset zoom">{Math.round(canvasZoom * 100)}%</button><button type="button" onClick={() => setCanvasZoom((value) => Math.min(1.4, Number((value + .1).toFixed(2))))} className="grid size-8 place-items-center rounded-lg border border-line bg-white" aria-label="Zoom in">+</button></div>
          </div>
          <div className="schematic-rotate-hint"><Smartphone size={30} aria-hidden/><div><strong>Rotate your phone to view the schematic</strong><span>Landscape gives the system map a clear postcard-sized canvas.</span></div></div>
          <div ref={canvasViewportRef} className="schematic-mobile-canvas-content thin-scrollbar overflow-auto touch-pan-x bg-[radial-gradient(circle_at_50%_35%,rgba(246,201,69,.16),transparent_19rem),linear-gradient(#f8fbfe,#f3f7fb)]">
            <svg
              viewBox={`0 0 1100 ${canvasHeight}`}
              style={{ width: 1100 * canvasZoom, height: canvasHeight * canvasZoom }}
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
                const scaleX = 1100 / bounds.width;
                const scaleY = canvasHeight / bounds.height;
                void moveNode(
                  nodeRef,
                  (event.clientX - bounds.left) * scaleX - nodeSize.width / 2,
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
                width="1100"
                height={canvasHeight}
                fill="url(#schematic-grid)"
                opacity="0.42"
                pointerEvents="none"
              />
              {diagram.connections.map((connection) => (
                <ConnectionPath
                  key={connection.id}
                  connection={connection}
                  positions={displayPositions}
                  onOpen={setSelected}
                  showLabel={showConnectionLabels}
                />
              ))}
              {diagram.sourceNodes.map((node) => {
                const position = displayPositions.get(node.id)!;
                return <NodeCard key={node.id} node={node} {...position} connectingFrom={connectingFrom?.id} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />;
              })}
              {diagram.inverterNodes.map((node) => {
                const position = displayPositions.get(node.id)!;
                return <NodeCard key={node.id} node={node} {...position} connectingFrom={connectingFrom?.id} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />;
              })}
              <NodeCard node={diagram.outputNode} {...displayPositions.get(diagram.outputNode.id)!} connectingFrom={connectingFrom?.id} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />
              {diagram.accessoryNodes.map((node) => {
                const position = displayPositions.get(node.id)!;
                return <NodeCard key={node.id} node={node} {...position} connectingFrom={connectingFrom?.id} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />;
              })}
              {diagram.earthNode && (
                <NodeCard node={diagram.earthNode} {...displayPositions.get(diagram.earthNode.id)!} connectingFrom={connectingFrom?.id} onConnectionStart={setConnectingFrom} onConnectionDrop={completeConnection} onMoveStart={setMovingNode} onMoveEnd={moveNodeFromPointer} />
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
                <select name="connectionType" defaultValue={editorConnection?.connectionType ?? defaultConnectionType} className="field">
                  <option value="dc">DC power</option>
                  <option value="ac">AC power</option>
                  <option value="data">Data / communications</option>
                  <option value="earth">Earth / bonding</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                DC polarity
                <select name="polarity" defaultValue={editorConnection ? editorPolarity : defaultPolarity} className="field">
                  <option value="pair">Positive + negative pair</option>
                  <option value="positive">Positive cable</option>
                  <option value="negative">Negative cable</option>
                  <option value="na">Not applicable / unspecified</option>
                </select>
              </label>
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
    </div>
  );
}
