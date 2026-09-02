import type { SupabaseClient } from "@supabase/supabase-js";
import { extractEquipmentLabel, type EquipmentLabelExtraction } from "@/ai/equipment-label";

const inventoryTypeName: Record<EquipmentLabelExtraction["equipmentType"], string> = {
  panel: "PV panel",
  pv_string: "PV string",
  battery: "Battery",
  inverter: "Inverter",
  generator: "Generator",
  protection: "Protection device",
  meter: "Meter",
  other: "Equipment",
};

function visibleSpecifications(extraction: EquipmentLabelExtraction) {
  return Object.fromEntries([
    ["ratedVoltage", extraction.ratedVoltage],
    ["ratedCurrent", extraction.ratedCurrent],
    ["ratedPower", extraction.ratedPower],
    ["capacity", extraction.capacity],
    ["panelType", extraction.panelType],
    ["maximumPowerVoltage", extraction.maximumPowerVoltage],
    ["maximumPowerCurrent", extraction.maximumPowerCurrent],
    ["openCircuitVoltage", extraction.openCircuitVoltage],
    ["shortCircuitCurrent", extraction.shortCircuitCurrent],
    ["maximumSystemVoltage", extraction.maximumSystemVoltage],
    ["maximumSeriesFuseRating", extraction.maximumSeriesFuseRating],
    ["dimensions", extraction.dimensions],
    ["weight", extraction.weight],
    ["phase", extraction.phase],
    ["frequency", extraction.frequency],
    ["ingressRating", extraction.ingressRating],
    ["certifications", extraction.certifications.join(", ")],
    ...extraction.otherSpecifications.map((item) => [item.label, item.value]),
  ].filter(([, value]) => String(value ?? "").trim()));
}

export interface InventoryPhotoCapture {
  extraction?: EquipmentLabelExtraction;
  equipmentId?: string;
  equipmentName?: string;
  saved: boolean;
  warning?: string;
}

export async function captureSiteInventoryFromLabel({
  supabase,
  siteId,
  imagePath,
  imageBytes,
  mimeType,
}: {
  supabase: SupabaseClient;
  siteId: string;
  imagePath: string;
  imageBytes: Uint8Array;
  mimeType: string;
}): Promise<InventoryPhotoCapture> {
  try {
    const extraction = await extractEquipmentLabel(imageBytes, mimeType);
    const hasIdentity = Boolean(
      extraction.manufacturer || extraction.model || extraction.serialNumber ||
      extraction.ratedVoltage || extraction.capacity || extraction.ratedPower,
    );
    if (extraction.confidence === "low" || extraction.equipmentType === "other" || !hasIdentity) {
      return { extraction, saved: false, warning: "The photo was kept in chat, but its equipment identity was not clear enough to add to inventory." };
    }

    const specifications = visibleSpecifications(extraction);
    const equipmentName = [extraction.manufacturer, extraction.model].filter(Boolean).join(" ") || inventoryTypeName[extraction.equipmentType];
    const note = "Added from a Wattson label photo. Visible label values still require user review; physical condition has not been determined from the image.";
    let existing: { id: string; specifications: Record<string, unknown> | null; photo_urls: unknown } | null = null;
    if (extraction.serialNumber) {
      const match = await supabase
        .from("site_equipment")
        .select("id,specifications,photo_urls")
        .eq("site_id", siteId)
        .eq("serial_number", extraction.serialNumber)
        .maybeSingle();
      if (match.error) throw match.error;
      existing = match.data;
    }

    if (existing) {
      const photos = Array.isArray(existing.photo_urls) ? existing.photo_urls.map(String) : [];
      const updated = await supabase
        .from("site_equipment")
        .update({
          type: extraction.equipmentType,
          name: equipmentName,
          manufacturer: extraction.manufacturer || null,
          model: extraction.model || null,
          specifications: { ...(existing.specifications ?? {}), ...specifications },
          notes: note,
          photo_urls: [...new Set([...photos, imagePath])],
        })
        .eq("id", existing.id)
        .eq("site_id", siteId)
        .select("id")
        .single();
      if (updated.error) throw updated.error;
      return { extraction, equipmentId: updated.data.id, equipmentName, saved: true };
    }

    const created = await supabase
      .from("site_equipment")
      .insert({
        site_id: siteId,
        type: extraction.equipmentType,
        name: equipmentName,
        manufacturer: extraction.manufacturer || null,
        model: extraction.model || null,
        serial_number: extraction.serialNumber || null,
        quantity: 1,
        condition: "needs_testing",
        status: "available",
        specifications,
        notes: note,
        photo_urls: [imagePath],
      })
      .select("id")
      .single();
    if (created.error) throw created.error;
    return { extraction, equipmentId: created.data.id, equipmentName, saved: true };
  } catch (problem) {
    return {
      saved: false,
      warning: problem instanceof Error ? problem.message : "Wattson could not read this equipment label.",
    };
  }
}
