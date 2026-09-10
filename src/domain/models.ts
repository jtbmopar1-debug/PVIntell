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
  discoveryNeedsReview?: boolean;
}

export interface SystemSummary {
  id: string;
  siteId: string;
  name: string;
  projectType: ProjectType;
  phase: LifecyclePhase;
  completedAreas?: string[];
}

export type FinancialEntryType = "purchase" | "other_cost" | "rebate" | "buyback" | "other_income";

export interface FinancialEntry {
  id: string;
  type: FinancialEntryType;
  date: string;
  description: string;
  amount: number;
  vendor?: string;
  notes?: string;
}

export interface SystemFinancialsState {
  currency: string;
  entries: FinancialEntry[];
  updatedAt?: string;
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
  /** Planning readiness only; never indicates that an item is installed. */
  proposedChecklist?: Record<string, boolean>;
  /**
   * A reviewed proposal retained as the starting point for the future as-built
   * schematic. It is deliberately separate from installed components and
   * connections, which must be confirmed by the user during the build.
   */
  proposedAsBuiltDraft?: {
    createdAt: string;
    architecture?: "combined_hybrid_inverter" | "separate_solar_controller_and_inverter" | "ac_coupled" | "not_decided";
    flow: string[];
    nodes?: Array<{ id: string; label: string; detail: string; image: string; x: number; y: number; installed?: boolean; installedRecordId?: string; reviewed?: boolean; notes?: string; authorityCheck?: boolean }>;
    connections?: Array<{ from: string; to: string; label: string; kind: "solar-dc" | "battery-dc" | "ac" | "earth"; lengthM?: number; lengthBasis?: "estimated" | "measured"; cableSizeMm2?: number; protectionAmps?: number; notes?: string; authorityCheck?: boolean; configured?: boolean }>;
    panelCount?: number;
    panelWatts?: number;
    pvStrings?: number;
    panelsPerString?: number;
    panelVmpV?: number;
    panelVocV?: number;
    panelImpA?: number;
    panelIscA?: number;
    batteryVoltage?: number;
    batteryAh?: number;
    batteryQuantity?: number;
    inverterKw?: number;
    generatorContinuousKw?: number;
    generatorSurgeKw?: number;
  };
  architecture?: "combined_hybrid_inverter" | "separate_solar_controller_and_inverter" | "ac_coupled" | "not_decided";
  designBasis?: string;
  inverterArrangement?: "combined" | "modular" | "string_inverter" | "optimiser_string" | "microinverters" | "compare" | "existing";
  startingStage?: string;
  expansionPath?: string;
  nextValidation?: string;
  panelType?: "bifacial" | "monofacial" | "flexible" | "other" | "not_selected";
  panelManufacturer?: string;
  panelModel?: string;
  panelSupplier?: string;
  panelProductUrl?: string;
  panelDatasheetUrl?: string;
  panelDatasheetVersion?: string;
  /** User-confirmed candidate mounting locations carried through from discovery. */
  mountingLocations?: string[];
  panelWatts?: number;
  panelCount?: number;
  existingPanelGroup?: {
    name: string;
    availableCount: number;
    maximumAvailableToProposal?: number;
    proposedUseCount?: number;
    surplusCount?: number;
    supplementaryCount?: number;
    supplementaryTargetPvKw?: number;
    wattsEach?: number;
    supplementaryWattsEach?: number;
    supplementaryPanelType?: string;
    supplementaryLengthMm?: number;
    supplementaryWidthMm?: number;
    assessmentStatus: "provisional_pending_datasheet_and_condition";
  };
  energyTargetPvKw?: number;
  energyTargetPanelCount?: number;
  planningPanelCapacity?: number;
  fitLimited?: boolean;
  pvStrings?: number;
  panelsPerString?: number;
  stringDesign?: {
    strings: number;
    panelsPerString: number;
    stringVmpV: number;
    stringVocV: number;
    coldStringVocV: number;
    minimumMpptCurrentA: number;
    minimumInputShortCircuitCurrentA: number;
    planningMinimumTemperatureC: number;
  };
  panelVmpV?: number;
  panelVocV?: number;
  panelImpA?: number;
  panelIscA?: number;
  targetPvKw?: number;
  panelLengthMm?: number;
  panelProfileBasis?: "representative" | "user_equipment";
  panelWidthMm?: number;
  panelThicknessMm?: number;
  panelWeightKg?: number;
  panelWeightBasis?: string;
  panelMaximumSystemVoltageV?: number;
  panelMaximumSeriesFuseA?: number;
  panelVocTemperatureCoefficientPercentPerC?: number;
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
  sizingMethod?: "deterministic-v1" | "user-adjusted";
  sizingInputs?: {
    dailyEnergyKwh?: number;
    dailyEnergySource?: "off_grid_daily_energy_use" | "current_energy_use" | "pool_equipment_schedule";
    peakSunHours?: number;
    systemEfficiency?: number;
    simultaneousLoadKw?: number;
    startupPeakKw?: number;
    startupLoadName?: string;
    scheduledLoadEnergyKwh?: number;
    batteryOnlyDays?: number;
    batterySizingBasis?: "no_sun_autonomy" | "solar_assisted_typical_winter" | "daily_energy_fraction";
    weakestMonthPvKwh?: number;
    assumedNonSolarLoadKwh?: number;
  };
  sizingAssumptions?: string[];
  sizingWarnings?: string[];
  generatorIncluded?: boolean;
  generatorPurchaseStatus?: "not_purchased" | "have_details";
  generatorType?: string;
  generatorFuel?: string;
  generatorContinuousKw?: number;
  generatorSurgeKw?: number;
  generatorConnectionMethod?: string;
  /** Regional rules basis used for preliminary protective-earth calculations. */
  electricalStandard?: "as_nzs" | "nec" | "iec" | "local_review";
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
  solarResource?: {
    peakSunHours: number;
    basis: "annual_weighted_average" | "weakest_month";
    source: string;
    period: string;
    monthlyPeakSunHours: number[];
    latitude?: number;
    longitude?: number;
    calculatedAt?: string;
  };
  loads: Load[];
  assumptions: Assumption[];
  components: ComponentSpec[];
  connections: SystemConnection[];
  schematicPositions: SchematicPosition[];
  overviewCardOrder: OverviewCardOrder[];
  designCalculator?: DesignCalculatorState;
  designDiscovery?: Record<string, { value?: string; confidence?: string; recordedAt?: string }>;
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
  actionUrl?: string;
  actionLabel?: string;
}
