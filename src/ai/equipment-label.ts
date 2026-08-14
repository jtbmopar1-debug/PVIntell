import { z } from "zod";

export const equipmentLabelSchema = z.object({
  equipmentType: z.enum(["panel", "pv_string", "battery", "inverter", "generator", "protection", "meter", "other"]),
  manufacturer: z.string(),
  model: z.string(),
  serialNumber: z.string(),
  ratedVoltage: z.string(),
  ratedCurrent: z.string(),
  ratedPower: z.string(),
  capacity: z.string(),
  panelType: z.string().default(""),
  maximumPowerVoltage: z.string().default(""),
  maximumPowerCurrent: z.string().default(""),
  openCircuitVoltage: z.string().default(""),
  shortCircuitCurrent: z.string().default(""),
  maximumSystemVoltage: z.string().default(""),
  nominalOperatingCellTemperature: z.string().default(""),
  maximumSeriesFuseRating: z.string().default(""),
  powerTolerance: z.string().default(""),
  moduleEfficiency: z.string().default(""),
  temperatureCoefficientPmax: z.string().default(""),
  temperatureCoefficientVoc: z.string().default(""),
  temperatureCoefficientIsc: z.string().default(""),
  dimensions: z.string().default(""),
  weight: z.string().default(""),
  phase: z.string(),
  frequency: z.string(),
  ingressRating: z.string(),
  certifications: z.array(z.string()),
  otherSpecifications: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })),
  confidence: z.enum(["high", "medium", "low"]),
  unreadableFields: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type EquipmentLabelExtraction = z.infer<typeof equipmentLabelSchema>;

interface GeminiLabelInteraction {
  output_text?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    equipmentType: { type: "string", enum: ["panel", "pv_string", "battery", "inverter", "generator", "protection", "meter", "other"] },
    manufacturer: { type: "string" },
    model: { type: "string" },
    serialNumber: { type: "string" },
    ratedVoltage: { type: "string" },
    ratedCurrent: { type: "string" },
    ratedPower: { type: "string" },
    capacity: { type: "string" },
    panelType: { type: "string" },
    maximumPowerVoltage: { type: "string" },
    maximumPowerCurrent: { type: "string" },
    openCircuitVoltage: { type: "string" },
    shortCircuitCurrent: { type: "string" },
    maximumSystemVoltage: { type: "string" },
    nominalOperatingCellTemperature: { type: "string" },
    maximumSeriesFuseRating: { type: "string" },
    powerTolerance: { type: "string" },
    moduleEfficiency: { type: "string" },
    temperatureCoefficientPmax: { type: "string" },
    temperatureCoefficientVoc: { type: "string" },
    temperatureCoefficientIsc: { type: "string" },
    dimensions: { type: "string" },
    weight: { type: "string" },
    phase: { type: "string" },
    frequency: { type: "string" },
    ingressRating: { type: "string" },
    certifications: { type: "array", items: { type: "string" } },
    otherSpecifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" }, value: { type: "string" } },
        required: ["label", "value"],
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    unreadableFields: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["equipmentType", "manufacturer", "model", "serialNumber", "ratedVoltage", "ratedCurrent", "ratedPower", "capacity", "panelType", "maximumPowerVoltage", "maximumPowerCurrent", "openCircuitVoltage", "shortCircuitCurrent", "maximumSystemVoltage", "nominalOperatingCellTemperature", "maximumSeriesFuseRating", "powerTolerance", "moduleEfficiency", "temperatureCoefficientPmax", "temperatureCoefficientVoc", "temperatureCoefficientIsc", "dimensions", "weight", "phase", "frequency", "ingressRating", "certifications", "otherSpecifications", "confidence", "unreadableFields", "warnings"],
};

export function parseEquipmentLabelResponse(raw: GeminiLabelInteraction): EquipmentLabelExtraction {
  const text = raw.output_text ?? raw.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .find((content) => content.type === "text")?.text;
  if (!text) throw new Error(raw.error?.message ?? "Wattson could not read this label.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Wattson returned an unreadable label result. Please try a clearer photo.");
  }
  return equipmentLabelSchema.parse(parsed);
}

export async function extractEquipmentLabel(image: Uint8Array, mimeType: string): Promise<EquipmentLabelExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const model = process.env.GEMINI_TECHNICAL_MODEL ?? "gemini-3.7-flash";
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      model,
      store: false,
      system_instruction: "Read solar and electrical equipment nameplates conservatively. Extract only text that is visibly supported by the image. For PV panels, explicitly look for Pmax, Vmp, Imp, Voc, Isc, maximum system voltage, NOCT, maximum series fuse rating, power tolerance, module efficiency, temperature coefficients, dimensions, weight, and whether the label states bifacial or another panel construction. Use empty strings for absent fields. Preserve printed units. Never infer compatibility, condition, safety, approval, or regulatory compliance from a label. Put ambiguity, possible OCR errors, or multiple possible values in warnings.",
      input: [
        { type: "text", text: "Extract the equipment nameplate into the requested structure. If the image is not a readable equipment label, return low confidence and explain why in warnings." },
        { type: "image", data: Buffer.from(image).toString("base64"), mime_type: mimeType },
      ],
      response_format: { type: "text", mime_type: "application/json", schema: responseSchema },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await response.json() as GeminiLabelInteraction;
  if (!response.ok) throw new Error(raw.error?.message ?? `Gemini image request failed with status ${response.status}.`);
  return parseEquipmentLabelResponse(raw);
}
