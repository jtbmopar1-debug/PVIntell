"use client";

import {
  ArrowLeft,
  BatteryCharging,
  Cable,
  Camera,
  Gauge,
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
import type { ComponentSpec, PVArray } from "@/domain/models";

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
                      data-ac-field={key}
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
              data-inverter-field={key}
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
              data-earthing-field={key}
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
      <h2 className="mt-2 text-lg font-extrabold">DC shutoff details</h2>
      <p className="mt-1 text-[10px] leading-5 text-muted">
        Record the device rating and exactly what it disconnects. Values copied
        from a label should still be reviewed before saving.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(isolatorFields).map(([key, label]) => (
          <Field key={key} label={label}>
            {key === "currentType" ? (
              <select
                data-isolator-field={key}
                defaultValue={String(specs[label] ?? "DC")}
                className="field"
              >
                <option value="DC">DC</option>
                <option value="AC">AC</option>
              </select>
            ) : key === "lockable" ? (
              <select
                data-isolator-field={key}
                defaultValue={String(specs[label] ?? "Not confirmed")}
                className="field"
              >
                <option>Not confirmed</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            ) : (
              <input
                data-isolator-field={key}
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

type BaseProps = { siteId: string; systemId: string; systemName: string; returnTo?: string };

export function ComponentDetail({
  siteId,
  systemId,
  systemName,
  component,
  defaults,
  returnTo,
}: BaseProps & {
  component?: ComponentSpec;
  defaults?: { kind: ComponentSpec["kind"]; name: string; schematicImage?: string };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<EquipmentLabelExtraction>();
  const [photoPath, setPhotoPath] = useState(component?.photoUrl ?? "");
  const icon = itemIcon(component?.kind ?? defaults?.kind ?? "other");
  const back = returnTo ?? `/sites/${siteId}/systems/${systemId}`;
  const isAcConnection =
    (component?.name ?? defaults?.name ?? "")
      .toLowerCase()
      .includes("switchboard ac connection") ||
    component?.specs["Connection type"] === "Inverter to switchboard AC";
  const isInverter =
    (component?.kind ?? defaults?.kind ?? "other") === "inverter";
  const isIsolator =
    (component?.kind ?? defaults?.kind ?? "other") === "isolator";
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
      if (isEarthing && Object.values(earthingFields).includes(name as never))
        return false;
      if (isIsolator && Object.values(isolatorFields).includes(name as never))
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
  }
  async function analyze(file?: File) {
    if (!file) return;
    setAnalyzing(true);
    setError("");
    setExtraction(undefined);
    const body = new FormData();
    body.set("file", file);
    body.set("projectId", systemId);
    try {
      const response = await fetch("/api/equipment/analyze-label", {
        method: "POST",
        body,
      });
      const result = await response.json();
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
    if (isAcConnection) {
      specifications["Connection type"] = "Inverter to switchboard AC";
      for (const [key, label] of Object.entries(acConnectionFields)) {
        const field = document.querySelector(
          `[data-ac-field="${key}"]`,
        ) as HTMLInputElement | null;
        const value = field?.value.trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isInverter) {
      specifications["Equipment record"] = "Individual inverter";
      for (const [key, label] of Object.entries(inverterAssignmentFields)) {
        const field = document.querySelector(
          `[data-inverter-field="${key}"]`,
        ) as HTMLInputElement | null;
        const value = field?.value.trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isEarthing) {
      specifications["Equipment record"] = "System earthing and bonding";
      for (const [key, label] of Object.entries(earthingFields)) {
        const field = document.querySelector(
          `[data-earthing-field="${key}"]`,
        ) as HTMLInputElement | null;
        const value = field?.value.trim();
        if (value) specifications[label] = value;
        else delete specifications[label];
      }
    }
    if (isIsolator) {
      specifications["Equipment record"] = "Isolation device";
      for (const [key, label] of Object.entries(isolatorFields)) {
        const field = document.querySelector(
          `[data-isolator-field="${key}"]`,
        ) as HTMLInputElement | HTMLSelectElement | null;
        const value = field?.value.trim();
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
    };
    try {
      const response = await fetch(
        component ? `/api/components/${component.id}` : "/api/components",
        {
          method: component ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Could not save equipment");
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
    const response = await fetch(`/api/components/${component.id}`, {
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
      <label className="mb-4 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-[#91aec9] bg-[#f7fafd] p-4">
        <span className="grid size-11 place-items-center rounded-xl bg-white text-brand">
          <Camera size={20} />
        </span>
        <span className="flex-1">
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
        {analyzing ? (
          <LoaderCircle className="animate-spin text-brand" size={19} />
        ) : (
          <ScanLine className="text-brand" size={19} />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          disabled={analyzing}
          onChange={(event) => void analyze(event.target.files?.[0])}
        />
      </label>
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
      {isEarthing && <EarthingDetails specs={component?.specs ?? {}} />}
      {isIsolator && <IsolatorDetails specs={component?.specs ?? {}} />}
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
      <form action={save} className="card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Equipment type">
            <select
              name="type"
              defaultValue={component?.kind ?? defaults?.kind ?? "other"}
              className="field"
            >
              {componentTypes.map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Equipment name">
            <input
              name="name"
              required
              defaultValue={component?.name ?? defaults?.name}
              className="field"
            />
          </Field>
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
              <Field label="Quantity">
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max={isInverter ? 1 : undefined}
                  readOnly={isInverter}
                  defaultValue={component?.quantity ?? 1}
                  className="field"
                />
                {isInverter && (
                  <span className="mt-1 block text-[9px] font-normal text-muted">
                    One physical inverter per card.
                  </span>
                )}
              </Field>
            </>
          )}
          <Field label="Installed location">
            <input
              name="installationLocation"
              defaultValue={component?.location}
              className="field"
              placeholder="e.g. Studio utility wall"
            />
          </Field>
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
          <Field
            label={
              isAcConnection
                ? "Additional connection information"
                : isIsolator
                  ? "Other isolator details"
                : "Technical specifications"
            }
            help={
              isAcConnection
                ? "Add anything not covered above in plain language, or use Name: Value for structured details."
                : isIsolator
                  ? "Only add details that are not covered by the isolator fields above."
                : "One Name: Value per line, or enter plain-language notes. Use any values relevant to this item: voltage, current, power, cable size, breaker rating, torque, chemistry, capacity, and so on."
            }
            wide
          >
            <textarea
              name="specifications"
              rows={isIsolator ? 4 : 10}
              defaultValue={editableAdditionalSpecs
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n")}
              className="field py-3 font-mono"
              placeholder="Rated voltage: 48 V&#10;Breaker rating: 32 A&#10;Cable size: 16 mm²"
            />
          </Field>
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
      <form action={save} className="card p-6">
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
