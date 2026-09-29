import type { Project } from "@/domain/models";

const discoveryValue = (project: Pick<Project, "designDiscovery">, key: string) => {
  const answer = project.designDiscovery?.[key];
  if (answer && typeof answer === "object" && "value" in answer) return answer.value;
  return answer;
};

const hasRecordedSelection = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasRecordedSelection);
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object") return Object.values(value).some(hasRecordedSelection);
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized || /^(?:none|no|false|not[_ -]?applicable|unknown|not recorded|n\/a|\[\]|\{\})$/.test(normalized)) return false;
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (parsed !== normalized) return hasRecordedSelection(parsed);
  } catch {
    // Plain discovery selections are handled below.
  }
  return true;
};

export function projectHasPoolContext(project: Pick<Project, "name" | "components" | "designDiscovery">) {
  if (/\b(?:pool|spa|swimming)\b/i.test(project.name)) return true;
  if (project.components.some((component) => /\b(?:pool|spa|swimming)\b/i.test(`${component.name} ${JSON.stringify(component.specs ?? {})}`))) return true;

  const buildingType = discoveryValue(project, "building_type");
  const buildingTypeText = (Array.isArray(buildingType) ? buildingType.join(" ") : String(buildingType ?? "")).replaceAll("_", " ");
  if (/\b(?:pool|spa|swimming)\b/i.test(buildingTypeText)) return true;

  return hasRecordedSelection(discoveryValue(project, "pool_or_spa"))
    || hasRecordedSelection(discoveryValue(project, "pool_equipment"))
    || hasRecordedSelection(discoveryValue(project, "pool_equipment_ratings"));
}
