import type { ComponentSpec, DesignCalculatorState, Project, PVArray, SystemConnection } from "../domain/models";

type ProposedDraft = NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>;
type ProposedNode = NonNullable<ProposedDraft["nodes"]>[number];
type ProposedConnection = NonNullable<ProposedDraft["connections"]>[number];

const generatedSource = "wattson design";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

function numberFrom(value: unknown) {
  const parsed = Number(typeof value === "string" ? value.match(/-?\d+(?:\.\d+)?/)?.[0] : value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isGeneratedProposalRecord(record: { specifications?: Record<string, string | number>; specs?: Record<string, string | number> }) {
  const specifications = record.specifications ?? record.specs ?? {};
  return text(specifications["Proposal source"]).toLowerCase() === generatedSource;
}

export function structuredProposalArrays(project: Project) {
  if (project.schematicOrigin !== "structured_proposal_intake") return [];
  return project.pvArrays.filter((array) => !isGeneratedProposalRecord(array));
}

export function structuredProposalComponents(project: Project) {
  if (project.schematicOrigin !== "structured_proposal_intake") return [];
  return project.components.filter((component) => !isGeneratedProposalRecord(component));
}

export function hasStructuredProposalEquipment(project: Project) {
  return structuredProposalArrays(project).length > 0 || structuredProposalComponents(project).length > 0;
}

function recordLabel(component: ComponentSpec) {
  const makeModel = [component.manufacturer, component.model].filter(Boolean).join(" ");
  return makeModel ? `${component.name} · ${makeModel}` : component.name;
}

function componentImage(kind: ComponentSpec["kind"]) {
  if (kind === "battery") return "/guides/battery/battery-cabinet.png";
  if (kind === "inverter") return "/schematic-components/hybrid-inverter.jpg";
  if (kind === "generator") return "/schematic-components/generator.jpg";
  if (kind === "charger") return "/schematic-components/mppt-charge-controller.jpg";
  if (kind === "protection") return "/schematic-components/ac-circuit-breaker-mcb.jpg";
  if (kind === "isolator") return "/schematic-components/dc-disconnect-isolator.jpg";
  if (kind === "combiner") return "/schematic-components/dc-combiner-box.jpg";
  if (kind === "meter" || kind === "monitoring") return "/schematic-components/energy-meter.jpg";
  return "/schematic-components/ac-distribution-board.jpg";
}

function candidateInverter(components: ComponentSpec[]) {
  return components.find((component) => component.kind === "inverter");
}

function arrayAssessment(array: PVArray, inverter?: ComponentSpec) {
  const messages: string[] = [];
  if (!array.panelCount || !array.panelWatts) messages.push("panel quantity or rating is incomplete");
  if (!array.manufacturer || !array.panelModel) messages.push("the exact panel product is not fully identified");
  const completeTopology = Boolean(array.strings && array.panelsPerString && array.panelCount && array.strings * array.panelsPerString === array.panelCount);
  if (!completeTopology) messages.push("the complete string layout still needs confirmation");

  const inverterMinimumV = numberFrom(inverter?.specs["MPPT minimum voltage"]);
  const inverterMaximumV = numberFrom(inverter?.specs["MPPT maximum voltage"] ?? inverter?.specs["Maximum PV voltage"]);
  const inverterMaximumA = numberFrom(inverter?.specs["Maximum PV input current"]);
  const stringPanels = array.panelsPerString;
  const stringVmp = stringPanels && array.maximumPowerVoltageV ? stringPanels * array.maximumPowerVoltageV : undefined;
  const stringVoc = stringPanels && array.openCircuitVoltageV ? stringPanels * array.openCircuitVoltageV : undefined;
  const stringCurrent = array.shortCircuitCurrentA ?? array.maximumPowerCurrentA;
  if (stringVmp && inverterMinimumV && stringVmp < inverterMinimumV) messages.push(`recorded string Vmp (${stringVmp.toFixed(0)} V) is below the selected inverter's stated MPPT minimum (${inverterMinimumV} V)`);
  if (stringVoc && inverterMaximumV && stringVoc > inverterMaximumV) messages.push(`recorded string Voc (${stringVoc.toFixed(0)} V) exceeds the selected inverter's stated maximum (${inverterMaximumV} V)`);
  if (stringCurrent && inverterMaximumA && stringCurrent > inverterMaximumA) messages.push(`recorded string current (${stringCurrent} A) exceeds the selected inverter's stated input limit (${inverterMaximumA} A)`);
  if (!messages.length && stringVmp && stringVoc && stringCurrent && inverterMinimumV && inverterMaximumV && inverterMaximumA) {
    return "Initial recorded-value check passed; cold-voltage, bifacial allowance, MPPT allocation and the exact product instructions still require verification.";
  }
  return messages.length
    ? `Assessment required: ${messages.join("; ")}.`
    : "Assessment required: panel electrical data and the selected inverter limits are not complete enough to validate this array.";
}

function componentAssessment(component: ComponentSpec, inverter?: ComponentSpec) {
  if (component.kind === "inverter") {
    const phaseNote = text(component.specs["AC output voltage"]);
    return `Assessment required: confirm the selected model, firmware-enabled phase arrangement, network approval and operating limits${phaseNote ? ` for its recorded ${phaseNote} output` : ""}.`;
  }
  if (component.kind === "battery") {
    const nominalVoltage = numberFrom(component.specs["Nominal battery voltage"] ?? component.specs["Nominal voltage"]);
    const minimumVoltage = numberFrom(inverter?.specs["Battery voltage minimum"]);
    const maximumVoltage = numberFrom(inverter?.specs["Battery voltage maximum"]);
    if (nominalVoltage && minimumVoltage && maximumVoltage && (nominalVoltage < minimumVoltage || nominalVoltage > maximumVoltage)) {
      return `Invalid recorded voltage match: ${nominalVoltage} V is outside the selected inverter's stated ${minimumVoltage}–${maximumVoltage} V battery range.`;
    }
    if (nominalVoltage && minimumVoltage && maximumVoltage) return `Initial voltage-range check passed (${nominalVoltage} V within ${minimumVoltage}–${maximumVoltage} V); exact model, quantity, BMS and firmware compatibility still require verification.`;
    return "Assessment required: confirm battery voltage, usable capacity, BMS and exact inverter compatibility.";
  }
  if (component.kind === "generator") return "Assessment required: confirm continuous/surge rating, voltage, phase, earthing and the approved inverter or changeover connection method.";
  return "Assessment required: confirm this proposed item's rating, role and compatibility before it is accepted for the design.";
}

function componentDetail(component: ComponentSpec, assessment: string) {
  const specifications = Object.entries(component.specs)
    .filter(([key]) => !["Proposal status", "Proposal source"].includes(key))
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${value}`);
  return [
    component.quantity > 1 ? `${component.quantity} proposed` : "1 proposed",
    component.manufacturer,
    component.model,
    ...specifications,
    assessment,
  ].filter(Boolean).join(" · ");
}

function arrayDetail(array: PVArray, assessment: string) {
  const product = [array.manufacturer, array.panelModel].filter(Boolean).join(" ");
  const topology = array.strings && array.panelsPerString
    ? `${array.strings} string${array.strings === 1 ? "" : "s"} × ${array.panelsPerString} panels`
    : array.strings ? `${array.strings} recorded string${array.strings === 1 ? "" : "s"}; panels per string pending` : "string layout pending";
  return [
    array.panelCount ? `${array.panelCount} × ${array.panelWatts ?? "?"} W` : "panel quantity pending",
    product,
    topology,
    array.cableLengthM ? `${array.cableLengthM} m recorded route` : undefined,
    assessment,
  ].filter(Boolean).join(" · ");
}

function parseCableSize(value?: string) {
  return numberFrom(value);
}

function connectionKind(connection: SystemConnection, componentByRef: Map<string, ComponentSpec>): ProposedConnection["kind"] {
  if (connection.connectionType === "earth") return "earth";
  if (connection.connectionType === "ac") return "ac";
  if (connection.circuitRole === "pv_dc" || connection.sourceRef.startsWith("pv:") || connection.targetRef.startsWith("pv:")) return "solar-dc";
  const source = componentByRef.get(connection.sourceRef);
  const target = componentByRef.get(connection.targetRef);
  return source?.kind === "battery" || target?.kind === "battery" || connection.circuitRole === "battery_dc" ? "battery-dc" : "ac";
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sourceFingerprint(arrays: PVArray[], components: ComponentSpec[], connections: SystemConnection[]) {
  return `structured-v1-${fnv1a(JSON.stringify({
    arrays: arrays.map((array) => [array.id, array.name, array.panelCount, array.panelWatts, array.strings, array.panelsPerString, array.manufacturer, array.panelModel, array.maximumPowerVoltageV, array.maximumPowerCurrentA, array.openCircuitVoltageV, array.shortCircuitCurrentA, array.cableLengthM, array.cableSizeMm2]),
    components: components.map((component) => [component.id, component.kind, component.name, component.manufacturer, component.model, component.quantity, component.specs, component.notes]),
    connections: connections.map((connection) => [connection.id, connection.sourceRef, connection.targetRef, connection.name, connection.connectionType, connection.circuitRole, connection.cableLength, connection.cableSize, connection.breakerSize, connection.fuseSize, connection.isolator, connection.notes]),
  }))}`;
}

export function structuredProposalDesignFacts(project: Project): Partial<DesignCalculatorState> | undefined {
  const arrays = structuredProposalArrays(project);
  const components = structuredProposalComponents(project);
  if (!arrays.length && !components.length) return undefined;
  const inverter = candidateInverter(components);
  const battery = components.find((component) => component.kind === "battery");
  const generator = components.find((component) => component.kind === "generator");
  const totalPanels = arrays.reduce((total, array) => total + (array.panelCount ?? 0), 0);
  const totalPvKw = arrays.reduce((total, array) => total + (array.panelCount ?? 0) * (array.panelWatts ?? 0) / 1000, 0);
  const topologyResolved = arrays.length > 0 && arrays.every((array) => array.panelCount && array.strings && array.panelsPerString && array.strings * array.panelsPerString === array.panelCount);
  const batteryNominalKwh = numberFrom(battery?.specs["Nominal energy"]);
  const batteryUsableFromNotes = numberFrom(battery?.notes?.match(/([\d.]+)\s*kWh\s*usable/i)?.[1]);
  const inverterType = text(inverter?.specs["Inverter type"]).toLowerCase();
  return {
    panelCount: totalPanels || undefined,
    targetPvKw: totalPvKw ? Number(totalPvKw.toFixed(3)) : undefined,
    panelProfileBasis: "user_equipment",
    pvArrayPlan: arrays.length ? {
      status: topologyResolved ? "resolved" : "topology_unresolved",
      configurationSource: "user",
      arrays: arrays.map((array) => {
        const resolved = Boolean(array.panelCount && array.strings && array.panelsPerString && array.strings * array.panelsPerString === array.panelCount);
        return {
          id: array.id,
          name: array.name,
          allocatedPanelCount: array.panelCount,
          mounting: text(array.specifications["Mounting option"]) || undefined,
          direction: array.orientationDegrees == null ? undefined : String(array.orientationDegrees),
          pitch: array.tiltDegrees == null ? undefined : String(array.tiltDegrees),
          topology: {
            kind: array.strings && array.strings > 1 ? "parallel" as const : "series" as const,
            status: resolved ? "resolved" as const : "pending_surface_allocation_and_equipment" as const,
            strings: resolved ? Array.from({ length: array.strings! }, (_, index) => ({ id: `${array.id}-string-${index + 1}`, panelsInSeries: array.panelsPerString! })) : [],
            combinerRequirement: !resolved ? "pending" as const : array.strings! > 1 ? "required" as const : "not_required" as const,
            reason: resolved ? "Recorded by the user; electrical limits still require assessment." : "The user-entered array is preserved, but its string topology is incomplete.",
          },
        };
      }),
    } : undefined,
    architecture: inverterType === "hybrid" ? "combined_hybrid_inverter" : undefined,
    inverterArrangement: inverter ? "combined" : undefined,
    inverterKw: numberFrom(inverter?.specs["Rated power"]),
    inverterPlan: undefined,
    batteryIncluded: Boolean(battery),
    batteryChemistry: text(battery?.specs["Battery type"] ?? battery?.specs["Chemistry / battery type"]) || undefined,
    batteryVoltage: numberFrom(battery?.specs["Nominal battery voltage"] ?? battery?.specs["Nominal voltage"]),
    batteryAh: numberFrom(battery?.specs["Rated capacity"] ?? battery?.specs.Capacity),
    batteryQuantity: battery?.quantity,
    batteryUsableKwh: battery ? batteryUsableFromNotes ?? (batteryNominalKwh ? Number((batteryNominalKwh * battery.quantity).toFixed(2)) : undefined) : undefined,
    generatorIncluded: Boolean(generator),
  };
}

export function createStructuredProposalDraft(project: Project, design: DesignCalculatorState, gridConnected: boolean): ProposedDraft | undefined {
  const arrays = structuredProposalArrays(project);
  const components = structuredProposalComponents(project);
  if (!arrays.length && !components.length) return undefined;
  const inverter = candidateInverter(components);
  const componentByRef = new Map(components.map((component) => [`component:${component.id}`, component]));
  const nodeByRecordRef = new Map<string, string>();
  const nodes: ProposedNode[] = [];

  arrays.forEach((array, index) => {
    const id = `solar-pv-${index + 1}`;
    const recordRef = `pv:${array.id}`;
    nodeByRecordRef.set(recordRef, id);
    nodes.push({
      id,
      label: array.name,
      detail: arrayDetail(array, arrayAssessment(array, inverter)),
      image: "/schematic-components/solar-panel-pv-module.jpg",
      x: 40,
      y: 30 + index * 145,
      recordRef,
      reviewed: false,
    });
  });

  const byKind = new Map<ComponentSpec["kind"], number>();
  components.forEach((component) => {
    const kindIndex = (byKind.get(component.kind) ?? 0) + 1;
    byKind.set(component.kind, kindIndex);
    const sameKindCount = components.filter((candidate) => candidate.kind === component.kind).length;
    const id = component.kind === "inverter" && sameKindCount === 1 ? "inverter"
      : component.kind === "battery" && sameKindCount === 1 ? "battery"
        : component.kind === "generator" && sameKindCount === 1 ? "generator"
          : `proposal-${component.kind}-${kindIndex}`;
    const recordRef = `component:${component.id}`;
    nodeByRecordRef.set(recordRef, id);
    const column = component.kind === "inverter" ? 560 : component.kind === "battery" ? 330 : component.kind === "generator" ? 330 : 730;
    const row = component.kind === "inverter" ? 200 + (kindIndex - 1) * 190 : component.kind === "battery" ? 650 + (kindIndex - 1) * 145 : component.kind === "generator" ? 820 + (kindIndex - 1) * 145 : 40 + (kindIndex - 1) * 145;
    nodes.push({
      id,
      label: recordLabel(component),
      detail: componentDetail(component, componentAssessment(component, inverter)),
      image: componentImage(component.kind),
      x: column,
      y: row,
      recordRef,
      reviewed: false,
    });
  });

  nodes.push(
    { id: "switchboard", label: "Building power board", detail: "Proposed AC connection point; board capacity, protection and phase arrangement require assessment.", image: "/schematic-components/ac-distribution-board.jpg", x: 920, y: 220 },
    { id: "earth", label: "Safety earth", detail: "Protective earthing and bonding arrangement to be verified for the selected Site and equipment.", image: "/schematic-components/earth-electrode.png", x: 1100, y: 430 },
  );

  const relevantConnections = project.connections.filter((connection) => nodeByRecordRef.has(connection.sourceRef) && nodeByRecordRef.has(connection.targetRef));
  const connections: ProposedConnection[] = relevantConnections.map((connection) => {
    const lengthM = numberFrom(connection.cableLength);
    const cableSizeMm2 = parseCableSize(connection.cableSize);
    const kind = connectionKind(connection, componentByRef);
    const sourceNode = nodeByRecordRef.get(connection.sourceRef)!;
    const targetNode = nodeByRecordRef.get(connection.targetRef)!;
    const sourceLabel = nodes.find((node) => node.id === sourceNode)?.label ?? "Source";
    const targetLabel = nodes.find((node) => node.id === targetNode)?.label ?? "destination";
    return {
      from: sourceNode,
      to: targetNode,
      label: connection.name && connection.name !== "Connection" ? `${sourceLabel} · ${connection.name}` : `${sourceLabel} to ${targetLabel}`,
      kind,
      lengthM,
      lengthBasis: lengthM ? "estimated" : undefined,
      cableSizeMm2,
      notes: [connection.notes, "User-entered candidate route; cable, protection and equipment limits still require validation."].filter(Boolean).join(" "),
      configured: Boolean(lengthM && cableSizeMm2 && (kind === "earth" || connection.breakerSize || connection.fuseSize || connection.isolator)),
    };
  });

  const inverterNodes = nodes.filter((node) => node.recordRef && componentByRef.get(node.recordRef)?.kind === "inverter");
  for (const node of inverterNodes) {
    if (!connections.some((connection) => connection.from === node.id && connection.to === "switchboard" && connection.kind === "ac")) {
      connections.push({ from: node.id, to: "switchboard", label: `${node.label} proposed AC output`, kind: "ac", notes: "Output cable, protection, phase allocation and board capacity require validation." });
    }
  }
  connections.push({ from: "switchboard", to: "earth", label: "Safety earth and bonding", kind: "earth", notes: "Final earthing arrangement requires Site-specific verification." });

  if (gridConnected) {
    nodes.push(
      { id: "grid-supply", label: "Public grid supply", detail: "Existing public supply; voltage, phase and network requirements must be confirmed for the Site.", image: "/schematic-components/grid-connection-v2.png", x: 560, y: 1010, authorityCheck: true },
      { id: "grid-changeover", label: "Grid connection and isolation", detail: "Candidate connection point only; applicable network, isolation and changeover requirements remain unverified.", image: "/schematic-components/automatic-transfer-switch-ats.jpg", x: 760, y: 1010, authorityCheck: true },
    );
    connections.push(
      { from: "grid-supply", to: "grid-changeover", label: "Public supply to isolation", kind: "ac", authorityCheck: true },
      { from: "grid-changeover", to: "switchboard", label: "Grid feed to building power board", kind: "ac", authorityCheck: true },
    );
  }

  const battery = components.find((component) => component.kind === "battery");
  const facts = structuredProposalDesignFacts(project) ?? {};
  return {
    sourceRecordFingerprint: sourceFingerprint(arrays, components, relevantConnections),
    createdAt: new Date().toISOString(),
    architecture: facts.architecture ?? design.architecture,
    flow: [
      arrays.length ? `${arrays.length} recorded PV array${arrays.length === 1 ? "" : "s"}` : undefined,
      inverter ? recordLabel(inverter) : "Power conversion to assess",
      battery ? recordLabel(battery) : undefined,
      components.some((component) => component.kind === "generator") ? "Generator candidate" : undefined,
      "Building power board",
      "Site loads",
    ].filter((value): value is string => Boolean(value)),
    nodes,
    connections,
    panelCount: facts.panelCount,
    batteryVoltage: facts.batteryVoltage,
    batteryAh: facts.batteryAh,
    batteryQuantity: facts.batteryQuantity,
    inverterKw: facts.inverterKw,
  };
}

export function reconcileStructuredProposalDraft(project: Project, design: DesignCalculatorState, gridConnected: boolean) {
  const rebuilt = createStructuredProposalDraft(project, design, gridConnected);
  if (!rebuilt) return undefined;
  const previous = design.proposedAsBuiltDraft;
  if (previous?.sourceRecordFingerprint === rebuilt.sourceRecordFingerprint) return previous;
  if (!previous) return rebuilt;
  const previousNodes = new Map((previous.nodes ?? []).map((node) => [node.recordRef ?? node.id, node]));
  const nodes = rebuilt.nodes?.map((node) => {
    const prior = previousNodes.get(node.recordRef ?? node.id);
    if (!prior) return node;
    return {
      ...node,
      x: prior.x,
      y: prior.y,
      reviewed: prior.reviewed,
      installed: prior.installed,
      installedRecordId: prior.installedRecordId,
    };
  });
  const previousConnections = new Map((previous.connections ?? []).map((connection) => [`${connection.from}:${connection.to}:${connection.kind}`, connection]));
  const connections = rebuilt.connections?.map((connection) => {
    const prior = previousConnections.get(`${connection.from}:${connection.to}:${connection.kind}`);
    if (!prior || prior.lengthM !== connection.lengthM || prior.cableSizeMm2 !== connection.cableSizeMm2) return connection;
    return { ...connection, configured: prior.configured, protectionAmps: prior.protectionAmps };
  });
  return { ...rebuilt, nodes, connections };
}
