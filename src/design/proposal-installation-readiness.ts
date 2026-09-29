type ProposalNode = {
  id?: string;
  label?: string;
  recordRef?: string;
  reviewed?: boolean;
  authorityCheck?: boolean;
};

type ProposalConnection = {
  from?: string;
  to?: string;
  label?: string;
  kind?: "solar-dc" | "battery-dc" | "ac" | "earth";
  configured?: boolean;
  authorityCheck?: boolean;
};

type PersistedConnection = {
  sourceRef: string;
  targetRef: string;
  connectionType: string;
};

export type ProposalTopologyRecords = {
  componentIds: string[];
  pvArrayIds: string[];
  connections: PersistedConnection[];
};

function connectionType(kind: ProposalConnection["kind"]) {
  if (kind === "solar-dc" || kind === "battery-dc") return "dc";
  return kind ?? "other";
}

function connectionKey(sourceRef: string, targetRef: string, type: string) {
  const ends = [sourceRef, targetRef].sort();
  return `${ends[0]}|${ends[1]}|${type}`;
}

export function proposalInstallationReadiness(
  settings: Record<string, unknown>,
  records: ProposalTopologyRecords,
) {
  const calculator = (settings.designCalculator ?? {}) as Record<string, unknown>;
  const checklist = (calculator.proposedChecklist ?? {}) as Record<string, unknown>;
  const draft = (calculator.proposedAsBuiltDraft ?? {}) as {
    nodes?: ProposalNode[];
    connections?: ProposalConnection[];
  };
  const nodes = (draft.nodes ?? []).filter((node) => !node.authorityCheck);
  const connections = (draft.connections ?? []).filter((connection) => !connection.authorityCheck);
  const blockers: string[] = [];

  if (checklist["proposed-schematic"] !== true) blockers.push("the proposed schematic has not been accepted");
  if (!nodes.length) blockers.push("the accepted schematic contains no equipment");
  if (!connections.length) blockers.push("the accepted schematic contains no connections");

  const nodeById = new Map(nodes.map((node) => [node.id ?? "", node]));
  const persistedRefs = new Set([
    ...records.componentIds.map((id) => `component:${id}`),
    ...records.pvArrayIds.map((id) => `pv:${id}`),
  ]);

  for (const node of nodes) {
    const label = node.label || node.id || "Unnamed equipment";
    if (node.reviewed !== true) blockers.push(`${label} has not been accepted`);
    if (!node.recordRef) blockers.push(`${label} has no saved equipment record`);
    else if (!persistedRefs.has(node.recordRef)) blockers.push(`${label} is missing from the saved system`);
  }

  const expectedConnectionCounts = new Map<string, { count: number; label: string }>();
  const referencedNodeIds = new Set<string>();
  for (const connection of connections) {
    const label = connection.label || `${connection.from ?? "Unknown"} to ${connection.to ?? "unknown"}`;
    if (connection.configured !== true) blockers.push(`${label} has not been configured`);
    const source = nodeById.get(connection.from ?? "");
    const target = nodeById.get(connection.to ?? "");
    if (!source || !target) {
      blockers.push(`${label} refers to equipment outside the accepted schematic`);
      continue;
    }
    referencedNodeIds.add(source.id ?? "");
    referencedNodeIds.add(target.id ?? "");
    if (!source.recordRef || !target.recordRef || !connection.kind) continue;
    const key = connectionKey(source.recordRef, target.recordRef, connectionType(connection.kind));
    const expected = expectedConnectionCounts.get(key);
    expectedConnectionCounts.set(key, { count: (expected?.count ?? 0) + 1, label });
  }

  for (const node of nodes) {
    if (node.id && !referencedNodeIds.has(node.id)) blockers.push(`${node.label || node.id} is disconnected`);
  }

  const actualConnectionCounts = new Map<string, number>();
  for (const connection of records.connections) {
    const key = connectionKey(connection.sourceRef, connection.targetRef, connection.connectionType);
    actualConnectionCounts.set(key, (actualConnectionCounts.get(key) ?? 0) + 1);
  }
  for (const [key, expected] of expectedConnectionCounts) {
    if ((actualConnectionCounts.get(key) ?? 0) < expected.count) blockers.push(`${expected.label} is missing from the saved system`);
  }

  return { ready: blockers.length === 0, blockers: [...new Set(blockers)] };
}
