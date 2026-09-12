import type { WattsonActionRequest } from "@/ai/actions";
import type { DiscoveryAnswers } from "@/discovery/new-system";
import { answerList, proposalIncludesSolar } from "./proposal-inputs";

function architectureAction(answers: DiscoveryAnswers): WattsonActionRequest {
  const architecture = answers.architecture_preference === "combined"
    ? "combined_hybrid_inverter"
    : answers.architecture_preference === "modular"
      ? "separate_solar_controller_and_inverter"
      : ["string_inverter", "optimiser_string", "microinverters"].includes(String(answers.architecture_preference))
        ? "ac_coupled"
        : ["compare", "existing"].includes(String(answers.architecture_preference)) ? "not_decided" : "combined_hybrid_inverter";
  return {
    name: "record_design_preference",
    arguments: {
      architecture,
      notes: "Recorded from the completed guided discovery.",
    },
  };
}

/** Build the proposal immediately after guided discovery, without asking an AI
 * model to invent or calculate equipment sizes. */
export function deterministicProposalActions(answers: DiscoveryAnswers): WattsonActionRequest[] {
  const preference = architectureAction(answers);
  let existingPanels: { name?: string; panelType?: string; quantity?: number; maxUseQuantity?: number; watts?: number; proposalUse?: string } = {};
  try {
    if (typeof answers.existing_panel_selection === "string") existingPanels = JSON.parse(answers.existing_panel_selection) as typeof existingPanels;
  } catch { /* An older free-text answer remains discovery evidence but cannot drive numeric sizing. */ }
  const includeExistingPanels = proposalIncludesSolar(answers) && answerList(answers.panel_construction_interest).includes("existing")
    && existingPanels.proposalUse === "include"
    && Number(existingPanels.quantity) > 0
    && Number(existingPanels.watts) > 0;
  const panelInterests = Array.isArray(answers.panel_construction_interest)
    ? answers.panel_construction_interest.map(String)
    : [String(answers.panel_construction_interest ?? "")];
  const selectedExistingType = existingPanels.panelType === "bifacial" ? "bifacial"
    : existingPanels.panelType === "flexible" ? "flexible"
    : existingPanels.panelType ? "monofacial"
    : undefined;
  const panelType = includeExistingPanels && selectedExistingType ? selectedExistingType
    : panelInterests.includes("flexible_lightweight") ? "flexible"
    : panelInterests.includes("bifacial") ? "bifacial"
    : "monofacial";
  return [
    preference,
    {
      name: "record_preliminary_design",
      arguments: {
        design_basis: "Calculated from the completed discovery's recorded energy, solar-resource, backup-scope and simultaneous-load evidence. Unsupported values remain blank.",
        starting_stage: "Use the deterministic planning baseline as the first design stage, subject to the visible evidence warnings and equipment checks.",
        expansion_path: "Recalculate from measured consumption and confirmed future loads before expansion; select equipment whose documented voltage, current and battery limits support that path.",
        next_validation: "Resolve the first warning shown in Deterministic sizing evidence before selecting equipment.",
        panel_type: panelType,
        inverter_arrangement: String(answers.architecture_preference ?? "combined"),
        site_location: typeof answers.site_location === "string" ? answers.site_location : undefined,
        site_timezone: typeof answers.site_timezone === "string" ? answers.site_timezone : undefined,
        ...(includeExistingPanels ? {
          representative_panel_watts: Number(existingPanels.watts),
          existing_panel_name: existingPanels.name || "Existing panels",
          existing_panel_available_count: Number(existingPanels.quantity),
          existing_panel_max_use_count: Math.min(Number(existingPanels.maxUseQuantity) || Number(existingPanels.quantity), Number(existingPanels.quantity)),
          existing_panel_assessment_required: true,
        } : {}),
        fit_status: "unverified",
      },
    },
  ];
}
