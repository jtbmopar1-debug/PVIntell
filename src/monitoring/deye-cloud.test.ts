import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authenticateDeye, fetchDeyeStationLatest, listDeyeStations, normalizeDeyeStationLatest } from "@/monitoring/deye-cloud";

describe("DeyeCloud read-only connector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.DEYECLOUD_APP_ID = "test-app";
    process.env.DEYECLOUD_APP_SECRET = "test-secret";
  });

  it("hashes the account password and obtains a server-side token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, code: 1000000, accessToken: "Bearer token", refreshToken: "Bearer refresh", expiresIn: 3600 }), { status: 200 }));
    const credential = await authenticateDeye({ email: "owner@example.com", password: "plain-password", region: "eu" });
    const request = fetchMock.mock.calls[0]; const sent = JSON.parse(String(request[1]?.body));

    expect(String(request[0])).toContain("/account/token?appId=test-app");
    expect(sent.password).not.toBe("plain-password");
    expect(sent.password).toMatch(/^[a-f0-9]{64}$/);
    expect(credential).toMatchObject({ accessToken: "token", refreshToken: "refresh", region: "eu" });
  });

  it("discovers stations and normalizes current station power without inventing missing values", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, code: 1000000, stationList: [{ id: 42, name: "Home", locationAddress: "Wellington", regionTimezone: "Pacific/Auckland" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, code: 1000000, generationPower: 4200, consumptionPower: 1600, chargePower: 700, dischargePower: 0, batterySOC: 81, purchasePower: 100, wirePower: 200, lastUpdateTime: 1789000000 }), { status: 200 }));
    const credential = { region: "eu" as const, stationId: "42", accessToken: "token" };

    await expect(listDeyeStations(credential)).resolves.toEqual([expect.objectContaining({ id: "42", name: "Home", timezone: "Pacific/Auckland" })]);
    await expect(fetchDeyeStationLatest(credential)).resolves.toMatchObject({ providerDeviceId: "42", pvPowerW: 4200, loadPowerW: 1600, batteryPowerW: 700, batterySocPercent: 81, gridPowerW: -100 });
  });

  it("keeps absent telemetry absent", () => {
    expect(normalizeDeyeStationLatest({ success: true, code: 1000000, lastUpdateTime: "2026-09-11T00:00:00Z", generationPower: null, batterySOC: null }, "station")).toEqual({ providerDeviceId: "station", measuredAt: "2026-09-11T00:00:00.000Z", pvPowerW: undefined, loadPowerW: undefined, batteryPowerW: undefined, batterySocPercent: undefined, gridPowerW: undefined, inverterState: "DeyeCloud" });
  });
});
