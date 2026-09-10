"use client";

import { BatteryCharging, Cable, Calculator, CheckCircle2, Circle, Eye, EyeOff, Minus, Plus, RotateCcw, Save, Smartphone, Sun, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FormattedChatMessage } from "@/components/formatted-chat-message";
import { defaultProposalPanel, defaultProposalPanelStringLayout, proposalPanelProfile } from "@/design/candidate-panel";
import { deriveProposalSizing, normalizedDailyEnergy, solarFirstPowerAlternative } from "@/design/proposal-sizing";
import { recommendedPanelOrientation } from "@/design/panel-orientation";
import { generatorFromDiscovery, proposalIncludesSolar } from "@/design/proposal-inputs";
import { assessPanelSurfaces } from "@/design/panel-surfaces";
import type { DesignCalculatorState, Project, Site } from "@/domain/models";

const n = (value: unknown, fallback = 0) => {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  if (typeof value === "string") {
    const parsed = Number(value.match(/-?\d+(?:\.\d+)?/)?.[0]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};
const round = (value: number, places = 1) => Number.isFinite(value) ? value.toFixed(places) : "—";
const supplementaryArray = (design: DesignCalculatorState) => {
  const group = design.existingPanelGroup;
  if (!group?.supplementaryTargetPvKw) return undefined;
  return {
    targetPvKw: n(group.supplementaryTargetPvKw),
    count: n(group.supplementaryCount),
    watts: n(group.supplementaryWattsEach),
    type: group.supplementaryPanelType,
    lengthMm: n(group.supplementaryLengthMm),
    widthMm: n(group.supplementaryWidthMm),
  };
};
const projectIdFromHref = (href: string) => href.match(/\/systems\/([0-9a-f-]{36})/i)?.[1];
const projectSiteIdFromHref = (href: string) => href.match(/\/sites\/([0-9a-f-]{36})/i)?.[1];
const planningCableForCurrent = (amps: number) => amps <= 10 ? 1.5 : amps <= 16 ? 2.5 : amps <= 25 ? 4 : amps <= 32 ? 6 : amps <= 50 ? 10 : amps <= 63 ? 16 : amps <= 80 ? 25 : amps <= 100 ? 35 : amps <= 125 ? 50 : amps <= 160 ? 70 : 95;
const planningAcCableForCurrent = (amps: number) => amps <= 10 ? 1.5 : amps <= 20 ? 2.5 : amps <= 28 ? 4 : amps <= 40 ? 6 : planningCableForCurrent(amps);
const asNzsProtectiveEarthForActive = (activeCableMm2: number) => activeCableMm2 <= 2.5 ? 1.5 : activeCableMm2 <= 6 ? 2.5 : activeCableMm2 <= 10 ? 4 : activeCableMm2 <= 16 ? 6 : activeCableMm2 <= 25 ? 10 : activeCableMm2 <= 35 ? 16 : activeCableMm2 <= 50 ? 25 : Math.ceil(activeCableMm2 / 2);
const iecProtectiveEarthForActive = (activeCableMm2: number) => activeCableMm2 <= 16 ? activeCableMm2 : activeCableMm2 <= 35 ? 16 : Math.ceil(activeCableMm2 / 2);
const necEquipmentGroundingConductor = (protectionAmps: number) => [[15, 2.08], [20, 3.31], [60, 5.26], [100, 8.37], [200, 13.3], [300, 21.2], [400, 26.7], [500, 33.6], [600, 42.4]] as const satisfies ReadonlyArray<readonly [number, number]>;
const inferElectricalStandard = (site: Site): NonNullable<DesignCalculatorState["electricalStandard"]> => {
  const region = `${site.location} ${site.timezone}`.toLowerCase();
  if (region.includes("new zealand") || region.includes("australia") || site.timezone === "Pacific/Auckland" || site.timezone.startsWith("Australia/")) return "as_nzs";
  if (region.includes("united states") || region.includes(" usa") || site.timezone.startsWith("America/")) return "nec";
  return "local_review";
};
const planningProtectiveEarth = (activeCableMm2: number, protectionAmps: number, standard: DesignCalculatorState["electricalStandard"], pvBond = false) => {
  if (!activeCableMm2) return undefined;
  if (standard === "as_nzs") return pvBond ? Math.max(4, asNzsProtectiveEarthForActive(activeCableMm2)) : asNzsProtectiveEarthForActive(activeCableMm2);
  if (standard === "iec") return iecProtectiveEarthForActive(activeCableMm2);
  if (standard === "nec") {
    const table = necEquipmentGroundingConductor(protectionAmps);
    return table.find(([rating]) => protectionAmps <= rating)?.[1];
  }
  return undefined;
};
const mountingLocationLabels: Record<string, string> = { main_roof: "Main roof", other_roof: "Garage, shed or another roof", ground: "Ground-mounted frame", fence: "Fence or vertical screen", wall_facade: "Wall or building facade", carport_pergola: "Carport, pergola or canopy", curved_lightweight: "Curved or weight-limited surface", mobile: "Vehicle, boat or movable structure", none: "No solar panels" };
const discoveredMountingLocations = (project: Project) => String(project.designDiscovery?.proposed_panel_location?.value ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const mountingLocationText = (locations?: string[]) => locations?.length ? locations.map((value) => mountingLocationLabels[value] ?? value).join(" + ") : "Mounting location not recorded";
const inverterArrangementLabels: Record<string, string> = { string_inverter: "solar string inverter", optimiser_string: "string inverter with DC optimisers", microinverters: "microinverter arrangement", compare: "inverter arrangement to compare", existing: "existing inverter pending assessment" };
const azimuthText = (degrees?: number) => {
  if (degrees === undefined || !Number.isFinite(degrees)) return "not established";
  const directions = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return `${round(((degrees % 360) + 360) % 360, 0)}° (${directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]})`;
};
export const proposalUsesPublicGrid = (project: Project) => {
  const value = (key: string) => String(project.designDiscovery?.[key]?.value ?? "").trim().toLowerCase();
  const utility = value("utility_relationship").replaceAll("-", "_");
  const targetRole = value("target_grid_role");
  if (targetRole === "replace_grid" || utility === "off_grid" || utility.includes("no public electricity") || utility.includes("no public grid") || utility.includes("without public grid")) return false;
  if (utility.includes("connected to public") || utility === "grid_connected" || targetRole === "emergency_fallback") return true;
  return project.projectType === "hybrid" || project.projectType === "grid-tied";
};

function systemScopeSummary(project: Project, design?: DesignCalculatorState) {
  const value = (key: string) => project.designDiscovery?.[key]?.value ?? "";
  const config = design ?? project.designCalculator ?? {};
  const buildings = String(value("building_type")).split(",").map((item) => item.trim());
  const poolSystem = buildings.includes("pool_spa") || Boolean(value("pool_heating_profile"));
  const heaterOutput = String(value("pool_heating_profile")).trim();
  const equipment = String(value("pool_equipment")).split(",").map((item) => item.trim().replaceAll("_", " ")).filter(Boolean);
  const architectureValue = String(config.architecture ?? value("architecture_preference"));
  const architecture = inverterArrangementLabels[String(config.inverterArrangement)] ?? ({ combined_hybrid_inverter: "hybrid inverter", separate_solar_controller_and_inverter: "separate solar controller and inverter", ac_coupled: "AC-coupled inverter", not_decided: "inverter arrangement to assess" } as Record<string, string>)[architectureValue] ?? architectureValue.replaceAll("_", " ");
  const panelCount = n(config.panelCount);
  const panelWatts = n(config.panelWatts);
  const pvStrings = n(config.pvStrings);
  const panelsPerString = n(config.panelsPerString);
  const existingGroup = config.existingPanelGroup;
  const existingUseCount = n(existingGroup?.proposedUseCount);
  const supplementaryCount = n(existingGroup?.supplementaryCount);
  const supplementaryTargetPvKw = n(existingGroup?.supplementaryTargetPvKw);
  const supplementaryWatts = n(existingGroup?.supplementaryWattsEach);
  const arrayText = existingGroup && existingUseCount
    ? `a calculated requirement using ${existingUseCount} of the ${existingGroup.availableCount} available ${panelWatts ? `${panelWatts} W ` : ""}${existingGroup.name} panels${supplementaryTargetPvKw ? ` plus a separate ${supplementaryTargetPvKw} kW minimum additional array${supplementaryCount && supplementaryWatts ? `, provisionally shown as ${supplementaryCount} × ${supplementaryWatts} W modules` : ""}` : ""}`
    : panelCount ? `${panelCount}${panelWatts ? ` × ${panelWatts} W` : ""} solar panels${pvStrings ? ` in ${pvStrings} string${pvStrings === 1 ? "" : "s"}${panelsPerString ? ` of ${panelsPerString} panels` : ""}` : ""}` : "the proposed solar array";
  const inverterArticle = n(config.inverterKw) >= 8 && n(config.inverterKw) < 9 ? "an" : "a";
  const inverterText = n(config.inverterKw) ? `feeding ${inverterArticle} ${config.inverterKw} kW ${architecture}` : `feeding a ${architecture || "suitable inverter arrangement"} (continuous rating still to be confirmed)`;
  const batteryText = proposalIncludesBattery(project)
    ? config.batteryUsableKwh ? `${round(config.batteryUsableKwh, 1)} kWh of usable battery storage is proposed.` : "Battery storage is included as a separate planning item."
    : "No battery storage is included in this proposal.";
  const generator = discoveredGenerator(project);
  const generatorRole = generator.outageRole ? ` Its recorded outage roles are ${generator.outageRole.split(",").map((item) => item.trim().replaceAll("_", " ")).join(", ")}.` : "";
  const generatorText = generator.included
    ? config.generatorContinuousKw ? ` A generator requiring at least ${config.generatorContinuousKw} kW continuous output${config.generatorSurgeKw ? ` and documented ${config.generatorSurgeKw} kW motor-start capability` : ""} is included${config.generatorPurchaseStatus === "not_purchased" ? " for later purchase" : ""}.${generatorRole}` : ` Generator supply is included and still needs a confirmed size.${generatorRole}`
    : "";
  const targetGridRole = String(value("target_grid_role")).toLowerCase();
  const gridRelationship = !proposalUsesPublicGrid(project)
    ? "as a standalone supply without the public grid in the operating power path"
    : targetGridRole === "emergency_fallback"
      ? "with the public grid retained only as a controlled emergency fallback"
      : "alongside the public grid, so solar and stored energy reduce grid use while the grid covers shortfalls";
  if (poolSystem) {
    const loads = equipment.length ? `, including ${equipment.join(", ")}` : "";
    const heater = heaterOutput ? ` The design must support ${heaterOutput}${/kw/i.test(heaterOutput) ? "" : " kW thermal"} of pool-heating capacity.` : "";
    return `Wattson has arranged ${arrayText} ${inverterText} ${gridRelationship} for the pool or spa${loads}. ${batteryText}${generatorText}${heater}`;
  }
  const outcomes = String(value("primary_outcome")).split(",").map((item) => ({
    cost: "lower electricity bills",
    backup: "provide power during outages",
    independence: "reduce reliance on the public grid",
    off_grid_supply: "provide power without a public grid supply",
  } as Record<string, string>)[item.trim()] ?? item.trim().replaceAll("_", " ")).filter(Boolean);
  const outcome = outcomes.length > 1 ? `${outcomes.slice(0, -1).join(", ")} and ${outcomes.at(-1)}` : outcomes[0];
  return `Wattson has arranged ${arrayText} ${inverterText} ${gridRelationship}${outcome ? `, with the goal of helping you ${outcome}` : " from the confirmed Site, load and future-use requirements"}. ${batteryText}${generatorText}`;
}

export function ProposalScopeOverview({ project, design }: { project: Project; design: DesignCalculatorState }) {
  const surfaces = assessPanelSurfaces(project.designDiscovery ?? {}, design, project.solarResource?.latitude);
  const value = (key: string) => project.designDiscovery?.[key]?.value ?? "";
  const panelCount = n(design.panelCount);
  const supplementary = supplementaryArray(design);
  const existingPanelCount = n(design.existingPanelGroup?.proposedUseCount);
  const basePanelCount = existingPanelCount || (supplementary ? 0 : panelCount);
  const moduleAreaM2 = basePanelCount * n(design.panelLengthMm) * n(design.panelWidthMm) / 1_000_000
    + (supplementary?.count ?? 0) * (supplementary?.lengthMm ?? 0) * (supplementary?.widthMm ?? 0) / 1_000_000;
  let recordedAreaM2 = 0;
  try {
    const rawAreas = typeof value("panel_area_dimensions") === "string"
      ? JSON.parse(String(value("panel_area_dimensions")))
      : value("panel_area_dimensions");
    if (Array.isArray(rawAreas)) recordedAreaM2 = rawAreas.reduce((total, area) => total + n(area?.lengthM) * n(area?.widthM), 0);
  } catch { /* Free-text measurements remain visible in discovery, but are not presented as calculated area. */ }
  const architecture = inverterArrangementLabels[String(design.inverterArrangement)] ?? ({ combined_hybrid_inverter: "combined hybrid inverter", separate_solar_controller_and_inverter: "separate MPPT charge controller and inverter", ac_coupled: "AC-coupled inverter" } as Record<string, string>)[String(design.architecture)] ?? "inverter arrangement";
  const targetGridRole = String(value("target_grid_role")).toLowerCase();
  const gridRelationship = !proposalUsesPublicGrid(project)
    ? "Standalone/off-grid supply; the public grid is not part of the normal operating path."
    : targetGridRole === "emergency_fallback"
      ? "The system supplies normal loads, with the public grid retained as a controlled emergency fallback."
      : "Grid-connected operation; solar serves loads first, any included storage shifts or backs up energy, and the public grid balances shortfall or surplus subject to local rules.";
  const mountingLocations = design.mountingLocations ?? [];
  const mountingApproach = mountingLocations.includes("ground") ? "ground-mount rack system"
    : mountingLocations.some((location) => ["fence", "wall_facade"].includes(location)) ? "vertical rail/frame mounting system"
      : mountingLocations.includes("carport_pergola") ? "canopy rail/frame mounting system"
        : mountingLocations.some((location) => ["curved_lightweight", "mobile"].includes(location)) || design.panelType === "flexible" ? "specialist lightweight/flexible mounting system"
          : mountingLocations.some((location) => ["main_roof", "other_roof"].includes(location)) ? "roof rail/rack mounting system"
            : "mounting system not selected";
  const generator = discoveredGenerator(project);
  const roofOnly = mountingLocations.length > 0 && mountingLocations.every((location) => ["main_roof", "other_roof"].includes(location));
  const areaType = roofOnly ? "roof area" : "mounting area";
  const chemistry = /lifepo|lithium iron/i.test(String(design.batteryChemistry)) ? "LiFePO₄" : String(design.batteryChemistry ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
  const batteryVoltage = n(design.batteryVoltage);
  const batteryVoltageText = batteryVoltage >= 50 && batteryVoltage <= 54 ? "48 V-class" : batteryVoltage ? `${round(batteryVoltage, 1)} V` : "";
  const inverterArticle = n(design.inverterKw) >= 8 && n(design.inverterKw) < 9 ? "an" : "a";
  const generatorText = generator.included
    ? design.generatorContinuousKw ? ` Generator provision requires at least ${design.generatorContinuousKw} kW continuous output${design.generatorSurgeKw ? ` and documented ${design.generatorSurgeKw} kW motor-start capability` : ""}.` : " Generator provision is included, with its final rating still to be confirmed."
    : "";
  const loadSizing = deterministicSizing(project, n(design.panelWatts, defaultProposalPanel.watts));
  const startupEnvelopeKw = loadSizing.startupPeakKw;
  const runningEnvelopeKw = loadSizing.simultaneousLoadKw;
  const startupLoadName = loadSizing.startupLoadName || "largest motor";
  const generatorSurgeAdequate = Boolean(startupEnvelopeKw && design.generatorSurgeKw && design.generatorSurgeKw >= startupEnvelopeKw);
  const retainedExistingPanels = Boolean(design.existingPanelGroup?.proposedUseCount);
  const solarFirstAlternative = !proposalUsesPublicGrid(project) && !proposalIncludesBattery(project)
    ? solarFirstPowerAlternative({ panelCount, panelWatts: n(design.panelWatts), inverterKw: n(design.inverterKw), startupPeakKw: startupEnvelopeKw })
    : undefined;
  const solarFallbackText = proposalUsesPublicGrid(project)
    ? "The public grid remains available when solar production is insufficient."
    : proposalIncludesBattery(project)
      ? "The battery may cover weak-sun periods only if its inverter and discharge limits support this load."
      : generator.included
        ? "Without a battery, the generator is the proposed poor-sun fallback, subject to verified running and motor-start capability."
        : "Without grid, battery or generator support, this load should only be treated as available when the solar supply can demonstrably support it.";
  const solarArrayChangeText = solarFirstAlternative?.additionalPanelCount
    ? retainedExistingPanels
      ? `retain these panels and add about ${solarFirstAlternative.additionalPanelCount} compatible ${design.panelWatts ? `${design.panelWatts} W-class ` : ""}panel${solarFirstAlternative.additionalPanelCount === 1 ? "" : "s"} as another suitable string or input`
      : `increase the proposed array to about ${solarFirstAlternative.totalPanelCount} x ${design.panelWatts} W panels`
    : "retain the proposed panel capacity";
  const solarFirstAlternativeText = solarFirstAlternative
    ? ` The solar-first option is to ${solarArrayChangeText} and use about a ${round(solarFirstAlternative.inverterKw, 1)} kW inverter arrangement. That provides roughly ${round(solarFirstAlternative.targetPvKw, 1)} kW of panel capacity and may run the ${startupLoadName} directly in adequate sunlight once the inverter's motor-start behaviour is verified. ${solarFallbackText}`
    : "";
  const limitedSupplyReason = retainedExistingPanels
    ? `Because this proposal uses your ${design.existingPanelGroup?.proposedUseCount} existing ${design.panelWatts ? `${design.panelWatts} W ` : ""}panels, the resulting solar array and ${round(design.inverterKw ?? 0, 1)} kW inverter cannot provide the ${startupLoadName}'s ${round(startupEnvelopeKw ?? 0, 1)} kW starting demand by themselves.`
    : `The proposed solar array and ${round(design.inverterKw ?? 0, 1)} kW inverter cannot provide the ${startupLoadName}'s ${round(startupEnvelopeKw ?? 0, 1)} kW starting demand by themselves.`;
  const batteryFreeStandalone = !proposalUsesPublicGrid(project) && !proposalIncludesBattery(project);
  const topologyNote = batteryFreeStandalone && design.architecture === "ac_coupled"
    ? "This standalone, battery-free AC-coupled arrangement needs a documented grid-forming supply and PV output control. A normal grid-following string inverter or microinverter is not a standalone source; a generator connection alone does not establish compatibility. This power path remains unverified."
    : batteryFreeStandalone && design.architecture === "separate_solar_controller_and_inverter"
      ? "Separate solar controllers and inverters often use a battery-backed DC bus. With no battery selected, the controller-to-inverter power path remains unverified until both manufacturers document compatible battery-free operation."
      : design.architecture === "not_decided" ? "The inverter arrangement is still awaiting comparison or assessment. The schematic is a planning outline, not a confirmed equipment topology." : "";
  const highPowerLoadNotice = batteryFreeStandalone && startupEnvelopeKw && design.inverterKw && startupEnvelopeKw > design.inverterKw
    ? generator.included
      ? generatorSurgeAdequate
        ? `${limitedSupplyReason}${solarFirstAlternativeText} With the current array, a larger ${round(design.generatorContinuousKw ?? 0, 1)} kW-class generator is proposed for that job and must document at least ${round(startupEnvelopeKw, 1)} kW starting capability; start it before using the ${startupLoadName}. A battery with a suitably rated inverter is another possible redesign.`
        : `${limitedSupplyReason}${solarFirstAlternativeText} The current generator selection also does not document the required starting capability. Select a generator with at least ${round(design.generatorContinuousKw ?? runningEnvelopeKw ?? 0, 1)} kW continuous output and documented ${round(startupEnvelopeKw, 1)} kW motor-start capability, or use a compatible soft starter; do not assume the PV and generator ratings add together.`
      : `${limitedSupplyReason}${solarFirstAlternativeText} Until one of these supply paths documents the required motor-start capability, treat the ${startupLoadName} as unsupported.`
    : "";
  const solarFirstUpgradeCount = Math.max(0, panelCount - n(design.energyTargetPanelCount));
  const solarFirstUpgradeApplied = Boolean(batteryFreeStandalone && design.sizingAssumptions?.some((note) => note.startsWith("Solar-first proposal adds")) && startupEnvelopeKw && design.inverterKw && design.inverterKw >= startupEnvelopeKw);
  const solarFirstArrayDescription = supplementary
    ? `It retains ${existingPanelCount} of your existing panels and includes a separate array supplying at least ${round(supplementary.targetPvKw, 2)} kW${supplementary.count && supplementary.watts ? `; ${supplementary.count} × ${supplementary.watts} W ${supplementary.type ?? "planning modules"} is one replaceable planning option` : ""}.`
    : `This proposal includes ${solarFirstUpgradeCount} more panels than the energy baseline.`;
  const solarFirstUpgradeNotice = solarFirstUpgradeApplied
    ? `${solarFirstArrayDescription} A ${round(design.inverterKw ?? 0, 1)} kW inverter class is proposed so solar can supply the ${startupLoadName}'s ${round(startupEnvelopeKw ?? 0, 1)} kW start during adequate sunlight, subject to the selected modules, MPPT limits and inverter's documented motor-start performance. ${solarFallbackText}`
    : "";
  const energyScheduleConflict = Boolean(loadSizing.dailyEnergyKwh && loadSizing.scheduledLoadEnergyKwh && loadSizing.scheduledLoadEnergyKwh > loadSizing.dailyEnergyKwh);
  const generatorCarriesHighPowerLoads = generator.included && /high_power_loads|large_appliances/.test(String(generator.outageRole ?? ""));
  const futureSelections = String(value("expected_expansion")).split(",").map((item) => item.trim()).filter((item) => item && item !== "none");
  const recordedShade = String(value("shading")).toLowerCase();
  const shadePlanningText = ["some", "significant"].includes(recordedShade)
    ? ` ${recordedShade === "significant" ? "Significant" : "Some"} shade is recorded; its time-of-day and seasonal production effect has not yet been numerically modelled.`
    : "";
  const futureLabels: Record<string, string> = { ev: "EV charging", workshop: "more workshop equipment", water_pump: "a water or irrigation pump", extra_dwelling: "another dwelling or building", electric_hot_water: "electric hot water", more_storage: "more battery storage", heated_pool: "a pool, spa or pool heating", more_pv: "more solar panels" };
  const futureText = futureSelections.map((item) => futureLabels[item] ?? item.replaceAll("_", " "));
  const bifacialModulesIncluded = design.panelType === "bifacial";
  return <div>
    <p className="text-sm font-semibold leading-6">{systemScopeSummary(project, design)}</p>
    <p className="mt-3 text-xs leading-5 text-[#31465c]">{moduleAreaM2 ? `${round(moduleAreaM2, 1)} m² of known panel face area` : "Panel dimensions still need confirming"}{recordedAreaM2 ? `; ${round(recordedAreaM2, 1)} m² of recorded ${areaType} before the listed exclusions.` : "; usable mounting area still needs confirming."} The location-based starting recommendation is {azimuthText(design.azimuthDegrees)} azimuth and {design.tiltDegrees !== undefined ? `${round(design.tiltDegrees, 0)}° tilt` : "tilt to confirm"}. Roof-mounted panels normally follow the recorded roof face and pitch; these target angles do not describe an unmeasured roof. Mounting basis: {mountingApproach}.{shadePlanningText}</p>
    {surfaces.faces.length ? <div className="mt-3 space-y-2 text-xs leading-5 text-[#31465c]">{surfaces.faces.map((face) => <p key={face.id}><strong>{face.name}:</strong> {face.direction ? face.direction.replaceAll("_", " ") : "Direction unconfirmed"}{face.pitch ? `, ${face.pitch} surface pitch` : ", pitch unconfirmed"}. {face.capacity !== undefined ? `About ${face.capacity} modules in the preliminary rectangular layout. ` : "Module fit awaits dimensions. "}{face.mountingDescription} {face.aspect}</p>)}{surfaces.warnings.map((warning) => <p key={warning} className="rounded-lg border border-[#e2c765] bg-[#fff8d8] p-3">{warning}</p>)}</div> : null}
    <p className="mt-3 text-xs leading-5 text-[#31465c]">Power conversion is through {design.inverterKw ? `${inverterArticle} ${design.inverterKw} kW ` : "a "}{architecture}. {gridRelationship} {proposalIncludesBattery(project) ? `The proposed ${[batteryVoltageText, design.batteryUsableKwh ? `${round(design.batteryUsableKwh, 1)} kWh usable` : "", chemistry].filter(Boolean).join(", ")} battery supports the recorded backup or energy-shifting goal.` : "No battery is included."}{generatorText}</p>
    {bifacialModulesIncluded ? <p className="mt-3 rounded-xl border border-[#b8d7f1] bg-[#eef6fd] p-3 text-xs leading-5 text-[#31465c]"><strong>Bifacial design check:</strong> Panel wattage is treated as front-side nameplate capacity. Rear-side gain varies with mounting height, ground reflectance, spacing, shade and season, so it is not assumed as guaranteed output. The selected inverter and MPPT inputs must be checked against the module datasheet&apos;s bifacial current allowance, maximum voltage and the chosen DC oversizing or clipping strategy.</p> : null}
    {topologyNote ? <p className="mt-3 rounded-xl border border-[#e2c765] bg-[#fff8d8] p-3 text-xs leading-5 text-[#6a5110]"><strong>Inverter arrangement check:</strong> {topologyNote}</p> : null}
    {solarFirstUpgradeNotice ? <p className="mt-3 rounded-xl border border-[#9bcdb2] bg-[#effaf4] p-3 text-xs font-semibold leading-5 text-[#245c3e]"><strong>Solar-first sizing:</strong> {solarFirstUpgradeNotice}</p> : null}
    {highPowerLoadNotice ? <p className={`mt-3 rounded-xl border p-3 text-xs font-semibold leading-5 ${generatorSurgeAdequate ? "border-[#e2c765] bg-[#fff8d8] text-[#6a5110]" : "border-[#e6aa9c] bg-[#fff0eb] text-[#873824]"}`}><strong>High-power load check:</strong> {highPowerLoadNotice}</p> : null}
    {energyScheduleConflict ? solarFirstUpgradeApplied ? <p className="mt-3 rounded-xl border border-[#b8d7f1] bg-[#eef6fd] p-3 text-xs font-semibold leading-5 text-[#31465c]"><strong>Workday energy check:</strong> The entered tool runtimes imply about {round(loadSizing.scheduledLoadEnergyKwh ?? 0, 1)} kWh per workday, above the separate {round(loadSizing.dailyEnergyKwh ?? 0, 1)} kWh/day whole-system answer. The larger solar-first power path does not prove that both figures are additional or that sunlight will coincide with every tool run. Reconcile the overlap before final energy sizing; direct solar is preferred when available and the generator covers the remaining supported periods.</p> : generatorCarriesHighPowerLoads ? <p className="mt-3 rounded-xl border border-[#e2c765] bg-[#fff8d8] p-3 text-xs font-semibold leading-5 text-[#6a5110]"><strong>Workshop energy arrangement:</strong> The entered high-power tool runtimes imply about {round(loadSizing.scheduledLoadEnergyKwh ?? 0, 1)} kWh per workday. Because the generator is explicitly assigned those loads, this subtotal informs generator runtime and fuel planning rather than automatically increasing the {round(loadSizing.dailyEnergyKwh ?? 0, 1)} kWh/day solar basis. Solar may reduce generator loading when available, but the design does not rely on combined output.</p> : <p className="mt-3 rounded-xl border border-[#e6aa9c] bg-[#fff0eb] p-3 text-xs font-semibold leading-5 text-[#873824]"><strong>Energy estimates need reconciling:</strong> The entered tool ratings and runtimes imply about {round(loadSizing.scheduledLoadEnergyKwh ?? 0, 1)} kWh per workday, above the {round(loadSizing.dailyEnergyKwh ?? 0, 1)} kWh whole-system answer currently used for solar sizing. This is an unverified consumption subtotal—not a battery or generator requirement. Loads still add in kWh when used at different times, while direct solar may serve the portion that coincides with production. Operating times or an explicit solar/generator allocation are needed before that split can be calculated.</p> : null}
    {futureText.length ? <p className="mt-3 rounded-xl border border-[#d8c777] bg-[#fff9df] p-3 text-xs leading-5 text-[#624b14]"><strong>Future-ready note:</strong> You may later add {futureText.join(", ")}. These possibilities are not included in the current equipment sizes or energy calculation. Preserve practical expansion options where reasonable, then recalculate before purchasing equipment for an addition.</p> : null}
    <p className="mt-3 border-t border-[#ccdae7] pt-3 text-xs leading-5 text-muted"><strong className="text-brand">Built for you, adjustable by you.</strong> These quantities, ratings and component types are planning recommendations—not absolutes. Change them to suit your goals and available equipment; verify the selected products, structure, cable routes, protection, isolation and local requirements before purchase or construction.</p>
  </div>;
}

function proposalIncludesBattery(project: Project) {
  const requirement = String(project.designDiscovery?.battery_requirement?.value ?? "").toLowerCase();
  if (["none", "no battery storage"].includes(requirement)) return false;
  if (["include", "include battery storage"].includes(requirement)) return true;
  const backup = String(project.designDiscovery?.backup_preference?.value ?? "").toLowerCase();
  return project.projectType === "off-grid" || Boolean(backup && backup !== "none" && backup !== "no outage backup");
}

type DiscoveredGenerator = {
  included: boolean;
  purchaseStatus?: "not_purchased" | "have_details";
  generatorType?: string;
  fuel?: string;
  continuousKw?: number;
  surgeKw?: number;
  connectionMethod?: string;
  outageRole?: string;
};

function discoveredGenerator(project: Project): DiscoveredGenerator {
  return generatorFromDiscovery(project.designDiscovery ?? {});
}

function discoveredDailyEnergyKwh(project: Project) {
  return normalizedDailyEnergy(project.designDiscovery ?? {})?.dailyKwh;
}

function deterministicSizing(project: Project, panelWatts = defaultProposalPanel.watts, selectedPanelCount?: number) {
  const savedPanel = project.designCalculator;
  const usesDefaultPanel = !savedPanel?.panelWatts || savedPanel.panelProfileBasis === "representative";
  return deriveProposalSizing({
    mode: project.projectType,
    peakSunHours: project.peakSunHours,
    autonomyDays: project.autonomyDays,
    discovery: project.designDiscovery ?? {},
    representativePanelWatts: panelWatts,
    selectedPanelCount,
    representativePanelLengthMm: savedPanel?.panelLengthMm ?? (usesDefaultPanel ? defaultProposalPanel.lengthMm : undefined),
    representativePanelWidthMm: savedPanel?.panelWidthMm ?? (usesDefaultPanel ? defaultProposalPanel.widthMm : undefined),
    solarResource: project.solarResource,
  });
}

function batterySizingBasis(project: Project, currentDesign: DesignCalculatorState = project.designCalculator ?? {}) {
  const sizing = deterministicSizing(
    project,
    n(currentDesign.panelWatts, defaultProposalPanel.watts),
    n(currentDesign.panelCount) || undefined,
  );
  if (sizing.batteryUsableKwh && sizing.batterySizingBasis === "solar_assisted_typical_winter")
    return `${round(sizing.batteryUsableKwh, 1)} kWh usable: the larger of assumed non-solar-window load (${round(sizing.assumedNonSolarLoadKwh ?? 0, 1)} kWh) and weakest-month PV shortfall (${round((sizing.dailyEnergyKwh ?? 0) - (sizing.weakestMonthPvKwh ?? 0), 1)} kWh)`;
  if (sizing.batteryUsableKwh)
    return `${round(sizing.dailyEnergyKwh ?? 0, 1)} kWh/day × ${sizing.batteryOnlyDays} battery-only day equivalent`;
  return sizing.warnings.find((warning) => warning.startsWith("Battery size withheld"))
    ?? "Usable storage requires recorded daily energy, scope and source timing";
}

function proposalBatterySizing(project: Project, savedUsableKwh?: number, trustSavedWithoutBasis = false) {
  if (trustSavedWithoutBasis && savedUsableKwh) return { usableKwh: savedUsableKwh, acceptedSavedValue: true };
  const calculatedUsableKwh = deterministicSizing(project, n(project.designCalculator?.panelWatts, defaultProposalPanel.watts)).batteryUsableKwh;
  const matches = Boolean(savedUsableKwh && calculatedUsableKwh && Math.abs(savedUsableKwh - calculatedUsableKwh) <= .05);
  return { usableKwh: calculatedUsableKwh, acceptedSavedValue: matches };
}

function suggestedPanelCount(project: Project, panelWatts: number) {
  if (!proposalIncludesSolar(project.designDiscovery ?? {})) return 0;
  const expected = deterministicSizing(project, panelWatts);
  const upgrade = !proposalUsesPublicGrid(project) && !proposalIncludesBattery(project) ? solarFirstPowerAlternative({
    panelCount: expected.panelCount,
    panelWatts,
    inverterKw: expected.inverterKw,
    startupPeakKw: expected.startupPeakKw,
  }) : undefined;
  return upgrade?.totalPanelCount ?? expected.panelCount;
}

export function wattsonPanelSizingIsPlausible(project: Project, panelWatts: number, saved: DesignCalculatorState) {
  if (saved.updatedBy !== "wattson") return true;
  if (!proposalIncludesSolar(project.designDiscovery ?? {})) return !saved.panelCount && !saved.targetPvKw;
  const baseline = deterministicSizing(project, panelWatts);
  const powerUpgrade = !proposalUsesPublicGrid(project) && !proposalIncludesBattery(project) ? solarFirstPowerAlternative({
    panelCount: baseline.panelCount,
    panelWatts,
    inverterKw: baseline.inverterKw,
    startupPeakKw: baseline.startupPeakKw,
  }) : undefined;
  const expectedPanelCount = powerUpgrade?.totalPanelCount ?? baseline.panelCount;
  const expectedPvKw = powerUpgrade?.targetPvKw ?? baseline.pvKw;
  if (!expectedPanelCount || !expectedPvKw) return false;
  const savedPvKw = n(saved.targetPvKw) || n(saved.panelCount) * panelWatts / 1000;
  const supplementary = supplementaryArray(saved);
  if (supplementary && saved.existingPanelGroup?.proposedUseCount) {
    const existing = saved.existingPanelGroup;
    const required = powerUpgrade ? powerUpgrade.inverterKw * 1.2 : expectedPvKw;
    return n(existing.proposedUseCount) <= n(existing.maximumAvailableToProposal, existing.availableCount)
      && Math.abs(savedPvKw - required) <= .01
      && Math.abs(n(existing.proposedUseCount) * panelWatts / 1000 + supplementary.targetPvKw - savedPvKw) <= .01;
  }
  return saved.panelCount === expectedPanelCount && Math.abs(savedPvKw - expectedPvKw) <= .01;
}

function suggestedInverterKw(project: Project) {
  const panelWatts = n(project.designCalculator?.panelWatts, defaultProposalPanel.watts);
  const baseline = deterministicSizing(project, panelWatts);
  const upgrade = !proposalUsesPublicGrid(project) && !proposalIncludesBattery(project) ? solarFirstPowerAlternative({
    panelCount: baseline.panelCount,
    panelWatts,
    inverterKw: baseline.inverterKw,
    startupPeakKw: baseline.startupPeakKw,
  }) : undefined;
  return upgrade?.inverterKw ?? baseline.inverterKw;
}

function proposedInverterKw(project: Project, saved: DesignCalculatorState) {
  const calculated = suggestedInverterKw(project);
  if (!saved.inverterKw) return calculated;
  if (saved.updatedBy !== "wattson") return saved.inverterKw;
  return calculated;
}

function proposedGeneratorKw(generator: DiscoveredGenerator, inverterKw?: number) {
  if (!generator.included) return undefined;
  if (generator.continuousKw) return generator.continuousKw;
  if (generator.purchaseStatus === "have_details") return undefined;
  if (!inverterKw) return undefined;
  return Math.max(1, Math.ceil(inverterKw * 0.85 * 2) / 2);
}

function planningNodeDetail(node: NonNullable<NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>["nodes"]>[number], design: DesignCalculatorState) {
  const supplementary = supplementaryArray(design);
  if (supplementary && node.id === "solar-pv-1") return { ...node, detail: `${design.existingPanelGroup?.proposedUseCount ?? "?"} x ${design.existingPanelGroup?.wattsEach ?? design.panelWatts ?? "?"} W user-owned panels; suitability to verify` };
  if (supplementary && node.id === "solar-pv-2") return { ...node, detail: `${round(supplementary.targetPvKw, 2)} kW minimum separate array; module type and quantity to select` };
  if (node.id === "solar" || node.id.startsWith("solar-pv-")) return { ...node, detail: `${node.id.startsWith("solar-pv-") ? design.panelsPerString ?? "?" : design.panelCount ?? "?"} x ${design.panelWatts ?? "?"} W; ${node.id.startsWith("solar-pv-") ? "one independent PV string" : pvLayoutLabel(design)}` };
  if (node.id.includes("inverter") && design.inverterKw) return { ...node, detail: `${design.inverterKw} kW continuous rating proposed${node.id === "pv-inverter" ? "; " + node.detail : ""}` };
  if (node.id === "battery") {
    const nominalKwh = n(design.batteryVoltage) * n(design.batteryAh) * n(design.batteryQuantity, 1) / 1000;
    const usableKwh = nominalKwh * n(design.usableBatteryPercent, 80) / 100 || n(design.batteryUsableKwh);
    return { ...node, detail: usableKwh ? `${round(usableKwh, 1)} kWh usable (${design.batteryAh ?? "?"} Ah at ${design.batteryVoltage ?? "?"} V)` : "Battery capacity still to be confirmed" };
  }
  if (node.id === "generator") return { ...node, detail: design.generatorContinuousKw ? `${design.generatorContinuousKw} kW continuous target${design.generatorPurchaseStatus === "not_purchased" ? "; generator not purchased yet" : ""}` : "Generator rating still to be confirmed" };
  return node;
}

function generatorInterfaceSpecification(design: DesignCalculatorState, gridConnected = false) {
  const method = design.generatorConnectionMethod;
  const inverterTarget = design.architecture === "ac_coupled" ? "battery-inverter" : "inverter";
  const hybridDefaultsToInverterInput = !method && ["combined_hybrid_inverter", "separate_solar_controller_and_inverter"].includes(String(design.architecture));
  if (method === "inverter_input" || hybridDefaultsToInverterInput) return {
    target: inverterTarget,
    label: "Generator AC input breaker",
    detail: "Protects the generator feed into the hybrid inverter's documented AC/generator input. Use the breaker type, poles and maximum rating required by the exact inverter manual; it may also provide isolation where permitted.",
    image: "/schematic-components/generator-ac-input-breaker-v2.png",
  };
  if (method === "ats") return {
    target: "switchboard",
    label: "Automatic source transfer",
    detail: "Transfers the supported switchboard supply path automatically; generator remote-start control is a separate requirement.",
    image: "/schematic-components/automatic-transfer-switch-ats.jpg",
  };
  if (method === "changeover") return {
    target: "switchboard",
    label: "Generator inlet and manual changeover",
    detail: "Provides a protected generator connection and prevents another source from energising the board at the same time.",
    image: "/schematic-components/generator-inlet-box.jpg",
  };
  if (method === "portable_inlet") return {
    target: "switchboard",
    label: "Generator inlet and source isolation",
    detail: `Provides a suitable inlet and protection${gridConnected ? ", with an approved transfer arrangement preventing grid backfeed" : " for the switchboard supply path"}.`,
    image: "/schematic-components/generator-inlet-box.jpg",
  };
  if (method === "direct_wired") return {
    target: "switchboard",
    label: "Generator isolation and protection",
    detail: `Provides isolation and circuit protection for the fixed generator feed${gridConnected ? ", with approved source transfer preventing grid backfeed" : ""}.`,
    image: "/schematic-components/ac-circuit-breaker-mcb.jpg",
  };
  return {
    target: "switchboard",
    label: "Generator connection route to confirm",
    detail: "Confirm whether the generator feeds an approved inverter input or the switchboard; isolation, protection and any source-transfer requirements follow that choice and local rules.",
    image: "/schematic-components/generator-inlet-box.jpg",
  };
}

function componentPlanningDetail(node: NonNullable<NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>["nodes"]>[number], draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>, design: DesignCalculatorState, ready: boolean) {
  const basic = planningNodeDetail(node, design);
  if (!ready) return basic;
  const touching = (draft.connections ?? []).filter((connection) => connection.from === node.id || connection.to === node.id);
  const dc = touching.find((connection) => connection.kind === "solar-dc");
  const ac = touching.find((connection) => connection.kind === "ac" && !connection.authorityCheck);
  if (node.id.includes("solar-safety")) {
    const stringVoc = n(design.panelVocV) * n(design.panelsPerString, 1);
    const ratedVoltage = stringVoc <= 600 ? 600 : stringVoc <= 1000 ? 1000 : 1500;
    const ratedCurrent = [16, 20, 25, 32, 40, 50, 63].find((amps) => amps >= Math.max(32, n(dc?.protectionAmps))) ?? Math.ceil(n(dc?.protectionAmps));
    return { ...basic, detail: `${ratedVoltage} V DC · ${ratedCurrent} A minimum · DC-PV2 load-break isolator; confirm cold-corrected Voc, poles, enclosure and location` };
  }
  if (node.id === "ac-safety") return { ...basic, detail: `${design.connectionType === "ac_three" ? 400 : 230} V AC · ${ac?.protectionAmps ?? "rating to verify"} A protection; confirm poles, curve, fault rating and RCD requirements` };
  return basic;
}

type ProposedNode = NonNullable<NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>["nodes"]>[number];
type ProposedDraft = NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>;
type ComponentSpec = { label: string; value: string; note?: string };

function componentSpecifications(node: ProposedNode, draft: ProposedDraft, design: DesignCalculatorState): ComponentSpec[] {
  const touching = (draft.connections ?? []).filter((connection) => connection.from === node.id || connection.to === node.id);
  const dc = touching.find((connection) => connection.kind === "solar-dc");
  const batteryDc = touching.find((connection) => connection.kind === "battery-dc");
  const ac = touching.find((connection) => connection.kind === "ac" && !connection.authorityCheck);
  const earth = touching.find((connection) => connection.kind === "earth");
  const value = (number: number | undefined, unit: string) => number ? `${number} ${unit}` : "To be confirmed";

  if (node.id === "solar" || node.id.startsWith("solar-pv-")) {
    const supplementary = supplementaryArray(design);
    const isSupplementary = Boolean(supplementary && node.id === "solar-pv-2");
    const quantity = supplementary && node.id === "solar-pv-1" ? n(design.existingPanelGroup?.proposedUseCount) : isSupplementary ? supplementary?.count ?? 0 : node.id.startsWith("solar-pv-") ? n(design.panelsPerString) : n(design.panelCount);
    const panelWatts = isSupplementary ? supplementary?.watts ?? 0 : n(design.existingPanelGroup?.wattsEach, n(design.panelWatts));
    const panelWeight = isSupplementary ? 0 : n(design.panelWeightKg);
    const stringPanels = node.id.startsWith("solar-pv-") ? quantity : n(design.panelsPerString);
    return [
      { label: "Quantity", value: quantity ? `${quantity} panels` : "To be confirmed" },
      { label: "Module rating", value: panelWatts ? `${panelWatts} W each` : "Select modules to meet the capacity target" },
      { label: "Nameplate power", value: isSupplementary && supplementary ? `At least ${round(supplementary.targetPvKw, 2)} kW${quantity && panelWatts ? ` (${round(quantity * panelWatts / 1000, 2)} kW planning option)` : ""}` : quantity && panelWatts ? `${round(quantity * panelWatts / 1000, 2)} kW` : "To be confirmed" },
      { label: "Module dimensions", value: isSupplementary ? supplementary?.lengthMm && supplementary?.widthMm ? `${supplementary.lengthMm} × ${supplementary.widthMm} mm planning option` : "To be confirmed" : design.panelLengthMm && design.panelWidthMm ? `${design.panelLengthMm} × ${design.panelWidthMm} mm each` : "To be confirmed" },
      { label: "Module weight", value: panelWeight ? `${panelWeight} kg each${quantity ? ` · ${round(panelWeight * quantity, 1)} kg total` : ""}` : "To be confirmed", note: design.panelWeightBasis },
      { label: "Module Vmp / Voc", value: !isSupplementary && design.panelVmpV && design.panelVocV ? `${design.panelVmpV} / ${design.panelVocV} V` : "To be confirmed" },
      { label: "String Vmp / Voc", value: !isSupplementary && stringPanels && design.panelVmpV && design.panelVocV ? `${round(stringPanels * design.panelVmpV, 1)} / ${round(stringPanels * design.panelVocV, 1)} V` : "To be confirmed", note: "Nameplate values; final maximum voltage needs the cold-temperature correction." },
      { label: "Module Imp / Isc", value: !isSupplementary && design.panelImpA && design.panelIscA ? `${design.panelImpA} / ${design.panelIscA} A` : "To be confirmed" },
      { label: "Maximum system voltage", value: isSupplementary ? "To be confirmed" : value(design.panelMaximumSystemVoltageV, "V DC") },
      { label: "Maximum series fuse", value: isSupplementary ? "To be confirmed" : value(design.panelMaximumSeriesFuseA, "A") },
      { label: "Mounting location", value: mountingLocationText(design.mountingLocations) },
      { label: "Planning azimuth", value: azimuthText(design.azimuthDegrees), note: "Equator-facing Site recommendation until the actual mounting surface is confirmed." },
      { label: "Planning tilt", value: design.tiltDegrees !== undefined ? `${round(design.tiltDegrees, 0)}°` : "To be confirmed", note: "Latitude-based planning recommendation until the actual surface pitch is entered." },
    ];
  }

  if (node.id.includes("solar-safety")) {
    const stringVoc = n(design.panelVocV) * n(design.panelsPerString, 1);
    const ratedVoltage = stringVoc <= 600 ? 600 : stringVoc <= 1000 ? 1000 : 1500;
    const requiredCurrent = Math.max(32, n(dc?.protectionAmps));
    const ratedCurrent = [16, 20, 25, 32, 40, 50, 63].find((amps) => amps >= requiredCurrent) ?? Math.ceil(requiredCurrent);
    return [
      { label: "Device", value: "DC rotary load-break isolator" },
      { label: "Utilisation category", value: "DC-PV2" },
      { label: "Minimum voltage rating", value: `${ratedVoltage} V DC`, note: `String nameplate Voc ${round(stringVoc, 1)} V; confirm cold-corrected maximum.` },
      { label: "Minimum current rating", value: `${ratedCurrent} A` },
      { label: "Poles / enclosure", value: "Confirm for the selected inverter, location and installation method" },
    ];
  }

  if (node.id.includes("inverter")) return [
    { label: "Continuous output", value: value(design.inverterKw, "kW") },
    { label: "Arrangement", value: design.architecture?.replaceAll("_", " ") ?? "To be confirmed" },
    { label: "AC system", value: `${design.connectionType === "ac_three" ? 400 : 230} V AC` },
    { label: "PV inputs", value: design.pvStrings ? `${design.pvStrings} independent MPPT input${design.pvStrings === 1 ? "" : "s"} required` : "To be confirmed" },
    { label: "Connected AC circuit", value: ac?.protectionAmps ? `${ac.protectionAmps} A planning protection · ${value(ac.cableSizeMm2, "mm² cable")}` : "Complete the route configuration" },
  ];

  if (node.id === "generator") return [
    { label: "Purchase status", value: design.generatorPurchaseStatus === "not_purchased" ? "Not purchased yet" : "Existing or selected generator" },
    { label: "Continuous target", value: value(design.generatorContinuousKw, "kW") },
    { label: "Motor-start requirement", value: value(design.generatorSurgeKw, "kW") },
    { label: "Type", value: design.generatorType?.replaceAll("_", " ") ?? "Select a compatible generator" },
    { label: "Fuel", value: design.generatorFuel?.replaceAll("_", " ") ?? "To be chosen" },
    { label: "Connection", value: design.generatorConnectionMethod?.replaceAll("_", " ") ?? "Dedicated inlet/changeover or approved inverter input to be confirmed" },
  ];

  if (node.id === "generator-changeover") return [
    { label: "Purpose", value: generatorInterfaceSpecification(design).detail },
    { label: "Generator target", value: value(design.generatorContinuousKw, "kW continuous") },
    { label: "Auto start", value: "Only include when requested and when the generator and controller document compatible remote-start support" },
    { label: "Final checks", value: "Voltage, phase, neutral/earth arrangement, isolation, protection, inlet, source transfer and local electrical requirements" },
  ];

  if (node.id === "ac-safety") return [
    { label: "Device", value: "AC protective switching device" },
    { label: "Voltage rating", value: `${design.connectionType === "ac_three" ? 400 : 230} V AC` },
    { label: "Current rating", value: ac?.protectionAmps ? `${ac.protectionAmps} A` : "Complete the route configuration" },
    { label: "Connected cable", value: value(ac?.cableSizeMm2, "mm²") },
    { label: "Final checks", value: "Poles, trip curve, fault rating and RCD requirements" },
  ];

  if (node.id === "battery") return [
    { label: "Quantity", value: design.batteryQuantity ? `${design.batteryQuantity}` : "To be confirmed" },
    { label: "Nominal voltage", value: value(design.batteryVoltage, "V each") },
    { label: "Capacity", value: value(design.batteryAh, "Ah each") },
    { label: "Chemistry", value: design.batteryChemistry ?? "To be confirmed" },
    { label: "Planning usable", value: design.usableBatteryPercent ? `${design.usableBatteryPercent}%` : "To be confirmed" },
  ];

  if (node.id === "battery-safety") return [
    { label: "Device", value: "Battery-rated DC fuse and disconnect" },
    { label: "System voltage", value: value(design.batteryVoltage, "V DC") },
    { label: "Protection rating", value: batteryDc?.protectionAmps ? `${batteryDc.protectionAmps} A` : "Complete the route configuration" },
    { label: "Connected cable", value: value(batteryDc?.cableSizeMm2, "mm²") },
    { label: "Final checks", value: "DC interrupt rating, fuse class, polarity and enclosure" },
  ];

  const connectionSpecs = touching.map((connection) => ({
    label: connection.label,
    value: [connection.cableSizeMm2 ? `${connection.cableSizeMm2} mm² cable` : "Cable to confirm", connection.protectionAmps ? `${connection.protectionAmps} A protection` : connection.kind === "earth" ? "No overcurrent device" : "Protection to confirm"].join(" · "),
    note: connection.lengthM ? `${connection.lengthM} m ${connection.lengthBasis ?? "estimated"} one-way route` : undefined,
  }));
  return [
    { label: "Function", value: node.detail },
    ...(node.id === "switchboard" ? [{ label: "AC system", value: `${design.connectionType === "ac_three" ? 400 : 230} V AC` }] : []),
    ...(node.id === "earth" && earth?.cableSizeMm2 ? [{ label: "Protective conductor", value: `${earth.cableSizeMm2} mm²` }] : []),
    ...connectionSpecs,
    ...(node.notes ? [{ label: "Recorded note", value: node.notes }] : []),
  ];
}

function batteryAdjustedDraft(draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>, includeBattery: boolean) {
  if (includeBattery) return draft;
  const batteryNodeIds = new Set(["battery", "battery-safety", "battery-inverter"]);
  return {
    ...draft,
    flow: draft.flow?.filter((item) => !item.toLowerCase().includes("battery")),
    nodes: draft.nodes?.filter((node) => !batteryNodeIds.has(node.id)),
    connections: draft.connections?.filter((connection) => !batteryNodeIds.has(connection.from) && !batteryNodeIds.has(connection.to)),
  };
}

function upgradePvStringIsolationDraft(draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>, design: DesignCalculatorState) {
  const stringCount = Math.max(1, Math.round(n(design.pvStrings, 1)));
  if (stringCount <= 1 || !draft.nodes?.some((node) => node.id === "solar-safety") || draft.nodes.some((node) => node.id === "solar-safety-1") || draft.nodes.some((node) => node.id === "solar-pv-1")) return draft;
  const inbound = draft.connections?.find((connection) => connection.from === "solar" && connection.to === "solar-safety");
  const outbound = draft.connections?.find((connection) => connection.from === "solar-safety" && connection.kind === "solar-dc");
  if (!inbound || !outbound) return draft;
  const safety = draft.nodes.find((node) => node.id === "solar-safety");
  const solar = draft.nodes.find((node) => node.id === "solar");
  const nodes = draft.nodes.filter((node) => node.id !== "solar" && node.id !== "solar-safety");
  const connections = (draft.connections ?? []).filter((connection) => connection !== inbound && connection !== outbound);
  for (let index = 0; index < stringCount; index += 1) {
    nodes.push({ id: `solar-pv-${index + 1}`, label: `PV${index + 1} · ${n(design.panelsPerString, 1)} panels`, detail: `${n(design.panelsPerString, 1)} × ${design.panelWatts ?? "?"} W; one independent PV string`, image: solar?.image ?? "/schematic-components/solar-panel-pv-module.jpg", x: solar?.x ?? 35, y: (solar?.y ?? 30) + index * 125 });
    const id = `solar-safety-${index + 1}`;
    nodes.push({ id, label: `PV${index + 1} isolator`, detail: `DC isolator for PV${index + 1}; disconnects that string independently`, image: safety?.image ?? "/schematic-components/dc-disconnect-isolator.jpg", x: safety?.x ?? 250, y: (safety?.y ?? 30) + index * 125 });
    connections.push(
      { from: `solar-pv-${index + 1}`, to: id, label: `PV${index + 1} string`, kind: "solar-dc" },
      { from: id, to: outbound.to, label: `PV${index + 1} string to MPPT${index + 1}`, kind: "solar-dc" },
    );
  }
  return { ...draft, nodes, connections };
}

function ensurePvArrayEarth(draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>) {
  const nodes = draft.nodes ?? [];
  const inverter = nodes.find((node) => node.id === "inverter" || node.id.includes("inverter"));
  if (!inverter) return draft;
  const solarNodes = nodes.filter((node) => node.id === "solar" || node.id.startsWith("solar-pv-"));
  const originalConnections = draft.connections ?? [];
  const existing = originalConnections.filter((connection) => !(connection.kind === "earth" && /array frame earth/i.test(connection.label)));
  const alreadyCorrect = solarNodes.length > 0 && solarNodes.every((node, index) => existing.some((connection) => connection.from === node.id && connection.to === (solarNodes[index + 1]?.id ?? inverter.id) && /array frame bond/i.test(connection.label)));
  if (alreadyCorrect) return existing.length === originalConnections.length ? draft : { ...draft, connections: existing };
  const additions = solarNodes.map((node, index) => ({
    from: node.id,
    to: solarNodes[index + 1]?.id ?? inverter.id,
    label: `${node.id.startsWith("solar-pv-") ? `PV${node.id.split("-").at(-1)}` : `PV${index + 1}`} array frame bond`,
    kind: "earth" as const,
    notes: "Continuous protective bonding of PV module frames and mounting structure back to the installation earthing system through the inverter earthing point; verify the final topology against the selected equipment and AS/NZS requirements.",
  }));
  return additions.length ? { ...draft, connections: [...existing, ...additions] } : draft;
}

function preliminaryConnectionValues(connection: NonNullable<NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>["connections"]>[number], design: DesignCalculatorState) {
  if (connection.configured === true) return connection;
  if (!connection.lengthM && connection.kind !== "earth") return connection;
  if (connection.kind === "earth") {
    if (/\bPV\d* array frame bond\b/i.test(connection.label)) {
      const pvCableMm2 = planningCableForCurrent(n(design.panelIscA) * 1.25);
      const earthCableMm2 = planningProtectiveEarth(pvCableMm2, Math.ceil(n(design.panelIscA) * 1.25), design.electricalStandard, true);
      return { ...connection, cableSizeMm2: connection.cableSizeMm2 ?? earthCableMm2, protectionAmps: undefined, notes: connection.notes ?? (earthCableMm2 ? `Preliminary PV bonding size calculated using the ${design.electricalStandard} regional profile.` : "Protective bonding size requires the Site's applicable electrical standard.") };
    }
    const acCurrent = n(design.inverterKw) * 1000 / 230;
    const activeCableMm2 = planningAcCableForCurrent(acCurrent);
    const earthCableMm2 = planningProtectiveEarth(activeCableMm2, Math.ceil(acCurrent * 1.25), design.electricalStandard);
    return { ...connection, cableSizeMm2: connection.cableSizeMm2 ?? earthCableMm2, protectionAmps: undefined, notes: connection.notes ?? (earthCableMm2 ? `Preliminary protective-earth size calculated using the ${design.electricalStandard} regional profile.` : "Protective-earth size requires the Site's applicable electrical standard.") };
  }
  if (connection.authorityCheck) return connection;
  const voltage = connection.kind === "solar-dc" ? n(design.panelVmpV) * n(design.panelsPerString) : connection.kind === "battery-dc" ? n(design.batteryVoltage) : 230;
  const combinedLegacyPvFeed = connection.from === "solar" || connection.from === "solar-safety";
  const solarCurrent = n(design.panelIscA) * 1.25 * (combinedLegacyPvFeed ? n(design.pvStrings, 1) : 1);
  const current = connection.kind === "solar-dc" ? solarCurrent : n(design.inverterKw) * 1000 / Math.max(voltage, 1);
  if (!voltage || !current) return connection;
  const currentCapacityCable = connection.kind === "ac" ? planningAcCableForCurrent(current) : planningCableForCurrent(current);
  return { ...connection, cableSizeMm2: Math.max(connection.cableSizeMm2 ?? 0, 1.5, currentCapacityCable), protectionAmps: connection.protectionAmps ?? Math.ceil(current * 1.25), notes: connection.notes ?? "Preliminary current-capacity sizing; confirm route, derating, equipment limits and protection coordination." };
}

function NumberField({ label, value, unit, max, onChange }: { label: string; value?: number; unit?: string; max?: number; onChange: (value: number) => void }) {
  return <label className="space-y-1.5 text-xs font-bold"><span>{label}</span><div className="flex overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand"><input type="number" min="0" max={max} step="any" value={value ?? ""} onChange={(event) => onChange(n(event.target.value))} className="h-11 min-w-0 flex-1 bg-transparent px-3 outline-none"/>{unit && <span className="grid place-items-center border-l border-line bg-[#f5f8fb] px-3 text-[10px] text-muted">{unit}</span>}</div></label>;
}

function Result({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-line bg-white p-4"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">{label}</span><strong className="mt-2 block text-2xl tracking-[-.04em]">{value}</strong><p className="mt-1 text-[10px] leading-4 text-muted">{detail}</p></div>;
}

function pvLayoutLabel(design: Pick<DesignCalculatorState, "pvStrings" | "panelsPerString" | "panelCount" | "existingPanelGroup">) {
  if (design.existingPanelGroup?.supplementaryTargetPvKw) return "2 separate arrays; string layouts to confirm";
  if (design.pvStrings && design.panelsPerString) return `${design.pvStrings} parallel string${design.pvStrings === 1 ? "" : "s"} x ${design.panelsPerString} panels in series`;
  if (design.panelsPerString) return `${design.panelsPerString} panels in series per string`;
  if (design.pvStrings) return `${design.pvStrings} parallel string${design.pvStrings === 1 ? "" : "s"}`;
  return design.panelCount ? "Series/parallel layout still to be checked" : "Panel count still to be checked";
}

function pvLayoutCountMismatch(design: Pick<DesignCalculatorState, "pvStrings" | "panelsPerString" | "panelCount">) {
  if (!design.pvStrings || !design.panelsPerString || !design.panelCount) return false;
  return design.pvStrings * design.panelsPerString !== design.panelCount;
}

function discoveredAcSupply(project: Project) {
  const phase = String(project.designDiscovery?.ac_phase_arrangement?.value ?? "").toLowerCase();
  const recordedVoltage = String(project.designDiscovery?.nominal_ac_voltage?.value ?? "").toLowerCase();
  const connectionType = /three|3[ -]?phase/.test(phase) ? "ac_three" as const : /single|split/.test(phase) ? "ac_single" as const : undefined;
  const voltage = recordedVoltage.includes("440_480") || /440\s*[–-]\s*480/.test(recordedVoltage) ? 480
    : recordedVoltage.includes("380_415") || /380\s*[–-]\s*415/.test(recordedVoltage) ? 400
      : recordedVoltage.includes("200_240") || /200\s*[–-]\s*240/.test(recordedVoltage) ? 230
        : recordedVoltage.includes("110_120") || /110\s*[–-]\s*120/.test(recordedVoltage) ? 120
          : Number(recordedVoltage.match(/\d+(?:\.\d+)?/)?.[0]) || undefined;
  return { connectionType, voltage };
}

export function DesignCalculator({ project, site }: { project: Project; site: Site }) {
  const commissioned = ["monitor", "diagnose", "maintain", "explain"].includes(project.phase);
  const includeBattery = proposalIncludesBattery(project);
  const [design, setDesign] = useState<DesignCalculatorState>(() => {
    const stored = { ...project.designCalculator, ...recommendedPanelOrientation(project.designCalculator ?? {}, site.latitude) };
    const saved: DesignCalculatorState = stored.panelWatts ? stored : {
      panelType: defaultProposalPanel.panelType,
      panelManufacturer: defaultProposalPanel.manufacturer,
      panelModel: defaultProposalPanel.model,
      panelSupplier: defaultProposalPanel.supplier,
      panelProductUrl: defaultProposalPanel.productUrl,
      panelDatasheetUrl: defaultProposalPanel.datasheetUrl,
      panelDatasheetVersion: defaultProposalPanel.datasheetVersion,
      panelWatts: defaultProposalPanel.watts,
      panelLengthMm: defaultProposalPanel.lengthMm,
      panelWidthMm: defaultProposalPanel.widthMm,
      panelThicknessMm: defaultProposalPanel.thicknessMm,
      panelWeightKg: defaultProposalPanel.weightKg,
      panelWeightBasis: defaultProposalPanel.weightBasis,
      panelVmpV: defaultProposalPanel.vmpV,
      panelVocV: defaultProposalPanel.vocV,
      panelImpA: defaultProposalPanel.impA,
      panelIscA: defaultProposalPanel.iscA,
      panelMaximumSystemVoltageV: defaultProposalPanel.maximumSystemVoltageV,
      panelMaximumSeriesFuseA: defaultProposalPanel.maximumSeriesFuseA,
      panelVocTemperatureCoefficientPercentPerC: defaultProposalPanel.vocTemperatureCoefficientPercentPerC,
      ...stored,
    };
    const panelWatts = n(saved.panelWatts, defaultProposalPanel.watts);
    const rejectWattsonPanelSizing = !wattsonPanelSizingIsPlausible(project, panelWatts, saved);
    const panelCount = !rejectWattsonPanelSizing && saved.panelCount ? Math.max(1, Math.round(saved.panelCount)) : suggestedPanelCount(project, panelWatts);
    const wattsonSizedWithoutDailyEnergy = saved.updatedBy === "wattson" && !discoveredDailyEnergyKwh(project);
    const batterySizing = includeBattery ? proposalBatterySizing(project, wattsonSizedWithoutDailyEnergy ? undefined : n(saved.batteryUsableKwh) || undefined, saved.updatedBy !== "wattson") : { usableKwh: undefined, acceptedSavedValue: false };
    const proposedBatteryUsableKwh = batterySizing.usableKwh ?? 0;
    const batteryVoltage = includeBattery ? n(saved.batteryVoltage, 51.2) : 0;
    const usableBatteryPercent = n(saved.usableBatteryPercent, 80);
    const discoveredAc = discoveredAcSupply(project);
    const generator = discoveredGenerator(project);
    const inverterKw = wattsonSizedWithoutDailyEnergy ? suggestedInverterKw(project) : proposedInverterKw(project, saved);
    const generatorContinuousKw = saved.generatorContinuousKw ?? proposedGeneratorKw(generator, inverterKw);
    return {
      panelType: "not_selected", fitStatus: "unverified", peakSunHours: project.peakSunHours,
      systemEfficiencyPercent: 80,
      maxVoltageDropPercent: 2,
      ...saved,
      connectionType: discoveredAc.connectionType ?? saved.connectionType ?? "dc",
      connectionVoltage: saved.connectionVoltage ?? discoveredAc.voltage,
      panelManufacturer: saved.panelManufacturer,
      panelModel: saved.panelModel,
      panelSupplier: saved.panelSupplier,
      panelProductUrl: saved.panelProductUrl,
      panelDatasheetUrl: saved.panelDatasheetUrl,
      panelDatasheetVersion: saved.panelDatasheetVersion,
      panelWatts,
      panelCount,
      targetPvKw: rejectWattsonPanelSizing ? undefined : saved.targetPvKw,
      mountingLocations: saved.mountingLocations?.length ? saved.mountingLocations : discoveredMountingLocations(project),
      panelLengthMm: saved.panelLengthMm,
      panelWidthMm: saved.panelWidthMm,
      panelThicknessMm: saved.panelThicknessMm,
      panelWeightKg: saved.panelWeightKg,
      panelWeightBasis: saved.panelWeightBasis,
      pvStrings: rejectWattsonPanelSizing ? undefined : saved.pvStrings,
      panelsPerString: rejectWattsonPanelSizing ? undefined : saved.panelsPerString,
      panelVmpV: saved.panelVmpV,
      panelVocV: saved.panelVocV,
      panelImpA: saved.panelImpA,
      panelIscA: saved.panelIscA,
      panelMaximumSystemVoltageV: saved.panelMaximumSystemVoltageV,
      panelMaximumSeriesFuseA: saved.panelMaximumSeriesFuseA,
      panelVocTemperatureCoefficientPercentPerC: saved.panelVocTemperatureCoefficientPercentPerC,
      batteryChemistry: includeBattery ? saved.batteryChemistry ?? "LiFePO₄ (planning assumption)" : undefined,
      batteryVoltage: batteryVoltage || undefined,
      batteryUsableKwh: proposedBatteryUsableKwh || undefined,
      batteryAh: (batterySizing.acceptedSavedValue ? saved.batteryAh : undefined) ?? (proposedBatteryUsableKwh ? Math.ceil((proposedBatteryUsableKwh * 1000) / Math.max(batteryVoltage * (usableBatteryPercent / 100), 1)) : undefined),
      batteryQuantity: saved.batteryQuantity ?? 1,
      inverterKw,
      generatorIncluded: generator.included,
      generatorPurchaseStatus: saved.generatorPurchaseStatus ?? generator.purchaseStatus,
      generatorType: saved.generatorType ?? generator.generatorType,
      generatorFuel: saved.generatorFuel ?? generator.fuel,
      generatorContinuousKw,
      generatorSurgeKw: saved.generatorSurgeKw ?? generator.surgeKw,
      generatorConnectionMethod: saved.generatorConnectionMethod ?? generator.connectionMethod,
      usableBatteryPercent,
      electricalStandard: saved.electricalStandard ?? inferElectricalStandard(site),
      ...recommendedPanelOrientation(saved, site.latitude),
    };
  });
  const [status, setStatus] = useState("");
  const set = <K extends keyof DesignCalculatorState>(key: K, value: DesignCalculatorState[K]) => setDesign((current) => {
    if (key === "panelType" && ["monofacial", "bifacial", "flexible"].includes(String(value))) {
      const profile = proposalPanelProfile(value);
      return {
        ...current, panelType: profile.panelType, panelWatts: profile.watts,
        panelLengthMm: profile.lengthMm, panelWidthMm: profile.widthMm,
        panelThicknessMm: profile.thicknessMm, panelWeightKg: profile.weightKg,
        panelWeightBasis: profile.weightBasis, panelVmpV: profile.vmpV,
        panelVocV: profile.vocV, panelImpA: profile.impA, panelIscA: profile.iscA,
        panelMaximumSystemVoltageV: profile.maximumSystemVoltageV,
        panelMaximumSeriesFuseA: profile.maximumSeriesFuseA,
        panelVocTemperatureCoefficientPercentPerC: profile.vocTemperatureCoefficientPercentPerC,
        panelManufacturer: undefined, panelModel: undefined, panelSupplier: undefined,
        panelProductUrl: undefined, panelDatasheetUrl: undefined, panelDatasheetVersion: undefined,
        pvStrings: undefined, panelsPerString: undefined, fitStatus: "unverified",
      };
    }
    if (key === "panelCount") {
      const panelCount = Math.max(0, Math.round(n(value)));
      const knownProfile = ["monofacial", "bifacial", "flexible"].includes(String(current.panelType));
      const layout = panelCount > 0 && knownProfile
        ? defaultProposalPanelStringLayout(panelCount, proposalPanelProfile(current.panelType))
        : undefined;
      return {
        ...current,
        panelCount: panelCount || undefined,
        targetPvKw: panelCount && current.panelWatts ? Number((panelCount * current.panelWatts / 1000).toFixed(2)) : undefined,
        pvStrings: layout?.strings,
        panelsPerString: layout?.panelsPerString,
        stringDesign: layout,
        fitStatus: "unverified",
      };
    }
    const next = { ...current, [key]: value };
    const changedSourcedModule = (key === "panelWatts" || key === "panelType")
      && current.panelProfileBasis === "representative"
      && (next.panelWatts !== defaultProposalPanel.watts || next.panelType !== defaultProposalPanel.panelType);
    if (!changedSourcedModule) return next;
    return {
      ...next,
      panelManufacturer: undefined,
      panelModel: undefined,
      panelSupplier: undefined,
      panelProductUrl: undefined,
      panelDatasheetUrl: undefined,
      panelDatasheetVersion: undefined,
      panelLengthMm: undefined,
      panelWidthMm: undefined,
      panelThicknessMm: undefined,
      panelWeightKg: undefined,
      panelWeightBasis: undefined,
      panelVmpV: undefined,
      panelVocV: undefined,
      panelImpA: undefined,
      panelIscA: undefined,
      panelMaximumSystemVoltageV: undefined,
      panelMaximumSeriesFuseA: undefined,
      panelVocTemperatureCoefficientPercentPerC: undefined,
      pvStrings: undefined,
      panelsPerString: undefined,
      fitStatus: "unverified",
    };
  });
  const results = useMemo(() => {
    const pvKw = n(design.panelWatts) * n(design.panelCount) / 1000 + n(supplementaryArray(design)?.targetPvKw);
    const rawArea = n(design.panelLengthMm) * n(design.panelWidthMm) / 1_000_000 * n(design.panelCount);
    const totalWeight = n(design.panelWeightKg) * n(design.panelCount);
    const latitude = Math.abs(site.latitude ?? 35);
    const idealAzimuth = (site.latitude ?? -1) < 0 ? 0 : 180;
    const azimuthDifference = Math.abs((((n(design.azimuthDegrees) - idealAzimuth) + 540) % 360) - 180);
    const orientationFactor = Math.max(.55, 1 - azimuthDifference / 360 - Math.abs(n(design.tiltDegrees) - latitude) / 300);
    const dailyKwh = pvKw * n(design.peakSunHours, project.peakSunHours) * (n(design.systemEfficiencyPercent, 80) / 100) * orientationFactor;
    const nominalBattery = n(design.batteryVoltage) * n(design.batteryAh) * n(design.batteryQuantity, 1) / 1000;
    const usableBattery = nominalBattery ? nominalBattery * n(design.usableBatteryPercent, 80) / 100 : n(design.batteryUsableKwh);
    const factor = design.connectionType === "ac_three" ? Math.sqrt(3) : 2;
    const dropVolts = n(design.cableSizeMm2) ? factor * .0175 * n(design.connectionLengthM) * n(design.connectionCurrent) / n(design.cableSizeMm2) : 0;
    const dropPercent = n(design.connectionVoltage) ? dropVolts / n(design.connectionVoltage) * 100 : 0;
    const allowedDrop = n(design.connectionVoltage) * n(design.maxVoltageDropPercent, 2) / 100;
    const minimumCable = allowedDrop ? factor * .0175 * n(design.connectionLengthM) * n(design.connectionCurrent) / allowedDrop : 0;
    const configuredPanels = n(design.pvStrings) * n(design.panelsPerString);
    const stringVmp = n(design.panelVmpV) * n(design.panelsPerString);
    const stringVoc = n(design.panelVocV) * n(design.panelsPerString);
    const arrayImp = n(design.panelImpA) * n(design.pvStrings);
    const arrayIsc = n(design.panelIscA) * n(design.pvStrings);
    return { pvKw, rawArea, totalWeight, dailyKwh, orientationFactor, nominalBattery, usableBattery, dropVolts, dropPercent, minimumCable, planningBreaker: n(design.connectionCurrent) * 1.25, configuredPanels, stringVmp, stringVoc, arrayImp, arrayIsc };
  }, [design, project.peakSunHours, site.latitude]);
  const gridConnected = proposalUsesPublicGrid(project);
  const overviewDraft = useMemo(() => {
    const baseDraft = proposalDraftForCurrentDesign(design, gridConnected);
    const draft = batteryAdjustedDraft(ensurePvArrayEarth(upgradePvStringIsolationDraft(ensureGeneratorSupply(ensureGridSupply(baseDraft, gridConnected), design, gridConnected), design)), includeBattery);
    const connections = draft.connections?.map((connection) => preliminaryConnectionValues(connection, design));
    const calculatedDraft = { ...draft, connections };
    const routesReady = (connections ?? []).filter((connection) => !connection.authorityCheck).every((connection) => connection.configured === true);
    return { ...calculatedDraft, nodes: draft.nodes?.map((node) => componentPlanningDetail(node, calculatedDraft, design, routesReady)) };
  }, [design, includeBattery, gridConnected]);
  const sizingEvidence = deterministicSizing(
    project,
    n(design.panelWatts, defaultProposalPanel.watts),
    n(design.panelCount) || undefined,
  );

  async function save(nextDesign: DesignCalculatorState = design) {
    setStatus("Saving…");
    try {
      const response = await fetch("/api/design-calculator", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, design: nextDesign }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save design");
      setStatus("Working design saved");
    } catch (problem) { setStatus(problem instanceof Error ? problem.message : "Could not save design"); }
  }
  return <div className="animate-rise space-y-4">
    <div><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="eyebrow">{commissioned ? "Installed system record" : "System planning record"}</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.045em] md:text-[30px]">{project.name} System Overview</h1><p className="mt-1.5 max-w-3xl text-xs leading-5 text-muted">{commissioned ? "The commissioned specification and as-built component record. Keep it current when equipment, settings or connections change." : "The planning numbers behind the working schematic. Wattson prefills these from discovery and completes them as routes and equipment are confirmed."}</p></div>{!commissioned ? <Link href={`/sites/${project.siteId}/systems/${project.id}/design/schematic`} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-brand bg-white px-4 text-xs font-bold text-brand">← Back to schematic</Link> : null}</div><div className="mt-4 rounded-2xl border border-line bg-[#eef5fc] p-4"><div className="eyebrow">System scope</div>{commissioned ? <p className="mt-2 text-sm font-semibold leading-6">{systemScopeSummary(project, design)}</p> : <div className="mt-2"><ProposalScopeOverview project={project} design={design}/></div>}</div>{status && <p className="mt-1.5 text-[9px] font-bold text-brand">{status}</p>}</div>

    <section className="card overflow-hidden">
      <div className="border-b border-line bg-[#eef5fc] p-5"><div className="eyebrow">{commissioned ? "As-built equipment schedule" : "Schematic equipment schedule"}</div><h2 className="mt-2 text-lg font-extrabold">Every component in this system</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-muted">{commissioned ? "This is the commissioned system record. The equipment schedule, technical specifications and schematic describe what is installed." : "This list and the schematic are the same working record. Proposed items become the verified as-built record when installation and commissioning are completed."}</p></div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {(overviewDraft.nodes ?? []).map((node) => <Link key={node.id} href={`#tech-${node.id}`} className={`flex items-center gap-3 rounded-xl border p-3 transition hover:border-brand ${node.reviewed ? "border-[#9bd2ad] bg-[#f2fbf5]" : "border-line bg-white"}`}>
          <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-[#f4f7fa]"><Image src={node.image} alt="" fill sizes="56px" className="object-contain p-1"/></span>
          <span className="min-w-0"><strong className="block text-xs">{node.label}</strong><span className="mt-1 block text-[9px] leading-4 text-muted">{node.detail}</span><span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${node.reviewed ? "bg-[#dff3e8] text-[#17603b]" : "bg-[#fff1cc] text-[#805d00]"}`}>{node.reviewed ? "Specification accepted" : "Proposed · review"}</span></span>
        </Link>)}
        {(overviewDraft.connections ?? []).map((connection, index) => { const configured = connection.configured === true; return <Link key={`${connection.from}-${connection.to}-${index}`} href={`/sites/${project.siteId}/systems/${project.id}/design/schematic`} className={`flex items-center gap-3 rounded-xl border p-3 transition hover:border-brand ${configured ? "border-[#9bd2ad] bg-[#f2fbf5]" : "border-[#e56b5d] bg-[#fff8f6]"}`}><span className="grid size-14 shrink-0 place-items-center rounded-lg bg-[#eef3f8] text-brand"><Cable size={22}/></span><span className="min-w-0"><strong className="block text-xs">{connection.label}</strong><span className="mt-1 block text-[9px] leading-4 text-muted">{[connection.cableSizeMm2 ? `${connection.cableSizeMm2} mm² cable` : "Cable size required", connection.protectionAmps ? `${connection.protectionAmps} A protection` : connection.kind === "earth" ? "Earth connection" : "Protection size required"].join(" · ")}</span><span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${configured ? "bg-[#dff3e8] text-[#17603b]" : "bg-[#ffebe7] text-[#b53222]"}`}>{configured ? "Configured" : "Configure"}</span></span></Link>; })}
      </div>
    </section>

    <details open className="card overflow-hidden">
      <summary className="cursor-pointer list-none p-5"><div className="flex items-center justify-between gap-4"><div><div className="eyebrow">Technical details</div><h2 className="mt-2 text-base font-extrabold">{commissioned ? "As-built system numbers" : "Advanced planning numbers"}</h2><p className="mt-1 text-xs leading-5 text-muted">{commissioned ? "These are the installed system values. Update them whenever an as-built component, setting or connection changes." : "These are estimated proposal figures, to be checked and corrected as the system is built or components are purchased."}</p></div><span className="shrink-0 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-brand">Show details</span></div></summary>
      <div className="space-y-6 border-t border-line bg-[#f7fafc] p-5">
    {!commissioned && (
      <section className="card overflow-hidden">
        <div className="border-b border-line bg-[#f2fbf5] p-5">
          <div className="eyebrow text-[#17603b]">Deterministic sizing evidence</div>
          <h2 className="mt-2 text-base font-extrabold">Where the proposal numbers come from</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Wattson explains the design; PVIntell calculates these baseline values from the recorded discovery evidence.</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Result label="Daily energy" value={sizingEvidence.dailyEnergyKwh ? `${round(sizingEvidence.dailyEnergyKwh, 1)} kWh/day` : "Not established"} detail={sizingEvidence.dailyEnergySource === "current_energy_use" ? "Converted once from recorded current consumption" : sizingEvidence.dailyEnergySource === "off_grid_daily_energy_use" ? "Recorded daily off-grid requirement" : sizingEvidence.dailyEnergySource === "pool_equipment_schedule" ? "Calculated from the recorded pool-equipment timers and runtimes" : "No usable energy record"}/>
          <Result label="Solar resource" value={sizingEvidence.peakSunHours ? `${round(sizingEvidence.peakSunHours, 2)} h/day` : "Not established"} detail={sizingEvidence.weakestMonthPeakSunHours ? `${sizingEvidence.solarResourceBasis === "weakest_month" ? "Weakest month used" : "Annual average used"}; monthly range ${round(sizingEvidence.weakestMonthPeakSunHours, 2)}–${round(sizingEvidence.strongestMonthPeakSunHours ?? 0, 2)} h/day · ${sizingEvidence.solarResourceSource}` : `${round(sizingEvidence.systemEfficiency * 100, 0)}% planning system efficiency`}/>
          <Result label="Simultaneous load" value={sizingEvidence.simultaneousLoadKw ? `${round(sizingEvidence.simultaneousLoadKw, 1)} kW` : "Not established"} detail={sizingEvidence.startupPeakKw ? `${round(sizingEvidence.startupPeakKw, 1)} kW recorded startup envelope` : "Needed for standalone inverter sizing"}/>
          <Result label="Battery basis" value={sizingEvidence.batterySizingBasis === "solar_assisted_typical_winter" ? "Solar-assisted typical winter" : sizingEvidence.batteryOnlyDays ? `${sizingEvidence.batteryOnlyDays} battery-only day equivalent` : "Not established"} detail={sizingEvidence.batterySizingBasis === "solar_assisted_typical_winter" ? `${round(sizingEvidence.assumedNonSolarLoadKwh ?? 0, 1)} kWh non-solar allowance; ${round(sizingEvidence.weakestMonthPvKwh ?? 0, 1)} kWh planned winter-day PV` : "Solar and generator energy are not counted twice"}/>
          <Result label="Current panel plan" value={design.panelCount ? `${design.panelCount} panels` : "Not selected"} detail={sizingEvidence.planningPanelCapacity !== undefined ? `Recorded-area planning capacity: ${sizingEvidence.planningPanelCapacity} panels${sizingEvidence.energyTargetPanelCount ? `; calculated annual-energy baseline: ${sizingEvidence.energyTargetPanelCount}` : ""}` : sizingEvidence.energyTargetPanelCount ? `Calculated annual-energy baseline: ${sizingEvidence.energyTargetPanelCount} panels; usable area still needs verification` : "Needs usable area rectangles and module dimensions"}/>
        </div>
        {sizingEvidence.assumptions.length > 0 && (
          <ul className="border-t border-line bg-white px-8 py-4 text-[10px] leading-5 text-muted">
            {sizingEvidence.assumptions.map((item) => <li key={item} className="list-disc">{item}</li>)}
          </ul>
        )}
        {sizingEvidence.warnings.length > 0 && (
          <ul className="border-t border-[#f0d57c] bg-[#fff8d8] px-8 py-4 text-[10px] leading-5 text-[#6f5200]">
            {sizingEvidence.warnings.map((item) => <li key={item} className="list-disc">{item}</li>)}
          </ul>
        )}
      </section>
    )}
    {(design.startingStage || design.expansionPath || design.nextValidation) && <section className="card p-5"><div className="eyebrow">Wattson’s staged plan</div><div className="mt-4 grid gap-4 md:grid-cols-3"><div><strong className="text-sm">Start useful</strong><p className="mt-1 text-xs leading-5 text-muted">{design.startingStage || "Not proposed yet"}</p></div><div><strong className="text-sm">Expand cleanly</strong><p className="mt-1 text-xs leading-5 text-muted">{design.expansionPath || "Not proposed yet"}</p></div><div><strong className="text-sm">Validate next</strong><p className="mt-1 text-xs leading-5 text-muted">{design.nextValidation || "Not proposed yet"}</p></div></div></section>}

    <section className="card overflow-hidden">
      <div className="border-b border-line bg-[#eef5fc] p-5">
        <div className="eyebrow">Component technical register</div>
        <h2 className="mt-2 text-base font-extrabold">Schematic components and specifications</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">A read-only overview of what each schematic unit contains and the ratings currently required. Accepted components feed the Build It shopping list; changes are made from the schematic or advanced planning sections.</p>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        {(overviewDraft.nodes ?? []).map((node) => {
          const specs = componentSpecifications(node, overviewDraft, design);
          const wattsonPrompt = `Explain the proposed ${node.label} for ${project.name}. Use its current specification (${specs.map((spec) => `${spec.label}: ${spec.value}`).join("; ")}) and answer questions specifically about selecting or sourcing this component.`;
          return <article key={node.id} id={`tech-${node.id}`} className={`flex scroll-mt-24 flex-col rounded-2xl border p-4 ${node.reviewed ? "border-[#9bd2ad] bg-[#f7fcf8]" : "border-line bg-white"}`}>
            <div className="flex items-start gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#f4f7fa]"><Image src={node.image} alt="" fill sizes="56px" className="object-contain p-1"/></span>
              <div className="min-w-0 flex-1"><div className="eyebrow">{node.reviewed ? "Specification accepted" : node.installed ? "Installed component" : "Proposed component"}</div><h3 className="mt-2 text-sm font-extrabold">{node.label}</h3><p className="mt-1 text-[10px] leading-4 text-muted">{node.detail}</p></div>
            </div>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {specs.map((spec, index) => <div key={`${spec.label}-${index}`} className="rounded-xl border border-line bg-[#f8fafc] p-3"><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-muted">{spec.label}</dt><dd className="mt-1 text-[11px] font-extrabold leading-4 text-ink">{spec.value}</dd>{spec.note ? <p className="mt-1 text-[9px] leading-4 text-muted">{spec.note}</p> : null}</div>)}
            </dl>
            <div className="mt-auto flex justify-end pt-4">
              <Link href={`/sites/${project.siteId}/systems/${project.id}?view=wattson`} onClick={() => window.sessionStorage.setItem("pvintell:wattson-prompt", wattsonPrompt)} className="inline-flex h-9 items-center justify-center rounded-xl border border-brand bg-white px-4 text-[10px] font-bold text-brand">Ask Wattson about this component</Link>
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className="card overflow-hidden"><div className="flex items-center gap-3 border-b border-line bg-[#fff8d8] p-5"><Sun className="text-[#d99b00]" size={20}/><div><h2 className="font-extrabold">Solar array and physical fit</h2><p className="text-[10px] text-muted">Azimuth defaults to equator-facing and tilt defaults to the Site latitude for both roof and ground proposals. Replace them with the actual mounting angles when known.</p></div></div><div className="grid gap-6 p-5 xl:grid-cols-[1.4fr_.8fr]"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="space-y-1.5 text-xs font-bold"><span>Panel type</span><select value={design.panelType} onChange={(e) => set("panelType", e.target.value as DesignCalculatorState["panelType"])} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="bifacial">Bifacial</option><option value="monofacial">Monofacial</option><option value="flexible">Flexible/lightweight</option><option value="other">Other</option><option value="not_selected">Not selected</option></select></label><NumberField label="Panel rating" value={design.panelWatts} unit="W" onChange={(v) => set("panelWatts", v)}/><NumberField label="Panel count" value={design.panelCount} onChange={(v) => set("panelCount", Math.round(v))}/><NumberField label="Panel length" value={design.panelLengthMm} unit="mm" onChange={(v) => set("panelLengthMm", v)}/><NumberField label="Panel width" value={design.panelWidthMm} unit="mm" onChange={(v) => set("panelWidthMm", v)}/><NumberField label="Panel weight" value={design.panelWeightKg} unit="kg" onChange={(v) => set("panelWeightKg", v)}/><NumberField label="Azimuth (location default)" value={design.azimuthDegrees} unit="°" max={360} onChange={(v) => set("azimuthDegrees", v)}/><NumberField label="Tilt (latitude default)" value={design.tiltDegrees} unit="°" max={90} onChange={(v) => set("tiltDegrees", v)}/><NumberField label="Peak sun hours" value={design.peakSunHours} unit="h/day" max={24} onChange={(v) => set("peakSunHours", v)}/><NumberField label="Planning efficiency" value={design.systemEfficiencyPercent} unit="%" max={100} onChange={(v) => set("systemEfficiencyPercent", v)}/><label className="space-y-1.5 text-xs font-bold sm:col-span-2"><span>Physical fit status</span><select value={design.fitStatus} onChange={(e) => set("fitStatus", e.target.value as DesignCalculatorState["fitStatus"])} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="unverified">Not checked yet</option><option value="verified">Verified against usable area</option><option value="does_not_fit">Does not fit</option></select></label></div><div className="grid grid-cols-2 gap-3"><Result label="PV rating" value={`${round(results.pvKw, 2)} kW`} detail="Panel nameplate total"/><Result label="Module area" value={`${round(results.rawArea, 1)} m²`} detail="Panels only; add mounting gaps and required clearances"/><Result label="Panel weight" value={`${round(results.totalWeight, 0)} kg`} detail="Modules only; structure and mounting still require assessment"/><Result label="Planning output" value={`${round(results.dailyKwh, 1)} kWh/day`} detail={`Illustrative yield using ${round(results.orientationFactor * 100, 0)}% orientation factor; not a production guarantee`}/></div></div>{design.panelType === "bifacial" && <p className="border-t border-line bg-[#f5f8fb] px-5 py-3 text-[10px] leading-4 text-muted">Bifacial is evaluated by default, but rear-side gain is not counted here. It depends on clearance, spacing and the surface below the panel; a flush roof can provide little extra rear yield.</p>}</section>
    <p className="rounded-xl border border-[#b8d7f1] bg-[#eef6fd] px-4 py-3 text-[10px] leading-5 text-muted"><strong className="text-ink">Representative proposal values.</strong> Wattage, size, weight and electrical specifications estimate the selected panel class. The panels purchased may have different specifications; replace these values with the selected product datasheet before detailed design or purchase.</p>


    <section className="card overflow-hidden"><div className="border-b border-line bg-[#eef5fc] p-5"><div className="eyebrow">PV string layout</div><h2 className="mt-2 text-base font-extrabold">Series and parallel layout for the schematic</h2><p className="mt-1 text-xs leading-5 text-muted">This is the simple picture-language version: panels in series make one string; strings in parallel feed the selected controller or inverter input.</p></div><div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"><NumberField label="Parallel strings" value={design.pvStrings} onChange={(v) => set("pvStrings", Math.round(v))}/><NumberField label="Panels per series string" value={design.panelsPerString} onChange={(v) => set("panelsPerString", Math.round(v))}/><NumberField label="Panel Vmp" value={design.panelVmpV} unit="V" onChange={(v) => set("panelVmpV", v)}/><NumberField label="Panel Voc" value={design.panelVocV} unit="V" onChange={(v) => set("panelVocV", v)}/><NumberField label="Panel Imp" value={design.panelImpA} unit="A" onChange={(v) => set("panelImpA", v)}/><NumberField label="Panel Isc" value={design.panelIscA} unit="A" onChange={(v) => set("panelIscA", v)}/><div className="rounded-xl border border-line bg-white p-3 text-[10px] leading-4 text-muted sm:col-span-2"><strong className="block text-[11px] text-ink">{pvLayoutLabel(design)}</strong>{pvLayoutCountMismatch(design) ? <span className="mt-1 block text-[#b9412b]">Panel count does not match strings x panels per string.</span> : <span className="mt-1 block">This label appears on the proposed schematic.</span>}</div></div><div className="grid gap-3 border-t border-line bg-[#f5f8fb] p-5 sm:grid-cols-2 lg:grid-cols-4"><Result label="Configured panels" value={results.configuredPanels ? `${round(results.configuredPanels, 0)}` : "Not set"} detail="Parallel strings x panels in series"/><Result label="String Vmp" value={results.stringVmp ? `${round(results.stringVmp, 1)} V` : "Not set"} detail="Panel Vmp x panels in series"/><Result label="String Voc" value={results.stringVoc ? `${round(results.stringVoc, 1)} V` : "Not set"} detail="Nameplate subtotal only; not cold corrected"/><Result label="Array current" value={results.arrayImp ? `${round(results.arrayImp, 1)} A` : "Not set"} detail="Panel Imp x parallel strings"/></div></section>

    <div className="grid gap-6 xl:grid-cols-2"><section className="card overflow-hidden"><div className="flex items-center gap-3 border-b border-line p-5"><BatteryCharging className="text-brand" size={20}/><h2 className="font-extrabold">Inverter and battery</h2></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-bold sm:col-span-2"><span>Equipment arrangement</span><select value={design.architecture ?? "not_decided"} onChange={(e) => set("architecture", e.target.value as DesignCalculatorState["architecture"])} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="not_decided">Not decided</option><option value="combined_hybrid_inverter">Combined hybrid inverter</option><option value="separate_solar_controller_and_inverter">Separate charge controller and inverter</option><option value="ac_coupled">AC-coupled</option></select></label><NumberField label="Inverter continuous rating" value={design.inverterKw} unit="kW" onChange={(v) => set("inverterKw", v)}/><label className="space-y-1.5 text-xs font-bold"><span>Battery chemistry</span><input value={design.batteryChemistry ?? ""} onChange={(e) => set("batteryChemistry", e.target.value)} placeholder="e.g. LiFePO₄" className="h-11 w-full rounded-xl border border-line bg-white px-3"/></label><NumberField label="Battery voltage" value={design.batteryVoltage} unit="V" onChange={(v) => set("batteryVoltage", v)}/><NumberField label="Capacity per battery" value={design.batteryAh} unit="Ah" onChange={(v) => set("batteryAh", v)}/><NumberField label="Number of batteries" value={design.batteryQuantity} onChange={(v) => set("batteryQuantity", Math.round(v))}/><NumberField label="Planning usable amount" value={design.usableBatteryPercent} unit="%" max={100} onChange={(v) => set("usableBatteryPercent", v)}/></div><div className="grid grid-cols-2 gap-3 border-t border-line bg-[#f5f8fb] p-5"><Result label="Nominal storage" value={`${round(results.nominalBattery, 1)} kWh`} detail="Voltage × amp-hours × quantity"/><Result label="Planning usable" value={`${round(results.usableBattery, 1)} kWh`} detail={batterySizingBasis(project, design)}/></div></section>

    </div>

    <div className="rounded-2xl border border-[#f0d57c] bg-[#fff8d8] p-4 text-xs leading-5"><Calculator className="mr-2 inline text-[#b77d00]" size={16}/><strong>Working design only.</strong> Exact PV string voltage/current limits, cable installation method, ambient temperature, fault current, breaker curves, manufacturer instructions and local electrical requirements still have to be checked before build values are accepted.</div>
    <button onClick={() => void save()} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white"><Save size={15}/>Save advanced changes</button>
      </div>
    </details>
  </div>;
}

function ProposedPlan({ project, design, onToggle }: { project: Project; design: DesignCalculatorState; onToggle: (id: string) => void }) {
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const items = [
    {
      id: "solar-array",
      title: "Solar array and mounting",
      detail: design.panelCount ? `${design.panelCount} panels are in the working design. ${pvLayoutLabel(design)}. Confirm fit, structure, access and mounting before buying.` : "No panel count is proposed yet. Wattson needs physical-fit evidence before an array can be confirmed.",
      help: "Measure the usable rectangle, subtract obstructions, then compare it with a real panel and mounting layout.",
    },
    {
      id: "inverter",
      title: "Inverter arrangement",
      detail: design.architecture === "separate_solar_controller_and_inverter" ? "Separate charge controller and inverter are proposed." : design.architecture === "combined_hybrid_inverter" ? "A combined hybrid inverter is proposed." : design.architecture === "ac_coupled" ? "An AC-coupled arrangement is proposed." : "The inverter arrangement is still to be chosen.",
      help: "Check a dry location, manufacturer clearances, ventilation and a practical cable route before selecting a model.",
    },
    {
      id: "battery",
      title: "Battery storage",
      detail: design.batteryUsableKwh ? `${design.batteryUsableKwh} kWh usable storage is a planning estimate.` : "Battery capacity is not sized yet.",
      help: "Plan a protected, accessible location and confirm the battery’s voltage, chemistry and BMS limits before purchase.",
    },
    {
      id: "protection",
      title: "Cables, isolation and protection",
      detail: "This stays proposed until the actual equipment, cable route and manufacturer requirements are known.",
      help: "Do not choose final cable or fuse sizes from this card. Wattson will help gather the equipment ratings and route details first.",
    },
  ];
  const planningComplete = items.every((item) => design.proposedChecklist?.[item.id]);
  return <section className="card overflow-hidden"><div className="border-b border-line bg-[#fff1ee] p-5"><div className="eyebrow text-[#b9412b]">Proposed system outline</div><h2 className="mt-2 text-xl font-extrabold">What Wattson is planning</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-muted">These are not installed components. A green tick means you have reviewed the planning requirements for that item — not that it has been purchased, wired or approved.</p></div><div className="grid gap-4 p-5 md:grid-cols-2">{items.map((item) => { const complete = design.proposedChecklist?.[item.id] ?? false; return <article key={item.id} className={`rounded-2xl border p-4 ${complete ? "border-[#9bd2ad] bg-[#f2fbf5]" : "border-[#ecaaa0] bg-[#fff7f5]"}`}><div className="flex items-start justify-between gap-3"><div><div className={`text-[10px] font-bold uppercase tracking-[.12em] ${complete ? "text-[#17603b]" : "text-[#b9412b]"}`}>{complete ? "Planning reviewed" : "Needs planning"}</div><h3 className="mt-2 text-sm font-extrabold">{item.title}</h3></div><button type="button" onClick={() => onToggle(item.id)} className={`grid size-9 shrink-0 place-items-center rounded-xl border ${complete ? "border-[#74bd8d] bg-white text-[#17603b]" : "border-[#e79b91] bg-white text-[#b9412b]"}`} title={complete ? "Mark planning as needing review" : "Mark planning requirements reviewed"}>{complete ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button></div><p className="mt-3 text-[11px] leading-5 text-muted">{item.detail}</p><details className="mt-3 rounded-xl bg-white/70 p-3 text-[11px] leading-5 text-muted"><summary className="cursor-pointer font-bold text-brand">What do I need to check?</summary><p className="mt-2">{item.help}</p></details><Link href={`${base}?view=wattson`} className="mt-4 inline-flex text-[11px] font-bold text-brand">Ask Wattson about this component →</Link></article>; })}</div><div className="flex flex-col justify-between gap-3 border-t border-line bg-[#f7fafc] p-5 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-muted">{planningComplete ? "Outline accepted. Next, review how these parts connect in the proposed build schematic." : "Review all four proposed components to unlock the proposed build schematic."}</p>{planningComplete ? <Link href={`${base}/design/schematic`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-xs font-bold text-white">Continue to proposed schematic →</Link> : <span className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#dce7f1] px-5 text-xs font-bold text-[#6d7f91]">Continue to proposed schematic</span>}</div></section>;
}

export function ProposedBuildSchematic({ project, site, showIntro = false }: { project: Project; site: Site; showIntro?: boolean }) {
  const router = useRouter();
  const includeBattery = proposalIncludesBattery(project);
  const [design, setDesign] = useState<DesignCalculatorState>(() => {
    const stored = { ...project.designCalculator, ...recommendedPanelOrientation(project.designCalculator ?? {}, site.latitude) };
    const saved: DesignCalculatorState = stored.panelWatts ? stored : {
      panelType: defaultProposalPanel.panelType,
      panelManufacturer: defaultProposalPanel.manufacturer,
      panelModel: defaultProposalPanel.model,
      panelSupplier: defaultProposalPanel.supplier,
      panelProductUrl: defaultProposalPanel.productUrl,
      panelDatasheetUrl: defaultProposalPanel.datasheetUrl,
      panelDatasheetVersion: defaultProposalPanel.datasheetVersion,
      panelWatts: defaultProposalPanel.watts,
      panelLengthMm: defaultProposalPanel.lengthMm,
      panelWidthMm: defaultProposalPanel.widthMm,
      panelThicknessMm: defaultProposalPanel.thicknessMm,
      panelWeightKg: defaultProposalPanel.weightKg,
      panelWeightBasis: defaultProposalPanel.weightBasis,
      panelVmpV: defaultProposalPanel.vmpV,
      panelVocV: defaultProposalPanel.vocV,
      panelImpA: defaultProposalPanel.impA,
      panelIscA: defaultProposalPanel.iscA,
      panelMaximumSystemVoltageV: defaultProposalPanel.maximumSystemVoltageV,
      panelMaximumSeriesFuseA: defaultProposalPanel.maximumSeriesFuseA,
      panelVocTemperatureCoefficientPercentPerC: defaultProposalPanel.vocTemperatureCoefficientPercentPerC,
      ...stored,
    };
    const panelWatts = n(saved.panelWatts, defaultProposalPanel.watts);
    const rejectWattsonPanelSizing = !wattsonPanelSizingIsPlausible(project, panelWatts, saved);
    const wattsonSizedWithoutDailyEnergy = saved.updatedBy === "wattson" && !discoveredDailyEnergyKwh(project);
    const panelCount = !rejectWattsonPanelSizing && saved.panelCount ? Math.max(1, Math.round(saved.panelCount)) : suggestedPanelCount(project, panelWatts);
    const inverterKw = wattsonSizedWithoutDailyEnergy ? suggestedInverterKw(project) : proposedInverterKw(project, saved);
    const generator = discoveredGenerator(project);
    const generatorContinuousKw = saved.generatorContinuousKw ?? proposedGeneratorKw(generator, inverterKw);
    const batteryVoltage = includeBattery ? saved.batteryVoltage ?? 51.2 : undefined;
    const usableBatteryPercent = includeBattery ? saved.usableBatteryPercent ?? 80 : undefined;
    const batterySizing = includeBattery ? proposalBatterySizing(project, wattsonSizedWithoutDailyEnergy ? undefined : n(saved.batteryUsableKwh) || undefined, saved.updatedBy !== "wattson") : { usableKwh: undefined, acceptedSavedValue: false };
    const batteryUsableKwh = includeBattery ? batterySizing.usableKwh : undefined;
    const batteryAh = includeBattery ? (batterySizing.acceptedSavedValue ? saved.batteryAh : undefined) ?? (batteryUsableKwh ? Math.ceil((batteryUsableKwh * 1000) / Math.max(n(batteryVoltage) * (n(usableBatteryPercent, 80) / 100), 1)) : undefined) : undefined;
    return { ...saved, panelWatts, panelCount, targetPvKw: rejectWattsonPanelSizing ? undefined : saved.targetPvKw, mountingLocations: saved.mountingLocations?.length ? saved.mountingLocations : discoveredMountingLocations(project), pvStrings: rejectWattsonPanelSizing ? undefined : saved.pvStrings, panelsPerString: rejectWattsonPanelSizing ? undefined : saved.panelsPerString, panelVmpV: saved.panelVmpV, panelVocV: saved.panelVocV, panelImpA: saved.panelImpA, panelIscA: saved.panelIscA, inverterKw, batteryVoltage, batteryUsableKwh, batteryAh, batteryQuantity: includeBattery ? saved.batteryQuantity ?? 1 : undefined, usableBatteryPercent, generatorIncluded: generator.included, generatorPurchaseStatus: saved.generatorPurchaseStatus ?? generator.purchaseStatus, generatorType: saved.generatorType ?? generator.generatorType, generatorFuel: saved.generatorFuel ?? generator.fuel, generatorContinuousKw, generatorSurgeKw: saved.generatorSurgeKw ?? generator.surgeKw, generatorConnectionMethod: saved.generatorConnectionMethod ?? generator.connectionMethod, electricalStandard: saved.electricalStandard ?? inferElectricalStandard(site) };
  });
  const [status, setStatus] = useState("");
  const [introOpen, setIntroOpen] = useState(showIntro);
  const [introPortalTarget, setIntroPortalTarget] = useState<HTMLElement | null>(null);
  const base = `/sites/${project.siteId}/systems/${project.id}`;
  const reviewed = design.proposedChecklist?.["proposed-schematic"] ?? false;
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIntroPortalTarget(document.body));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!introOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIntroOpen(false);
        router.replace(`${base}/design/schematic`, { scroll: false });
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [base, introOpen, router]);

  async function saveWorkingDraft(draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>) {
    const nextDesign = { ...design, proposedAsBuiltDraft: draft };
    setDesign(nextDesign);
    setStatus("Saving schematic…");
    const response = await fetch("/api/design-calculator", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, design: nextDesign }) });
    const body = await response.json();
    setStatus(response.ok ? "Schematic saved" : body.error ?? "Could not save schematic");
  }

  async function saveRedesign(nextDesign: DesignCalculatorState, draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>) {
    const savedDesign = { ...nextDesign, proposedAsBuiltDraft: draft };
    setDesign(savedDesign);
    setStatus("Saving redesign…");
    const response = await fetch("/api/design-calculator", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, design: savedDesign }) });
    const body = await response.json();
    setStatus(response.ok ? "Redesign saved" : body.error ?? "Could not save redesign");
  }

  async function acceptAndContinue(candidate: unknown) {
    if (reviewed) {
      router.push(`${base}?view=build`);
      return;
    }
    const completedDraft = candidate && typeof candidate === "object" && Array.isArray((candidate as { connections?: unknown }).connections)
      ? candidate as NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>
      : design.proposedAsBuiltDraft ?? createProposedAsBuiltDraft(design, project.projectType === "hybrid" || project.projectType === "grid-tied");
    const nextDesign: DesignCalculatorState = {
      ...design,
      proposedChecklist: { ...(design.proposedChecklist ?? {}), "proposed-schematic": true },
      proposedAsBuiltDraft: completedDraft,
    };
    setStatus("Saving your reviewed layout…");
    const response = await fetch("/api/design-calculator", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, design: nextDesign }) });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Could not save the proposed schematic.");
      return;
    }
    setDesign(nextDesign);
    router.push(`${base}?view=build`);
  }

  const dismissIntro = () => {
    setIntroOpen(false);
    router.replace(`${base}/design/schematic`, { scroll: false });
  };
  return <div className="proposed-schematic-page animate-rise space-y-5">
    {introOpen && introPortalTarget ? createPortal(<div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#0b2742]/55 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:py-8" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissIntro(); }}><section role="dialog" aria-modal="true" aria-labelledby="proposal-intro-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#bad0e4] bg-white p-6 shadow-2xl md:p-8"><div className="flex items-start justify-between gap-4"><div><div className="eyebrow">Your proposal is ready</div><h2 id="proposal-intro-title" className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">Here is how your proposed system works</h2></div><button type="button" onClick={dismissIntro} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted" aria-label="Dismiss proposal introduction"><X size={18}/></button></div><div className="mt-5 rounded-2xl border border-line bg-[#eef5fc] p-4"><div className="eyebrow">System scope</div><div className="mt-2"><ProposalScopeOverview project={project} design={design}/></div></div><button type="button" onClick={dismissIntro} className="mt-5 h-12 w-full rounded-xl bg-brand px-5 text-sm font-extrabold text-white">Explore and adjust my schematic</button></section></div>, introPortalTarget) : null}
    <div className="schematic-page-intro"><div className="eyebrow">Working system centrepoint</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em] md:text-[38px]">{project.name} system schematic</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Discovery has defined the proposed equipment and capacity. Use each component and connection to move from proposal into the Build It record.</p><div className="mt-4 rounded-2xl border border-line bg-[#eef5fc] p-4"><div className="eyebrow">System scope</div><div className="mt-2"><ProposalScopeOverview project={project} design={design}/></div></div></div><section className="proposed-schematic-shell card overflow-hidden"><ProposedSchematic project={project} projectName={project.name} gridConnected={proposalUsesPublicGrid(project)} includeBattery={includeBattery} design={design} reviewed={reviewed} onToggle={(draft) => void acceptAndContinue(draft)} onDraftChange={(draft) => void saveWorkingDraft(draft)} onRedesign={(nextDesign, draft) => void saveRedesign(nextDesign, draft)} wattsonHref={`${base}?view=wattson`}/></section>{status && <p className="text-xs font-semibold text-brand">{status}</p>}</div>;
}

function ProposedSchematic({ project, projectName, gridConnected, includeBattery, design, reviewed, onToggle, onDraftChange, onRedesign, wattsonHref }: { project: Project; projectName: string; gridConnected: boolean; includeBattery: boolean; design: DesignCalculatorState; reviewed: boolean; onToggle: (draft: unknown) => void; onDraftChange: (draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>) => void; onRedesign: (design: DesignCalculatorState, draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>) => void; wattsonHref: string }) {
  const rawDraft = ensureGeneratorSupply(ensureGridSupply(proposalDraftForCurrentDesign(design, gridConnected), gridConnected), design, gridConnected);
  const upgradedDraft = upgradePvStringIsolationDraft(rawDraft, design);
  const earthedDraft = ensurePvArrayEarth(upgradedDraft);
  const sourceDraft = batteryAdjustedDraft(earthedDraft, includeBattery);
  const upgradeSignature = JSON.stringify(earthedDraft);
  const savedDraftSignature = JSON.stringify(design.proposedAsBuiltDraft);
  const lastSavedUpgrade = useRef("");
  useEffect(() => {
    if (upgradeSignature === savedDraftSignature || upgradeSignature === lastSavedUpgrade.current) return;
    lastSavedUpgrade.current = upgradeSignature;
    onDraftChange(earthedDraft);
  }, [earthedDraft, onDraftChange, savedDraftSignature, upgradeSignature]);
  const calculatedConnections = sourceDraft.connections?.map((connection) => preliminaryConnectionValues(connection, design));
  const routesReady = (calculatedConnections ?? []).filter((connection) => !connection.authorityCheck).every((connection) => connection.configured === true);
  const draftWithConnections = { ...sourceDraft, connections: calculatedConnections };
  const draft = { ...draftWithConnections, nodes: sourceDraft.nodes?.map((node) => componentPlanningDetail(node, draftWithConnections, design, routesReady)) };
  const overviewHref = `${wattsonHref.split("?")[0]}/design`;
  const connectionsToConfigure = (draft.connections ?? []).filter((connection) => !connection.authorityCheck);
  const configuredConnections = connectionsToConfigure.filter((connection) => connection.configured === true).length;
  const connectionsComplete = connectionsToConfigure.length > 0 && configuredConnections === connectionsToConfigure.length;
  const componentsToReview = (draft.nodes ?? []).filter((node) => !node.authorityCheck);
  const reviewedComponents = componentsToReview.filter((node) => node.reviewed === true).length;
  const componentsComplete = componentsToReview.length > 0 && reviewedComponents === componentsToReview.length;
  const overviewComplete = componentsComplete;
  const readyForBuild = overviewComplete && connectionsComplete && componentsComplete;

  return <section className="border-t border-line bg-[#f6f9fc] p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="eyebrow">Proposed build schematic · easy guide</div>
        <h3 className="mt-2 text-lg font-extrabold">How your planned power system would work</h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Follow the coloured cables between the pictures to see the whole planned system. Select a picture to inspect that part.</p>
      </div>
    </div>

    <DraftProposedSchematicCanvas draft={draft} design={design} project={project} gridConnected={gridConnected} systemName={projectName} onChange={onDraftChange} onRedesign={onRedesign} wattsonHref={wattsonHref}/>

    <div className="mt-5 rounded-2xl border border-line bg-white p-4">
      <div className="eyebrow">Before Build It</div>
      <h4 className="mt-2 text-sm font-extrabold">Finish the working design in this order</h4>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Link href={overviewHref} className={`rounded-xl border p-3 hover:border-brand ${overviewComplete ? "border-[#86c79a] bg-[#f1faf4]" : "border-line bg-[#f7fafc]"}`}><span className="flex items-center justify-between gap-2"><span className={`text-[10px] font-bold ${overviewComplete ? "text-[#17603b]" : "text-brand"}`}>1 · SYSTEM OVERVIEW</span>{overviewComplete ? <CheckCircle2 size={18} className="shrink-0 text-[#17603b]" aria-label="Completed"/> : null}</span><strong className="mt-1 block text-xs">Check equipment and planning values</strong><span className="mt-1 block text-[10px] leading-4 text-muted">Review the calculated component specifications and return here to accept each item.</span></Link>
        <div className={`rounded-xl border p-3 ${connectionsComplete ? "border-[#86c79a] bg-[#f1faf4]" : "border-[#e4bd54] bg-[#fff9df]"}`}><span className="flex items-center justify-between gap-2"><span className={`text-[10px] font-bold ${connectionsComplete ? "text-[#17603b]" : "text-[#765918]"}`}>2 · CONNECTIONS · {configuredConnections}/{connectionsToConfigure.length}</span>{connectionsComplete ? <CheckCircle2 size={18} className="shrink-0 text-[#17603b]" aria-label="Completed"/> : null}</span><strong className="mt-1 block text-xs">Add every route distance</strong><span className="mt-1 block text-[10px] leading-4 text-muted">Select each Configure label, enter its measured or estimated one-way distance, then save the calculated cable and protection values.</span></div>
        <div className={`rounded-xl border p-3 ${componentsComplete ? "border-[#86c79a] bg-[#f1faf4]" : "border-line bg-[#f7fafc]"}`}><span className="flex items-center justify-between gap-2"><span className={`text-[10px] font-bold ${componentsComplete ? "text-[#17603b]" : "text-brand"}`}>3 · COMPONENTS · {reviewedComponents}/{componentsToReview.length}</span>{componentsComplete ? <CheckCircle2 size={18} className="shrink-0 text-[#17603b]" aria-label="Completed"/> : null}</span><strong className="mt-1 block text-xs">Accept the equipment schedule</strong><span className="mt-1 block text-[10px] leading-4 text-muted">Open each component, review its full specification and accept it. Build It opens when every component is green.</span></div>
      </div>
      <button type="button" disabled={!readyForBuild} onClick={onToggle} className={`mt-4 flex h-12 w-full items-center justify-between rounded-xl px-4 text-left text-xs font-extrabold transition disabled:cursor-not-allowed disabled:bg-[#dce7f1] disabled:text-[#6d7f91] ${readyForBuild ? "bg-[#238653] text-white hover:bg-[#1b7045]" : ""}`}><span>{reviewed ? "Open Build It" : "Approve completed plan and open Build It"}</span>{readyForBuild ? <CheckCircle2 size={19}/> : <Circle size={19}/>}</button>
    </div>

    <div className="mt-4 rounded-xl border border-[#e6cc74] bg-[#fff9df] p-3 text-[11px] leading-5 text-[#624b14]"><strong>This is a plan, not permission to wire it.</strong> The actual equipment models, cable sizes, fuses, isolators, ventilation, mounting and local rules must be checked before any work begins.</div>
    <p className="mt-4 text-[11px] leading-5 text-muted">When you review this picture, PVIntell saves it as a potential draft for the later as-built schematic. The real as-built record stays empty until you confirm the actual equipment and connections.</p>
  </section>;
}

function DraftProposedSchematicCanvas({ draft, design, project, gridConnected, systemName, onChange, onRedesign, wattsonHref }: { draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>; design: DesignCalculatorState; project: Project; gridConnected: boolean; systemName: string; onChange: (draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>) => void; onRedesign: (design: DesignCalculatorState, draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>) => void; wattsonHref: string }) {
  const [zoom, setZoom] = useState(1);
  const [showConnectionLabels, setShowConnectionLabels] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedConnectionKey, setSelectedConnectionKey] = useState<string>();
  const [routeLength, setRouteLength] = useState(0);
  const [routeBasis, setRouteBasis] = useState<"estimated" | "measured">("estimated");
  const [pendingSizing, setPendingSizing] = useState<{ cableSizeMm2?: number; protectionAmps?: number }>();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatIntent, setChatIntent] = useState<"ask" | "install" | "redesign">("ask");
  const [chatConversationId, setChatConversationId] = useState<string>();
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [movingNodeId, setMovingNodeId] = useState<string>();
  const [componentModalTarget, setComponentModalTarget] = useState<HTMLElement | null>(null);
  const [quickPanelCount, setQuickPanelCount] = useState("");
  const [quickEditMessage, setQuickEditMessage] = useState("");
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const fit = () => {
      if (window.innerWidth < 1100) setZoom(Math.max(.25, Math.min(1, viewport.clientWidth / 1120)));
    };
    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("orientationchange", fit);
    };
  }, []);
  const nodeWidth = 140;
  const nodeCentre = 70;
  const nodes = draft.nodes ?? [];
  const connections = draft.connections ?? [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedConnection = connections.find((connection) => `${connection.from}:${connection.to}` === selectedConnectionKey);
  const selectedNodeIsSolar = selectedNode?.id === "solar" || selectedNode?.id.startsWith("solar-pv-");
  const selectedSupplementaryArray = selectedNode?.id === "solar-pv-2" ? supplementaryArray(design) : undefined;
  const selectedNodeSpecs = selectedSupplementaryArray ? [
    ["Mounting", "Suitable mounting area to confirm"], ["Array", `At least ${round(selectedSupplementaryArray.targetPvKw, 2)} kW`], ["Connection", "Separate compatible string / MPPT input"], ["Planning azimuth", azimuthText(design.azimuthDegrees)], ["Planning tilt", design.tiltDegrees === undefined ? "not established" : `${round(design.tiltDegrees, 0)}°; actual surface to confirm`], ["Panel type / quantity", "Select a compatible option"], ["Electrical limits", "Confirm from selected module and inverter datasheets"],
  ] : selectedNodeIsSolar ? [
    ["Mounting", mountingLocationText(design.mountingLocations)], ["Array", `${design.panelCount ?? "—"} × ${design.panelWatts ?? "—"} W`], ["Strings", pvLayoutLabel(design)], ["Azimuth", azimuthText(design.azimuthDegrees)], ["Tilt", design.tiltDegrees === undefined ? "not established" : `${round(design.tiltDegrees, 0)}°`], ["Panel Vmp / Voc", `${design.panelVmpV ?? "—"} / ${design.panelVocV ?? "—"} V`], ["Panel Imp / Isc", `${design.panelImpA ?? "—"} / ${design.panelIscA ?? "—"} A`],
  ] : selectedNode?.id === "battery" ? [
    ["Battery bank", `${design.batteryQuantity ?? "—"} × ${design.batteryVoltage ?? "—"} V`], ["Capacity", `${design.batteryAh ?? "—"} Ah each`], ["Planning usable", `${design.usableBatteryPercent ?? "—"}%`], ["Chemistry", design.batteryChemistry ?? "Not confirmed"],
  ] : selectedNode?.id.includes("inverter") ? [["Continuous rating", `${design.inverterKw ?? "—"} kW`], ["Arrangement", design.architecture?.replaceAll("_", " ") ?? "Not confirmed"]] : selectedNode ? [["Current proposal", selectedNode.detail], ["Technical notes", selectedNode.notes || "No notes recorded"]] : [];
  useEffect(() => {
    setComponentModalTarget(null);
    if (!selectedNode) return;
    setQuickPanelCount(String(design.panelCount ?? ""));
    setQuickEditMessage("");
    const frame = window.requestAnimationFrame(() => {
      setComponentModalTarget(document.getElementById("schematic-component-record-modal"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [design.panelCount, selectedNode]);
  const overviewHref = `${wattsonHref.split("?")[0]}/design`;
  const pvNames = Array.from({ length: Math.max(1, n(design.pvStrings, 1)) }, (_, index) => `PV${index + 1}`);
  const connectionDisplayLabel = (connection: (typeof connections)[number]) => connection.authorityCheck && connection.from === "grid-supply" ? "Public grid AC supply to isolation" : connection.authorityCheck && connection.to === "switchboard" ? "Grid AC feed to power board" : connection.kind === "solar-dc" && connection.from === "solar" ? `${pvNames.join(" / ")} · ${n(design.panelsPerString, 1)} panels per string` : connection.kind === "solar-dc" && connection.from === "solar-safety" ? `${pvNames.join(" / ")} to inverter/MPPT inputs` : connection.label;
  const pvCircuitId = (connection: (typeof connections)[number]) => connection.kind === "solar-dc" ? connection.label.match(/\bPV\d+\b/i)?.[0].toUpperCase() : undefined;
  const standardCable = (minimum: number) => [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120].find((size) => size >= minimum) ?? Math.ceil(minimum);
  const routeElectricals = (connection: (typeof connections)[number], lengthM: number) => {
    if (connection.kind === "earth") {
      if (/\bPV\d* array frame bond\b/i.test(connection.label)) {
        const pvCircuit = pvCircuitId(connection);
        const pvCableMm2 = connections.filter((item) => item.kind === "solar-dc" && (!pvCircuit || pvCircuitId(item) === pvCircuit)).reduce((largest, item) => Math.max(largest, n(item.cableSizeMm2)), planningCableForCurrent(n(design.panelIscA) * 1.25));
        return { cableSizeMm2: planningProtectiveEarth(pvCableMm2, Math.ceil(n(design.panelIscA) * 1.25), design.electricalStandard, true), protectionAmps: undefined };
      }
      const calculatedAcCable = planningAcCableForCurrent(n(design.inverterKw) * 1000 / 230);
      const recordedAcCable = connections.filter((item) => item.kind === "ac").reduce((largest, item) => Math.max(largest, n(item.cableSizeMm2)), 0);
      const acProtection = Math.ceil(n(design.inverterKw) * 1000 / 230 * 1.25);
      return { cableSizeMm2: planningProtectiveEarth(Math.max(calculatedAcCable, recordedAcCable), acProtection, design.electricalStandard), protectionAmps: undefined };
    }
    const voltage = connection.kind === "solar-dc" ? n(design.panelVmpV) * n(design.panelsPerString, 1) : connection.kind === "battery-dc" ? n(design.batteryVoltage, 48) : 230;
    const stringCurrent = n(design.panelIscA) * 1.25;
    const current = connection.kind === "solar-dc" ? stringCurrent : connection.kind === "battery-dc" ? n(design.inverterKw) * 1000 / Math.max(voltage, 1) : n(design.inverterKw) * 1000 / Math.max(voltage, 1);
    if (!voltage || !current) return { cableSizeMm2: undefined, protectionAmps: undefined };
    const minimumByDrop = voltage && current ? 2 * .0175 * lengthM * current / (voltage * .02) : 0;
    const circuitFloor = connection.kind === "ac" ? planningAcCableForCurrent(current) : planningCableForCurrent(current);
    return { cableSizeMm2: standardCable(Math.max(minimumByDrop, circuitFloor)), protectionAmps: Math.ceil(current * 1.25) };
  };
  const openContextChat = (intent: "ask" | "install" | "redesign") => {
    if (!selectedConnection && !selectedNode) return;
    setChatIntent(intent); setChatOpen(true);
    const subject = selectedNode?.label ?? (selectedConnection ? connectionDisplayLabel(selectedConnection) : "this item");
    const introductions = { ask: `Ask me anything about ${subject}. I have its discovery, proposal and schematic context.`, install: `Let’s walk through how to implement ${subject}, including the evidence and checks to record.`, redesign: `Let’s review or redesign ${subject}. Tell me what you want changed and I’ll assess the effects on connected components and calculations.` };
    setChatMessages((current) => current.length ? current : [{ role: "assistant", content: introductions[intent] }]);
  };
  const sendConnectionChat = async () => {
    if ((!selectedConnection && !selectedNode) || !chatInput.trim() || chatBusy) return;
    const userMessage = chatInput.trim();
    const nextMessages = [...chatMessages, { role: "user" as const, content: userMessage }];
    setChatMessages(nextMessages); setChatInput(""); setChatBusy(true);
    try {
      const subjectId = selectedNode ? `component_${selectedNode.id}` : `connection_${selectedConnection?.from}_${selectedConnection?.to}`;
      const subjectTitle = selectedNode?.label ?? (selectedConnection ? connectionDisplayLabel(selectedConnection) : "System item");
      const requestedKw = chatIntent === "redesign" && selectedNode?.id.includes("inverter") ? userMessage.match(/\b(\d+(?:\.\d+)?)\s*kW\b/i) : null;
      if (requestedKw) {
        const inverterKw = Number(requestedKw[1]);
        const nextDraft = { ...draft, inverterKw, nodes: nodes.map((node) => node.id === selectedNode?.id ? { ...node, detail: `Proposed hybrid inverter / charger: ${inverterKw} kW` } : node) };
        onRedesign({ ...design, inverterKw }, nextDraft);
        setChatMessages((current) => [...current, { role: "assistant", content: `Done — I’ve changed the proposed inverter to **${inverterKw} kW** and saved the redesign. The connected battery current, cable and protection figures now need recalculating against that larger continuous rating. Tiny inverter upgrade, potentially chunky copper consequences.` }]);
        return;
      }
      const response = await fetch("/api/wattson/discovery-help", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: userMessage, conversationId: chatConversationId, siteId: projectSiteIdFromHref(wattsonHref), projectId: projectIdFromHref(wattsonHref), discoveryAnswers: {}, question: { id: `build_${subjectId}_${chatIntent}`, title: `${subjectTitle} — ${chatIntent}`, stage: "Build It", help: `Use this selected schematic context: ${JSON.stringify({ intent: chatIntent, node: selectedNode, connection: selectedConnection, panelCount: design.panelCount, panelWatts: design.panelWatts, pvStrings: design.pvStrings, panelsPerString: design.panelsPerString, panelVmpV: design.panelVmpV, panelIscA: design.panelIscA, inverterKw: design.inverterKw, batteryVoltage: design.batteryVoltage })}` }, recentConversation: nextMessages.slice(-8) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Wattson is unavailable");
      setChatConversationId(body.conversationId); setChatMessages((current) => [...current, { role: "assistant", content: body.message }]);
    } catch (problem) { setChatMessages((current) => [...current, { role: "assistant", content: problem instanceof Error ? problem.message : "Wattson is unavailable" }]); }
    finally { setChatBusy(false); }
  };
  const saveRoute = () => {
    if (!selectedConnection || routeLength <= 0) return;
    setPendingSizing(routeElectricals(selectedConnection, routeLength));
  };
  const acceptSizing = () => {
    if (!selectedConnection || !pendingSizing) return;
    const selectedPvCircuit = pvCircuitId(selectedConnection);
    onChange({ ...draft, connections: connections.map((connection) => {
      if (connection === selectedConnection) return { ...connection, lengthM: routeLength, lengthBasis: routeBasis, ...pendingSizing, configured: true };
      if (!selectedPvCircuit || pvCircuitId(connection) !== selectedPvCircuit) return connection;
      const sizingChanged = connection.cableSizeMm2 !== pendingSizing.cableSizeMm2 || connection.protectionAmps !== pendingSizing.protectionAmps;
      return { ...connection, ...pendingSizing, configured: sizingChanged ? false : connection.configured };
    }) });
    setPendingSizing(undefined);
    setSelectedConnectionKey(undefined);
  };
  const acceptComponent = () => {
    if (!selectedNode) return;
    onChange({ ...draft, nodes: nodes.map((node) => node.id === selectedNode.id ? { ...node, reviewed: true } : node) });
    setSelectedNodeId(undefined);
  };
  const saveQuickPanelQuantity = () => {
    const panelCount = Number(quickPanelCount);
    if (!Number.isInteger(panelCount) || panelCount < 1 || panelCount > 10000) {
      setQuickEditMessage("Enter a whole number of panels greater than zero.");
      return;
    }
    if (panelCount === design.panelCount) {
      setQuickEditMessage("That quantity is already in the proposal.");
      return;
    }
    const panelWatts = n(design.panelWatts, defaultProposalPanel.watts);
    const sizing = deterministicSizing(project, panelWatts, panelCount);
    const stringDesign = defaultProposalPanelStringLayout(panelCount, proposalPanelProfile(design.panelType));
    const usableBatteryPercent = n(design.usableBatteryPercent, 80);
    const batteryVoltage = n(design.batteryVoltage, 51.2);
    const includePlannedBattery = proposalIncludesBattery(project);
    const batteryAh = includePlannedBattery && sizing.batteryUsableKwh
      ? Math.ceil(sizing.batteryUsableKwh * 1000 / Math.max(batteryVoltage * (usableBatteryPercent / 100), 1))
      : undefined;
    const nextDesign: DesignCalculatorState = {
      ...design,
      panelCount,
      targetPvKw: sizing.pvKw ?? Number((panelCount * panelWatts / 1000).toFixed(2)),
      energyTargetPvKw: sizing.energyTargetPvKw,
      energyTargetPanelCount: sizing.energyTargetPanelCount,
      planningPanelCapacity: sizing.planningPanelCapacity,
      fitLimited: sizing.fitLimited,
      requiredPanelAreaM2: design.panelLengthMm && design.panelWidthMm ? Number((panelCount * design.panelLengthMm * design.panelWidthMm / 1_000_000).toFixed(1)) : undefined,
      fitStatus: sizing.fitLimited ? "does_not_fit" : "unverified",
      pvStrings: stringDesign?.strings,
      panelsPerString: stringDesign?.panelsPerString,
      stringDesign,
      inverterKw: sizing.inverterKw ?? design.inverterKw,
      batteryUsableKwh: includePlannedBattery ? sizing.batteryUsableKwh : undefined,
      batteryAh,
      sizingMethod: "user-adjusted",
      sizingInputs: {
        dailyEnergyKwh: sizing.dailyEnergyKwh,
        dailyEnergySource: sizing.dailyEnergySource,
        peakSunHours: sizing.peakSunHours,
        systemEfficiency: sizing.systemEfficiency,
        simultaneousLoadKw: sizing.simultaneousLoadKw,
        startupPeakKw: sizing.startupPeakKw,
        batteryOnlyDays: sizing.batteryOnlyDays,
        batterySizingBasis: sizing.batterySizingBasis,
        weakestMonthPvKwh: sizing.weakestMonthPvKwh,
        assumedNonSolarLoadKwh: sizing.assumedNonSolarLoadKwh,
      },
      sizingAssumptions: sizing.assumptions,
      sizingWarnings: sizing.warnings,
      proposedChecklist: { ...(design.proposedChecklist ?? {}), "solar-array": false, "proposed-schematic": false },
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
    };
    const nextDraft = proposalDraftForCurrentDesign({ ...nextDesign, proposedAsBuiltDraft: draft }, gridConnected);
    onRedesign(nextDesign, nextDraft);
    setQuickEditMessage(`Saved ${panelCount} panels. Array, string, inverter and storage planning figures were refreshed.`);
  };
  const moveNode = (event: DragEvent<HTMLDivElement>) => {
    if (!movingNodeId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(980, (event.clientX - bounds.left) / zoom - nodeWidth / 2));
    const y = Math.max(0, Math.min(470, (event.clientY - bounds.top) / zoom - 60));
    onChange({ ...draft, nodes: nodes.map((node) => node.id === movingNodeId ? { ...node, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 } : node) });
    setMovingNodeId(undefined);
  };
  const tidyLayout = () => onChange({ ...draft, nodes: nodes.map((node, index) => ({ ...node, x: 35 + (index % 4) * 260, y: 30 + Math.floor(index / 4) * 190 })) });
  const addItem = () => {
    const label = window.prompt("Name the component or item to add");
    if (!label?.trim()) return;
    const id = `custom-${Date.now()}`;
    onChange({ ...draft, nodes: [...nodes, { id, label: label.trim(), detail: "Added to the working system", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 35 + (nodes.length % 4) * 260, y: 30 + Math.floor(nodes.length / 4) * 190 }] });
  };
  const removeSelectedNode = () => {
    if (!selectedNode || !window.confirm(`Delete ${selectedNode.label} from this system schematic? Its attached connections will also be removed.`)) return;
    onChange({ ...draft, nodes: nodes.filter((node) => node.id !== selectedNode.id), connections: connections.filter((connection) => connection.from !== selectedNode.id && connection.to !== selectedNode.id) });
    setSelectedNodeId(undefined);
  };
  const connectionGeometry = (fromId: string, toId: string, offset = 0) => {
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) return { path: "", labelX: 0, labelY: 0 };
    const nodeHeight = 122;
    const fromCx = from.x + nodeCentre;
    const fromCy = from.y + nodeHeight / 2;
    const toCx = to.x + nodeCentre;
    const toCy = to.y + nodeHeight / 2;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const x1 = horizontal ? fromCx + Math.sign(dx || 1) * nodeCentre : fromCx + offset;
    const y1 = horizontal ? fromCy + offset : fromCy + Math.sign(dy || 1) * nodeHeight / 2;
    const x2 = horizontal ? toCx - Math.sign(dx || 1) * nodeCentre : toCx + offset;
    const y2 = horizontal ? toCy + offset : toCy - Math.sign(dy || 1) * nodeHeight / 2;
    const bend = Math.max(35, (horizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1)) * .45);
    const path = horizontal
      ? `M ${x1} ${y1} C ${x1 + Math.sign(dx || 1) * bend} ${y1}, ${x2 - Math.sign(dx || 1) * bend} ${y2}, ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1} ${y1 + Math.sign(dy || 1) * bend}, ${x2} ${y2 - Math.sign(dy || 1) * bend}, ${x2} ${y2}`;
    return { path, labelX: (x1 + x2) / 2, labelY: (y1 + y2) / 2 };
  };
  const pathFor = (fromId: string, toId: string, offset = 0) => connectionGeometry(fromId, toId, offset).path;

  return <div className="proposed-schematic-canvas mt-5 overflow-hidden rounded-2xl border border-[#bad0e4] bg-white"><div className="schematic-canvas-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#edf5fc] px-3 py-2"><span className="text-xs font-extrabold text-brand">{systemName}</span><div className="flex shrink-0 flex-wrap gap-1"><button type="button" onClick={tidyLayout} className="h-8 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand">Tidy layout</button><button type="button" onClick={() => setShowConnectionLabels((value) => !value)} aria-pressed={showConnectionLabels} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[10px] font-bold text-brand">{showConnectionLabels ? <EyeOff size={13}/> : <Eye size={13}/>} {showConnectionLabels ? "Hide labels" : "Show labels"}</button><button type="button" onClick={addItem} className="h-8 rounded-lg border border-line bg-white px-3 text-[10px] font-bold text-brand">+ Add item</button><button type="button" onClick={() => setZoom((value) => Math.max(.25, Number((value - .1).toFixed(2))))} className="grid size-8 place-items-center rounded-lg border border-line bg-white" aria-label="Zoom out"><Minus size={14}/></button><button type="button" onClick={() => setZoom(1)} className="grid size-8 place-items-center rounded-lg border border-line bg-white" aria-label="Reset zoom"><RotateCcw size={13}/></button><button type="button" onClick={() => setZoom((value) => Math.min(1.3, Number((value + .1).toFixed(2))))} className="grid size-8 place-items-center rounded-lg border border-line bg-white" aria-label="Zoom in"><Plus size={14}/></button></div></div><div className="schematic-rotate-hint"><Smartphone size={30} aria-hidden/><div><strong>Rotate your phone to view the schematic</strong><span>Landscape gives the working diagram a clear postcard-sized canvas.</span></div></div><div ref={canvasViewportRef} className="schematic-mobile-canvas-content thin-scrollbar overflow-auto overscroll-contain">
    {selectedNode && componentModalTarget ? createPortal(<div className="mt-5 border-t border-line pt-5">{selectedNodeIsSolar && !supplementaryArray(design) ? <div className="rounded-2xl border border-[#9fc6e7] bg-[#eef6fd] p-4"><div className="eyebrow">Quick edit</div><label className="mt-3 block text-xs font-bold">Total panel quantity<div className="mt-1.5 flex gap-2"><input type="number" min="1" max="10000" step="1" inputMode="numeric" value={quickPanelCount} onChange={(event) => { setQuickPanelCount(event.target.value); setQuickEditMessage(""); }} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm font-extrabold"/><button type="button" onClick={saveQuickPanelQuantity} className="h-11 rounded-xl bg-brand px-4 text-xs font-bold text-white">Save quantity</button></div></label><p className="mt-2 text-[10px] leading-4 text-muted">This refreshes array capacity, string layout and the dependent inverter and storage planning figures.</p>{quickEditMessage ? <p className="mt-2 text-[10px] font-semibold text-brand" role="status">{quickEditMessage}</p> : null}</div> : null}<div className="mt-5 eyebrow">Full component specification</div><dl className="mt-3 grid gap-3 sm:grid-cols-2">{selectedNodeSpecs.map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-[#f7fafc] p-3"><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-muted">{label}</dt><dd className="mt-1 text-xs font-extrabold">{value}</dd></div>)}</dl><button type="button" onClick={removeSelectedNode} className="mt-4 h-9 w-full rounded-lg border border-[#e7b7af] text-[10px] font-bold text-[#a7442d]">Delete this item</button></div>, componentModalTarget) : null}
    <div className="w-[1120px] origin-top-left" style={{ zoom }}>
    <div className="flex min-w-[1120px] items-center gap-4 border-b border-line bg-[#f8fbfe] px-4 py-2 text-[9px] font-semibold text-muted"><strong className="text-brand">Draft proposed schematic</strong><span><b className="text-[#d94141]">Red + black</b> = solar or battery DC</span><span><b className="text-[#d99500]">Gold</b> = inverter AC to the building</span><span><b className="text-[#9b3db5]">Purple</b> = controlled public-grid AC</span><span><b className="text-[#25875a]">Green</b> = protective earth / bonding</span><span className="ml-auto">Cable sizes and safety parts still need checking</span></div>
    <div className="relative h-[610px] w-[1120px] bg-[radial-gradient(circle,#c8d7e4_1px,transparent_1px),radial-gradient(circle_at_50%_45%,rgba(246,201,69,.12),transparent_22rem)] bg-[size:20px_20px,auto]" role="img" aria-label="Draft proposed solar power system schematic" onDragOver={(event) => event.preventDefault()} onDrop={moveNode}>
      <svg viewBox="0 0 1120 610" className="absolute inset-0 h-full w-full" aria-hidden>
        {connections.map((connection) => {
          if (connection.kind === "solar-dc" || connection.kind === "battery-dc") {
            const circuitCount = connection.kind === "solar-dc" && connection.from === "solar" ? Math.max(1, n(design.pvStrings, 1)) : 1;
            return <g key={`${connection.from}:${connection.to}`}>{Array.from({ length: circuitCount }, (_, index) => { const centre = (index - (circuitCount - 1) / 2) * 14; return <g key={index}><path d={pathFor(connection.from, connection.to, centre - 3)} fill="none" stroke="#dc4444" strokeWidth="3"/><path d={pathFor(connection.from, connection.to, centre + 3)} fill="none" stroke="#202d38" strokeWidth="2.5"/></g>; })}</g>;
          }
          const colour = connection.authorityCheck ? "#9b3db5" : connection.kind === "earth" ? "#25875a" : "#d99500";
          return <path key={`${connection.from}:${connection.to}`} d={pathFor(connection.from, connection.to)} fill="none" stroke={colour} strokeWidth="4"/>;
        })}
      </svg>
      {showConnectionLabels && connections.map((connection) => {
        const from = byId.get(connection.from);
        const to = byId.get(connection.to);
        if (!from || !to) return null;
        const complete = connection.configured === true;
        const geometry = connectionGeometry(connection.from, connection.to);
        return <button type="button" onClick={() => { setSelectedConnectionKey(`${connection.from}:${connection.to}`); setRouteLength(connection.lengthM ?? 0); setRouteBasis(connection.lengthBasis ?? "estimated"); setChatOpen(false); }} key={`label:${connection.from}:${connection.to}`} title={complete ? `${connectionDisplayLabel(connection)} — ${connection.cableSizeMm2} mm²${connection.protectionAmps ? `, ${connection.protectionAmps} A protection` : ""}` : `Configure ${connectionDisplayLabel(connection)}`} className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-[8px] font-bold shadow-sm ${complete ? "border-line bg-white/95 text-[#4d6176]" : "border-[#d94a3a] bg-[#fff1ee] text-[#a52f22]"}`} style={{ left: geometry.labelX, top: geometry.labelY }}>{complete ? connectionDisplayLabel(connection) : "Configure"}</button>;
      })}
      {nodes.map((node) => <button type="button" draggable key={node.id} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setMovingNodeId(node.id); }} onClick={() => setSelectedNodeId(node.id)} className="absolute z-20 w-[140px] cursor-grab text-center active:cursor-grabbing" style={{ left: node.x, top: node.y }} title={`Drag to move or select to open ${node.label}`}>
        <span className="block overflow-hidden rounded-2xl border border-[#b8cce0] bg-white p-2 shadow-[0_8px_22px_rgba(20,60,99,.12)] transition hover:-translate-y-0.5 hover:border-brand">
          <span className="relative block h-[72px] overflow-hidden rounded-xl bg-[#f4f7fa]"><Image src={node.image} alt="" fill sizes="124px" className="object-contain p-1.5"/></span>
          <span className="mt-1.5 block text-[10px] font-extrabold text-[#102d4d]">{node.label}</span>
          <span className="mt-1 block text-[8px] leading-3 text-muted">{node.detail}</span>
          <span className={`mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.08em] ${node.reviewed ? "bg-[#dff3e8] text-[#17603b]" : "bg-[#fff1cc] text-[#805d00]"}`}>{node.reviewed ? "✓ Specification accepted" : "Proposed · review"}</span>
        </span>
      </button>)}
    </div></div></div>
    <div onClickCapture={(event) => { const anchor = (event.target as HTMLElement).closest("a"); const label = anchor?.textContent ?? ""; if (anchor && (label.includes("Ask Wattson") || label.includes("Walk through"))) { event.preventDefault(); openContextChat(label.includes("Walk through") ? "install" : "ask"); } }}>
    {(selectedNode || selectedConnection) ? <div className="fixed inset-0 z-[80] grid place-items-center bg-[#102d4d]/45 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) { setSelectedNodeId(undefined); setSelectedConnectionKey(undefined); setPendingSizing(undefined); } }}>
      <section id={selectedNode ? "schematic-component-record-modal" : undefined} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><div className="eyebrow">{selectedNode ? "Proposed component" : "Planning connection"}</div><h3 className="mt-2 text-xl font-extrabold">{selectedNode?.label ?? selectedConnection?.label}</h3></div><button type="button" onClick={() => { setSelectedNodeId(undefined); setSelectedConnectionKey(undefined); setPendingSizing(undefined); }} className="grid size-9 place-items-center rounded-xl border border-line"><X size={16}/></button></div>
        {selectedNode ? <div className="mt-5 space-y-4"><p className="text-xs leading-5 text-muted">{selectedNode.detail}</p><Link href={`${overviewHref}#tech-${selectedNode.id}`} className="flex h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-center text-xs font-bold text-white">{selectedNodeIsSolar ? "Edit panel quantity or specifications" : "Edit this component"}</Link><button type="button" onClick={() => openContextChat("ask")} className="h-11 w-full rounded-xl border border-brand bg-white px-4 text-xs font-bold text-brand">Ask Wattson about this component</button><button type="button" onClick={acceptComponent} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition ${selectedNode.reviewed ? "border border-[#86c79a] bg-[#dff3e8] text-[#17603b]" : "bg-[#238653] text-white hover:bg-[#1b7045]"}`}><CheckCircle2 size={16}/>{selectedNode.reviewed ? "Specification accepted" : "Accept specification"}</button><p className="rounded-xl border border-[#b8d7f1] bg-[#eef6fd] p-3 text-[10px] leading-4 text-muted">Acceptance adds this proposed item to the Build It shopping list. It does not mark it purchased, installed or certified.</p></div> : null}
        {selectedConnection ? <div className="mt-5 space-y-4"><p className="text-xs leading-5 text-muted">Record the measured or estimated one-way route so Wattson can suggest planning values for this connection. You will review the complete schematic before Build It opens.</p><NumberField label="One-way route length" value={routeLength} unit="m" onChange={setRouteLength}/><label className="block text-xs font-bold">Distance quality<select value={routeBasis} onChange={(event) => setRouteBasis(event.target.value as "estimated" | "measured")} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3"><option value="estimated">Estimated</option><option value="measured">Measured</option></select></label><button type="button" disabled={routeLength <= 0} onClick={saveRoute} className="h-11 w-full rounded-xl bg-brand px-4 text-xs font-bold text-white disabled:opacity-40">Calculate and review planning values</button><button type="button" onClick={() => openContextChat("ask")} className="h-11 w-full rounded-xl border border-brand bg-white px-4 text-xs font-bold text-brand">Ask Wattson about this connection</button><p className="rounded-xl border border-[#efd98e] bg-[#fff9e3] p-3 text-[10px] leading-4 text-[#765918]">Final conductor and protection selection still depends on equipment limits, installation method, temperature, grouping, fault level and local electrical rules.</p></div> : null}
      </section>
    </div> : null}
    </div>
    {selectedConnection && pendingSizing && !chatOpen ? <div className="fixed inset-0 z-[90] grid place-items-center bg-[#102d4d]/55 p-4"><section className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#9bd2ad] bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-[#b9dfc6] bg-[#f2fbf5] p-5"><div><div className="eyebrow text-[#17603b]">Wattson sizing suggestion</div><h3 className="mt-2 text-xl font-extrabold">{connectionDisplayLabel(selectedConnection)}</h3><p className="mt-2 text-[10px] leading-4 text-muted">Review these planning values before adding them to the working design.</p></div><button type="button" onClick={() => setPendingSizing(undefined)} className="grid size-9 place-items-center rounded-xl border border-line bg-white"><X size={16}/></button></div><div className="grid gap-3 p-5 sm:grid-cols-2"><Result label="Cable" value={pendingSizing.cableSizeMm2 ? `${pendingSizing.cableSizeMm2} mm²` : "Needs review"} detail="Suggested conductor size"/><Result label="Protection" value={pendingSizing.protectionAmps ? `${pendingSizing.protectionAmps} A` : "Not applicable"} detail="Suggested fuse or breaker"/><Result label="Route length" value={`${routeLength} m`} detail={routeBasis === "measured" ? "Measured route" : "Estimated route"}/><Result label="Circuit" value={selectedConnection.kind === "solar-dc" ? "PV DC" : selectedConnection.kind === "battery-dc" ? "Battery DC" : selectedConnection.kind === "earth" ? "Safety earth" : "AC"} detail="Working design circuit"/></div><div className="grid gap-2 border-t border-line bg-[#f7fafc] p-5 sm:grid-cols-2"><button type="button" onClick={() => setPendingSizing(undefined)} className="h-11 rounded-xl border border-brand bg-white px-4 text-xs font-bold text-brand">Go back</button><button type="button" onClick={acceptSizing} className="h-11 rounded-xl bg-brand px-4 text-xs font-bold text-white">Accept and record</button></div></section></div> : null}
    {chatOpen && (selectedConnection || selectedNode) ? <div className="fixed inset-0 z-[90] grid place-items-center bg-[#102d4d]/55 p-4"><section className="flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-line bg-[#eef5fc] p-4"><div><div className="eyebrow">Wattson · questions about this item</div><h3 className="mt-2 text-lg font-extrabold">{selectedNode?.label ?? (selectedConnection ? connectionDisplayLabel(selectedConnection) : "System item")}</h3></div><button type="button" onClick={() => setChatOpen(false)} className="grid size-9 place-items-center rounded-xl border border-line bg-white"><X size={16}/></button></div><div className="thin-scrollbar min-h-56 flex-1 space-y-3 overflow-y-auto p-4">{chatMessages.map((message, index) => <div key={index} className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-5 ${message.role === "user" ? "ml-auto bg-brand text-white" : "bg-[#eef3f8] text-ink"}`}><FormattedChatMessage content={message.content}/></div>)}{chatBusy ? <div className="text-xs font-semibold text-muted">Wattson is checking this item…</div> : null}</div><div className="flex gap-2 border-t border-line p-4"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendConnectionChat(); } }} placeholder={`Ask about ${selectedNode?.label ?? (selectedConnection ? connectionDisplayLabel(selectedConnection) : "this item")}…`} className="min-h-12 flex-1 resize-none rounded-xl border border-line p-3 text-xs outline-none focus:border-brand"/><button type="button" disabled={!chatInput.trim() || chatBusy} onClick={() => void sendConnectionChat()} className="rounded-xl bg-brand px-4 text-xs font-bold text-white disabled:opacity-40">Send</button></div></section></div> : null}
  </div>;
}

function proposalDraftForCurrentDesign(design: DesignCalculatorState, gridConnected: boolean): NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]> {
  const draft = design.proposedAsBuiltDraft;
  if (!draft) return createProposedAsBuiltDraft(design, gridConnected);
  const nodes = draft.nodes ?? [];
  const expectedStrings = design.mountingLocations?.includes("none") ? 0 : Math.max(1, Math.round(n(design.pvStrings, 1)));
  const actualStrings = nodes.filter((node) => node.id.startsWith("solar-pv-")).length || (nodes.some((node) => node.id === "solar") ? 1 : 0);
  const structureChanged =
    draft.architecture !== design.architecture
    || n(draft.panelCount) !== n(design.panelCount)
    || n(draft.panelWatts) !== n(design.panelWatts)
    || (expectedStrings ? n(draft.pvStrings, 1) : n(draft.pvStrings)) !== expectedStrings
    || n(draft.panelsPerString) !== n(design.panelsPerString)
    || actualStrings !== expectedStrings
    || nodes.some((node) => node.id === "generator") !== Boolean(design.generatorIncluded)
    || nodes.some((node) => node.id === "grid-supply") !== gridConnected;
  return structureChanged ? createProposedAsBuiltDraft(design, gridConnected) : draft;
}

export function createProposedAsBuiltDraft(design: DesignCalculatorState, gridConnected = false): NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]> {
  type Draft = NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>;
  const baseFlow = design.architecture === "separate_solar_controller_and_inverter"
    ? ["Solar panels", "Solar charge controller", "Battery storage", "Inverter", "Your lights, outlets and tools"]
    : design.architecture === "combined_hybrid_inverter"
      ? ["Solar panels", "Hybrid inverter / charger", "Your lights, outlets and tools"]
      : design.architecture === "ac_coupled"
        ? ["Solar panels", "PV inverter", "AC connection", "Your lights, outlets and tools"]
        : ["Solar panels", "Inverter / charger to be selected", "Your lights, outlets and tools"];
  const flow = design.generatorIncluded ? [...baseFlow.slice(0, -1), "Generator backup", baseFlow.at(-1) ?? "Your lights, outlets and tools"] : baseFlow;
  const pvLayout = pvLayoutLabel(design);
  const pvStringCount = Math.max(1, n(design.pvStrings, 1));
  const supplementary = supplementaryArray(design);
  const solarIsolationLabel = pvStringCount > 1 ? `PV isolation for ${pvStringCount} strings` : "Solar safety switch";
  const solarIsolationDetail = pvStringCount > 1
    ? "Use one correctly rated isolator per string, or a rated common multi-pole isolator that disconnects all strings together."
    : "Lets the PV string be safely disconnected";
  const pvFeedLabel = design.pvStrings && design.panelsPerString
    ? `${design.pvStrings} string${design.pvStrings === 1 ? "" : "s"} x ${design.panelsPerString} panels`
    : "PV string layout to confirm";
  const solarDetail = design.panelCount
    ? `${design.panelCount} x ${design.panelWatts ?? "?"} W; ${mountingLocationText(design.mountingLocations)}; ${pvLayout}`
    : `${mountingLocationText(design.mountingLocations)}; ${pvLayout}`;
  const solarSafetyNodes = (x: number): NonNullable<Draft["nodes"]> => pvStringCount > 1
    ? Array.from({ length: pvStringCount }, (_, index) => ({ id: `solar-safety-${index + 1}`, label: `PV${index + 1} isolator`, detail: `DC isolator for PV${index + 1}; disconnects that string independently`, image: "/schematic-components/dc-disconnect-isolator.jpg", x, y: 20 + index * 125 }))
    : [{ id: "solar-safety", label: solarIsolationLabel, detail: solarIsolationDetail, image: "/schematic-components/dc-disconnect-isolator.jpg", x, y: 30 }];
  const solarNodes: NonNullable<Draft["nodes"]> = supplementary
    ? [
      { id: "solar-pv-1", label: "Existing panel array", detail: `${design.existingPanelGroup?.proposedUseCount ?? "?"} × ${design.existingPanelGroup?.wattsEach ?? design.panelWatts ?? "?"} W user-owned panels; suitability to verify`, image: "/schematic-components/solar-panel-pv-module.jpg", x: 35, y: 20 },
      { id: "solar-pv-2", label: "Additional solar array", detail: `${round(supplementary.targetPvKw, 2)} kW minimum; module type and quantity to select`, image: "/schematic-components/solar-panel-pv-module.jpg", x: 35, y: 145 },
    ]
    : pvStringCount > 1
    ? Array.from({ length: pvStringCount }, (_, index) => ({ id: `solar-pv-${index + 1}`, label: `PV${index + 1} · ${n(design.panelsPerString, 1)} panels`, detail: `${n(design.panelsPerString, 1)} × ${design.panelWatts ?? "?"} W; one independent PV string`, image: "/schematic-components/solar-panel-pv-module.jpg", x: 35, y: 20 + index * 125 }))
    : [{ id: "solar", label: "Solar panels", detail: solarDetail, image: "/schematic-components/solar-panel-pv-module.jpg", x: 35, y: 30 }];
  const solarFeedConnections = (target: string): NonNullable<Draft["connections"]> => pvStringCount > 1
    ? Array.from({ length: pvStringCount }, (_, index) => [
      { from: `solar-pv-${index + 1}`, to: `solar-safety-${index + 1}`, label: `PV${index + 1} string`, kind: "solar-dc" as const },
      { from: `solar-safety-${index + 1}`, to: target, label: `PV${index + 1} string to MPPT${index + 1}`, kind: "solar-dc" as const },
    ]).flat()
    : [{ from: "solar", to: "solar-safety", label: pvFeedLabel, kind: "solar-dc" as const }, { from: "solar-safety", to: target, label: "PV string to inverter/MPPT input", kind: "solar-dc" as const }];
  const nodes: NonNullable<Draft["nodes"]> = [
    ...solarNodes,
    { id: "battery", label: "Battery storage", detail: design.batteryUsableKwh ? `${round(design.batteryUsableKwh, 1)} kWh usable storage from discovery` : design.batteryVoltage ? `${design.batteryVoltage} V storage proposed` : "Storage capacity requires a confirmed daily-energy value", image: "/schematic-components/lifepo4-battery-bank.jpg", x: 35, y: 345 },
    { id: "switchboard", label: "Building power board", detail: "Sends power to lights, outlets and tools", image: "/schematic-components/ac-distribution-board.jpg", x: 940, y: 180 },
    { id: "earth", label: "Safety earth", detail: "Provides a safety path into the ground", image: "/schematic-components/earth-electrode.svg", x: 940, y: 415 },
  ];
  const connections: NonNullable<Draft["connections"]> = [];
  if (design.architecture === "separate_solar_controller_and_inverter") {
    nodes.push(
      ...solarSafetyNodes(250),
      { id: "controller", label: "Solar power controller", detail: "Controls power going into the battery", image: "/schematic-components/mppt-charge-controller.jpg", x: 465, y: 30 },
      { id: "battery-safety", label: "Battery fuse and switch", detail: "Protects the battery cable and disconnects it", image: "/schematic-components/dc-fuse.jpg", x: 250, y: 345 },
      { id: "inverter", label: "Inverter / charger", detail: design.inverterKw ? `Proposed inverter / charger: ${design.inverterKw} kW` : "Changes battery power into building power", image: "/schematic-components/hybrid-inverter.jpg", x: 545, y: 180 },
      { id: "ac-safety", label: "Building safety switch", detail: "Protects the cable feeding the building", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 745, y: 180 },
    );
    connections.push(
      ...solarFeedConnections("controller"),
      { from: "controller", to: "battery", label: "Power charging battery", kind: "battery-dc" },
      { from: "battery", to: "battery-safety", label: "Stored battery power", kind: "battery-dc" },
      { from: "battery-safety", to: "inverter", label: "Safe battery feed", kind: "battery-dc" },
      { from: "inverter", to: "ac-safety", label: "Building power", kind: "ac" },
      { from: "ac-safety", to: "switchboard", label: "To power board", kind: "ac" },
      { from: "switchboard", to: "earth", label: "Safety earth wire", kind: "earth" },
    );
  } else if (design.architecture === "ac_coupled") {
    nodes.push(
      ...solarSafetyNodes(240),
      { id: "pv-inverter", label: "Solar power box", detail: "Changes panel power into building power", image: "/schematic-components/string-inverter.jpg", x: 445, y: 30 },
      { id: "battery-safety", label: "Battery fuse and switch", detail: "Protects and disconnects the battery", image: "/schematic-components/dc-fuse.jpg", x: 240, y: 345 },
      { id: "battery-inverter", label: "Battery power box", detail: "Controls charging and stored power", image: "/schematic-components/hybrid-inverter.jpg", x: 445, y: 345 },
      { id: "ac-safety", label: "Building safety switch", detail: "Protects the cable feeding the building", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 745, y: 180 },
    );
    connections.push(
      ...solarFeedConnections("pv-inverter"),
      { from: "pv-inverter", to: "ac-safety", label: "Solar power for building", kind: "ac" },
      { from: "battery", to: "battery-safety", label: "Stored battery power", kind: "battery-dc" },
      { from: "battery-safety", to: "battery-inverter", label: "Safe battery feed", kind: "battery-dc" },
      { from: "battery-inverter", to: "ac-safety", label: "Battery power for building", kind: "ac" },
      { from: "ac-safety", to: "switchboard", label: "To power board", kind: "ac" },
      { from: "switchboard", to: "earth", label: "Safety earth wire", kind: "earth" },
    );
    const pvInverter = nodes.find((node) => node.id === "pv-inverter");
    if (pvInverter) {
      pvInverter.label = design.inverterArrangement === "microinverters" ? "Microinverters" : "Solar string inverter";
      pvInverter.image = design.inverterArrangement === "microinverters" ? "/schematic-components/microinverter.jpg" : "/schematic-components/string-inverter.jpg";
      pvInverter.detail = design.inverterArrangement === "microinverters" ? "Module-level DC-to-AC conversion; branch ratings and standalone grid-forming support to confirm" : "Converts the PV strings to AC; battery storage uses a separate compatible inverter";
    }
    if (design.inverterArrangement === "microinverters") {
      // Module DC feeds the microinverters locally; the trunk leaving them is AC.
      const safetyIds = new Set(nodes.filter((node) => node.id.startsWith("solar-safety")).map((node) => node.id));
      for (let i = nodes.length - 1; i >= 0; i--) if (safetyIds.has(nodes[i].id)) nodes.splice(i, 1);
      for (let i = connections.length - 1; i >= 0; i--) if (safetyIds.has(connections[i].from) || safetyIds.has(connections[i].to)) connections.splice(i, 1);
      for (const node of solarNodes) connections.push({ from: node.id, to: "pv-inverter", label: "Module DC inputs; compatibility to confirm", kind: "solar-dc" });
    } else if (design.inverterArrangement === "optimiser_string") {
      // Optimisers are module-level equipment, before each string's isolation.
      for (const solar of solarNodes) {
        const id = `optimisers-${solar.id}`;
        nodes.push({ id, label: "DC optimisers", detail: "Module-level DC optimisers; exact module, string and inverter compatibility required", image: "/schematic-components/dc-optimisers.svg", x: 240, y: solar.y });
        for (const connection of connections) if (connection.from === solar.id && connection.kind === "solar-dc") connection.from = id;
        connections.push({ from: solar.id, to: id, label: "Module-level DC inputs", kind: "solar-dc" });
      }
      for (const node of nodes) if (node.id.startsWith("solar-safety")) node.x = 445;
      else if (["pv-inverter", "ac-safety", "switchboard", "earth"].includes(node.id)) node.x += 205;
    }
  } else {
    nodes.push(
      ...solarSafetyNodes(250),
      { id: "battery-safety", label: "Battery fuse and switch", detail: "Protects and disconnects the battery", image: "/schematic-components/dc-fuse.jpg", x: 250, y: 345 },
      { id: "inverter", label: design.architecture === "not_decided" ? "Inverter arrangement to assess" : "Hybrid inverter", detail: design.architecture === "not_decided" ? "Select or assess the inverter architecture and its documented source paths" : design.inverterKw ? `Proposed hybrid inverter / charger: ${design.inverterKw} kW` : "Manages solar, battery and building power", image: "/schematic-components/hybrid-inverter.jpg", x: 545, y: 180 },
      { id: "ac-safety", label: "Building safety switch", detail: "Protects the cable feeding the building", image: "/schematic-components/ac-circuit-breaker-mcb.jpg", x: 745, y: 180 },
    );
    connections.push(
      ...solarFeedConnections("inverter"),
      { from: "battery", to: "battery-safety", label: "Stored battery power", kind: "battery-dc" },
      { from: "battery-safety", to: "inverter", label: "Safe battery feed", kind: "battery-dc" },
      { from: "inverter", to: "ac-safety", label: "Building power", kind: "ac" },
      { from: "ac-safety", to: "switchboard", label: "To power board", kind: "ac" },
      { from: "switchboard", to: "earth", label: "Safety earth wire", kind: "earth" },
    );
  }
  if (gridConnected) {
    nodes.push(
      { id: "grid-supply", label: "Public grid supply", detail: "Existing utility or network supply to this Site", image: "/schematic-components/grid-connection.svg", x: 575, y: 445, authorityCheck: true },
      { id: "grid-changeover", label: "Grid changeover and isolation", detail: "Possible electrician job: check the Site's local authority and network-operator requirements", image: "/schematic-components/automatic-transfer-switch-ats.jpg", x: 765, y: 445, authorityCheck: true },
    );
    connections.push(
      { from: "grid-supply", to: "grid-changeover", label: "Possible electrician job — check local authority", kind: "ac", authorityCheck: true },
      { from: "grid-changeover", to: "switchboard", label: "Controlled grid feed", kind: "ac", authorityCheck: true },
    );
  }
  if (design.generatorIncluded) {
    const generatorInterface = generatorInterfaceSpecification(design, gridConnected);
    nodes.push(
      { id: "generator", label: design.generatorPurchaseStatus === "not_purchased" ? "Generator to purchase" : "Generator supply", detail: design.generatorContinuousKw ? `${design.generatorContinuousKw} kW minimum continuous${design.generatorSurgeKw ? `; verified ${design.generatorSurgeKw} kW motor-start required` : ""}` : "Generator rating still to be confirmed", image: "/schematic-components/generator.jpg", x: 250, y: 445 },
      { id: "generator-changeover", label: generatorInterface.label, detail: generatorInterface.detail, image: generatorInterface.image, x: 420, y: 445 },
    );
    connections.push(
      { from: "generator", to: "generator-changeover", label: "Generator AC supply", kind: "ac" },
      { from: "generator-changeover", to: generatorInterface.target, label: "Protected generator input", kind: "ac" },
    );
  }
  if (design.mountingLocations?.includes("none")) {
    const excluded = new Set(nodes.filter((node) => node.id === "solar" || node.id.startsWith("solar-") || node.id === "controller").map((node) => node.id));
    for (let i = nodes.length - 1; i >= 0; i--) if (excluded.has(nodes[i].id)) nodes.splice(i, 1);
    for (let i = connections.length - 1; i >= 0; i--) if (excluded.has(connections[i].from) || excluded.has(connections[i].to)) connections.splice(i, 1);
    for (let i = flow.length - 1; i >= 0; i--) if (/solar panel|solar charge/i.test(flow[i])) flow.splice(i, 1);
  }
  return {
    createdAt: new Date().toISOString(),
    architecture: design.architecture,
    flow,
    nodes,
    connections: connections.map((connection) => preliminaryConnectionValues(connection, design)),
    panelCount: design.panelCount,
    panelWatts: design.panelWatts,
    pvStrings: design.pvStrings,
    panelsPerString: design.panelsPerString,
    panelVmpV: design.panelVmpV,
    panelVocV: design.panelVocV,
    panelImpA: design.panelImpA,
    panelIscA: design.panelIscA,
    batteryVoltage: design.batteryVoltage,
    batteryAh: design.batteryAh,
    batteryQuantity: design.batteryQuantity,
    inverterKw: design.inverterKw,
    generatorContinuousKw: design.generatorContinuousKw,
    generatorSurgeKw: design.generatorSurgeKw,
  };
}

function ensureGeneratorSupply(draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>, design: DesignCalculatorState, gridConnected = false) {
  if (!design.generatorIncluded) return draft;
  const generatorInterface = generatorInterfaceSpecification(design, gridConnected);
  if (draft.nodes?.some((node) => node.id === "generator")) return {
    ...draft,
    nodes: draft.nodes.map((node) => node.id === "generator-changeover" ? { ...node, label: generatorInterface.label, detail: generatorInterface.detail, image: generatorInterface.image } : node),
    connections: draft.connections?.map((connection) => connection.from === "generator-changeover" ? { ...connection, to: generatorInterface.target, label: "Protected generator input" } : connection),
  };
  return {
    ...draft,
    flow: draft.flow.includes("Generator backup") ? draft.flow : [...draft.flow.slice(0, -1), "Generator backup", draft.flow.at(-1) ?? "Your lights, outlets and tools"],
    nodes: [
      ...(draft.nodes ?? []),
      { id: "generator", label: design.generatorPurchaseStatus === "not_purchased" ? "Generator to purchase" : "Generator supply", detail: design.generatorContinuousKw ? `${design.generatorContinuousKw} kW minimum continuous${design.generatorSurgeKw ? `; verified ${design.generatorSurgeKw} kW motor-start required` : ""}` : "Generator rating still to be confirmed", image: "/schematic-components/generator.jpg", x: 250, y: 445 },
      { id: "generator-changeover", label: generatorInterface.label, detail: generatorInterface.detail, image: generatorInterface.image, x: 420, y: 445 },
    ],
    connections: [
      ...(draft.connections ?? []),
      { from: "generator", to: "generator-changeover", label: "Generator AC supply", kind: "ac" as const },
      { from: "generator-changeover", to: generatorInterface.target, label: "Protected generator input", kind: "ac" as const },
    ],
    generatorContinuousKw: design.generatorContinuousKw,
    generatorSurgeKw: design.generatorSurgeKw,
  };
}

function ensureGridSupply(draft: NonNullable<DesignCalculatorState["proposedAsBuiltDraft"]>, gridConnected: boolean) {
  const normalisedDraft = {
    ...draft,
    nodes: draft.nodes?.map((node) => node.id === "inverter" && node.label === "Main power box"
      ? { ...node, label: draft.architecture === "separate_solar_controller_and_inverter" ? "Inverter / charger" : "Hybrid inverter" }
      : node),
  };
  if (!gridConnected || normalisedDraft.nodes?.some((node) => node.id === "grid-supply")) return normalisedDraft;
  return {
    ...normalisedDraft,
    nodes: [
      ...(normalisedDraft.nodes ?? []),
      { id: "grid-supply", label: "Public grid supply", detail: "Existing utility or network supply to this Site", image: "/schematic-components/grid-connection.svg", x: 575, y: 445, authorityCheck: true },
      { id: "grid-changeover", label: "Grid changeover and isolation", detail: "Possible electrician job: check the Site's local authority and network-operator requirements", image: "/schematic-components/automatic-transfer-switch-ats.jpg", x: 765, y: 445, authorityCheck: true },
    ],
    connections: [
      ...(normalisedDraft.connections ?? []),
      { from: "grid-supply", to: "grid-changeover", label: "Possible electrician job — check local authority", kind: "ac" as const, authorityCheck: true },
      { from: "grid-changeover", to: "switchboard", label: "Controlled grid feed", kind: "ac" as const, authorityCheck: true },
    ],
  };
}
