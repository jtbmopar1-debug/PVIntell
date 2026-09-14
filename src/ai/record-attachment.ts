import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecordAttachmentTarget {
  kind: "component" | "pv_array";
  id: string;
  projectId: string;
  name: string;
}

interface AttachmentComponent {
  id: string;
  project_id: string;
  type: string;
  display_name: string;
}

interface AttachmentArray {
  id: string;
  project_id: string;
  name: string;
}

export interface RecordAttachmentResolution {
  target?: RecordAttachmentTarget;
  candidates?: RecordAttachmentTarget[];
}

function mentioned(message: string, value: string) {
  const normalizedMessage = message.toLocaleLowerCase();
  const normalizedValue = value.trim().toLocaleLowerCase();
  return normalizedValue.length > 1 && normalizedMessage.includes(normalizedValue);
}

export function resolveRecordAttachmentTarget(message: string, components: AttachmentComponent[], arrays: AttachmentArray[]): RecordAttachmentResolution {
  const exact = [
    ...components.filter((item) => mentioned(message, item.display_name)).map((item) => ({ kind: "component" as const, id: item.id, projectId: item.project_id, name: item.display_name })),
    ...arrays.filter((item) => mentioned(message, item.name)).map((item) => ({ kind: "pv_array" as const, id: item.id, projectId: item.project_id, name: item.name })),
  ];
  if (exact.length === 1) return { target: exact[0] };
  if (exact.length > 1) return { candidates: exact };

  const type = /\binverter\b/i.test(message) ? "inverter"
    : /\bbatter(?:y|ies)\b/i.test(message) ? "battery"
    : /\b(?:charge\s+)?controller\b|\bmppt\b/i.test(message) ? "charger"
    : /\bgenerator\b/i.test(message) ? "generator"
    : /\bmeter\b/i.test(message) ? "meter"
    : undefined;
  const typed = type
    ? components.filter((item) => item.type === type).map((item) => ({ kind: "component" as const, id: item.id, projectId: item.project_id, name: item.display_name }))
    : /\b(?:pv|solar)?\s*(?:array|string|panels?)\b/i.test(message)
      ? arrays.map((item) => ({ kind: "pv_array" as const, id: item.id, projectId: item.project_id, name: item.name }))
      : [];
  return typed.length === 1 ? { target: typed[0] } : { candidates: typed };
}

export function requestsExistingRecordAttachment(message: string) {
  return /\battach\b/i.test(message)
    && /\b(?:image|photo|picture|this|that|it)\b/i.test(message)
    && /\b(?:record|component|panel|array|string|battery|controller|inverter|generator|meter|load|connection)\b/i.test(message);
}

export async function attachImageToRecord(supabase: SupabaseClient, target: RecordAttachmentTarget, imagePath: string) {
  const update = target.kind === "component"
    ? await supabase.from("system_components").update({ photo_url: imagePath }).eq("id", target.id).eq("project_id", target.projectId).select("id").maybeSingle()
    : await supabase.from("pv_arrays").update({ label_photo_path: imagePath }).eq("id", target.id).eq("project_id", target.projectId).select("id").maybeSingle();
  if (update.error) throw update.error;
  if (!update.data) throw new Error("The selected record is no longer available.");
  return { target, summary: `Attached the image to ${target.name}` };
}
