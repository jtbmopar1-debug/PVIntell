import { describe, expect, it } from "vitest";
import { confirmedDestinationNames, conversationKind } from "./conversation-kind";

describe("conversationKind", () => {
  it("keeps dashboard chats separate from grouped help chats", () => {
    expect(conversationKind("How is my system performing?" )).toBe("dashboard");
    expect(conversationKind("Dashboard — New chat")).toBe("dashboard");
    expect(conversationKind("Discovery — House solar")).toBe("discovery");
    expect(conversationKind("Guided system discovery")).toBe("discovery");
    expect(conversationKind("Build It — Battery fuse")).toBe("component");
    expect(conversationKind("Configure — Inverter")).toBe("component");
  });

  it("reads permission, Site and system from one installed-import reply", () => {
    expect(confirmedDestinationNames("sure, sunnyview, system1")).toEqual({ siteName: "sunnyview", systemName: "system1" });
    expect(confirmedDestinationNames("Sunnyview; System 1")).toEqual({ siteName: "Sunnyview", systemName: "System 1" });
    expect(confirmedDestinationNames("sure")).toBeNull();
  });

});
