import type { ComponentSpec, SystemConnection } from "@/domain/models";
import { isCanonicalEquipmentImage } from "@/ui/assets";

type SchematicLink = { sourceId: string; targetId: string };

/** Cables stay in their connection records, while physical connector hardware
 * such as busbars remains visible as equipment on the schematic. */
export function isVisibleInstalledAccessory(component: Pick<ComponentSpec, "kind" | "name" | "specs">) {
  if (!['cable', 'connector'].includes(component.kind)) return true;
  if (/\bbus\s*bars?\b/i.test(component.name)) return true;
  return isCanonicalEquipmentImage(String(component.specs["Schematic image"] ?? ""));
}

/** Explicit user/Wattson topology outranks older direct-link inference. */
export function removeCoveredInferredLinks<T extends SchematicLink, E extends SchematicLink>(inferred: T[], explicit: E[]) {
  const explicitPairs = new Set(explicit.map((connection) => `${connection.sourceId}:${connection.targetId}`));
  const explicitEndpoints = new Set(explicit.flatMap((connection) => [connection.sourceId, connection.targetId]));
  return inferred.filter((connection) =>
    !explicitPairs.has(`${connection.sourceId}:${connection.targetId}`)
    && !explicitEndpoints.has(connection.sourceId),
  );
}

function legacyGeneratorRoutePlaceholder(component: Pick<ComponentSpec, "kind" | "name" | "specs">) {
  return component.kind === "generator"
    && component.specs["Proposal source"] === "Wattson design"
    && component.specs["Proposal node id"] === "generator-changeover"
    && /generator connection (?:route|method) to confirm/i.test(component.name);
}

/** Older proposals represented an undecided generator route as a second
 * generator component. Collapse that legacy two-edge shape back into the
 * single provisional connection it describes. */
export function collapseLegacyGeneratorRoute(components: ComponentSpec[], connections: SystemConnection[]) {
  const placeholders = components.filter(legacyGeneratorRoutePlaceholder);
  if (!placeholders.length) return { components, connections };
  const hiddenRefs = new Set(placeholders.map((component) => `component:${component.id}`));
  const collapsed: SystemConnection[] = [];
  for (const placeholder of placeholders) {
    const placeholderRef = `component:${placeholder.id}`;
    const incoming = connections.find((connection) => connection.targetRef === placeholderRef && connection.sourceRef !== placeholderRef);
    const outgoing = connections.find((connection) => connection.sourceRef === placeholderRef && connection.targetRef !== placeholderRef);
    if (!incoming || !outgoing) continue;
    collapsed.push({
      ...outgoing,
      id: `legacy-generator-route:${placeholder.id}`,
      sourceRef: incoming.sourceRef,
      targetRef: outgoing.targetRef,
      name: "Generator connection method to confirm",
      connectionType: "ac",
      circuitRole: "unspecified",
      polarity: "na",
      cableSize: undefined,
      cableLength: undefined,
      breakerSize: undefined,
      fuseSize: undefined,
      isolator: undefined,
      route: undefined,
      notes: [incoming.notes, outgoing.notes, "[provisional-generator-interface]"].filter(Boolean).join("\n"),
      confidence: "estimated",
    });
  }
  return {
    components: components.filter((component) => !hiddenRefs.has(`component:${component.id}`)),
    connections: [
      ...connections.filter((connection) => !hiddenRefs.has(connection.sourceRef) && !hiddenRefs.has(connection.targetRef)),
      ...collapsed,
    ],
  };
}
