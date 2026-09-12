export type InstalledSystemCreationRequest = {
  request_payload: unknown;
  status: string;
  site_id?: string | null;
  project_id?: string | null;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function installedSystemCreationReplay(existing: InstalledSystemCreationRequest, requestPayload: unknown) {
  if (stableJson(existing.request_payload) !== stableJson(requestPayload)) return { kind: "conflict" as const };
  if (existing.status === "completed" && existing.site_id && existing.project_id) {
    return { kind: "completed" as const, siteId: existing.site_id, projectId: existing.project_id };
  }
  return { kind: "processing" as const };
}

