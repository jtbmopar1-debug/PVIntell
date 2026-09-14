import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { persistRequestedSchematic } from "./schematic-builder";

function recordingSupabase() {
  const inserted: Record<string, Array<Record<string, unknown>>> = {};
  let nextId = 1;
  const client = {
    from(table: string) {
      return {
        insert(value: Record<string, unknown> | Array<Record<string, unknown>>) {
          const rows = Array.isArray(value) ? value : [value];
          inserted[table] = [...(inserted[table] ?? []), ...rows];
          return {
            async select() {
              return { data: rows.map((row) => ({ ...row, id: `${table}-${nextId++}` })), error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserted };
}

describe("persistRequestedSchematic", () => {
  it("persists the acceptance request as explicit records and connections", async () => {
    const { client, inserted } = recordingSupabase();
    const result = await persistRequestedSchematic({
      supabase: client,
      projectId: "system-1",
      message: "i need a schematic pls - 8x630w panels in a 4p2s (dont worry about ratings) connected to a combiner box and isolators, then to the 8kw hybrid inverter, and a fused 100ah 48v lifeop4 battery via busbar.",
    });

    expect(inserted.pv_arrays).toHaveLength(2);
    expect(inserted.pv_arrays).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "PV1", panel_count: 4, panel_watts: 630, panels_per_string: 4 }),
      expect.objectContaining({ name: "PV2", panel_count: 4, panel_watts: 630, panels_per_string: 4 }),
    ]));
    expect(inserted.system_components.map((row) => row.display_name)).toEqual([
      "8 kW hybrid inverter",
      "48 V 100 Ah LiFePO4 battery",
      "PV combiner box",
      "PV DC isolator 1",
      "PV DC isolator 2",
      "Battery fuse",
      "Positive busbar",
      "Negative busbar",
    ]);
    expect(inserted.system_connections).toHaveLength(10);
    expect(inserted.system_connections.map((row) => row.name)).toEqual(expect.arrayContaining([
      "PV1 DC",
      "PV2 DC",
      "PV1 isolated DC",
      "PV2 isolated DC",
      "Combined PV DC",
      "Battery positive",
      "Fused battery positive",
      "Battery negative",
      "Positive busbar to inverter",
      "Negative busbar to inverter",
    ]));
    expect(result).toMatchObject({ arrayCount: 2, panelsPerArray: 4, panelWatts: 630 });
  });
});
