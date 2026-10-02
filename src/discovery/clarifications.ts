import type { DiscoveryAnswers } from "./new-system";

export type DiscoveryClarification = {
  id: string;
  title: string;
  message: string;
  questionId: string;
};

const values = (value: DiscoveryAnswers[string]) => Array.isArray(value) ? value.map(String) : String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

/** Gentle cross-answer prompts. These are not validation errors and never block completion. */
export function discoveryClarifications(answers: DiscoveryAnswers): DiscoveryClarification[] {
  const prompts: DiscoveryClarification[] = [];
  const chargingWindows = values(answers.ev_charging_window);
  const chargingPriorities = values(answers.ev_charging_priority);
  if (chargingWindows.includes("overnight") && chargingPriorities.includes("solar_surplus") && answers.battery_requirement === "none") prompts.push({
    id: "overnight-solar-without-storage",
    title: "EV charging timing",
    message: "You selected overnight charging and solar-surplus charging without battery storage. Both can be valid for different days or situations. Clarify the usual priority if you want Wattson to plan charging controls more precisely.",
    questionId: "ev_travel_profile",
  });

  const orientation = String(answers.orientation_and_pitch ?? "").toLowerCase();
  const structure = String(answers.structure_condition ?? "").toLowerCase();
  if (/\"slope\"\s*:\s*\"flat\"|\bflat\b/.test(orientation) && /5_15|5[-–]15|5 to 15/.test(structure)) prompts.push({
    id: "surface-pitch-description",
    title: "Panel-area pitch",
    message: "One answer describes this surface as flat while another records a 5–15° pitch. A shallow roof may reasonably be described both ways; confirm the best planning description if exact tilt matters.",
    questionId: "orientation_and_pitch",
  });

  if (values(answers.panel_location).includes("none") && values(answers.expected_expansion).includes("more_pv")) prompts.push({
    id: "future-pv-location",
    title: "Future solar location",
    message: "You want to allow for more solar later but no panel location is currently selected. That may be intentional; optionally identify a future roof, ground or structure so expansion space is not assumed.",
    questionId: "panel_location",
  });

  const backup = String(answers.backup_preference ?? "").toLowerCase();
  if (answers.battery_requirement === "none" && backup && !/^(none|no outage backup)$/.test(backup) && answers.generator_requirement === "none") prompts.push({
    id: "backup-without-reserve-source",
    title: "Outage supply",
    message: "An outage-power goal is recorded without battery or generator support. This can mean loads may stop when solar is unavailable; clarify that operating expectation if you want a firm backup design.",
    questionId: "battery_requirement",
  });
  return prompts;
}
