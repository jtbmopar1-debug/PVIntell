export const WATTSON_STARTING_CREDITS = 100;

export const wattsonCreditCatalog = [
  { key: "system_proposal", label: "Generate initial system proposal", credits: 20, category: "Design" },
  { key: "proposal_rebuild", label: "Rebuild an existing proposal", credits: 6, category: "Design" },
  { key: "captured_component", label: "Add a component or PV array in System Capture", credits: 1, category: "System" },
  { key: "monitoring_connection", label: "Successful monitoring connection", credits: 5, category: "Monitoring" },
  { key: "handover_review", label: "Wattson handover module review", credits: 2, category: "Review" },
  { key: "image_analysis", label: "Analyse an uploaded image or document", credits: 2, category: "Wattson" },
  { key: "wattson_reply", label: "Standard Wattson reply", credits: 1, category: "Wattson" },
] as const;

export type WattsonCreditAction = (typeof wattsonCreditCatalog)[number]["key"];

export function wattsonCreditCost(action: WattsonCreditAction) {
  return wattsonCreditCatalog.find((item) => item.key === action)!.credits;
}
