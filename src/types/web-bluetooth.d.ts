interface BluetoothRemoteGATTCharacteristic extends EventTarget { value?: DataView; startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>; writeValue(value: BufferSource): Promise<void>; }
interface BluetoothRemoteGATTService { getCharacteristic(characteristic: BluetoothServiceUUID): Promise<BluetoothRemoteGATTCharacteristic>; }
interface BluetoothRemoteGATTServer { connected: boolean; connect(): Promise<BluetoothRemoteGATTServer>; disconnect(): void; getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>; }
interface BluetoothDevice { id: string; name?: string; gatt?: BluetoothRemoteGATTServer; }
interface Bluetooth { requestDevice(options: { filters?: Array<{ namePrefix?: string; services?: BluetoothServiceUUID[] }>; optionalServices?: BluetoothServiceUUID[]; acceptAllDevices?: boolean }): Promise<BluetoothDevice>; }
interface Navigator { bluetooth?: Bluetooth; }
