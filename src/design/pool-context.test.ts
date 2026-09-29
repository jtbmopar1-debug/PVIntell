import { describe, expect, it } from "vitest";
import { projectHasPoolContext } from "./pool-context";
import type { Project } from "@/domain/models";

const project = (overrides: Partial<Project> = {}) => ({
  name: "Home solar system",
  components: [],
  designDiscovery: {},
  ...overrides,
}) as Project;

describe("projectHasPoolContext", () => {
  it("does not treat dormant pool question keys as a pool system", () => {
    expect(projectHasPoolContext(project({
      designDiscovery: {
        pool_or_spa: { value: "none" },
        pool_equipment: { value: "none" },
        pool_equipment_ratings: { value: "{}" },
      },
    }))).toBe(false);
  });

  it("recognises an explicitly recorded pool or spa", () => {
    expect(projectHasPoolContext(project({ designDiscovery: { pool_or_spa: { value: "existing" } } }))).toBe(true);
    expect(projectHasPoolContext(project({ designDiscovery: { building_type: { value: "detached_house,pool_spa" } } }))).toBe(true);
  });
});
