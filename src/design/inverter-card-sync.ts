import type { SupabaseClient } from "@supabase/supabase-js";

type ProjectSettings = {
  schematicOrigin?: unknown;
  designCalculator?: {
    inverterPlan?: { unitRatingsKw?: unknown };
  };
};

const generatedUnitSource = "Wattson inverter plan";

/**
 * Keeps a structured proposal's physical inverter cards aligned with the
 * selected multi-unit inverter plan. User-entered cards are retained; only
 * missing Wattson planning units are added.
 */
export async function syncPlannedInverterCards(
  supabase: SupabaseClient,
  projectId: string,
  settings: ProjectSettings,
) {
  if (settings.schematicOrigin !== "structured_proposal_intake") return;
  const rawRatings = settings.designCalculator?.inverterPlan?.unitRatingsKw;
  if (!Array.isArray(rawRatings)) return;
  const ratings = rawRatings.map(Number).filter((rating) => Number.isFinite(rating) && rating > 0);
  if (ratings.length < 2) return;

  const existing = await supabase
    .from("system_components")
    .select("id,display_name,manufacturer,model,installation_location,specifications,notes,confidence,quantity,created_at")
    .eq("project_id", projectId)
    .eq("type", "inverter")
    .order("created_at", { ascending: true });
  if (existing.error) throw existing.error;
  const cards = existing.data ?? [];
  if (!cards.length || cards.length >= ratings.length) return;

  const source = cards.find((card) => {
    const specs = (card.specifications ?? {}) as Record<string, unknown>;
    return specs["Planning unit source"] !== generatedUnitSource;
  }) ?? cards[0];

  for (let index = cards.length; index < ratings.length; index += 1) {
    const unitNumber = index + 1;
    const specifications = {
      ...((source.specifications ?? {}) as Record<string, unknown>),
      "Rated power": `${ratings[index]} kW`,
      "Equipment record": "Individual inverter",
      "Planning unit source": generatedUnitSource,
      "Planning unit number": String(unitNumber),
    };
    const inserted = await supabase.from("system_components").insert({
      project_id: projectId,
      type: "inverter",
      display_name: /^inverter(?:\s+1)?$/i.test(source.display_name)
        ? `Inverter ${unitNumber}`
        : `${source.display_name} ${unitNumber}`,
      manufacturer: source.manufacturer,
      model: source.model,
      installation_location: source.installation_location,
      quantity: 1,
      specifications,
      notes: source.notes,
      confidence: source.confidence ?? "estimated",
    });
    if (inserted.error) throw inserted.error;
  }
}
