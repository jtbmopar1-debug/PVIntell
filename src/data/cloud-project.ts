import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChatMessage,
  InstallationStep,
  LifecyclePhase,
  Project,
  ProjectType,
  Site,
  SiteEquipment,
  SystemSummary,
} from "@/domain/models";
import { reconcileStoredProposal } from "@/ai/actions";

const defaultSteps: Omit<InstallationStep, "id">[] = [
  [
    "Planning & site preparation",
    "Confirm locations, cable routes, access, manuals and site-specific considerations.",
    "user",
    "A documented layout ready for the next build stage.",
  ],
  [
    "Battery installation",
    "Mount batteries as specified and verify isolation before interconnection.",
    "high-current-dc",
    "A secure, isolated bank ready for connection checks.",
  ],
  [
    "DC protection",
    "Install manufacturer-specified fusing, isolation, and over-current protection.",
    "high-current-dc",
    "Protected conductors with documented ratings.",
  ],
  [
    "Inverter installation",
    "Mount the inverter with required clearances and segregated cabling.",
    "licensed",
    "Equipment mounted and ready for connection checks.",
  ],
  [
    "PV installation",
    "Install the array, earthing, DC cabling, labels and isolation shown in the recorded design.",
    "licensed",
    "Array isolated and ready for pre-power tests.",
  ],
  [
    "AC wiring",
    "Complete and verify the planned AC connections and protection.",
    "licensed",
    "Connection details and test results recorded.",
  ],
  [
    "Communications",
    "Connect inverter, BMS, and monitoring communications.",
    "low-voltage",
    "All devices visible with stable communication.",
  ],
  [
    "Configuration",
    "Apply battery-approved charge limits and operating priorities.",
    "low-voltage",
    "Settings match the commissioning sheet.",
  ],
  [
    "Pre-power checks",
    "Verify polarity, torque, insulation tests, and protective devices.",
    "licensed",
    "Completed pre-energisation checklist.",
  ],
  [
    "Commissioning",
    "Energise in the manufacturer-defined sequence and record measurements.",
    "licensed",
    "System operating normally with baseline readings.",
  ],
].map(([title, description, safetyLevel, expectedResult]) => ({
  title,
  description,
  safetyLevel: safetyLevel as InstallationStep["safetyLevel"],
  expectedResult,
  complete: false,
}));

function projectType(mode: string): ProjectType {
  return mode === "grid_tied"
    ? "grid-tied"
    : mode === "hybrid"
      ? "hybrid"
      : "off-grid";
}

function mapSite(row: Record<string, unknown>): Site {
  return {
    id: String(row.id),
    name: String(row.name),
    location:
      typeof row.location === "string" && row.location
        ? row.location
        : "Location not set",
    latitude: typeof row.latitude === "number" ? row.latitude : undefined,
    longitude: typeof row.longitude === "number" ? row.longitude : undefined,
    timezone: typeof row.timezone === "string" ? row.timezone : "UTC",
    locationSource: (row.location_source as Site["locationSource"]) ?? "manual",
    locationConfirmed: Boolean(row.location_confirmed),
    discoveryNeedsReview: Boolean(row.discovery_needs_review),
  };
}

function mapEquipment(row: Record<string, unknown>): SiteEquipment {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    assignedProjectId:
      typeof row.assigned_project_id === "string"
        ? row.assigned_project_id
        : undefined,
    type: row.type as SiteEquipment["type"],
    name: String(row.name),
    manufacturer:
      typeof row.manufacturer === "string" ? row.manufacturer : undefined,
    model: typeof row.model === "string" ? row.model : undefined,
    serialNumber:
      typeof row.serial_number === "string" ? row.serial_number : undefined,
    quantity: Number(row.quantity ?? 1),
    condition: row.condition as SiteEquipment["condition"],
    status: row.status as SiteEquipment["status"],
    specifications: (row.specifications ?? {}) as Record<
      string,
      string | number
    >,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    photoUrls: Array.isArray(row.photo_urls) ? row.photo_urls.map(String) : [],
  };
}

export async function loadSiteInventory(
  supabase: SupabaseClient,
  siteId: string,
) {
  const workspace = await ensureWorkspace(supabase);
  const siteRow = workspace.sites.find((site) => site.id === siteId);
  if (!siteRow) throw new Error("Site not found");
  const equipmentResult = await supabase
    .from("site_equipment")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at");
  if (equipmentResult.error) throw equipmentResult.error;
  const systems: SystemSummary[] = workspace.systems
    .filter((system) => system.site_id === siteId)
    .map((system) => ({
      id: system.id,
      siteId: system.site_id,
      name: system.name,
      projectType: projectType(system.mode),
      phase: system.phase as LifecyclePhase,
    }));
  return {
    site: mapSite(siteRow),
    sites: workspace.sites.map(mapSite),
    systems,
    equipment: (equipmentResult.data ?? []).map(mapEquipment),
  };
}

async function insertDefaultSteps(supabase: SupabaseClient, projectId: string) {
  const rows = defaultSteps.map((step, index) => ({
    project_id: projectId,
    position: index + 1,
    title: step.title,
    instructions: step.description,
    safety_level: step.safetyLevel,
    expected_result: step.expectedResult,
  }));
  const result = await supabase.from("installation_steps").insert(rows);
  if (result.error) throw result.error;
}

export async function createSystem(
  supabase: SupabaseClient,
  userId: string,
  siteId: string,
  name: string,
  type: ProjectType = "off-grid",
  startingGoal?: string,
  systemVoltage?: number,
) {
  const created = await supabase
    .from("projects")
    .insert({
      owner_id: userId,
      site_id: siteId,
      name,
      description: startingGoal || "Tell Wattson what you want this system to do.",
      mode:
        type === "grid-tied"
          ? "grid_tied"
          : type === "hybrid"
            ? "hybrid"
            : "off_grid",
      phase: "discover",
      system_voltage: systemVoltage ?? null,
      settings: { autonomyDays: 2, priorities: [], startingGoal: startingGoal || null, goal: startingGoal || null },
    })
    .select("id")
    .single();
  if (created.error) throw created.error;
  await insertDefaultSteps(supabase, created.data.id);
  return created.data.id as string;
}

async function ensureWorkspace(supabase: SupabaseClient) {
  const [siteResult, discoveryResult, systemsResult] = await Promise.all([
    supabase.from("sites").select("*").order("created_at"),
    supabase.from("site_discoveries").select("site_id,impact_pending"),
    supabase.from("projects").select("id,site_id,name,mode,phase").order("created_at"),
  ]);
  if (siteResult.error) throw siteResult.error;
  if (discoveryResult.error) throw discoveryResult.error;
  if (systemsResult.error) throw systemsResult.error;
  const reviewNeeded = new Set((discoveryResult.data ?? []).filter((item) => item.impact_pending).map((item) => item.site_id));
  const sites = (siteResult.data ?? []).map((site) => ({ ...site, discovery_needs_review: reviewNeeded.has(site.id) }));
  const systems = systemsResult.data ?? [];
  return { sites, systems };
}

export async function loadSiteWorkspace(
  supabase: SupabaseClient,
  siteId: string,
  requestedSystemId: string,
  requestedConversationId?: string,
) {
  const workspace = await ensureWorkspace(supabase);
  const ownedSite = workspace.sites.find((site) => site.id === siteId);
  if (!ownedSite) throw new Error("Site not found");
  const selected = workspace.systems.find(
    (system) => system.site_id === siteId && system.id === requestedSystemId,
  );
  if (!selected) throw new Error("Power system not found");
  return loadWorkspace(supabase, selected.id, requestedConversationId, workspace);
}

export async function loadWorkspace(
  supabase: SupabaseClient,
  requestedSystemId?: string,
  requestedConversationId?: string,
  prefetchedWorkspace?: Awaited<ReturnType<typeof ensureWorkspace>>,
) {
  const workspace = prefetchedWorkspace ?? await ensureWorkspace(supabase);
  const rowSummary =
    workspace.systems.find((system) => system.id === requestedSystemId) ??
    workspace.systems[0];
  const [rowResult, equipmentResult] = await Promise.all([
    supabase.from("projects").select("*").eq("id", rowSummary.id).single(),
    supabase.from("site_equipment").select("*").eq("site_id", rowSummary.site_id).order("created_at"),
  ]);
  if (rowResult.error) throw rowResult.error;
  if (equipmentResult.error) throw equipmentResult.error;
  const row = rowResult.data;
  const siteRow =
    workspace.sites.find((item) => item.id === row.site_id) ??
    workspace.sites[0];
  const site = mapSite(siteRow);
  const [
    loads,
    assumptions,
    components,
    connections,
    schematicPositions,
    overviewCardOrder,
    pvArrays,
    steps,
    records,
    conversation,
    questionnaires,
  ] = await Promise.all([
    supabase.from("loads").select("*").eq("project_id", row.id).order("name"),
    supabase
      .from("assumptions")
      .select("*")
      .eq("project_id", row.id)
      .order("created_at"),
    supabase
      .from("system_components")
      .select("*")
      .eq("project_id", row.id)
      .order("created_at"),
    supabase
      .from("system_connections")
      .select("*")
      .eq("project_id", row.id)
      .order("created_at"),
    supabase
      .from("system_schematic_positions")
      .select("node_ref,position_x,position_y")
      .eq("project_id", row.id),
    supabase
      .from("system_overview_card_order")
      .select("node_ref,position")
      .eq("project_id", row.id)
      .order("position"),
    supabase
      .from("pv_arrays")
      .select("*")
      .eq("project_id", row.id)
      .order("created_at"),
    supabase
      .from("installation_steps")
      .select("*")
      .eq("project_id", row.id)
      .order("position"),
    supabase
      .from("commissioning_records")
      .select("*")
      .eq("project_id", row.id)
      .order("recorded_at"),
    requestedConversationId
      ? supabase.from("conversations").select("id").eq("project_id", row.id).eq("id", requestedConversationId).maybeSingle()
      : supabase.from("conversations").select("id").eq("project_id", row.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("questionnaire_responses")
      .select("template_key,template_version,status,answers")
      .eq("project_id", row.id),
  ]);
  for (const result of [
    loads,
    assumptions,
    components,
    connections,
    schematicPositions,
    overviewCardOrder,
    pvArrays,
    steps,
    records,
    conversation,
    questionnaires,
  ]) {
    if (
      (result === connections ||
        result === schematicPositions ||
        result === overviewCardOrder) &&
      result.error &&
      (result.error.code === "PGRST205" || result.error.code === "42P01")
    )
      continue;
    if (result.error) throw result.error;
  }

  let messages: ChatMessage[] = [];
  if (conversation.data?.id) {
    const result = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversation.data.id)
      .order("created_at")
      .limit(50);
    if (result.error) throw result.error;
    messages = await Promise.all(
      (result.data ?? []).filter((message) => String(message.content).trim()).map(async (message) => {
        const context = (message.structured_context ?? {}) as {
          citations?: Array<{ title: string; url: string }>;
          imagePath?: string;
          actionUrl?: string;
          actionLabel?: string;
        };
        let imageUrl: string | undefined;
        if (context.imagePath) {
          const signed = await supabase.storage
            .from("project-photos")
            .createSignedUrl(context.imagePath, 3600);
          imageUrl = signed.data?.signedUrl;
        }
        return {
          id: message.id,
          role:
            message.role === "user"
              ? ("user" as const)
              : ("assistant" as const),
          content: message.content,
          createdAt: message.created_at,
          citations: context.citations,
          imagePath: context.imagePath,
          imageUrl,
          actionUrl: context.actionUrl,
          actionLabel: context.actionLabel,
        };
      }),
    );
  }

  const settings = (row.settings ?? {}) as Record<string, unknown>;
  const commissioned = ["monitor", "diagnose", "maintain", "explain"].includes(String(row.phase));
  if (!commissioned && reconcileStoredProposal(settings, String(row.mode), { location: site.location, timezone: site.timezone })) {
    const reconciled = await supabase.from("projects").update({ settings }).eq("id", row.id).eq("owner_id", row.owner_id).eq("updated_at", row.updated_at);
    if (reconciled.error) throw reconciled.error;
  }
  const project: Project = {
    id: row.id,
    siteId: row.site_id,
    updatedAt: row.updated_at,
    name: row.name,
    description: row.description ?? "",
    projectType: projectType(row.mode),
    phase: row.phase,
    location: site.location,
    goal: String(settings.goal ?? settings.startingGoal ?? row.description ?? ""),
    priorities: Array.isArray(settings.priorities)
      ? settings.priorities.map(String)
      : [],
    systemVoltage: row.system_voltage ?? 0,
    autonomyDays: Number(settings.autonomyDays ?? 2),
    peakSunHours: Number(settings.peakSunHours ?? 0),
    solarResource: settings.solarResource && typeof settings.solarResource === "object"
      ? settings.solarResource as Project["solarResource"]
      : undefined,
    designCalculator: settings.designCalculator && typeof settings.designCalculator === "object"
      ? settings.designCalculator as Project["designCalculator"]
      : undefined,
    designDiscovery: settings.designDiscovery && typeof settings.designDiscovery === "object"
      ? settings.designDiscovery as Project["designDiscovery"]
      : undefined,
    loads: (loads.data ?? []).map((load) => ({
      id: load.id,
      name: load.name,
      watts: load.watts,
      quantity: load.quantity,
      hoursPerDay: load.hours_per_day,
      surgeWatts: load.surge_watts ?? load.watts,
      currentType: load.current_type,
      confidence: load.confidence,
      simultaneous: load.simultaneous,
    })),
    assumptions: (assumptions.data ?? []).map((assumption) => ({
      id: assumption.id,
      label: assumption.label,
      value:
        typeof assumption.value === "string"
          ? assumption.value
          : JSON.stringify(assumption.value),
      reason: assumption.reason ?? "",
      confidence: assumption.confidence,
    })),
    components: (components.data ?? [])
      .filter((component) => !(component.confidence === "estimated" && String(component.notes ?? "").startsWith("Proposed by Wattson")))
      .map((component) => ({
      id: component.id,
      kind: component.type,
      name: component.display_name ?? component.model ?? component.type,
      manufacturer: component.manufacturer ?? undefined,
      model: component.model ?? undefined,
      quantity: component.quantity,
      location: component.installation_location ?? undefined,
      notes: component.notes ?? undefined,
      serialNumber: component.serial_number ?? undefined,
      firmwareVersion: component.firmware_version ?? undefined,
      manualUrl: component.manual_url ?? undefined,
      photoUrl: component.photo_url ?? undefined,
      status: component.confidence,
      specs: component.specifications ?? {},
      })),
    connections: (connections.data ?? []).map((connection) => ({
      id: connection.id,
      projectId: connection.project_id,
      sourceRef: connection.source_ref,
      targetRef: connection.target_ref,
      name: connection.name,
      connectionType: connection.connection_type,
      polarity: connection.polarity ?? "na",
      cableSize: connection.cable_size ?? undefined,
      cableLength: connection.cable_length ?? undefined,
      breakerSize: connection.breaker_size ?? undefined,
      fuseSize: connection.fuse_size ?? undefined,
      isolator: connection.isolator ?? undefined,
      route: connection.route ?? undefined,
      notes: connection.notes ?? undefined,
      confidence: connection.confidence,
    })),
    schematicPositions: (schematicPositions.data ?? []).map((position) => ({
      nodeRef: position.node_ref,
      x: Number(position.position_x),
      y: Number(position.position_y),
    })),
    overviewCardOrder: (overviewCardOrder.data ?? []).map((item) => ({
      nodeRef: item.node_ref,
      position: Number(item.position),
    })),
    pvArrays: (pvArrays.data ?? []).map((array) => ({
      id: array.id,
      name: array.name,
      manufacturer: array.manufacturer ?? undefined,
      panelModel: array.panel_model ?? undefined,
      panelType: array.panel_type ?? undefined,
      supplier: array.supplier ?? undefined,
      purchasedOn: array.purchased_on ?? undefined,
      installedOn: array.installed_on ?? undefined,
      maximumPowerVoltageV: array.maximum_power_voltage_v ?? undefined,
      maximumPowerCurrentA: array.maximum_power_current_a ?? undefined,
      openCircuitVoltageV: array.open_circuit_voltage_v ?? undefined,
      shortCircuitCurrentA: array.short_circuit_current_a ?? undefined,
      maximumSystemVoltageV: array.maximum_system_voltage_v ?? undefined,
      nominalOperatingCellTempC:
        array.nominal_operating_cell_temp_c ?? undefined,
      maximumSeriesFuseA: array.maximum_series_fuse_a ?? undefined,
      labelPhotoPath: array.label_photo_path ?? undefined,
      panelWatts: array.panel_watts ?? undefined,
      panelCount: array.panel_count ?? undefined,
      strings: array.strings ?? undefined,
      panelsPerString: array.panels_per_string ?? undefined,
      orientationDegrees: array.orientation_degrees ?? undefined,
      tiltDegrees: array.tilt_degrees ?? undefined,
      cableSizeMm2: array.cable_size_mm2 ?? undefined,
      cableLengthM: array.cable_length_m ?? undefined,
      connectorType: array.connector_type ?? undefined,
      breakerDetails: array.breaker_details ?? undefined,
      isolatorDetails: array.isolator_details ?? undefined,
      combinerDetails: array.combiner_details ?? undefined,
      installationNotes: array.installation_notes ?? undefined,
      specifications: array.specifications ?? {},
      confidence: array.confidence ?? "estimated",
    })),
    installationSteps: (steps.data ?? []).map((step) => ({
      id: step.id,
      title: step.title,
      description: step.instructions,
      safetyLevel: step.safety_level,
      expectedResult: step.expected_result ?? "",
      complete: Boolean(step.completed_at),
    })),
    commissioning: (records.data ?? []).map((record) => ({
      id: record.id,
      label: record.type,
      value:
        typeof record.value === "string"
          ? record.value
          : JSON.stringify(record.value),
      expected: record.expected_range
        ? JSON.stringify(record.expected_range)
        : "Not specified",
      recordedAt: record.recorded_at,
      result: record.result === "pass" ? "pass" : "attention",
    })),
  };
  const sites = workspace.sites.map(mapSite);
  const systems: SystemSummary[] = workspace.systems.map((system) => ({
    id: system.id,
    siteId: system.site_id,
    name: system.name,
    projectType: projectType(system.mode),
    phase: system.phase as LifecyclePhase,
  }));
  const questionnaireDrafts = Object.fromEntries(
    (questionnaires.data ?? []).map((response) => [
      response.template_key,
      {
        version: response.template_version,
        status: response.status,
        answers: response.answers ?? {},
      },
    ]),
  );
  const siteEquipment = (equipmentResult.data ?? []).map(mapEquipment);
  return {
    project,
    messages,
    conversationId: conversation.data?.id,
    site,
    sites,
    systems,
    questionnaireDrafts,
    siteEquipment,
  };
}
