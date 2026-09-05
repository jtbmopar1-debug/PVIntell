import type { LocalDeviceAdapter } from "@/local-devices/types";
import type { MonitoringReading } from "@/monitoring/types";

const serviceUuid = "0000fff0-0000-1000-8000-00805f9b34fb";
const notifyUuid = "0000fff1-0000-1000-8000-00805f9b34fb";
const writeUuid = "0000fff2-0000-1000-8000-00805f9b34fb";

function bcd(bytes: number[]) { const digits = bytes.flatMap((byte) => [byte >> 4, byte & 15]); if (digits.some((digit) => digit > 9)) return undefined; return Number(digits.join("")); }
export function decodeJunctekFrame(bytes: Uint8Array): Record<number, number> {
  if (bytes[0] !== 0xbb || bytes.at(-1) !== 0xee || bytes.length < 4) return {};
  const result: Record<number, number> = {}; let valueBytes: number[] = [];
  for (const byte of bytes.slice(1, -2)) {
    if (byte >= 0xb0 && byte <= 0xf0) { const value = bcd(valueBytes); if (value != null) result[byte] = value; valueBytes = []; }
    else valueBytes.push(byte);
  }
  return result;
}
export function junctekMetrics(values: Record<number, number>): MonitoringReading | undefined {
  const voltage = values[0xc0]; const amps = values[0xc1]; const watts = values[0xd8]; const charging = values[0xd1]; const capacity = values[0xb0]; const remaining = values[0xd2];
  if ([voltage, amps, watts, capacity, remaining].every((item) => item == null)) return undefined;
  const direction = charging === 1 ? 1 : -1;
  return { measuredAt: new Date().toISOString(), ...(voltage == null ? {} : { batteryVoltageV: voltage / 100 }), ...(amps == null ? {} : { batteryCurrentA: direction * amps / 100 }), ...(watts == null ? {} : { batteryPowerW: direction * watts / 100 }), ...(capacity && remaining != null ? { batterySocPercent: Math.max(0, Math.min(100, (remaining / 1000) / (capacity / 10) * 100)) } : {}) };
}

export const junctekAdapter: LocalDeviceAdapter = {
  id: "junctek", label: "Junctek battery monitor", supported: () => typeof navigator !== "undefined" && Boolean(navigator.bluetooth),
  async connect(onReading) {
    if (!navigator.bluetooth) throw new Error("Bluetooth connection requires Chrome or Edge on Android, Windows, macOS or ChromeOS.");
    const device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: "KMF" }, { namePrefix: "BTG" }], optionalServices: [serviceUuid] });
    const server = await device.gatt?.connect(); if (!server) throw new Error("The selected device did not provide a Bluetooth connection.");
    const service = await server.getPrimaryService(serviceUuid); const notify = await service.getCharacteristic(notifyUuid); const writer = await service.getCharacteristic(writeUuid);
    let buffered: number[] = [];
    notify.addEventListener("characteristicvaluechanged", (event) => {
      const view = (event.target as BluetoothRemoteGATTCharacteristic).value; if (!view) return;
      buffered.push(...new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      while (buffered.includes(0xbb) && buffered.includes(0xee)) { const start = buffered.indexOf(0xbb); const end = buffered.indexOf(0xee, start); if (end < 0) break; const metrics = junctekMetrics(decodeJunctekFrame(Uint8Array.from(buffered.slice(start, end + 1)))); buffered = buffered.slice(end + 1); if (metrics) onReading(metrics); }
    });
    await notify.startNotifications();
    setTimeout(() => { void writer.writeValue(Uint8Array.from([0xbb, 0x9a, 0xa9, 0x0c, 0xee])); }, 250);
    return { deviceId: device.id, displayName: device.name || "Junctek monitor", disconnect: () => server.disconnect() };
  },
};
