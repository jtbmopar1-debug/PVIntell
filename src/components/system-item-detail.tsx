"use client";

import {
  ArrowLeft,
  BatteryCharging,
  Cable,
  Camera,
  Gauge,
  ImagePlus,
  Link2,
  LoaderCircle,
  Package,
  PlugZap,
  ScanLine,
  ShieldCheck,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EquipmentLabelExtraction } from "@/ai/equipment-label";
import { ComponentRegulatoryPanel } from "@/components/component-regulatory-panel";
import type { ComponentSpec, DesignCalculatorState, PVArray } from "@/domain/models";
import { inverterPowerInputKw } from "@/lib/power-units";
import type { ComponentRegulatoryBundle } from "@/regulations/component-regulatory-library";

// Keep the complete multipart request comfortably below common serverless
// request-body limits. Base64/provider processing can add further overhead.
const labelUploadLimit = 2 * 1024 * 1024;

async function responseBody(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text) as Record<string, any>; }
  catch { return { error: text.slice(0, 500) }; }
}

async function prepareLabelPhoto(file: File) {
  if (file.size <= labelUploadLimit) return file;
  const bitmap = await createImageBitmap(file);
  let longest = 2000;
  let quality = .8;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= labelUploadLimit) break;
    longest = Math.round(longest * .75);
    quality = Math.max(.52, quality - .08);
  }
  bitmap.close();
  if (!blob || blob.size > labelUploadLimit) throw new Error("This photo is too large to prepare. Please choose a smaller image.");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
}

const componentTypes: Array<[ComponentSpec["kind"], string]> = [
  ["inverter", "Inverter / charger"],
  ["battery", "Battery / bank"],
  ["generator", "Generator"],
  ["charger", "Charge controller"],
  ["protection", "Breaker / fuse / protection"],
  ["isolator", "Isolator / shutoff"],
  ["cable", "Cable run"],
  ["connector", "Connector"],
  ["combiner", "Combiner box"],
  ["meter", "Meter"],
  ["monitoring", "Monitoring device"],
  ["load", "Load / appliance"],
  ["panel", "Individual panels"],
  ["pv_string", "PV string"],
  ["other", "Other equipment"],
];
function itemIcon(type: string) {
  if (type === "inverter" || type === "charger") return <PlugZap size={22} />;
  if (type === "battery") return <BatteryCharging size={22} />;
  if (type === "protection" || type === "isolator")
    return <ShieldCheck size={22} />;
  if (type === "cable") return <Cable size={22} />;
  if (type === "connector" || type === "combiner") return <Link2 size={22} />;
  if (type === "meter" || type === "monitoring") return <Gauge size={22} />;
  if (type === "panel") return <Sun size={22} />;
  return <Package size={22} />;
}
const optionalNumber = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? "").trim();
  return value ? Number(value) : undefined;
};
const parseSpecs = (value: FormDataEntryValue | null) => {
  const specifications: Record<string, string> = {};
  const notes: string[] = [];
  for (const rawLine of String(value ?? "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator > 0) {
      const name = line.slice(0, separator).trim();
      const detail = line.slice(separator + 1).trim();
      if (name && detail) specifications[name] = detail;
      else notes.push(line);
    } else {
      notes.push(line);
    }
  }
  if (notes.length)
    specifications["Additional technical notes"] = notes.join("\n");
  return specifications;
};
const acConnectionFields = {
  sourceInverters: "Source inverter(s)",
  destinationBoard: "Destination switchboard / breaker panel",
  supplyArrangement: "Supply arrangement",
  nominalVoltage: "Nominal AC voltage",
  phase: "Phase arrangement",
  frequency: "Frequency",
  normalSource: "Normal supply source",
  alternateSource: "Alternate / bypass source",
  acCableType: "AC cable / conductor type",
  acCableSize: "AC conductor size",
  acCableLength: "AC cable length",
  acCores: "Cores / conductors",
  acRoute: "AC cable route",
  acBreaker: "AC breaker rating / type",
  acBreakerPoles: "AC breaker poles / curve",
  acRcd: "RCD / RCBO type and sensitivity",
  acIsolator: "AC isolator / main shutoff",
  changeoverType: "Changeover / transfer type",
  changeoverLocation: "Changeover location",
  changeoverMode: "Changeover operation",
  transferTrigger: "Transfer to alternate source trigger",
  returnTrigger: "Return to inverter / battery trigger",
  transferDelay: "Transfer / return delay",
  interlock: "Interlocking / anti-islanding",
  neutralArrangement: "Neutral / earth switching arrangement",
  gridMeter: "Grid / export meter",
  testedBy: "Installed / tested by",
  testDate: "Test date",
  certificateReference: "Certificate / test reference",
} as const;
const acConnectionGroups: Array<{
  title: string;
  help: string;
  fields: Array<keyof typeof acConnectionFields>;
}> = [
  {
    title: "Connection path",
    help: "Record where the AC supply starts, where it terminates and the supply format.",
    fields: [
      "sourceInverters",
      "destinationBoard",
      "supplyArrangement",
      "nominalVoltage",
      "phase",
      "frequency",
      "normalSource",
      "alternateSource",
    ],
  },
  {
    title: "Cable run",
    help: "Installed conductor, route and length between the inverter output and switchboard.",
    fields: [
      "acCableType",
      "acCableSize",
      "acCableLength",
      "acCores",
      "acRoute",
    ],
  },
  {
    title: "Protection and isolation",
    help: "Record ratings and device types—not only the nominal current.",
    fields: ["acBreaker", "acBreakerPoles", "acRcd", "acIsolator"],
  },
  {
    title: "Changeover and bypass logic",
    help: "Describe manual or automatic transfer, including the thresholds that move to mains/generator and return to inverter supply.",
    fields: [
      "changeoverType",
      "changeoverLocation",
      "changeoverMode",
      "transferTrigger",
      "returnTrigger",
      "transferDelay",
      "interlock",
      "neutralArrangement",
    ],
  },
  {
    title: "Verification",
    help: "Optional inspection, test or certification references for the completed AC work.",
    fields: ["gridMeter", "testedBy", "testDate", "certificateReference"],
  },
];
const inverterAssignmentFields = {
  inverterRole: "Role / purpose",
  pvInputs: "PV strings / MPPT inputs handled",
  generatorRole: "Generator charging role / input",
  batteryConnection: "Battery bank connected",
  acOutput: "AC output / switchboard supplied",
  parallelGroup: "Parallel unit / group",
  operatingMode: "Operating mode",
  prioritySettings: "Charging / source priority settings",
} as const;
const batteryFields = {
  nominalVoltage: "Nominal voltage",
  capacity: "Capacity",
  chemistry: "Chemistry / battery type",
  usableCapacity: "Planning usable capacity",
  bmsCompatibility: "BMS / inverter compatibility",
  maximumChargeCurrent: "Maximum charge current",
  maximumDischargeCurrent: "Maximum discharge current",
  arrangement: "Series / parallel arrangement",
} as const;
const earthingFields = {
  earthingArrangement: "Earthing arrangement / system",
  mainEarthPoint: "Main earth bar / electrode location",
  pvFrameBonding: "PV frames / mounting bonded",
  inverterEarth: "Inverter chassis earth",
  batteryEarth: "Battery rack / enclosure earth",
  generatorBonding: "Generator neutral / earth bonding",
  switchboardEarth: "Switchboard earth connection",
  conductorSizes: "Earth conductor sizes",
  bondingPoints: "Other bonded metalwork",
  testDate: "Earth test date",
  testResult: "Earth continuity / resistance result",
  inspectedBy: "Tested / inspected by",
} as const;
const isolatorFields = {
  circuitIsolated: "Circuit / equipment isolated",
  currentType: "AC / DC type",
  ratedVoltage: "Rated operational voltage",
  ratedCurrent: "Rated current",
  poles: "Number of poles",
  utilizationCategory: "Utilisation / switching category",
  enclosureRating: "Enclosure / IP rating",
  installationEnvironment: "Indoor / outdoor location",
  lockable: "Lockable in OFF position",
  cableTerminalCapacity: "Cable / terminal capacity",
  upstreamDevice: "Connected from / upstream device",
  downstreamDevice: "Connected to / downstream device",
  identificationLabel: "Isolation label / identifier",
  standard: "Standard / certification",
  testedBy: "Installed / tested by",
  testDate: "Test date",
} as const;
const protectionFields = {
  currentType: "AC / DC type",
  ratedCurrent: "Rated current",
  ratedVoltage: "Rated operational voltage",
  poles: "Number of poles",
  breakingCapacity: "Breaking / interrupt capacity",
  tripCurve: "Trip curve / characteristic",
  fuseClass: "Fuse class / family",
  fuseHolder: "Fuse holder / format",
  rcdType: "RCD / RCBO type",
  residualCurrent: "Residual-current sensitivity",
  spdType: "SPD type / class",
  maximumContinuousVoltage: "Maximum continuous voltage (Uc / MCOV)",
  surgeRating: "Surge / discharge-current rating",
  circuitProtected: "Circuit / equipment protected",
  cableTerminalCapacity: "Cable / terminal capacity",
  standard: "Standard / certification",
} as const;
const componentSpecificFields: Partial<Record<ComponentSpec["kind"], { eyebrow: string; title: string; help: string; fields: Record<string, string> }>> = {
  panel: { eyebrow: "Solar module", title: "Panel specifications", help: "Record the module ratings and physical details from the exact panel label or datasheet.", fields: { cellTechnology: "Cell technology", voc: "Open-circuit voltage (Voc)", vmp: "Maximum-power voltage (Vmp)", isc: "Short-circuit current (Isc)", imp: "Maximum-power current (Imp)", dimensions: "Module dimensions", weight: "Module weight" } },
  pv_string: { eyebrow: "PV string", title: "String specifications", help: "Record how this string is arranged and the ratings presented to the inverter or controller.", fields: { panelsPerString: "Panels per string", stringCount: "Number of parallel strings", arrangement: "Series / parallel arrangement", voc: "String open-circuit voltage", vmp: "String maximum-power voltage", isc: "String short-circuit current", imp: "String maximum-power current", mpptInput: "MPPT input / destination" } },
  generator: { eyebrow: "Generator", title: "Generator specifications", help: "Record the generator output, starting capability and connection arrangement.", fields: { fuel: "Fuel / energy source", continuousOutput: "Continuous output", surgeOutput: "Starting / surge output", voltagePhase: "Voltage / phase", frequency: "Frequency", startControl: "Start / control method", connection: "Transfer / inverter input arrangement" } },
  charger: { eyebrow: "Charge controller", title: "Controller specifications", help: "Record the controller input, battery-side limits and communications details.", fields: { controllerType: "Controller type", pvVoltage: "Maximum PV input voltage", pvCurrent: "Maximum PV input current", batteryVoltage: "Battery voltage range", chargeCurrent: "Maximum charge current", output: "Load / output arrangement", communications: "Communications / BMS interface" } },
  cable: { eyebrow: "Cable run", title: "Cable specifications", help: "Record the conductor construction, rating and physical route for this cable.", fields: { cableType: "Cable type", conductorSize: "Conductor size", cores: "Cores / conductors", voltageRating: "Voltage rating", currentRating: "Current / thermal rating", insulation: "Insulation / temperature rating", route: "Cable route" } },
  connector: { eyebrow: "Connector", title: "Connector specifications", help: "Record the connector family, polarity, environmental rating and compatible cable.", fields: { connectorType: "Connector type", polarity: "Polarity / keying", voltageRating: "Voltage rating", currentRating: "Current rating", cableCompatibility: "Cable compatibility", ingress: "Ingress / IP rating" } },
  combiner: { eyebrow: "Combiner", title: "Combiner specifications", help: "Record the string inputs, output and protection contained in this combiner.", fields: { inputs: "String inputs", output: "Output arrangement", fuses: "String fuses / protection", isolator: "DC isolator", enclosure: "Enclosure / IP rating", monitoring: "String monitoring", route: "Cable route" } },
  meter: { eyebrow: "Metering", title: "Meter specifications", help: "Record what the meter measures, its sensing arrangement and communications.", fields: { meterType: "Meter type", voltagePhase: "Voltage / phase", currentSensing: "CT / shunt sensing", accuracy: "Accuracy class", communications: "Communications", direction: "Import / export direction" } },
  monitoring: { eyebrow: "Monitoring", title: "Monitoring specifications", help: "Record the device role, protocol, power supply and connected equipment.", fields: { deviceRole: "Device role", protocol: "Protocol / interface", communications: "Network / communications", powerSupply: "Power supply", connectedEquipment: "Connected equipment", firmware: "Firmware / software" } },
  load: { eyebrow: "Electrical load", title: "Load specifications", help: "Record the load rating, starting behaviour and operating schedule.", fields: { loadType: "Load type", ratedPower: "Running / rated power", startingPower: "Starting / inrush power", voltagePhase: "Voltage / phase", schedule: "Operating schedule", control: "Control method", simultaneous: "Runs with other selected loads" } },
  other: { eyebrow: "Equipment", title: "Equipment specifications", help: "Record the purpose, ratings and interfaces for equipment that does not fit another category.", fields: { purpose: "Equipment purpose", ratings: "Key ratings", interfaces: "Interfaces / connections", environment: "Installation environment", identification: "Identification details" } },
};

function protectionFieldKeys(identity: string): Array<keyof typeof protectionFields> {
  const base: Array<keyof typeof protectionFields> = ["currentType", "ratedCurrent", "ratedVoltage", "poles"];
  if (/\brcd\b|\brcbo\b|\brccb\b|residual/.test(identity)) base.push("rcdType", "residualCurrent", "breakingCapacity");
  else if (/\bfuse\b|mrbf|mega|midi|class.?t|gpv|blade/.test(identity)) base.push("fuseClass", "fuseHolder", "breakingCapacity");
  else if (/surge|\bspd\b/.test(identity)) base.push("spdType", "maximumContinuousVoltage", "surgeRating");
  else base.push("breakingCapacity", "tripCurve");
  return [...base, "circuitProtected", "cableTerminalCapacity", "standard"];
}

function Field({
  label,
  help,
  children,
  wide = false,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`text-xs font-bold ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
      {help && (
        <span className="mt-1 block text-[9px] font-normal leading-4 text-muted">
          {help}
        </span>
      )}
    </label>
  );
}
function AcConnectionDetails({
  specs,
}: {
  specs: Record<string, string | number>;
}) {
  return (
    <section className="card mb-4 p-6">
      <div className="eyebrow">AC connection path</div>
      <h2 className="mt-2 text-lg font-extrabold">Inverter to switchboard</h2>
      <p className="mt-1 text-[10px] text-muted">
        Record the installed cable, protection, isolation and any grid or backup
        changeover arrangement.
      </p>
      <div className="mt-5 space-y-7">
        {acConnectionGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-extrabold">{group.title}</h3>
            <p className="mt-1 text-[10px] text-muted">{group.help}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {group.fields.map((key) => {
                const label = acConnectionFields[key];
                return (
                  <Field key={key} label={label}>
                    <input
                      form="component-technical-record" name={`ac_${key}`} data-ac-field={key}
                      defaultValue={specs[label]}
                      className="field"
                      placeholder={
                        key === "transferTrigger"
                          ? "e.g. Battery reaches 20%"
                          : key === "returnTrigger"
                            ? "e.g. Battery returns to 50%"
                            : key === "acBreaker"
                              ? "e.g. 63 A MCB"
                              : undefined
                      }
                    />
                  </Field>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InverterAssignmentDetails({
  specs,
}: {
  specs: Record<string, string | number>;
}) {
  return (
    <section className="card mb-4 p-6">
      <div className="eyebrow">Individual inverter assignment</div>
      <h2 className="mt-2 text-lg font-extrabold">
        What this inverter handles
      </h2>
      <p className="mt-1 text-[10px] text-muted">
        Keep each physical inverter separate, even when models match. This lets
        Wattson understand its exact PV, battery, generator and AC roles.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(inverterAssignmentFields).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              form="component-technical-record" name={`inverter_${key}`} data-inverter-field={key}
              defaultValue={specs[label]}
              className="field"
              placeholder={
                key === "pvInputs"
                  ? "e.g. PV3 on MPPT 1"
                  : key === "generatorRole"
                    ? "e.g. Generator charging enabled"
                    : undefined
              }
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

function EarthingDetails({
  specs,
}: {
  specs: Record<string, string | number>;
}) {
  return (
    <section className="card mb-4 p-6">
      <div className="eyebrow">Safety-critical record</div>
      <h2 className="mt-2 text-lg font-extrabold">Earthing and bonding</h2>
      <p className="mt-1 text-[10px] text-muted">
        Record what is visibly installed and any measured test result. An empty
        field means not confirmed—not necessarily missing.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(earthingFields).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              form="component-technical-record" name={`earthing_${key}`} data-earthing-field={key}
              defaultValue={specs[label]}
              className="field"
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

function IsolatorDetails({
  specs,
}: {
  specs: Record<string, string | number>;
}) {
  return (
    <section className="card mb-4 p-6">
      <div className="eyebrow">Isolation device</div>
      <h2 className="mt-2 text-lg font-extrabold">Isolation ratings</h2>
      <p className="mt-1 text-[10px] leading-5 text-muted">
        Record the device rating and exactly what it disconnects. Values copied
        from a label should still be reviewed before saving.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(isolatorFields).map(([key, label]) => (
          <Field key={key} label={label}>
            {key === "currentType" ? (
              <select
                form="component-technical-record" name={`isolator_${key}`} data-isolator-field={key}
                defaultValue={String(specs[label] ?? "DC")}
                className="field"
              >
                <option value="DC">DC</option>
                <option value="AC">AC</option>
              </select>
            ) : key === "lockable" ? (
              <select
                form="component-technical-record" name={`isolator_${key}`} data-isolator-field={key}
                defaultValue={String(specs[label] ?? "Not confirmed")}
                className="field"
              >
                <option>Not confirmed</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            ) : (
              <input
                form="component-technical-record" name={`isolator_${key}`} data-isolator-field={key}
                defaultValue={specs[label]}
                className="field"
                placeholder={
                  key === "ratedVoltage"
                    ? "e.g. 500 V DC"
                    : key === "ratedCurrent"
                      ? "e.g. 32 A"
                      : key === "circuitIsolated"
                        ? "e.g. PV1 to Inverter 1 MPPT"
                        : undefined
                }
              />
            )}
          </Field>
        ))}
      </div>
    </section>
  );
}

function ProtectionDetails({
  specs,
  identity,
}: {
  specs: Record<string, string | number>;
  identity: string;
}) {
  return (
    <section className="card mb-4 p-6">
      <div className="eyebrow">Protection device</div>
      <h2 className="mt-2 text-lg font-extrabold">Device ratings</h2>
      <p className="mt-1 text-[10px] leading-5 text-muted">
        Record the values marked on this exact device. Current alone does not establish voltage, breaking capacity, trip behaviour or suitability for AC or DC.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {protectionFieldKeys(identity).map((key) => {
          const label = protectionFields[key];
          return <Field key={key} label={label}>
            {key === "currentType" ? <select form="component-technical-record" name={`protection_${key}`} data-protection-field={key} defaultValue={String(specs[label] ?? "Not confirmed")} className="field"><option>Not confirmed</option><option value="AC">AC</option><option value="DC">DC</option></select> : <input form="component-technical-record" name={`protection_${key}`} data-protection-field={key} defaultValue={specs[label]} className="field" placeholder={key === "ratedCurrent" ? "e.g. 32 A" : key === "ratedVoltage" ? "e.g. 230 V AC or 500 V DC" : key === "breakingCapacity" ? "e.g. 6 kA" : key === "tripCurve" ? "e.g. C curve" : key === "residualCurrent" ? "e.g. 30 mA" : undefined}/>}
          </Field>;
        })}
      </div>
    </section>
  );
}

function BatteryDetails({ specs }: { specs: Record<string, string | number> }) {
  return (
    <section className="card mb-4 p-6">
      <div className="eyebrow">Battery bank</div>
      <h2 className="mt-2 text-lg font-extrabold">Battery specifications</h2>
      <p className="mt-1 text-[10px] leading-5 text-muted">
        Record the exact battery type and ratings. PVIntell will not assume a chemistry or treat an unknown battery as lithium.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(batteryFields).map(([key, label]) => (
          <Field key={key} label={label}>
            {key === "chemistry" ? (
              <select form="component-technical-record" name={`battery_${key}`} data-battery-field={key} defaultValue={String(specs[label] ?? "")} className="field">
                <option value="">Not confirmed</option>
                <option value="LiFePO4 / LFP">Lithium iron phosphate (LFP / LiFePO4)</option>
                <option value="Other lithium-ion">Other lithium-ion</option>
                <option value="LTO">Lithium titanate (LTO)</option>
                <option value="Flooded lead-acid">Flooded lead-acid</option>
                <option value="AGM">AGM lead-acid</option>
                <option value="Gel">Gel lead-acid</option>
                <option value="Sodium-ion">Sodium-ion</option>
                <option value="Other / custom">Other / custom</option>
              </select>
            ) : key === "bmsCompatibility" ? (
              <select form="component-technical-record" name={`battery_${key}`} data-battery-field={key} defaultValue={String(specs[label] ?? "")} className="field">
                <option value="">Not confirmed</option>
                <option value="Confirmed compatible">Confirmed compatible with inverter</option>
                <option value="Integrated">Integrated manufacturer system</option>
                <option value="Standalone">Standalone BMS / no communications required</option>
                <option value="Not checked">Not checked yet</option>
              </select>
            ) : (
              <input form="component-technical-record" name={`battery_${key}`} data-battery-field={key} defaultValue={specs[label]} className="field" placeholder={key === "nominalVoltage" ? "e.g. 48 V DC" : key === "capacity" ? "e.g. 200 Ah or 10 kWh" : key === "usableCapacity" ? "e.g. 80% or 8 kWh usable" : undefined} />
            )}
          </Field>
        ))}
      </div>
    </section>
  );
}

function ComponentSpecificDetails({ kind, specs }: { kind: ComponentSpec["kind"]; specs: Record<string, string | number> }) {
  const definition = componentSpecificFields[kind];
  if (!definition || kind === "battery") return null;
  return (
    <section className="card mb-4 p-6">
      <div className="eyebrow">{definition.eyebrow}</div>
      <h2 className="mt-2 text-lg font-extrabold">{definition.title}</h2>
      <p className="mt-1 text-[10px] leading-5 text-muted">{definition.help}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {kind === "panel" && (
          <Field label="Panel wattage">
            <div className="relative"><input form="component-technical-record" name="panelWattage" data-component-field="panelWattage" type="number" min="0" step="any" defaultValue={String(specs["Panel wattage"] ?? "").replace(/[^0-9.]/g, "")} className="field pr-12" placeholder="e.g. 450"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">W</span></div>
          </Field>
        )}
        {Object.entries(definition.fields).map(([key, label]) => (
          <Field key={key} label={label}>
            {kind === "panel" && key === "cellTechnology" ? (
              <select form="component-technical-record" name={`component_${key}`} data-component-field={key} defaultValue={String(specs[label] ?? "")} className="field">
                <option value="">Not confirmed</option>
                <option value="Monocrystalline silicon">Mono (monocrystalline)</option>
                <option value="Monocrystalline silicon (bifacial)">Mono bifacial</option>
                <option value="Polycrystalline silicon">Poly (polycrystalline)</option>
                <option value="Thin-film">Thin-film</option>
                <option value="TOPCon">TOPCon (N-type mono)</option>
                <option value="HJT">HJT (heterojunction)</option>
                <option value="PERC">PERC</option>
                <option value="Other / custom">Other / custom</option>
              </select>
            ) : (
              <input form="component-technical-record" name={`component_${key}`} data-component-field={key} defaultValue={specs[label]} className="field" />
            )}
          </Field>
        ))}
      </div>
    </section>
  );
}

type BaseProps = { siteId: string; systemId: string; systemName: string; returnTo?: string };

export function ComponentDetail({
  siteId,
  systemId,
  systemName,
  component,
  pvArray,
  defaults,
  returnTo,
  proposal = false,
  proposalNodeId,
  proposalDesign,
  regulatoryBundle,
}: BaseProps & {
  component?: ComponentSpec;
  pvArray?: PVArray;
  defaults?: { kind: ComponentSpec["kind"]; name: string; schematicImage?: string };
  proposal?: boolean;
  proposalNodeId?: string;
  proposalDesign?: DesignCalculatorState;
  regulatoryBundle?: ComponentRegulatoryBundle;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<EquipmentLabelExtraction>();
  const [photoPath, setPhotoPath] = useState(component?.photoUrl ?? pvArray?.labelPhotoPath ?? "");
  const icon = itemIcon(component?.kind ?? defaults?.kind ?? "other");
  const back = returnTo ?? `/sites/${siteId}/systems/${systemId}`;
  const isAcConnection =
    (component?.name ?? defaults?.name ?? "")
      .toLowerCase()
      .includes("switchboard ac connection") ||
    component?.specs["Connection type"] === "Inverter to switchboard AC";
  const isInverter =
    (component?.kind ?? defaults?.kind ?? "other") === "inverter";
  const isBattery =
    (component?.kind ?? defaults?.kind ?? "other") === "battery";
  const componentKind = component?.kind ?? defaults?.kind ?? "other";
  const isPanel =
    (component?.kind ?? defaults?.kind ?? "other") === "panel";
  const isIsolator =
    (component?.kind ?? defaults?.kind ?? "other") === "isolator";
  const isProtection =
    (component?.kind ?? defaults?.kind ?? "other") === "protection";
  const protectionIdentity = `${component?.name ?? defaults?.name ?? ""} ${component?.model ?? ""}`.toLowerCase();
  const showEquipmentType = !component && !defaults?.schematicImage;
  const isEarthing =
    (component?.name ?? defaults?.name ?? "")
      .toLowerCase()
      .includes("earthing / bonding") ||
    component?.specs["Equipment record"] === "System earthing and bonding";
  const editableAdditionalSpecs = Object.entries(component?.specs ?? {}).filter(
    ([name]) => {
      if (
        name === "Equipment record" ||
        name === "Connection type" ||
        name === "Schematic image"
      )
        return false;
      if (isAcConnection && Object.values(acConnectionFields).includes(name as never))
        return false;
      if (isInverter && Object.values(inverterAssignmentFields).includes(name as never))
        return false;
      if (isBattery && Object.values(batteryFields).includes(name as never))
        return false;
      if (componentSpecificFields[componentKind]?.fields && Object.values(componentSpecificFields[componentKind]!.fields).includes(name))
        return false;
      if ((isInverter && name === "Rated power") || (isPanel && (name === "Panel wattage" || name === "Panel arrangement")))
        return false;
      if (isEarthing && Object.values(earthingFields).includes(name as never))
        return false;
      if (isIsolator && Object.values(isolatorFields).includes(name as never))
        return false;
      if (isProtection && Object.values(protectionFields).includes(name as never))
        return false;
      return true;
    },
  );
  function setField(name: string, value: string) {
    if (!value) return;
    const form = document.querySelector("main form") as HTMLFormElement | null;
    const field = form?.elements.namedItem(name);
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    )
      field.value = value;
  }
  function applyExtraction(result: EquipmentLabelExtraction) {
    if (!isAcConnection) {
      if (!isIsolator) setField("type", result.equipmentType);
      setField(
        "name",
        [result.manufacturer, result.model].filter(Boolean).join(" "),
      );
      setField("manufacturer", result.manufacturer);
      setField("model", result.model);
      setField("serialNumber", result.serialNumber);
    }
    const specs = [
      ["Rated voltage", result.ratedVoltage],
      ["Rated current", result.ratedCurrent],
      ["Rated power", result.ratedPower],
      ["Capacity", result.capacity],
      ["Phase", result.phase],
      ["Frequency", result.frequency],
      ["Ingress rating", result.ingressRating],
      ["Certifications", result.certifications.join(", ")],
      ...result.otherSpecifications.map((item) => [item.label, item.value]),
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");
    if (specs) setField("specifications", specs);
    if (isIsolator) {
      const values: Partial<Record<keyof typeof isolatorFields, string>> = {
        ratedVoltage: result.ratedVoltage,
        ratedCurrent: result.ratedCurrent,
        enclosureRating: result.ingressRating,
        standard: result.certifications.join(", "),
      };
      for (const [key, value] of Object.entries(values)) {
        if (!value) continue;
        const field = document.querySelector(
          `[data-isolator-field="${key}"]`,
        ) as HTMLInputElement | HTMLSelectElement | null;
        if (field) field.value = value;
      }
    }
    if (isProtection) {
      const values: Partial<Record<keyof typeof protectionFields, string>> = {
        ratedVoltage: result.ratedVoltage,
        ratedCurrent: result.ratedCurrent,
        standard: result.certifications.join(", "),
      };
      for (const [key, value] of Object.entries(values)) {
        if (!value) continue;
        const field = document.querySelector(`[data-protection-field="${key}"]`) as HTMLInputElement | HTMLSelectElement | null;
        if (field) field.value = value;
      }
    }
  }
  async function analyze(file?: File) {
    if (!file) return;
    setAnalyzing(true);
    setError("");
    setExtraction(undefined);
    try {
      const preparedFile = await prepareLabelPhoto(file);
      const body = new FormData();
      body.set("file", preparedFile);
      body.set("projectId", systemId);
      const response = await fetch("/api/equipment/analyze-label", {
        method: "POST",
        body,
      });
      const result = await responseBody(response);
      if (!response.ok)
        throw new Error(result.error ?? "Could not read the equipment label");
      setExtraction(result.extraction);
      setPhotoPath(result.photoPath);
      applyExtraction(result.extraction);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not read the equipment label",
      );
    } finally {
      setAnalyzing(false);
    }
  }
  async function linkProposalRecord(recordRef: string, panelUpdate?: { panelCount: number; panelWatts?: number }, designUpdate: Partial<DesignCalculatorState> = {}) {
    if (!proposal || !proposalNodeId || !proposalDesign?.proposedAsBuiltDraft) return;
    const draft = proposalDesign.proposedAsBuiltDraft;
    let panelCount = proposalDesign.panelCount;
    let panelsPerString = proposalDesign.panelsPerString;
    let pvArrayPlan = proposalDesign.pvArrayPlan;
    if (panelUpdate) {
      const selectedIndex = Number(proposalNodeId.match(/^solar-pv-(\d+)$/)?.[1]) - 1;
      if (pvArrayPlan && Number.isInteger(selectedIndex) && selectedIndex >= 0 && pvArrayPlan.arrays[selectedIndex]) {
        pvArrayPlan = {
          ...pvArrayPlan,
          arrays: pvArrayPlan.arrays.map((array, index) => index === selectedIndex ? { ...array, allocatedPanelCount: panelUpdate.panelCount } : array),
        };
        panelCount = pvArrayPlan.arrays.reduce((total, array) => total + Number(array.allocatedPanelCount ?? 0), 0);
      } else if (Number.isInteger(selectedIndex) && selectedIndex >= 0 && Number(proposalDesign.pvStrings) > 1) {
        panelsPerString = panelUpdate.panelCount;
        panelCount = panelUpdate.panelCount * Number(proposalDesign.pvStrings);
      } else {
        panelCount = panelUpdate.panelCount;
      }
    }
    const nextDesign: DesignCalculatorState = {
      ...proposalDesign,
      ...designUpdate,
      ...(panelUpdate ? { panelWatts: panelUpdate.panelWatts, panelCount, panelsPerString, pvArrayPlan } : {}),
      proposedAsBuiltDraft: {
        ...draft,
        nodes: draft.nodes?.map((node) => node.id === proposalNodeId ? { ...node, recordRef } : node),
      },
    };
    const response = await fetch("/api/design-calculator", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: systemId, design: nextDesign }),
    });
    const body = await responseBody(response);
    if (!response.ok) throw new Error(body.error ?? "The equipment saved, but could not be linked back to the proposal schematic");
  }
  async function save(form: FormData) {
    setSaving(true);
    setError("");
    const specifications = parseSpecs(form.get("specifications"));
    const savedSchematicImage = component?.specs["Schematic image"];
    const schematicImage =
      typeof savedSchematicImage === "string"
        ? savedSchematicImage
        : defaults?.schematicImage;
    if (schematicImage) specifications["Schematic image"] = schematicImage;
    const ratedPower = String(isPanel ? form.get("panelWattage") ?? "" : form.get("ratedPower") ?? "").trim();
    if (ratedPower) {
      specifications[isPanel ? "Panel wattage" : "Rated power"] = `${ratedPower} ${isInverter ? "kW" : "W"}`;
    }
    else {
      delete specifications["Panel wattage"];
      delete specifications["Rated power"];
    }
    if (isAcConnection) {
      specifications["Connection type"] = "Inverter to switchboard AC";
      for (const [key, label] of Object.entries(acConnectionFields)) {
        const value = String(form.get(`ac_${key}`) ?? "").trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isInverter) {
      specifications["Equipment record"] = "Individual inverter";
      for (const [key, label] of Object.entries(inverterAssignmentFields)) {
        const value = String(form.get(`inverter_${key}`) ?? "").trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isBattery) {
      for (const [key, label] of Object.entries(batteryFields)) {
        const value = String(form.get(`battery_${key}`) ?? "").trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    const specificFields = componentSpecificFields[componentKind]?.fields;
    if (specificFields) {
      for (const [key, label] of Object.entries(specificFields)) {
        const value = String(form.get(`component_${key}`) ?? "").trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isEarthing) {
      specifications["Equipment record"] = "System earthing and bonding";
      for (const [key, label] of Object.entries(earthingFields)) {
        const value = String(form.get(`earthing_${key}`) ?? "").trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isIsolator) {
      specifications["Equipment record"] = "Isolation device";
      for (const [key, label] of Object.entries(isolatorFields)) {
        const value = String(form.get(`isolator_${key}`) ?? "").trim();
        if (value && value !== "Not confirmed") specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isProtection) {
      for (const key of protectionFieldKeys(protectionIdentity)) {
        const label = protectionFields[key];
        const value = String(form.get(`protection_${key}`) ?? "").trim();
        if (value && value !== "Not confirmed") specifications[label] = value;
        else delete specifications[label];
      }
    }
    const payload = {
      projectId: systemId,
      type: form.get("type"),
      name: form.get("name"),
      manufacturer: form.get("manufacturer") || undefined,
      model: form.get("model") || undefined,
      quantity: Number(form.get("quantity") || 1),
      installationLocation: form.get("installationLocation") || undefined,
      notes: form.get("notes") || undefined,
      serialNumber: form.get("serialNumber") || undefined,
      firmwareVersion: form.get("firmwareVersion") || undefined,
      manualUrl: form.get("manualUrl") || undefined,
      photoUrl: photoPath || undefined,
      specifications,
      confidence: proposal ? "estimated" : component?.status ?? "confirmed",
    };
    try {
      if (isPanel && (!component || pvArray)) {
        const panelsPerArray = Number(form.get("panelsPerArray") || pvArray?.panelCount || 1);
        const panelConnection = String(form.get("panelConnection") || "series");
        const cellTechnology = String(specifications["Cell technology"] ?? "").toLowerCase();
        const panelType: PVArray["panelType"] = cellTechnology.includes("bifacial") ? "bifacial"
          : cellTechnology.includes("thin") ? "thin-film"
          : cellTechnology.includes("flex") ? "flexible"
          : cellTechnology ? "monofacial"
          : pvArray?.panelType ?? "unknown";
        const specificationNumber = (label: string) => {
          const value = String(specifications[label] ?? "").match(/-?\d+(?:\.\d+)?/)?.[0];
          return value ? Number(value) : undefined;
        };
        const response = await fetch(pvArray ? `/api/pv-arrays/${pvArray.id}` : "/api/pv-arrays", {
          method: pvArray ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: systemId,
            name: form.get("name") || "PV Array",
            arrayCount: proposal ? 1 : payload.quantity,
            manufacturer: payload.manufacturer,
            panelModel: payload.model,
            panelType,
            panelWatts: ratedPower ? Number(ratedPower) : undefined,
            panelCount: panelsPerArray,
            strings: panelConnection === "parallel" ? panelsPerArray : pvArray?.strings ?? 1,
            panelsPerString: panelConnection === "parallel" ? 1 : panelsPerArray,
            maximumPowerVoltageV: specificationNumber("Maximum-power voltage (Vmp)"),
            maximumPowerCurrentA: specificationNumber("Maximum-power current (Imp)"),
            openCircuitVoltageV: specificationNumber("Open-circuit voltage (Voc)"),
            shortCircuitCurrentA: specificationNumber("Short-circuit current (Isc)"),
            maximumSystemVoltageV: pvArray?.maximumSystemVoltageV,
            nominalOperatingCellTempC: pvArray?.nominalOperatingCellTempC,
            maximumSeriesFuseA: pvArray?.maximumSeriesFuseA,
            labelPhotoPath: photoPath || undefined,
            orientationDegrees: pvArray?.orientationDegrees,
            tiltDegrees: pvArray?.tiltDegrees,
            cableSizeMm2: pvArray?.cableSizeMm2,
            cableLengthM: pvArray?.cableLengthM,
            connectorType: pvArray?.connectorType,
            breakerDetails: pvArray?.breakerDetails,
            isolatorDetails: pvArray?.isolatorDetails,
            combinerDetails: pvArray?.combinerDetails,
            installationNotes: payload.installationLocation ? `Installed location: ${payload.installationLocation}` : undefined,
            specifications: { ...specifications, "Wiring arrangement": panelConnection },
            confidence: proposal ? "estimated" : pvArray?.confidence ?? "confirmed",
          }),
        });
        const body = await responseBody(response);
        if (!response.ok) throw new Error(body.error ?? "Could not save PV arrays");
        const savedArrayId = typeof body.array?.id === "string" ? body.array.id : undefined;
        if (savedArrayId) await linkProposalRecord(`pv:${savedArrayId}`, { panelCount: panelsPerArray, panelWatts: ratedPower ? Number(ratedPower) : undefined });
        router.push(back);
        router.refresh();
        return;
      }
      const response = await fetch(
        component ? `/api/components/${component.id}` : "/api/components",
        {
          method: component ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await responseBody(response);
      if (!response.ok)
        throw new Error(body.error ?? "Could not save equipment");
      if (typeof body.component?.id === "string") {
        const numberIn = (value: unknown) => {
          const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
          return match ? Number(match[0]) : undefined;
        };
        const designUpdate: Partial<DesignCalculatorState> = isInverter
          ? { inverterKw: ratedPower ? Number(ratedPower) : proposalDesign?.inverterKw }
          : isBattery
            ? {
                batteryChemistry: String(specifications["Chemistry / battery type"] ?? "") || undefined,
                batteryVoltage: numberIn(specifications["Nominal voltage"]),
                batteryAh: /\bah\b/i.test(String(specifications.Capacity ?? "")) ? numberIn(specifications.Capacity) : proposalDesign?.batteryAh,
                batteryUsableKwh: /\bkwh\b/i.test(String(specifications["Planning usable capacity"] ?? specifications.Capacity ?? "")) ? numberIn(specifications["Planning usable capacity"] ?? specifications.Capacity) : proposalDesign?.batteryUsableKwh,
                batteryQuantity: payload.quantity,
              }
            : componentKind === "generator"
              ? { generatorContinuousKw: numberIn(specifications["Continuous output"]) }
              : {};
        await linkProposalRecord(`component:${body.component.id}`, undefined, designUpdate);
      }
      if (!component && returnTo && typeof body.component?.id === "string") {
        const quantity = Math.max(1, Number(payload.quantity) || 1);
        const columns = Math.min(3, quantity);
        const positions = Array.from({ length: quantity }, (_, index) => ({
          nodeRef: index ? `component:${body.component.id}:unit-${index + 1}` : `component:${body.component.id}`,
          x: 380 + (index % columns) * 120,
          y: 240 + Math.floor(index / columns) * 155,
        }));
        const positioned = await fetch("/api/schematic-positions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: systemId, positions }),
        });
        if (!positioned.ok) {
          const positionBody = await responseBody(positioned);
          throw new Error(positionBody.error ?? "Equipment was saved, but its schematic position could not be set");
        }
      }
      router.push(back);
      router.refresh();
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Could not save equipment",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !component ||
      !window.confirm(
        `Remove ${component.name} from ${systemName}? This cannot be undone.`,
      )
    )
      return;
    const response = await fetch(pvArray ? `/api/pv-arrays/${pvArray.id}` : `/api/components/${component.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Could not remove equipment");
      return;
    }
    router.push(back);
    router.refresh();
  }
  async function splitInverters() {
    if (!component || component.kind !== "inverter" || component.quantity < 2)
      return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/components/${component.id}/split`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Could not separate the inverters");
      router.push(back);
      router.refresh();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not separate the inverters",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <PageShell
      back={back}
      backLabel={returnTo ? "Back to schematic" : "Back to system overview"}
      wattsonHref={`/sites/${siteId}/systems/${systemId}?view=wattson`}
      eyebrow="System equipment"
      title={component ? component.name : (defaults?.name ?? "Add equipment")}
      description={`Technical record for ${systemName}. Changes here become part of Wattson's system context.`}
      icon={icon}
    >
      {!isAcConnection && <div className="mb-4 rounded-2xl border border-dashed border-[#91aec9] bg-[#f7fafd] p-4">
        <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand"><ScanLine size={20}/></span>
        <span className="min-w-0 flex-1">
          <strong className="block text-xs">
            {isAcConnection
              ? "Show Wattson a breaker, switchboard or changeover label"
              : "Show Wattson the equipment label"}
          </strong>
          <span className="mt-1 block text-[10px] text-muted">
            Visible specifications will be added to this record for review
            before saving.
          </span>
        </span>
        {analyzing && <LoaderCircle className="shrink-0 animate-spin text-brand" size={19}/>}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-3 text-xs font-bold text-white"><Camera size={17}/>Take photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={analyzing} onChange={(event) => void analyze(event.target.files?.[0])}/></label>
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand bg-white px-3 text-xs font-bold text-brand"><ImagePlus size={17}/>Choose gallery<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={analyzing} onChange={(event) => void analyze(event.target.files?.[0])}/></label>
        </div>
      </div>}
      {extraction && (
        <div className="mb-4 rounded-xl border border-line bg-[#f8fafc] p-3 text-[10px]">
          <div className="flex justify-between">
            <strong>Label values added for review</strong>
            <span className="uppercase text-brand">
              {extraction.confidence} confidence
            </span>
          </div>
          {extraction.warnings.length > 0 && (
            <p className="mt-2 text-[#8b6512]">
              {extraction.warnings.join(" ")}
            </p>
          )}
        </div>
      )}
      {isAcConnection && <AcConnectionDetails specs={component?.specs ?? {}} />}
      {isInverter && (
        <InverterAssignmentDetails specs={component?.specs ?? {}} />
      )}
      {isBattery && <BatteryDetails specs={component?.specs ?? {}} />}
      <ComponentSpecificDetails kind={componentKind} specs={component?.specs ?? {}} />
      {isEarthing && <EarthingDetails specs={component?.specs ?? {}} />}
      {isIsolator && <IsolatorDetails specs={component?.specs ?? {}} />}
      {isProtection && <ProtectionDetails specs={component?.specs ?? {}} identity={protectionIdentity} />}
      {component?.kind === "inverter" && component.quantity > 1 && (
        <div className="mb-4 rounded-2xl border border-[#d8bd77] bg-[#fff8df] p-5">
          <strong className="block text-sm">
            This record contains {component.quantity} physical inverters
          </strong>
          <p className="mt-1 text-[10px] leading-5 text-muted">
            Separate them so each inverter can have its own serial number,
            connections, settings and responsibilities.
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void splitInverters()}
            className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Split into {component.quantity} inverter cards
          </button>
        </div>
      )}
      {component && !proposal && component.status !== "confirmed" ? <div className="mb-4 rounded-2xl border border-[#8bc7a0] bg-[#effaf3] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-[#17603b]">Proposed record awaiting your confirmation</strong><p className="mt-1 text-[10px] leading-4 text-muted">Review the values below first. Confirming accepts this record as currently shown; any TBC or unverified values remain clearly marked.</p></div><button type="submit" form="component-technical-record" disabled={saving} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#238653] px-5 text-xs font-bold text-white disabled:opacity-50"><ShieldCheck size={16}/>{saving ? "Confirming…" : "Confirm this record"}</button></div></div> : null}
      <form id="component-technical-record" action={save} className="card p-6">
        {isAcConnection && <><input type="hidden" name="type" value={component?.kind ?? defaults?.kind ?? "other"}/><input type="hidden" name="name" value={component?.name ?? defaults?.name ?? "Grid connection"}/><input type="hidden" name="quantity" value={component?.quantity ?? 1}/></>}
        <div className="grid gap-4 sm:grid-cols-2">
          {!isAcConnection && !showEquipmentType && <input type="hidden" name="type" value={component?.kind ?? defaults?.kind ?? "other"}/>}
          {!isAcConnection && showEquipmentType && <Field label="Equipment type">
            <select
              name="type"
              defaultValue={defaults?.kind ?? "other"}
              className="field"
            >
              {componentTypes.map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </Field>}
          {!isAcConnection && <Field label="Equipment name" wide={!showEquipmentType}>
            <input
              name="name"
              required
              defaultValue={component?.name ?? defaults?.name}
              className="field"
            />
          </Field>}
          {!isAcConnection && (
            <>
              <Field label="Manufacturer">
                <input
                  name="manufacturer"
                  defaultValue={component?.manufacturer}
                  className="field"
                />
              </Field>
              <Field label="Model">
                <input
                  name="model"
                  defaultValue={component?.model}
                  className="field"
                />
              </Field>
              <Field label={isPanel ? "Number of arrays" : "Quantity"}>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue={isPanel && pvArray ? 1 : component?.quantity ?? 1}
                  className="field"
                />
              </Field>
              {isInverter && <Field label="Continuous rating">
                <div className="relative"><input name="ratedPower" type="number" min="0" step="any" defaultValue={isInverter ? inverterPowerInputKw(component?.specs["Rated power"]) : String(component?.specs["Panel wattage"] ?? "").replace(/[^0-9.]/g, "")} className="field pr-12" placeholder={isPanel ? "e.g. 450" : "e.g. 20"}/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">{isInverter ? "kW" : "W"}</span></div>
              </Field>}
              {isPanel && <Field label="Panels per array">
                <input name="panelsPerArray" type="number" min="1" defaultValue={pvArray?.panelCount ?? 1} className="field" placeholder="e.g. 6"/>
              </Field>}
              {isPanel && <Field label="Connection within each array">
                <select name="panelConnection" defaultValue={String(component?.specs["Wiring arrangement"] ?? "series").toLowerCase()} className="field"><option value="series">Series</option><option value="parallel">Parallel</option></select>
              </Field>}
            </>
          )}
          {!isAcConnection && <Field label="Installed location">
            <input
              name="installationLocation"
              defaultValue={component?.location}
              className="field"
              placeholder="e.g. Studio utility wall"
            />
          </Field>}
          {!isAcConnection && !isIsolator && (
            <>
              <Field label="Serial number">
                <input
                  name="serialNumber"
                  defaultValue={component?.serialNumber}
                  className="field"
                />
              </Field>
              <Field label="Firmware version">
                <input
                  name="firmwareVersion"
                  defaultValue={component?.firmwareVersion}
                  className="field"
                />
              </Field>
              <Field label="Manual URL" wide>
                <input
                  name="manualUrl"
                  type="url"
                  defaultValue={component?.manualUrl}
                  className="field"
                />
              </Field>
            </>
          )}
          {!isAcConnection && <Field
            label={
              isAcConnection
                ? "Additional connection information"
                : isIsolator
                  ? "Other isolator details"
                  : isProtection
                    ? "Other protection details"
                : "Technical specifications"
            }
            help={
              isAcConnection
                ? "Add anything not covered above in plain language, or use Name: Value for structured details."
                : isIsolator
                  ? "Only add details that are not covered by the isolator fields above."
                  : isProtection
                    ? "Only add details that are not covered by the device-rating fields above."
                : "One Name: Value per line, or enter plain-language notes. Use any values relevant to this item: voltage, current, power, cable size, breaker rating, torque, chemistry, capacity, and so on."
            }
            wide
          >
            <textarea
              name="specifications"
              rows={isIsolator || isProtection ? 4 : 10}
              defaultValue={editableAdditionalSpecs
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n")}
              className="field py-3 font-mono"
              placeholder="Rated voltage, current, power, capacity, chemistry, cable size, breaker rating or other model-specific details"
            />
          </Field>}
          <Field label="Installation and identification notes" wide>
            <textarea
              name="notes"
              rows={5}
              defaultValue={component?.notes}
              className="field py-3"
              placeholder="Cable route, connected circuit, labels, settings or anything learned later"
            />
          </Field>
        </div>
        {error && (
          <div className="mt-5 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">
            {error}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          {component && (
            <button
              type="button"
              onClick={() => void remove()}
              className="grid size-11 place-items-center rounded-xl border border-[#e3b9b1] text-[#9b4033]"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-brand text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save equipment record"}
          </button>
        </div>
      </form>
      {component && regulatoryBundle ? <ComponentRegulatoryPanel componentId={component.id} regulationsHref={`/settings/regulations?site=${siteId}&system=${systemId}&component=${component.id}`} bundle={regulatoryBundle}/> : null}
    </PageShell>
  );
}

export function PVArrayDetail({
  siteId,
  systemId,
  systemName,
  array,
}: BaseProps & { array?: PVArray }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const back = `/sites/${siteId}/systems/${systemId}`;
  async function save(form: FormData) {
    setSaving(true);
    setError("");
    const payload = {
      projectId: systemId,
      name: form.get("name"),
      manufacturer: form.get("manufacturer") || undefined,
      panelModel: form.get("panelModel") || undefined,
      panelWatts: optionalNumber(form, "panelWatts"),
      panelCount: optionalNumber(form, "panelCount"),
      strings: optionalNumber(form, "strings"),
      panelsPerString: optionalNumber(form, "panelsPerString"),
      orientationDegrees: optionalNumber(form, "orientationDegrees"),
      tiltDegrees: optionalNumber(form, "tiltDegrees"),
      cableSizeMm2: optionalNumber(form, "cableSizeMm2"),
      cableLengthM: optionalNumber(form, "cableLengthM"),
      connectorType: form.get("connectorType") || undefined,
      breakerDetails: form.get("breakerDetails") || undefined,
      isolatorDetails: form.get("isolatorDetails") || undefined,
      combinerDetails: form.get("combinerDetails") || undefined,
      installationNotes: form.get("installationNotes") || undefined,
      specifications: parseSpecs(form.get("specifications")),
    };
    try {
      const response = await fetch(
        array ? `/api/pv-arrays/${array.id}` : "/api/pv-arrays",
        {
          method: array ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Could not save PV array");
      router.push(back);
      router.refresh();
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Could not save PV array",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !array ||
      !window.confirm(
        `Remove ${array.name} from ${systemName}? This cannot be undone.`,
      )
    )
      return;
    const response = await fetch(`/api/pv-arrays/${array.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Could not remove PV array");
      return;
    }
    router.push(back);
    router.refresh();
  }
  return (
    <PageShell
      back={back}
      eyebrow="PV array"
      title={array?.name ?? "Add PV array"}
      description={`Panel, string, cabling and protection record for ${systemName}.`}
      icon={<Sun size={22} />}
    >
      {array && array.confidence !== "confirmed" ? <div className="mb-4 rounded-2xl border border-[#8bc7a0] bg-[#effaf3] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-[#17603b]">Proposed PV-array record awaiting your confirmation</strong><p className="mt-1 text-[10px] leading-4 text-muted">Review the panel, string and cable values below. TBC or unverified details remain visible after confirmation.</p></div><button type="submit" form="pv-array-technical-record" disabled={saving} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#238653] px-5 text-xs font-bold text-white disabled:opacity-50"><ShieldCheck size={16}/>{saving ? "Confirming…" : "Confirm this record"}</button></div></div> : null}
      <form id="pv-array-technical-record" action={save} className="card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Array name">
            <input
              name="name"
              required
              defaultValue={array?.name ?? "PV1"}
              className="field"
            />
          </Field>
          <Field label="Panel manufacturer">
            <input
              name="manufacturer"
              defaultValue={array?.manufacturer}
              className="field"
            />
          </Field>
          <Field label="Panel model">
            <input
              name="panelModel"
              defaultValue={array?.panelModel}
              className="field"
            />
          </Field>
          <Field label="Panel wattage">
            <input
              name="panelWatts"
              type="number"
              step="any"
              defaultValue={array?.panelWatts}
              className="field"
            />
          </Field>
          <Field label="Number of panels">
            <input
              name="panelCount"
              type="number"
              min="1"
              defaultValue={array?.panelCount}
              className="field"
            />
          </Field>
          <Field label="Number of strings">
            <input
              name="strings"
              type="number"
              min="1"
              defaultValue={array?.strings}
              className="field"
            />
          </Field>
          <Field label="Panels per string">
            <input
              name="panelsPerString"
              type="number"
              min="1"
              defaultValue={array?.panelsPerString}
              className="field"
            />
          </Field>
          <Field label="Direction / azimuth (°)">
            <input
              name="orientationDegrees"
              type="number"
              min="0"
              max="360"
              step="any"
              defaultValue={array?.orientationDegrees}
              className="field"
            />
          </Field>
          <Field label="Panel tilt (°)">
            <input
              name="tiltDegrees"
              type="number"
              min="0"
              max="90"
              step="any"
              defaultValue={array?.tiltDegrees}
              className="field"
            />
          </Field>
          <Field label="PV cable size (mm²)">
            <input
              name="cableSizeMm2"
              type="number"
              step="any"
              defaultValue={array?.cableSizeMm2}
              className="field"
            />
          </Field>
          <Field label="Cable run length (m)">
            <input
              name="cableLengthM"
              type="number"
              step="any"
              defaultValue={array?.cableLengthM}
              className="field"
            />
          </Field>
          <Field label="Connector type">
            <input
              name="connectorType"
              defaultValue={array?.connectorType}
              className="field"
            />
          </Field>
          <Field label="Breaker / fuse">
            <input
              name="breakerDetails"
              defaultValue={array?.breakerDetails}
              className="field"
            />
          </Field>
          <Field label="Isolator / shutoff">
            <input
              name="isolatorDetails"
              defaultValue={array?.isolatorDetails}
              className="field"
            />
          </Field>
          <Field label="Combiner box">
            <input
              name="combinerDetails"
              defaultValue={array?.combinerDetails}
              className="field"
            />
          </Field>
          <Field label="Other technical values" wide>
            <textarea
              name="specifications"
              rows={8}
              defaultValue={Object.entries(array?.specifications ?? {})
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n")}
              className="field py-3 font-mono"
              placeholder="Voc: 247 V&#10;Isc: 13.2 A"
            />
          </Field>
          <Field label="Installation notes" wide>
            <textarea
              name="installationNotes"
              rows={5}
              defaultValue={array?.installationNotes}
              className="field py-3"
            />
          </Field>
        </div>
        {error && (
          <div className="mt-5 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">
            {error}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          {array && (
            <button
              type="button"
              onClick={() => void remove()}
              className="grid size-11 place-items-center rounded-xl border border-[#e3b9b1] text-[#9b4033]"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-brand text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save PV array record"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}

function PageShell({
  back,
  backLabel = "Back to system overview",
  wattsonHref,
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  back: string;
  backLabel?: string;
  wattsonHref?: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f5f7fa] px-5 py-8 md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={back}
            className="inline-flex items-center gap-2 text-xs font-bold text-brand"
          >
            <ArrowLeft size={15} />
            {backLabel}
          </Link>
          <Link
            href={wattsonHref ?? `${back}?view=wattson`}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#123b66] px-4 text-xs font-bold text-white"
          >
            <Zap size={14} />
            Ask Wattson
          </Link>
        </div>
        <div className="my-7 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
            {icon}
          </span>
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.04em]">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
