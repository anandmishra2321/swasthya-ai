import { api } from './api';

export interface BleHeartRateData {
  bpm: number;
  rrIntervals?: number[];
  sensorContact?: boolean;
  energyExpended?: number;
  deviceName?: string;
  measuredAt: string;
}

export type HeartRateCallback = (data: BleHeartRateData) => void;
export type StatusCallback = (status: 'disconnected' | 'connecting' | 'connected' | 'error', message?: string) => void;

class WebBluetoothHeartRateManager {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  private onHeartRateCallback: HeartRateCallback | null = null;
  private onStatusCallback: StatusCallback | null = null;
  private isConnecting: boolean = false;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async connect(
    onHeartRate: HeartRateCallback,
    onStatus: StatusCallback
  ): Promise<boolean> {
    this.onHeartRateCallback = onHeartRate;
    this.onStatusCallback = onStatus;

    if (!this.isSupported()) {
      onStatus(
        'error',
        'Web Bluetooth is not supported in this browser. Please use Google Chrome, Microsoft Edge, or a Web-Bluetooth enabled browser over HTTPS.'
      );
      return false;
    }

    try {
      this.isConnecting = true;
      onStatus('connecting', 'Requesting Bluetooth device pairing dialog...');

      // Request Bluetooth device. Use acceptAllDevices for broader compatibility;
      // many wearables do not advertise the heart_rate service in their filter.
      const nav: any = navigator;
      this.device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['heart_rate', 'battery_service', 'device_information'],
      });

      if (!this.device) {
        onStatus('disconnected', 'Device pairing cancelled by user.');
        return false;
      }

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnected.bind(this));

      onStatus('connecting', `Connecting to GATT server on ${this.device.name || 'BLE Device'}...`);
      this.server = await this.device.gatt.connect();

      onStatus('connecting', 'Locating Heart Rate GATT service (0x180D)...');
      const service = await this.server.getPrimaryService('heart_rate');

      onStatus('connecting', 'Subscribing to Heart Rate Measurement characteristic (0x2A37)...');
      this.characteristic = await service.getCharacteristic('heart_rate_measurement');

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleCharacteristicValueChanged.bind(this)
      );

      this.isConnecting = false;
      onStatus('connected', `Streaming real-time heart rate from ${this.device.name || 'BLE Sensor'}`);
      return true;
    } catch (err: any) {
      this.isConnecting = false;
      console.error('BLE connection error:', err);
      onStatus('error', err.message || 'Failed to connect to Bluetooth Low Energy heart rate sensor.');
      return false;
    }
  }

  private handleCharacteristicValueChanged(event: any) {
    const value: DataView = event.target.value;
    if (!value || value.byteLength === 0) return;

    // Parse Bluetooth SIG Heart Rate Measurement GATT Specification
    // Flags at Byte 0
    const flags = value.getUint8(0);
    const is16BitFormat = (flags & 0x01) !== 0;
    const contactSensorBits = (flags >> 1) & 0x03;
    const contactDetected = contactSensorBits === 3;
    const hasEnergyExpended = (flags & 0x08) !== 0;
    const hasRrIntervals = (flags & 0x10) !== 0;

    let offset = 1;
    let bpm = 0;

    if (is16BitFormat) {
      bpm = value.getUint16(offset, /* littleEndian */ true);
      offset += 2;
    } else {
      bpm = value.getUint8(offset);
      offset += 1;
    }

    let energyExpended: number | undefined;
    if (hasEnergyExpended && offset + 2 <= value.byteLength) {
      energyExpended = value.getUint16(offset, true);
      offset += 2;
    }

    const rrIntervals: number[] = [];
    if (hasRrIntervals) {
      while (offset + 2 <= value.byteLength) {
        const rrRaw = value.getUint16(offset, true);
        // RR-Interval value in 1/1024 seconds, convert to milliseconds
        const rrMs = Math.round((rrRaw / 1024) * 1000);
        rrIntervals.push(rrMs);
        offset += 2;
      }
    }

    const readingData: BleHeartRateData = {
      bpm,
      rrIntervals: rrIntervals.length > 0 ? rrIntervals : undefined,
      sensorContact: contactSensorBits === 0 ? undefined : contactDetected,
      energyExpended,
      deviceName: this.device?.name || 'Bluetooth Heart Rate Sensor',
      measuredAt: new Date().toISOString(),
    };

    if (this.onHeartRateCallback) {
      this.onHeartRateCallback(readingData);
    }

    // Direct Real-time Ingestion to backend API!
    api.post('/wearables/ble-ingest', {
      bpm,
      rrIntervals: readingData.rrIntervals,
      sensorContact: readingData.sensorContact,
      energyExpended: readingData.energyExpended,
      deviceName: readingData.deviceName,
      measuredAt: readingData.measuredAt,
    }).catch((err) => {
      console.warn('Backend BLE ingest sync warning:', err.message);
    });
  }

  private handleDisconnected() {
    if (this.onStatusCallback) {
      this.onStatusCallback('disconnected', 'Device disconnected');
    }
    this.cleanUp();
  }

  public disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.cleanUp();
    if (this.onStatusCallback) {
      this.onStatusCallback('disconnected', 'Disconnected from sensor');
    }
  }

  private cleanUp() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnecting = false;
  }
}

export const webBluetoothHR = new WebBluetoothHeartRateManager();
