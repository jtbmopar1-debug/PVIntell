import { describe, expect, it } from "vitest";
import { GLOBAL_PRODUCT_PERSPECTIVE } from "./product-directives";

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
});
