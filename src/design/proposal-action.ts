import type { WattsonActionRequest } from "@/ai/actions";
import type { DiscoveryAnswers } from "@/discovery/new-system";

function architectureAction(answers: DiscoveryAnswers): WattsonActionRequest {
  const architecture = answers.architecture_preference === "combined"
    ? "combined_hybrid_inverter"
    : answers.architecture_preference === "modular"
      ? "separate_solar_controller_and_inverter"
      : "combined_hybrid_inverter";
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
  return [
    preference,
    {
      name: "record_preliminary_design",
      arguments: {
        design_basis: "Calculated from the completed discovery's recorded energy, solar-resource, backup-scope and simultaneous-load evidence. Unsupported values remain blank.",
        starting_stage: "Use the deterministic planning baseline as the first design stage, subject to the visible evidence warnings and equipment checks.",
        expansion_path: "Recalculate from measured consumption and confirmed future loads before expansion; select equipment whose documented voltage, current and battery limits support that path.",
        next_validation: "Resolve the first warning shown in Deterministic sizing evidence before selecting equipment.",
        panel_type: "monofacial",
        fit_status: "unverified",
      },
    },
  ];
}
