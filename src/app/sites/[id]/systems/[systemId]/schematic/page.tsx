import { redirect } from "next/navigation";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { SystemSchematic } from "@/components/system-schematic";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";
import type { ComponentSpec } from "@/domain/models";
import { METER_BOARD_IMAGE, NON_COMMUNICATING_DIGITAL_METER_IMAGE, SMART_ELECTRICITY_METER_IMAGE } from "@/ui/assets";

const supportedImages = /\.(?:jpe?g|png|webp|svg)$/i;
const acronyms = new Set(["ac", "dc", "pv", "bms", "mppt", "rcd", "rccb", "ats", "ct", "spd", "wifi"]);

function assetLabel(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .split(/[-_]+/)
    .map((word) =>
      acronyms.has(word.toLowerCase())
        ? word.toUpperCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(" ");
}

function assetType(fileName: string): ComponentSpec["kind"] {
  const name = fileName.toLowerCase();
  if (name.includes("inverter")) return "inverter";
  if (name.includes("battery")) return "battery";
  if (name.includes("generator")) return "generator";
  if (name.includes("charge-controller") || name.includes("charger")) return "charger";
  if (/breaker|fuse|surge|spd|rcd|rccb/.test(name)) return "protection";
  if (/isolator|disconnect/.test(name)) return "isolator";
  if (name.includes("cable")) return "cable";
  if (name.includes("combiner")) return "combiner";
  if (/meter|current-transformer|ct-clamp/.test(name)) return "meter";
  if (/monitor|logger|wifi|communication/.test(name)) return "monitoring";
  if (/panel|pv-module|mounting/.test(name)) return "panel";
  if (/relay|load|charging-station|ev-charger/.test(name)) return "load";
  return "other";
}

export default async function SchematicPage({
  params,
}: {
  params: Promise<{ id: string; systemId: string }>;
}) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string")
    redirect("/login");
  const { id, systemId } = await params;
  let workspace;
  try {
    workspace = await loadSiteWorkspace(supabase, id, systemId);
  } catch {
    redirect(`/sites/${id}`);
  }
  let files: string[] = [];
  try {
    files = await readdir(path.join(process.cwd(), "public", "schematic-components"));
  } catch {
    files = [];
  }
  const fileAssets = files
    .filter((fileName) => supportedImages.test(fileName))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => ({
      fileName,
      label: assetLabel(fileName),
      type: assetType(fileName),
      url: `/schematic-components/${encodeURIComponent(fileName)}`,
    }));
  const meterAssets = [
    { label: "Meter board or meter enclosure", url: METER_BOARD_IMAGE },
    { label: "Smart electricity meter", url: SMART_ELECTRICITY_METER_IMAGE },
    { label: "Non-communicating digital meter", url: NON_COMMUNICATING_DIGITAL_METER_IMAGE },
    { label: "Standard or accumulation electricity meter", url: "/schematic-components/energy-meter.jpg" },
  ].map(({ label, url }) => ({ fileName: `meter:${label}`, label, type: "meter" as const, url }));
  const schematicAssets = [...meterAssets, ...fileAssets];
  return <SystemSchematic project={workspace.project} site={workspace.site} sites={workspace.sites} schematicAssets={schematicAssets} />;
}
