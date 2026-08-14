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

export interface Site {
  id: string;
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  locationSource: "manual" | "device" | "search" | "imported";
  locationConfirmed: boolean;
}

export interface SystemSummary {
  id: string;
  siteId: string;
  name: string;
  projectType: ProjectType;
  phase: LifecyclePhase;
}

export interface SiteEquipment {
  id: string;
  siteId: string;
  assignedProjectId?: string;
  type: "panel" | "pv_string" | "battery" | "inverter" | "generator" | "protection" | "meter" | "other";
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  quantity: number;
  condition: "new" | "used_good" | "used_unknown" | "needs_testing" | "for_parts";
  status: "available" | "considering" | "assigned" | "installed" | "rejected" | "retired";
  specifications: Record<string, string | number>;
  notes?: string;
  photoUrls?: string[];
}

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
  kind: "panel" | "pv_string" | "battery" | "inverter" | "charger" | "generator" | "protection" | "isolator" | "cable" | "connector" | "combiner" | "meter" | "monitoring" | "load" | "other";
  name: string;
  manufacturer?: string;
  model?: string;
  quantity: number;
  location?: string;
  notes?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  manualUrl?: string;
  photoUrl?: string;
  status: Confidence;
  specs: Record<string, string | number>;
}

export interface PVArray {
  id: string;
  name: string;
  manufacturer?: string;
  panelModel?: string;
  panelType?: string;
  supplier?: string;
  purchasedOn?: string;
  installedOn?: string;
  maximumPowerVoltageV?: number;
  maximumPowerCurrentA?: number;
  openCircuitVoltageV?: number;
  shortCircuitCurrentA?: number;
  maximumSystemVoltageV?: number;
  nominalOperatingCellTempC?: number;
  maximumSeriesFuseA?: number;
  labelPhotoPath?: string;
  panelWatts?: number;
  panelCount?: number;
  strings?: number;
  panelsPerString?: number;
  orientationDegrees?: number;
  tiltDegrees?: number;
  cableSizeMm2?: number;
  cableLengthM?: number;
  connectorType?: string;
  breakerDetails?: string;
  isolatorDetails?: string;
  combinerDetails?: string;
  installationNotes?: string;
  specifications: Record<string, string | number>;
  confidence: Confidence;
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
  siteId?: string;
  updatedAt?: string;
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
  pvArrays: PVArray[];
  installationSteps: InstallationStep[];
  commissioning: CommissioningMeasurement[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  imageUrl?: string;
  imagePath?: string;
  citations?: Array<{ title: string; url: string }>;
}
