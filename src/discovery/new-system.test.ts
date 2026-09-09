import { describe, expect, it } from "vitest";
import { visibleDiscoveryQuestions } from "./new-system";

describe("new-system discovery", () => {
  it("offers a chest freezer as a separate simultaneous compressor load", () => {
    const questions = visibleDiscoveryQuestions({
      utility_relationship: "grid_connected",
      target_grid_role: "normal_supply",
      primary_outcome: ["backup"],
      building_type: ["detached_house"],
      everyday_needs: ["fridge_freezer"],
      backup_preference: "most_home",
    });
    const highPower = questions.find((question) => question.id === "heavy_loads");
    expect(highPower?.options?.map((option) => option.value)).toEqual(expect.arrayContaining(["refrigeration", "chest_freezer"]));
  });
});
