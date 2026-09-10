import { describe, expect, it } from "vitest";
import { dashboardMessageAllowsActions } from "./dashboard-intent";

describe("dashboardMessageAllowsActions", () => {
  it("keeps general sizing questions read-only", () => {
    expect(dashboardMessageAllowsActions("how many panels can I get on a roof 3x17m?")).toBe(false);
    expect(dashboardMessageAllowsActions("what size inverter would that need?")).toBe(false);
  });

  it("allows explicit change requests even when phrased as questions", () => {
    expect(dashboardMessageAllowsActions("can you update my panel count to 8?")).toBe(true);
    expect(dashboardMessageAllowsActions("could you save that roof size?")).toBe(true);
  });

  it("allows a direct answer to an established structured question", () => {
    expect(dashboardMessageAllowsActions("what I have is a 3 by 17 metre roof", true)).toBe(true);
  });
});

