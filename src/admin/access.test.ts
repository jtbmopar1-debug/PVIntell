import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./access";

describe("isAdminEmail", () => {
  it("allows only the configured administrators", () => {
    expect(isAdminEmail("jtbmopar1@gmail.com")).toBe(true);
    expect(isAdminEmail(" LOCAL.DEV26@gmail.com ")).toBe(true);
    expect(isAdminEmail("someone@example.com")).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

