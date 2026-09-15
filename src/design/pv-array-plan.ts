import type { DesignCalculatorState } from "@/domain/models";

type Surface = { id: string; name: string; capacity?: number; mounting?: string; direction?: string; pitch?: string };

type PvArrayPlan = NonNullable<DesignCalculatorState["pvArrayPlan"]>;
type PvArray = PvArrayPlan["arrays"][number];

const unresolvedTopology = (): PvArray["topology"] => ({
  kind: "series_parallel",
  status: "pending_surface_allocation_and_equipment",
  strings: [],
  combinerRequirement: "pending",
  reason: "Set series length and any parallel grouping only after this array's panel allocation and the selected inverter MPPT voltage, current, short-circuit-current and input limits are known.",
});

export function balancedPanelAllocation(panelCount: number, arrayCount: number) {
  const total = Math.max(0, Math.round(panelCount));
  const groups = Math.max(0, Math.round(arrayCount));
  if (!total || !groups) return [];
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < remainder ? 1 : 0));
}

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
  const existing = input.existingPanelGroup;
  if (existing?.proposedUseCount) {
    const arrays: NonNullable<DesignCalculatorState["pvArrayPlan"]>["arrays"] = [{
      id: "existing-array",
      name: existing.name || "Existing panel array",
      allocatedPanelCount: existing.proposedUseCount,
      topology: unresolvedTopology(),
    }];
    if (existing.supplementaryTargetPvKw) arrays.push({
      id: "supplementary-array",
      name: "Supplementary solar array",
      allocatedPanelCount: existing.supplementaryCount,
      topology: unresolvedTopology(),
    });
    return { status: "topology_unresolved", arrays };
  }
  if (input.surfaces.length === 1) return {
    status: "topology_unresolved",
    arrays: [{ ...input.surfaces[0], allocatedPanelCount: input.panelCount, topology: unresolvedTopology() }],
  };
  if (input.surfaces.length > 1) {
    const allocations = input.panelCount ? allocatePanelCount(input.panelCount, input.surfaces) : input.surfaces.map(() => 0);
    const arrays = input.surfaces
      .map((surface, index) => ({ ...surface, allocatedPanelCount: allocations[index] || undefined, topology: unresolvedTopology() }))
      .filter((array) => !input.panelCount || array.allocatedPanelCount);
    const allocated = allocations.reduce((sum, count) => sum + count, 0);
    if (input.panelCount && allocated < input.panelCount) arrays.push({
      id: "unallocated-panels",
      name: "Panel location to confirm",
      allocatedPanelCount: input.panelCount - allocated,
      topology: unresolvedTopology(),
    });
    return { status: input.panelCount ? "topology_unresolved" : "surface_allocation_required", arrays };
  }
  return {
    status: "surface_allocation_required",
    arrays: [{ id: "proposed-array", name: "Proposed solar array", allocatedPanelCount: input.panelCount, topology: unresolvedTopology() }],
  };
}

/** Split one user-selected array while retaining every other mounting array. */
export function splitPvArrayPlan(plan: PvArrayPlan, arrayIndex: number, arrayCount: number): PvArrayPlan {
  const source = plan.arrays[arrayIndex];
  const count = Math.round(source?.allocatedPanelCount ?? 0);
  const parts = Math.round(arrayCount);
  if (!source) throw new RangeError("The selected PV array does not exist.");
  if (parts < 2) throw new RangeError("Choose at least two arrays.");
  if (!count || parts > count) throw new RangeError("Each new array must contain at least one panel.");

  const allocations = balancedPanelAllocation(count, parts);
  const capacities = source.capacity ? balancedPanelAllocation(source.capacity, parts) : [];
  const replacements = allocations.map((allocatedPanelCount, index): PvArray => ({
    ...source,
    id: `${source.id}-part-${index + 1}`,
    name: `${source.name} ${index + 1}`,
    capacity: capacities[index] || undefined,
    allocatedPanelCount,
    topology: unresolvedTopology(),
  }));

  return {
    status: "topology_unresolved",
    configurationSource: "user",
    arrays: [...plan.arrays.slice(0, arrayIndex), ...replacements, ...plan.arrays.slice(arrayIndex + 1)],
  };
}

/** Keep a user-selected array grouping when the proposal's total panel count changes. */
export function resizeUserPvArrayPlan(plan: PvArrayPlan, panelCount: number): PvArrayPlan {
  const total = Math.max(0, Math.round(panelCount));
  if (!plan.arrays.length || !total) return {
    ...plan,
    configurationSource: "user",
    status: "surface_allocation_required",
    arrays: plan.arrays.map((array) => ({ ...array, allocatedPanelCount: undefined, topology: unresolvedTopology() })),
  };

  const weights = plan.arrays.map((array) => Math.max(1, Math.round(array.allocatedPanelCount ?? 1)));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => total * weight / weightTotal);
  const allocations = raw.map(Math.floor);
  let remaining = total - allocations.reduce((sum, count) => sum + count, 0);
  const priority = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of priority) {
    if (!remaining) break;
    allocations[index] += 1;
    remaining -= 1;
  }

  return {
    status: "topology_unresolved",
    configurationSource: "user",
    arrays: plan.arrays
      .map((array, index) => ({ ...array, allocatedPanelCount: allocations[index] || undefined, topology: unresolvedTopology() }))
      .filter((array) => array.allocatedPanelCount),
  };
}
