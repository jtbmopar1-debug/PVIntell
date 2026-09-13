import { describe, expect, it } from "vitest";
import { installedSystemInputSchema } from "./installed-system-input";

const base = {
  idempotencyKey: "e3b1409d-9aa1-4ce5-858e-bf3e2c8797ea",
  systemName: "Main House",
  projectType: "hybrid" as const,
};

describe("installed system input", () => {
  it("accepts a null Site name when an existing Site is selected", () => {
    expect(installedSystemInputSchema.safeParse({ ...base, siteId: "existing-site", siteName: null }).success).toBe(true);
  });

  it("still requires a name when creating a new Site", () => {
    expect(installedSystemInputSchema.safeParse({ ...base, siteId: "__new__", siteName: null }).success).toBe(false);
  });

  it("accepts a named new Site", () => {
    expect(installedSystemInputSchema.safeParse({ ...base, siteId: "__new__", siteName: "River Views" }).success).toBe(true);
  });
});
