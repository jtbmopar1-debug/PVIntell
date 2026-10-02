import type { SupabaseClient } from "@supabase/supabase-js";

type ProjectSettings = {
  schematicOrigin?: unknown;
  designCalculator?: {
    inverterPlan?: { unitRatingsKw?: unknown; acceptedByUser?: unknown };
  };
};

const generatedUnitSource = "Wattson inverter plan";

function ratedPowerKw(specifications: unknown) {
  const value = String((specifications as Record<string, unknown> | null)?.["Rated power"] ?? "");
  const amount = Number(value.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return /\b(?:w|watt)s?\b/i.test(value) && !/\bkw\b/i.test(value) ? amount / 1000 : amount;
}

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
  const accepted = settings.designCalculator?.inverterPlan?.acceptedByUser === true;
  const generated = await supabase
    .from("system_components")
    .select("id,specifications")
    .eq("project_id", projectId)
    .eq("type", "inverter")
    .contains("specifications", { "Planning unit source": generatedUnitSource });
  if (generated.error) throw generated.error;
  const generatedCards = generated.data ?? [];

  // Calculated alternatives are guidance, not permission to create hardware.
  // Remove only Wattson-generated units when no multi-unit choice is accepted.
  if (!Array.isArray(rawRatings) || rawRatings.length < 2 || !accepted) {
    for (const card of generatedCards) {
      const recordRef = `component:${card.id}`;
      const links = await supabase.from("system_connections").delete().eq("project_id", projectId).or(`source_ref.eq.${recordRef},target_ref.eq.${recordRef}`);
      if (links.error) throw links.error;
    }
    if (generatedCards.length) {
      const removed = await supabase.from("system_components").delete().eq("project_id", projectId).in("id", generatedCards.map((card) => card.id));
      if (removed.error) throw removed.error;
    }
    return;
  }
  const ratings = rawRatings.map(Number).filter((rating) => Number.isFinite(rating) && rating > 0);
  if (ratings.length < 2) return;

  const surplus = generatedCards.filter((card) => Number((card.specifications as Record<string, unknown>)["Planning unit number"]) > ratings.length);
  for (const card of surplus) {
    const recordRef = `component:${card.id}`;
    const links = await supabase.from("system_connections").delete().eq("project_id", projectId).or(`source_ref.eq.${recordRef},target_ref.eq.${recordRef}`);
    if (links.error) throw links.error;
  }
  if (surplus.length) {
    const removed = await supabase.from("system_components").delete().eq("project_id", projectId).in("id", surplus.map((card) => card.id));
    if (removed.error) throw removed.error;
  }

  const existing = await supabase
    .from("system_components")
    .select("id,display_name,manufacturer,model,installation_location,specifications,notes,confidence,quantity,created_at")
    .eq("project_id", projectId)
    .eq("type", "inverter")
    .order("created_at", { ascending: true });
  if (existing.error) throw existing.error;
  const cards = existing.data ?? [];
  if (!cards.length) return;

  const authoritativeCards = cards.filter((card) => {
    const specs = (card.specifications ?? {}) as Record<string, unknown>;
    return specs["Planning unit source"] !== generatedUnitSource;
  });
  const unmatchedRatingIndexes = ratings.map((_, index) => index);
  for (const card of authoritativeCards) {
    const rating = ratedPowerKw(card.specifications);
    if (rating === undefined) throw new Error("Confirm the recorded inverter rating before accepting a multi-inverter arrangement.");
    const matchPosition = unmatchedRatingIndexes.findIndex((index) => Math.abs(ratings[index] - rating) < 0.01);
    if (matchPosition < 0) throw new Error(`The recorded ${rating} kW inverter does not match any unit in the proposed ${ratings.map((item) => `${item} kW`).join(" + ")} arrangement. Revise the arrangement before accepting it.`);
    unmatchedRatingIndexes.splice(matchPosition, 1);
  }
  if (!unmatchedRatingIndexes.length) return;

  const source = cards.find((card) => {
    const specs = (card.specifications ?? {}) as Record<string, unknown>;
    return specs["Planning unit source"] !== generatedUnitSource;
  }) ?? cards[0];

  for (const index of unmatchedRatingIndexes) {
    const alreadyGenerated = cards.some((card) => Number(((card.specifications ?? {}) as Record<string, unknown>)["Planning unit number"]) === index + 1);
    if (alreadyGenerated) continue;
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
