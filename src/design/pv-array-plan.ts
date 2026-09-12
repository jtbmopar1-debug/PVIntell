import type { DesignCalculatorState } from "@/domain/models";

type Surface = { id: string; name: string; capacity?: number; mounting?: string; direction?: string; pitch?: string };

function allocatePanelCount(panelCount: number, surfaces: Surface[]) {
  const total = Math.max(0, Math.round(panelCount));
  if (!total || !surfaces.length) return surfaces.map(() => 0);
  const weights = surfaces.map((surface) => surface.capacity && surface.capacity > 0 ? surface.capacity : 1);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => total * weight / weightTotal);
  const allocated = raw.map((value, index) => Math.min(Math.floor(value), surfaces[index].capacity ?? Number.POSITIVE_INFINITY));
  let remaining = total - allocated.reduce((sum, count) => sum + count, 0);
  const priority = surfaces.map((_, index) => index).sort((a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])) || weights[b] - weights[a]);
  while (remaining > 0) {
    const eligible = priority.filter((index) => allocated[index] < (surfaces[index].capacity ?? Number.POSITIVE_INFINITY));
    if (!eligible.length) break;
    for (const index of eligible) {
      if (!remaining) break;
      allocated[index] += 1;
      remaining -= 1;
    }
  }
  return allocated;
}

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
  if (input.surfaces.length > 1) {
    const allocations = input.panelCount ? allocatePanelCount(input.panelCount, input.surfaces) : input.surfaces.map(() => 0);
    const arrays = input.surfaces
      .map((surface, index) => ({ ...surface, allocatedPanelCount: allocations[index] || undefined, topology: topology() }))
      .filter((array) => !input.panelCount || array.allocatedPanelCount);
    const allocated = allocations.reduce((sum, count) => sum + count, 0);
    if (input.panelCount && allocated < input.panelCount) arrays.push({
      id: "unallocated-panels",
      name: "Panel location to confirm",
      allocatedPanelCount: input.panelCount - allocated,
      topology: topology(),
    });
    return { status: input.panelCount ? "topology_unresolved" : "surface_allocation_required", arrays };
  }
  return {
    status: "surface_allocation_required",
    arrays: [{ id: "proposed-array", name: "Proposed solar array", allocatedPanelCount: input.panelCount, topology: topology() }],
  };
}
