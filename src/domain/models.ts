export type Confidence = "estimated" | "confirmed";
export type ProjectType = "off-grid" | "grid-tied" | "hybrid";
export type LifecyclePhase =
  | "discover"
  | "design"
  | "explain"
  | "build"
  | "check"
  | "commission"
  | "monitor"
  | "diagnose"
  | "maintain";

export interface Load {
  id: string;
  name: string;
  watts: number;
  quantity: number;
  hoursPerDay: number;
  surgeWatts: number;
  currentType: "AC" | "DC";
  confidence: Confidence;
  simultaneous: boolean;
}

export interface Assumption {
  id: string;
  label: string;
  value: string;
  reason: string;
  confidence: Confidence;
}

export interface ComponentSpec {
  id: string;
  kind: "panel" | "battery" | "inverter" | "generator" | "protection" | "meter";
  name: string;
  manufacturer?: string;
  model?: string;
  quantity: number;
  location?: string;
  status: Confidence;
  specs: Record<string, string | number>;
}

export interface InstallationStep {
  id: string;
  title: string;
  description: string;
  safetyLevel: "user" | "low-voltage" | "high-current-dc" | "licensed";
  expectedResult: string;
  complete: boolean;
}

export interface CommissioningMeasurement {
  id: string;
  label: string;
  value: string;
  expected: string;
  recordedAt: string;
  result: "pass" | "attention";
}

export interface Project {
  id: string;
  name: string;
  description: string;
  projectType: ProjectType;
  phase: LifecyclePhase;
  location: string;
  goal: string;
  priorities: string[];
  systemVoltage: number;
  autonomyDays: number;
  peakSunHours: number;
  loads: Load[];
  assumptions: Assumption[];
  components: ComponentSpec[];
  installationSteps: InstallationStep[];
  commissioning: CommissioningMeasurement[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
