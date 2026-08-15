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

export interface SystemConnection {
  id: string;
  projectId: string;
  sourceRef: string;
  targetRef: string;
  name: string;
  connectionType: "dc" | "ac" | "data" | "earth" | "other";
  polarity?: "positive" | "negative" | "pair" | "na";
  cableSize?: string;
  cableLength?: string;
  breakerSize?: string;
  fuseSize?: string;
  isolator?: string;
  route?: string;
  notes?: string;
  confidence: Confidence;
}

export interface SchematicPosition {
  nodeRef: string;
  x: number;
  y: number;
}

export interface OverviewCardOrder {
  nodeRef: string;
  position: number;
}

export interface DesignCalculatorState {
  architecture?: "combined_hybrid_inverter" | "separate_solar_controller_and_inverter" | "ac_coupled" | "not_decided";
  designBasis?: string;
  startingStage?: string;
  expansionPath?: string;
  nextValidation?: string;
  panelType?: "bifacial" | "monofacial" | "other" | "not_selected";
  panelWatts?: number;
  panelCount?: number;
  targetPvKw?: number;
  panelLengthMm?: number;
  panelWidthMm?: number;
  panelWeightKg?: number;
  requiredPanelAreaM2?: number;
  fitStatus?: "verified" | "unverified" | "does_not_fit";
  azimuthDegrees?: number;
  tiltDegrees?: number;
  peakSunHours?: number;
  systemEfficiencyPercent?: number;
  inverterKw?: number;
  batteryChemistry?: string;
  batteryVoltage?: number;
  batteryAh?: number;
  batteryQuantity?: number;
  usableBatteryPercent?: number;
  batteryUsableKwh?: number;
  connectionType?: "dc" | "ac_single" | "ac_three";
  connectionVoltage?: number;
  connectionCurrent?: number;
  connectionLengthM?: number;
  cableSizeMm2?: number;
  breakerAmps?: number;
  maxVoltageDropPercent?: number;
  updatedAt?: string;
  updatedBy?: "user" | "wattson";
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
  connections: SystemConnection[];
  schematicPositions: SchematicPosition[];
  overviewCardOrder: OverviewCardOrder[];
  designCalculator?: DesignCalculatorState;
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
