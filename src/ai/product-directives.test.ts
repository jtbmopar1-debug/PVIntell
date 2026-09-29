import { describe, expect, it } from "vitest";
import { GLOBAL_PRODUCT_PERSPECTIVE, USER_SELECTED_PROPOSAL_EQUIPMENT_DIRECTIVE } from "./product-directives";

describe("PVIntell product directives", () => {
  it("enforces a global base perspective without a silent NZ default", () => {
    expect(GLOBAL_PRODUCT_PERSPECTIVE).toContain("GLOBAL application");
    expect(GLOBAL_PRODUCT_PERSPECTIVE).toContain("internationally neutral");
    expect(GLOBAL_PRODUCT_PERSPECTIVE).toContain("Never treat New Zealand");
    expect(GLOBAL_PRODUCT_PERSPECTIVE).toContain("selected Site has a confirmed location");
    expect(GLOBAL_PRODUCT_PERSPECTIVE).toContain("controlling jurisdiction");
    expect(GLOBAL_PRODUCT_PERSPECTIVE).toContain("overrides the user's account");
    expect(GLOBAL_PRODUCT_PERSPECTIVE).toContain("remains unconfirmed until the user accepts or pins it");
  });

  it("preserves user-selected proposal equipment while assessing validity", () => {
    expect(USER_SELECTED_PROPOSAL_EQUIPMENT_DIRECTIVE).toContain("valid, safe and appropriate use");
    expect(USER_SELECTED_PROPOSAL_EQUIPMENT_DIRECTIVE).toContain("not proof of technical validity");
    expect(USER_SELECTED_PROPOSAL_EQUIPMENT_DIRECTIVE).toContain("Never silently collapse multiple items");
    expect(USER_SELECTED_PROPOSAL_EQUIPMENT_DIRECTIVE).toContain("smallest necessary change");
  });
});
