"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Unplug } from "lucide-react";
import { junctekAdapter } from "@/local-devices/junctek";
import type { LocalDeviceSession } from "@/local-devices/types";
import type { MonitoringReading } from "@/monitoring/types";

type Scope = { siteId: string; systemId: string };
type LocalMonitoringState = {
  status: "idle" | "requesting" | "connected" | "error";
  scope?: Scope;
  deviceName?: string;
  error?: string;
  lastReading?: MonitoringReading;
  lastSavedAt?: number;
  connectJunctek(scope: Scope): Promise<void>;
  disconnect(): void;
};

const LocalMonitoringContext = createContext<LocalMonitoringState | null>(null);
const uploadIntervalMs = 30_000;

export function LocalMonitoringProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<LocalMonitoringState, "connectJunctek" | "disconnect">>({ status: "idle" });
  const session = useRef<LocalDeviceSession | null>(null); const activeScope = useRef<Scope>(); const lastUpload = useRef(0);

  async function saveReading(device: LocalDeviceSession, scope: Scope, reading: MonitoringReading) {
    if (Date.now() - lastUpload.current < uploadIntervalMs) return;
    lastUpload.current = Date.now();
    const response = await fetch("/api/monitoring/local-readings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId: scope.siteId, systemId: scope.systemId, adapter: "junctek", deviceId: device.deviceId, displayName: device.displayName, reading }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not save the Junctek reading");
    setState((current) => ({ ...current, lastSavedAt: Date.now() }));
  }

  async function connectJunctek(scope: Scope) {
    session.current?.disconnect(); session.current = null; activeScope.current = scope; lastUpload.current = 0;
    setState({ status: "requesting", scope });
    try {
      let pending: MonitoringReading | undefined;
      const connected = await junctekAdapter.connect((reading) => {
        setState((current) => ({ ...current, lastReading: reading }));
        const device = session.current; const currentScope = activeScope.current;
        if (device && currentScope) void saveReading(device, currentScope, reading).catch((problem) => setState((current) => ({ ...current, error: problem instanceof Error ? problem.message : "Could not save the reading" })));
        else pending = reading;
      });
      session.current = connected;
      setState((current) => ({ ...current, status: "connected", scope, deviceName: connected.displayName, error: undefined }));
      if (pending) void saveReading(connected, scope, pending).catch((problem) => setState((current) => ({ ...current, error: problem instanceof Error ? problem.message : "Could not save the reading" })));
    } catch (problem) {
      activeScope.current = undefined;
      const message = problem instanceof Error ? problem.message : "Could not connect to the Junctek monitor";
      setState({ status: "error", error: message }); throw new Error(message);
    }
  }

  function disconnect() {
    session.current?.disconnect(); session.current = null; activeScope.current = undefined; lastUpload.current = 0;
    setState({ status: "idle" });
  }

  useEffect(() => disconnect, []);
  return <LocalMonitoringContext.Provider value={{ ...state, connectJunctek, disconnect }}>{children}{state.status === "connected" ? <div className="fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-xl border border-line bg-white/95 px-3 py-2 text-[10px] shadow-lg backdrop-blur"><span className="size-2 rounded-full bg-[#2aa876]"/><strong>{state.deviceName}</strong><span className="text-muted">monitoring while PVIntell is open</span><button type="button" onClick={disconnect} aria-label="Disconnect local monitor" className="ml-1 grid size-7 place-items-center rounded-lg bg-[#eef3f8] text-brand"><Unplug size={13}/></button></div> : null}</LocalMonitoringContext.Provider>;
}

export function useLocalMonitoring() {
  const value = useContext(LocalMonitoringContext);
  if (!value) throw new Error("useLocalMonitoring must be used inside LocalMonitoringProvider");
  return value;
}
