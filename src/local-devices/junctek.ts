import type { LocalDeviceAdapter } from "@/local-devices/types";
import type { MonitoringReading } from "@/monitoring/types";

const serviceUuid = "0000fff0-0000-1000-8000-00805f9b34fb";
const notifyUuid = "0000fff1-0000-1000-8000-00805f9b34fb";
const writeUuid = "0000fff2-0000-1000-8000-00805f9b34fb";
const km140fServiceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const km140fCharacteristicUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const candidateServices = [
  serviceUuid,
  km140fServiceUuid,
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

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

export function parseJunctekR50(line: string, presetCapacityAh?: number): MonitoringReading | undefined {
  const match = line.trim().match(/^:r50=([^\r\n]+),?$/i); if (!match) return undefined;
  const fields = match[1].split(",").filter(Boolean).map((field) => Number(field.trim()));
  if (fields.length < 12 || fields.some((field) => !Number.isFinite(field))) return undefined;
  const voltage = fields[2] / 100; const current = fields[3] / 100 * (fields[11] === 1 ? 1 : -1); const remainingAh = fields[4] / 1_000;
  const soc = presetCapacityAh && presetCapacityAh > 0 ? Math.max(0, Math.min(100, Math.round((remainingAh / presetCapacityAh) * 1_000) / 10)) : undefined;
  return { measuredAt: new Date().toISOString(), batteryVoltageV: voltage, batteryCurrentA: current, batteryPowerW: Math.round(voltage * current * 100) / 100, ...(soc == null ? {} : { batterySocPercent: soc }) };
}

export function parseJunctekR51Capacity(line: string): number | undefined {
  const match = line.trim().match(/^:r51=([^\r\n]+),?$/i); if (!match) return undefined;
  const fields = match[1].split(",").filter(Boolean).map((field) => Number(field.trim()));
  if (fields.length < 9 || fields.some((field) => !Number.isFinite(field))) return undefined;
  const capacityAh = fields[8] / 10;
  return capacityAh > 0 ? capacityAh : undefined;
}

export function parseJunctekKmLive(line: string): MonitoringReading | undefined {
  const match = line.trim().match(/^:A=([^\r\n]+),?$/i); if (!match) return undefined;
  const fields = match[1].split(",").filter(Boolean).map((field) => Number(field.trim()));
  if (fields.length < 2 || fields.some((field) => !Number.isFinite(field))) return undefined;
  const voltage = fields[0] / 100; const direction = fields[2] === 0 ? -1 : 1; const current = direction * fields[1] / 1_000;
  const remainingAh = fields.length > 4 ? fields[4] / 1_000 : undefined; const capacityAh = fields.length > 5 ? fields[5] / 10 : undefined;
  const soc = remainingAh != null && capacityAh != null && capacityAh > 0 ? Math.max(0, Math.min(100, Math.round((remainingAh / capacityAh) * 1_000) / 10)) : undefined;
  return { measuredAt: new Date().toISOString(), batteryVoltageV: voltage, batteryCurrentA: current, batteryPowerW: Math.round(voltage * current * 100) / 100, ...(soc == null ? {} : { batterySocPercent: soc }) };
}

export const junctekAdapter: LocalDeviceAdapter = {
  id: "junctek", label: "Junctek battery monitor", supported: () => typeof navigator !== "undefined" && Boolean(navigator.bluetooth),
  async connect(onReading) {
    if (!navigator.bluetooth) throw new Error("Bluetooth connection requires Chrome or Edge on Android, Windows, macOS or ChromeOS.");
    // Some KM-F units omit their local name while advertising, so a name
    // filter can hide a perfectly compatible monitor from the browser picker.
    // Let the user select the nearby device, then restrict GATT access to the
    // explicit service allow-list below.
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: candidateServices });
    const server = await device.gatt?.connect(); if (!server) throw new Error("The selected device did not provide a Bluetooth connection.");
    let notify: BluetoothRemoteGATTCharacteristic | undefined; let writer: BluetoothRemoteGATTCharacteristic | undefined; let selectedService = "";
    for (const uuid of candidateServices) {
      try {
        const service = await server.getPrimaryService(uuid); const characteristics = await service.getCharacteristics();
        notify = characteristics.find((item) => item.uuid === notifyUuid || item.uuid === km140fCharacteristicUuid) ?? characteristics.find((item) => item.properties.notify || item.properties.indicate);
        writer = characteristics.find((item) => item.uuid === writeUuid || item.uuid === km140fCharacteristicUuid) ?? characteristics.find((item) => item.properties.write || item.properties.writeWithoutResponse);
        if (notify) { selectedService = service.uuid; break; }
      } catch { /* Candidate is not exposed by this device. */ }
    }
    if (!notify) { server.disconnect(); throw new Error("The KM140F paired, but its readable Bluetooth service was not found. The device service UUID is needed to complete support."); }
    let buffered: number[] = []; let textBuffer = ""; let presetCapacityAh: number | undefined;
    const consume = (view: DataView) => {
      const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      if (bytes.includes(0x3a) || textBuffer) {
        textBuffer += new TextDecoder().decode(bytes);
        const lines = textBuffer.split(/\r?\n/); textBuffer = lines.pop() ?? "";
        for (const line of lines) {
          presetCapacityAh = parseJunctekR51Capacity(line) ?? presetCapacityAh;
          const metrics = parseJunctekR50(line, presetCapacityAh) ?? parseJunctekKmLive(line); if (metrics) onReading(metrics);
        }
      }
      buffered.push(...bytes);
      while (buffered.includes(0xbb) && buffered.includes(0xee)) { const start = buffered.indexOf(0xbb); const end = buffered.indexOf(0xee, start); if (end < 0) break; const metrics = junctekMetrics(decodeJunctekFrame(Uint8Array.from(buffered.slice(start, end + 1)))); buffered = buffered.slice(end + 1); if (metrics) onReading(metrics); }
    };
    notify.addEventListener("characteristicvaluechanged", (event) => {
      const view = (event.target as BluetoothRemoteGATTCharacteristic).value; if (view) consume(view);
    });
    await notify.startNotifications();
    if (notify.properties.read) { try { consume(await notify.readValue()); } catch { /* Some firmware advertises read but only emits notifications. */ } }
    let pollId: ReturnType<typeof setInterval> | undefined;
    if (writer && selectedService === km140fServiceUuid) {
      const requestReading = () => void writer.writeValue(new TextEncoder().encode(":R50=1,2,1,\r\n")).catch(() => undefined);
      void writer.writeValue(new TextEncoder().encode(":R51=1,2,1,\r\n")).catch(() => undefined);
      setTimeout(requestReading, 150); pollId = setInterval(requestReading, 2_500);
    } else if (writer) {
      setTimeout(() => { void writer.writeValue(Uint8Array.from([0xbb, 0x9a, 0xa9, 0x0c, 0xee])).catch(() => undefined); }, 250);
    }
    return { deviceId: device.id, displayName: device.name || "Junctek monitor", disconnect: () => { if (pollId) clearInterval(pollId); server.disconnect(); } };
  },
};
