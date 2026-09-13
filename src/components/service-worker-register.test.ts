import { describe, expect, it } from "vitest";
import { isStaleAppAssetError } from "./service-worker-register";

describe("stale app asset detection", () => {
  it.each([
    "ChunkLoadError: Loading chunk 123 failed",
    "Failed to fetch dynamically imported module",
    "Importing a module script failed",
  ])("recognises a stale deployment asset failure: %s", (message) => {
    expect(isStaleAppAssetError(new Error(message))).toBe(true);
  });

  it("does not reload for an ordinary application error", () => {
    expect(isStaleAppAssetError(new Error("Could not save the component"))).toBe(false);
  });
});
