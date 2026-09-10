export function discoveryValue(discovery: Record<string, unknown>, key: string): unknown {
  const entry = discovery[key];
  return entry && typeof entry === "object" && "value" in entry ? (entry as { value: unknown }).value : entry;
}

export function answerList(value: unknown): string[] {
  return (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

export function proposalIncludesSolar(discovery: Record<string, unknown>) {
  return !answerList(discoveryValue(discovery, "proposed_panel_location") ?? discoveryValue(discovery, "panel_location")).includes("none");
}

export function generatorFromDiscovery(discovery: Record<string, unknown>) {
  const requirement = String(discoveryValue(discovery, "generator_requirement") ?? "").trim().toLowerCase();
  const included = /^(include|existing|planned)(\b|_)/.test(requirement) && !/provision/.test(requirement);
  const outageRole = String(discoveryValue(discovery, "generator_outage_role") ?? "");
  let details: Record<string, unknown> = {};
  try {
    const raw = discoveryValue(discovery, "generator_details");
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) details = parsed;
  } catch { /* Unstructured notes are not equipment ratings. */ }
  const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
  const suppliedPowerFactor = positive(details.powerFactor);
  const powerFactor = details.ratingUnit === "kVA" ? suppliedPowerFactor && suppliedPowerFactor <= 1 ? suppliedPowerFactor : undefined : 1;
  const continuous = positive(details.continuousRating);
  const surge = positive(details.surgeRating);
  return {
    included,
    outageRole: included ? outageRole : "",
    purchaseStatus: included ? (details.purchaseStatus === "have_details" ? "have_details" : "not_purchased") as "have_details" | "not_purchased" : undefined,
    continuousKw: included && continuous && powerFactor ? continuous * powerFactor : undefined,
    surgeKw: included && surge && powerFactor ? surge * powerFactor : undefined,
    generatorType: included && typeof details.generatorType === "string" ? details.generatorType : undefined,
    fuel: included && typeof details.fuel === "string" ? details.fuel : undefined,
    connectionMethod: included && typeof details.connectionMethod === "string" ? details.connectionMethod : undefined,
    warnings: included && details.ratingUnit === "kVA" && !powerFactor
      ? ["The existing generator is rated in kVA. Record its rated power factor or continuous kW before comparing it with the load; no fixed kVA-to-kW conversion is assumed."] : [],
  };
}
