import type { ComponentSpec } from "@/domain/models";
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
