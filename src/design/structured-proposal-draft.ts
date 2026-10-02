import type { ComponentSpec, DesignCalculatorState, Project, PVArray, SystemConnection } from "../domain/models";
import { defaultProposalPanel } from "./candidate-panel";
import { provisionalArrayTopology } from "./pv-array-plan";

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

function powerKwFrom(value: unknown) {
  const raw = text(value).toLowerCase();
  const rating = numberFrom(value);
  if (rating === undefined) return undefined;
  if (/\bkw\b/.test(raw)) return rating;
  if (/\bw\b/.test(raw)) return Number((rating / 1000).toFixed(3));
  return rating;
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
  return `structured-v2-${fnv1a(JSON.stringify({
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
  const batteryNominalKwh = numberFrom(battery?.specs["Nominal energy"]);
  const batteryUsableFromNotes = numberFrom(battery?.notes?.match(/([\d.]+)\s*kWh\s*usable/i)?.[1]);
  const inverterType = text(inverter?.specs["Inverter type"]).toLowerCase();
  let nextMppt = 1;
  const plannedArrays = arrays.map((array) => {
    const resolved = Boolean(array.panelCount && array.strings && array.panelsPerString && array.strings * array.panelsPerString === array.panelCount);
    const hasRecordedElectrical = Boolean(array.panelWatts && array.maximumPowerVoltageV && array.openCircuitVoltageV && array.maximumPowerCurrentA && array.shortCircuitCurrentA);
    const electrical = {
      watts: array.panelWatts ?? defaultProposalPanel.watts,
      vmpV: array.maximumPowerVoltageV ?? defaultProposalPanel.vmpV,
      vocV: array.openCircuitVoltageV ?? defaultProposalPanel.vocV,
      impA: array.maximumPowerCurrentA ?? defaultProposalPanel.impA,
      iscA: array.shortCircuitCurrentA ?? defaultProposalPanel.iscA,
      electricalBasis: hasRecordedElectrical ? "recorded" as const : "representative" as const,
    };
    const suggested = provisionalArrayTopology(array.panelCount ?? 0, electrical, array.id, nextMppt);
    const topology = resolved ? {
      kind: array.strings! > 1 ? "series_parallel" as const : "series" as const,
      status: "resolved" as const,
      strings: Array.from({ length: array.strings! }, (_, index) => ({
        id: `${array.id}-string-${index + 1}`,
        panelsInSeries: array.panelsPerString!,
        mpptInput: `MPPT ${nextMppt + index}`,
      })),
      combinerRequirement: "not_required" as const,
      reason: "Recorded by the user and provisionally assigned to independent MPPT inputs; verify the selected inverter's documented input limits.",
    } : suggested.topology;
    nextMppt += topology.strings.length;
    return {
      id: array.id,
      name: array.name,
      allocatedPanelCount: array.panelCount,
      panelWatts: suggested.panelWatts,
      panelVmpV: suggested.panelVmpV,
      panelVocV: suggested.panelVocV,
      panelImpA: suggested.panelImpA,
      panelIscA: suggested.panelIscA,
      panelElectricalBasis: suggested.panelElectricalBasis,
      mounting: text(array.specifications["Mounting option"]) || undefined,
      direction: array.orientationDegrees == null ? undefined : String(array.orientationDegrees),
      pitch: array.tiltDegrees == null ? undefined : String(array.tiltDegrees),
      topology,
    };
  });
  const requiredMpptInputs = plannedArrays.reduce((total, array) => total + array.topology.strings.length, 0);
  const recordedMpptInputs = numberFrom(inverter?.specs["MPPT count"] ?? inverter?.specs["Number of MPPTs"]);
  const inverterMinimumV = numberFrom(inverter?.specs["MPPT minimum voltage"]);
  const inverterMaximumV = numberFrom(inverter?.specs["MPPT maximum voltage"] ?? inverter?.specs["Maximum PV voltage"]);
  const inverterMaximumA = numberFrom(inverter?.specs["Maximum PV input current"]);
  const compatibilityWarnings = [
    requiredMpptInputs && recordedMpptInputs && requiredMpptInputs > recordedMpptInputs
      ? `The provisional design needs ${requiredMpptInputs} independent MPPT inputs, but the recorded inverter lists ${recordedMpptInputs}. Reallocate compatible equal strings only where the inverter instructions permit it, add suitable conversion equipment, or select an inverter with enough inputs.`
      : requiredMpptInputs
        ? `${requiredMpptInputs} independent MPPT input${requiredMpptInputs === 1 ? " is" : "s are"} provisionally required; confirm that count on the selected inverter.`
        : undefined,
    ...plannedArrays.flatMap((array) => array.topology.strings.flatMap((string) => {
      const vmp = string.panelsInSeries * Number(array.panelVmpV ?? 0);
      const voc = string.panelsInSeries * Number(array.panelVocV ?? 0);
      return [
        inverterMinimumV && vmp && vmp < inverterMinimumV ? `${array.name} ${string.id} has provisional Vmp ${vmp.toFixed(1)} V, below the recorded inverter MPPT minimum of ${inverterMinimumV} V.` : undefined,
        inverterMaximumV && voc && voc > inverterMaximumV ? `${array.name} ${string.id} has nameplate Voc ${voc.toFixed(1)} V, above the recorded inverter maximum of ${inverterMaximumV} V before cold correction.` : undefined,
        inverterMaximumA && array.panelIscA && array.panelIscA > inverterMaximumA ? `${array.name} has module Isc ${array.panelIscA} A, above the recorded inverter input limit of ${inverterMaximumA} A.` : undefined,
      ];
    })),
  ].filter((warning): warning is string => Boolean(warning));
  return {
    panelCount: totalPanels || undefined,
    targetPvKw: totalPvKw ? Number(totalPvKw.toFixed(3)) : undefined,
    recordedPvCapacityKw: totalPvKw ? Number(totalPvKw.toFixed(3)) : undefined,
    panelProfileBasis: "user_equipment",
    sizingWarnings: compatibilityWarnings,
    pvArrayPlan: arrays.length ? {
      status: arrays.every((array) => Boolean(array.panelCount)) ? "resolved" : "topology_unresolved",
      configurationSource: "user",
      arrays: plannedArrays,
    } : undefined,
    architecture: inverterType === "hybrid" ? "combined_hybrid_inverter" : undefined,
    inverterArrangement: inverter ? "combined" : undefined,
    inverterKw: powerKwFrom(inverter?.specs["Rated power"]),
    recordedInverterCapacityKw: powerKwFrom(inverter?.specs["Rated power"]),
    inverterPlan: undefined,
    batteryIncluded: Boolean(battery),
    batteryChemistry: text(battery?.specs["Battery type"] ?? battery?.specs["Chemistry / battery type"]) || undefined,
    batteryVoltage: numberFrom(battery?.specs["Nominal battery voltage"] ?? battery?.specs["Nominal voltage"]),
    batteryAh: numberFrom(battery?.specs["Rated capacity"] ?? battery?.specs.Capacity),
    batteryQuantity: battery?.quantity,
    batteryUsableKwh: battery ? batteryUsableFromNotes ?? (batteryNominalKwh ? Number((batteryNominalKwh * battery.quantity).toFixed(2)) : undefined) : undefined,
    recordedBatteryUsableKwh: battery ? batteryUsableFromNotes ?? (batteryNominalKwh ? Number((batteryNominalKwh * battery.quantity).toFixed(2)) : undefined) : undefined,
    generatorIncluded: Boolean(generator),
    generatorContinuousKw: powerKwFrom(generator?.specs["Rated power"]),
    recordedGeneratorContinuousKw: powerKwFrom(generator?.specs["Rated power"]),
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

  const supplementaryPvKw = Number(design.existingPanelGroup?.supplementaryTargetPvKw ?? 0);
  const recordedMpptCount = numberFrom(inverter?.specs["MPPT count"] ?? inverter?.specs["Number of MPPTs"]);
  const usedMpptCount = arrays.reduce((total, array) => total + Math.max(1, array.strings ?? 1), 0);
  const spareMpptCount = recordedMpptCount ? Math.max(0, recordedMpptCount - usedMpptCount) : 0;
  const recordedPanelWatts = [...new Set(arrays.map((array) => array.panelWatts).filter((watts): watts is number => Boolean(watts)))];
  const planningPanelWatts = recordedPanelWatts.length === 1 ? recordedPanelWatts[0] : undefined;
  const supplementaryPartCount = supplementaryPvKw > 0 ? Math.max(1, spareMpptCount) : 0;
  const provisionalPanelsPerPart = planningPanelWatts ? Math.max(1, Math.floor(supplementaryPvKw * 1000 / supplementaryPartCount / planningPanelWatts)) : undefined;
  const supplementaryPartKw = provisionalPanelsPerPart && planningPanelWatts
    ? provisionalPanelsPerPart * planningPanelWatts / 1000
    : supplementaryPvKw / Math.max(1, supplementaryPartCount);
  const supplementaryArrayNodeIds = Array.from({ length: supplementaryPartCount }, (_, index) => `supplementary-solar-array-${index + 1}`);
  supplementaryArrayNodeIds.forEach((id, index) => nodes.push({
    id,
    label: spareMpptCount > 0 ? supplementaryPartCount > 1 ? `Additional solar array ${index + 1}` : "Additional solar array" : "Extra solar not yet allocated",
    detail: !recordedMpptCount
      ? `Up to ${supplementaryPvKw.toFixed(2)} kW is being considered, but the inverter's number of solar inputs has not been recorded. Add that information before splitting or connecting extra arrays.`
      : spareMpptCount === 0
        ? `Up to ${supplementaryPvKw.toFixed(2)} kW is being considered, but no spare inverter solar input is currently shown. Review the recorded strings and inverter details before adding panels.`
        : gridConnected
      ? `${provisionalPanelsPerPart && planningPanelWatts ? `A provisional ${provisionalPanelsPerPart} × ${planningPanelWatts} W (${supplementaryPartKw.toFixed(2)} kW) option` : `About ${supplementaryPartKw.toFixed(2)} kW`} for spare solar input ${index + 1}. This helps solar cover more yearly use, but it is optional because the grid supplies the rest. Check the panel electrical details and available mounting area before accepting it.`
      : `${provisionalPanelsPerPart && planningPanelWatts ? `A provisional ${provisionalPanelsPerPart} × ${planningPanelWatts} W (${supplementaryPartKw.toFixed(2)} kW) option` : `About ${supplementaryPartKw.toFixed(2)} kW`} for solar input ${index + 1}. Check the panel electrical details, available mounting area and least-sunny-season performance before accepting it.`,
    image: "/schematic-components/solar-panel-pv-module.jpg",
    x: 40,
    y: 30 + (arrays.length + index) * 145,
    reviewed: false,
    introduced: true,
    introductionReason: gridConnected
      ? "Optional extra panels to help solar cover more of the estimated yearly use. They are not required because the grid can supply the rest."
      : "Extra panels suggested to help supply enough energy through the least-sunny part of the year.",
  }));

  const recordedShade = text(project.designDiscovery?.shading?.value).toLowerCase();
  if (["some", "significant", "fairly_consistent", "consistent"].includes(recordedShade)) nodes.push({
    id: "shade-optimiser-option",
    label: "Panel optimisers to compare",
    detail: "Shade has been recorded. First see whether panels can be moved out of the shade. If shade will still fall across panels in the same string, compare compatible panel optimisers or microinverters. They can reduce losses between unevenly shaded panels, but they cannot replace missing sunlight.",
    image: "/schematic-components/dc-optimisers.svg",
    x: 285,
    y: 30 + (arrays.length + supplementaryPartCount) * 145,
    reviewed: false,
    introduced: true,
    introductionReason: "Optional shade-management equipment to compare because shade was recorded during discovery.",
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
    const missingSolarInputDetails = component.kind === "inverter" ? [
      numberFrom(component.specs["MPPT count"] ?? component.specs["Number of MPPTs"]) ? undefined : "number of solar inputs",
      numberFrom(component.specs["MPPT minimum voltage"]) ? undefined : "minimum input voltage",
      numberFrom(component.specs["MPPT maximum voltage"] ?? component.specs["Maximum PV voltage"]) ? undefined : "maximum input voltage",
      numberFrom(component.specs["Maximum PV input current"]) ? undefined : "maximum input current",
      powerKwFrom(component.specs["Maximum PV input power"] ?? component.specs["Maximum recommended PV power"]) ? undefined : "maximum total panel power",
    ].filter((value): value is string => Boolean(value)) : [];
    const column = component.kind === "inverter" ? 560 : component.kind === "battery" ? 330 : component.kind === "generator" ? 330 : 730;
    const row = component.kind === "inverter" ? 200 + (kindIndex - 1) * 190 : component.kind === "battery" ? 650 + (kindIndex - 1) * 145 : component.kind === "generator" ? 820 + (kindIndex - 1) * 145 : 40 + (kindIndex - 1) * 145;
    nodes.push({
      id,
      label: recordLabel(component),
      detail: `${componentDetail(component, componentAssessment(component, inverter))}${missingSolarInputDetails.length ? ` User check: add the inverter's ${missingSolarInputDetails.join(", ")} from its datasheet before accepting extra panels.` : ""}`,
      image: componentImage(component.kind),
      x: column,
      y: row,
      recordRef,
      reviewed: false,
      introduced: text(component.specs["Planning unit source"]).toLowerCase() === "wattson inverter plan",
      introductionReason: text(component.specs["Planning unit source"]).toLowerCase() === "wattson inverter plan"
        ? "Added by Wattson after the user accepted a multi-inverter arrangement."
        : undefined,
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

  const inverterNode = inverter ? nodeByRecordRef.get(`component:${inverter.id}`) : undefined;
  const connected = (nodeId: string, kind: ProposedConnection["kind"]) => connections.some((connection) =>
    connection.kind === kind && (connection.from === nodeId || connection.to === nodeId));
  if (inverterNode) {
    for (const array of arrays) {
      const arrayNode = nodeByRecordRef.get(`pv:${array.id}`);
      if (arrayNode && !connected(arrayNode, "solar-dc")) connections.push({
        from: arrayNode,
        to: inverterNode,
        label: `${array.name} proposed PV DC input`,
        kind: "solar-dc",
        notes: "Candidate PV-to-inverter route. Confirm string allocation, MPPT limits, isolation, protection and cable sizing before installation.",
      });
    }
    for (const battery of components.filter((component) => component.kind === "battery")) {
      const batteryNode = nodeByRecordRef.get(`component:${battery.id}`);
      if (batteryNode && !connected(batteryNode, "battery-dc")) connections.push({
        from: batteryNode,
        to: inverterNode,
        label: `${battery.name} proposed battery DC connection`,
        kind: "battery-dc",
        notes: "Candidate battery-to-inverter route. Confirm BMS communications, voltage/current limits, isolation, protection and cable sizing before installation.",
      });
    }
    if (spareMpptCount > 0) supplementaryArrayNodeIds.forEach((nodeId, index) => connections.push({
      from: nodeId,
      to: inverterNode,
      label: `Additional array ${index + 1} proposed solar input`,
      kind: "solar-dc",
      notes: "This option has not been accepted. Check the panel details, mounting area, string layout and inverter input limits before adding it to the equipment list.",
      configured: false,
    }));
  }

  const generators = components.filter((component) => component.kind === "generator");
  const inverterType = text(inverter?.specs["Inverter type"]).toLowerCase();
  const generatorMethod = text(design.generatorConnectionMethod);
  const generatorTarget = generatorMethod === "inverter_input"
    ? inverterNode ?? "switchboard"
    : !generatorMethod && inverterNode && /hybrid|off[ -]?grid|inverter[ -]?charger/.test(inverterType)
      ? inverterNode
      : "switchboard";
  generators.forEach((generator, index) => {
    const generatorNode = nodeByRecordRef.get(`component:${generator.id}`);
    if (!generatorNode || connected(generatorNode, "ac")) return;
    if (!generatorMethod) {
      connections.push({
        from: generatorNode,
        to: generatorTarget,
        label: "Generator connection method to confirm",
        kind: "ac",
        notes: "Confirm whether the generator feeds an approved inverter input or the switchboard; isolation, protection and any source-transfer requirements follow that choice and local rules.",
        configured: false,
        provisionalInterface: true,
      });
      return;
    }
    const interfaceId = generators.length === 1 ? "generator-changeover" : `generator-changeover-${index + 1}`;
    const inverterInput = generatorMethod === "inverter_input";
    nodes.push({
      id: interfaceId,
      label: inverterInput ? "Generator AC input breaker" : generatorMethod === "ats" ? "Automatic source transfer" : generatorMethod === "changeover" ? "Generator inlet and manual changeover" : "Generator isolation and protection",
      detail: inverterInput
        ? "Candidate protected generator input; the selected inverter must explicitly support the generator voltage, phase, frequency, transfer and start/control arrangement."
        : "Candidate protected changeover connection; isolation, interlocking, neutral/earth arrangement and local requirements must be confirmed.",
      image: inverterInput ? "/schematic-components/generator-ac-input-breaker-v2.png" : generatorMethod === "ats" ? "/schematic-components/automatic-transfer-switch-ats.jpg" : generatorMethod === "changeover" || generatorMethod === "portable_inlet" ? "/schematic-components/generator-inlet-box.jpg" : "/schematic-components/ac-circuit-breaker-mcb.jpg",
      x: 560,
      y: 820 + index * 145,
    });
    connections.push(
      { from: generatorNode, to: interfaceId, label: `${generator.name} proposed AC supply`, kind: "ac", notes: "Candidate generator supply route; confirm continuous/surge rating, voltage, phase, frequency and protection." },
      { from: interfaceId, to: generatorTarget, label: "Protected generator input", kind: "ac", notes: "Connection method is provisional until the exact inverter or changeover instructions and Site requirements are verified." },
    );
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
      rejected: prior.rejected,
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
