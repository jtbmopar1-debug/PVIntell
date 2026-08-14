export type QuestionnaireAnswer = string | number | boolean;

export interface QuestionnaireQuestion {
  id: string;
  label: string;
  help?: string;
  type: "text" | "textarea" | "number" | "select";
  options?: Array<{ value: string; label: string }>;
  unit?: string;
  required?: boolean;
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  description: string;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireTemplate {
  key: string;
  version: number;
  title: string;
  description: string;
  sections: QuestionnaireSection[];
}

export const systemDiscoveryQuestionnaire: QuestionnaireTemplate = {
  key: "system_discovery",
  version: 1,
  title: "Tell us about this power system",
  description: "Work through this at your own pace. Estimates and ‘I don’t know yet’ answers are welcome.",
  sections: [
    {
      id: "purpose",
      title: "Purpose and priorities",
      description: "Start with what this system needs to achieve.",
      questions: [
        { id: "scenario", label: "What best describes this system?", type: "select", required: true, options: [
          { value: "off_grid_home", label: "Off-grid home" }, { value: "grid_backup", label: "Grid-connected battery backup" },
          { value: "cabin", label: "Cabin or tiny home" }, { value: "mobile", label: "Boat or caravan" },
          { value: "upgrade", label: "Existing system upgrade" }, { value: "diagnostics", label: "Existing system with a problem" },
        ] },
        { id: "use_pattern", label: "How will the property be used?", help: "For example: full-time home, weekends, seasonal, workshop or rental.", type: "textarea", required: true },
        { id: "main_goal", label: "What matters most?", help: "Lower bills, independence, outage backup, generator reduction, extra capacity, or something else.", type: "textarea", required: true },
      ],
    },
    {
      id: "loads",
      title: "What needs power",
      description: "Ordinary descriptions are enough; rating-label details can be added later.",
      questions: [
        { id: "everyday_loads", label: "Everyday appliances and equipment", help: "Fridges, lights, Wi-Fi, computers, televisions, pumps and similar loads.", type: "textarea", required: true },
        { id: "large_loads", label: "Large or high-starting loads", help: "Cooking, water heating, air conditioning, workshop tools, EV charging, pumps or motors.", type: "textarea" },
        { id: "occupants", label: "Typical number of people", type: "number" },
      ],
    },
    {
      id: "existing",
      title: "Existing equipment",
      description: "If the system does not exist yet, leave quantities at zero.",
      questions: [
        { id: "system_status", label: "Current stage", type: "select", required: true, options: [
          { value: "idea", label: "Early idea" }, { value: "design", label: "Being designed" }, { value: "installed", label: "Already installed" }, { value: "upgrade", label: "Installed and being upgraded" },
        ] },
        { id: "pv_strings", label: "PV strings", type: "number" },
        { id: "battery_units", label: "Battery units", type: "number" },
        { id: "inverter_units", label: "Inverters", type: "number" },
        { id: "generator_units", label: "Generators", type: "number" },
        { id: "equipment_notes", label: "Known makes, models or ratings", help: "Copy what you can see on equipment labels. Photos can be added later.", type: "textarea" },
      ],
    },
    {
      id: "resilience",
      title: "Backup and autonomy",
      description: "Tell us how the system should behave through poor weather or outages.",
      questions: [
        { id: "autonomy_days", label: "Desired reserve", type: "number", unit: "days" },
        { id: "generator_preference", label: "Generator preference", type: "select", options: [
          { value: "avoid", label: "Avoid generator use where practical" }, { value: "available", label: "Generator backup is acceptable" }, { value: "none", label: "No generator available" },
        ] },
        { id: "future_changes", label: "Likely future additions", help: "EV, heat pump, workshop, extra dwelling, more batteries or other planned loads.", type: "textarea" },
      ],
    },
  ],
};

export const questionnaireTemplates = [systemDiscoveryQuestionnaire];

export function scenarioForStart(title: string) {
  return ({ "Off-grid home": "off_grid_home", "Battery backup": "grid_backup", "Cabin or tiny home": "cabin", "Boat or caravan": "mobile", "Upgrade a system": "upgrade", "Diagnose a problem": "diagnostics" } as Record<string, string>)[title];
}

