interface BluetoothCharacteristicProperties { read: boolean; notify: boolean; indicate: boolean; write: boolean; writeWithoutResponse: boolean; }
interface BluetoothRemoteGATTCharacteristic extends EventTarget { uuid: string; properties: BluetoothCharacteristicProperties; value?: DataView; readValue(): Promise<DataView>; startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>; writeValue(value: BufferSource): Promise<void>; }
interface BluetoothRemoteGATTService { uuid: string; getCharacteristic(characteristic: BluetoothServiceUUID): Promise<BluetoothRemoteGATTCharacteristic>; getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>; }
interface BluetoothRemoteGATTServer { connected: boolean; connect(): Promise<BluetoothRemoteGATTServer>; disconnect(): void; getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>; }
interface BluetoothDevice { id: string; name?: string; gatt?: BluetoothRemoteGATTServer; }
interface Bluetooth { requestDevice(options: { filters?: Array<{ namePrefix?: string; services?: BluetoothServiceUUID[] }>; optionalServices?: BluetoothServiceUUID[]; acceptAllDevices?: boolean }): Promise<BluetoothDevice>; }
interface Navigator { bluetooth?: Bluetooth; }
