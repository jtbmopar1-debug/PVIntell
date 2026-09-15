import type { SupabaseClient } from "@supabase/supabase-js";

export function requestsMrbfCardUpdate(message: string, priorAssistantMessage: string) {
  return /\b(?:add|apply|put|save|record|update)\b/i.test(message)
    && /\b(?:specs?|specifications?|ratings?)\b/i.test(message)
    && /\b(?:cards?|technical cards?|components?|each|those|them)\b/i.test(message)
    && /\bMRBF\b/i.test(`${message}\n${priorAssistantMessage}`);
}

type MrbfRow = { id: string; display_name: string; specifications: Record<string, unknown> | null };

export async function updateMrbfTechnicalCards(supabase: SupabaseClient, projectId: string) {
  const result = await supabase
    .from("system_components")
    .select("id,display_name,specifications")
    .eq("project_id", projectId)
    .eq("type", "protection");
  if (result.error) throw result.error;
  const fuses = ((result.data ?? []) as MrbfRow[]).filter((item) => /MRBF/i.test(`${item.display_name} ${JSON.stringify(item.specifications ?? {})}`));
  if (!fuses.length) throw new Error("No MRBF fuse records were found on this schematic.");

  const individual = fuses.filter((item) => !/main|busbar.*(?:inverter|output)/i.test(item.display_name));
  const main = fuses.filter((item) => !individual.includes(item));
  const updates = fuses.map((item) => {
    const isMain = main.includes(item);
    const specifications = {
      ...(item.specifications ?? {}),
      "AC / DC type": "DC",
      "Rated current": isMain ? "300 A manufacturer DC over-current-device basis; MRBF substitution unconfirmed" : "100 A provisional",
      "Rated operational voltage": "At least 60 V DC; confirm the exact fuse and holder rating",
      "Fuse class / family": isMain ? "MRBF requested — suitability as the manufacturer-required DC protection remains unconfirmed" : "MRBF",
      "Fuse holder / format": "Compatible covered MRBF terminal-fuse holder",
      "Breaking / interrupt capacity": "TBC — calculate the prospective battery-bank fault current",
      "Circuit / equipment protected": isMain ? "Positive busbar-to-inverter battery feed" : item.display_name.replace(/\s*MRBF.*$/i, " positive lead"),
      "Cable / terminal capacity": isMain ? "Recorded as 4 AWG — does not match the Deye 10 kW AU manual’s 4/0 AWG (95 mm²) battery-cable value; redesign/verify before use" : "TBC — coordinate with the individual battery lead, terminals and BMS",
      "Sizing status": isMain ? "Not confirmed — 300 A is the inverter manual’s breaker basis, not approval of a 300 A MRBF" : "Not confirmed — verify BMS continuous/peak current, conductor ampacity and fault current",
    };
    return supabase.from("system_components").update({ specifications, confidence: "estimated" }).eq("id", item.id).eq("project_id", projectId);
  });
  const saved = await Promise.all(updates);
  const failed = saved.find((entry) => entry.error)?.error;
  if (failed) throw failed;
  return {
    summary: `Updated ${individual.length} individual MRBF technical card${individual.length === 1 ? "" : "s"} with a 100 A provisional rating and ${main.length} main-busbar MRBF card${main.length === 1 ? "" : "s"} with the inverter manufacturer’s 300 A DC protection basis. These are not final selections: BMS limits, cable capacity, fault current, holder voltage/interrupt rating and whether MRBF is suitable for the main device still require verification. The recorded 4 AWG inverter cable is flagged because the applicable Deye 10 kW AU manual specifies 4/0 AWG (95 mm²).`,
    updatedIds: fuses.map((item) => item.id),
  };
}
