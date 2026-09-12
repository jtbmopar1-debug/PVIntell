import type { DesignCalculatorState } from "@/domain/models";

type Surface = { id: string; name: string; capacity?: number; mounting?: string; direction?: string; pitch?: string };

/** Canonical proposal hierarchy. An unresolved topology is still explicit:
 * array -> strings -> series modules, with the parallel/MPPT point pending. */
export function buildPvArrayPlan(input: {
  panelCount?: number;
  surfaces: Surface[];
  existingPanelGroup?: DesignCalculatorState["existingPanelGroup"];
}): NonNullable<DesignCalculatorState["pvArrayPlan"]> {
  const topology = () => ({
    kind: "series_parallel" as const,
    status: "pending_surface_allocation_and_equipment" as const,
    strings: [] as Array<{ id: string; panelsInSeries: number; parallelGroup?: string; mpptInput?: string }>,
    combinerRequirement: "pending" as const,
    reason: "Set series length and any parallel grouping only after this array's panel allocation and the selected inverter MPPT voltage, current, short-circuit-current and input limits are known.",
  });
  const existing = input.existingPanelGroup;
  if (existing?.proposedUseCount) {
    const arrays: NonNullable<DesignCalculatorState["pvArrayPlan"]>["arrays"] = [{
      id: "existing-array",
      name: existing.name || "Existing panel array",
      allocatedPanelCount: existing.proposedUseCount,
      topology: topology(),
    }];
    if (existing.supplementaryTargetPvKw) arrays.push({
      id: "supplementary-array",
      name: "Supplementary solar array",
      allocatedPanelCount: existing.supplementaryCount,
      topology: topology(),
    });
    return { status: "topology_unresolved", arrays };
  }
  if (input.surfaces.length === 1) return {
    status: "topology_unresolved",
    arrays: [{ ...input.surfaces[0], allocatedPanelCount: input.panelCount, topology: topology() }],
  };
  if (input.surfaces.length > 1) return {
    status: "surface_allocation_required",
    arrays: input.surfaces.map((surface) => ({ ...surface, topology: topology() })),
  };
  return {
    status: "surface_allocation_required",
    arrays: [{ id: "proposed-array", name: "Proposed solar array", allocatedPanelCount: input.panelCount, topology: topology() }],
  };
}
