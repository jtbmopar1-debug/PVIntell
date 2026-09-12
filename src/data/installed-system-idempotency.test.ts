import { describe, expect, it } from "vitest";
import { installedSystemCreationReplay } from "./installed-system-idempotency";

describe("installed system creation idempotency", () => {
  const payload = { siteId: "__new__", siteName: "River Views", systemName: "House", projectType: "hybrid", systemVoltage: 48 };

  it("replays the first completed Site/system for the same request", () => {
    expect(installedSystemCreationReplay({ request_payload: { systemName: "House", siteName: "River Views", siteId: "__new__", systemVoltage: 48, projectType: "hybrid" }, status: "completed", site_id: "site-1", project_id: "system-1" }, payload)).toEqual({ kind: "completed", siteId: "site-1", projectId: "system-1" });
  });

  it("does not allow a concurrent duplicate to create another workspace", () => {
    expect(installedSystemCreationReplay({ request_payload: payload, status: "processing" }, payload)).toEqual({ kind: "processing" });
  });

  it("rejects reuse of a request key for different details", () => {
    expect(installedSystemCreationReplay({ request_payload: payload, status: "completed", site_id: "site-1", project_id: "system-1" }, { ...payload, systemName: "Workshop" })).toEqual({ kind: "conflict" });
  });
});

