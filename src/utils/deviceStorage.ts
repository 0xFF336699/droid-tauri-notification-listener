import { AndroidDeviceInfo, DeviceStorage } from '../types/deviceStorage';

const STORAGE_KEY = 'android_devices';

/**
 * 从 LocalStorage 加载所有设备
 */
export function loadDevices(): AndroidDeviceInfo[] {
  console.log('[deviceStorage.loadDevices] Start loading devices');
  try {
    console.log('[deviceStorage.loadDevices] Getting data from localStorage with key:', STORAGE_KEY);
    const data = localStorage.getItem(STORAGE_KEY);
    console.log('[deviceStorage.loadDevices] Retrieved data:', data ? `${data.length} chars` : 'null');

    if (!data) {
      console.log('[deviceStorage.loadDevices] No data found, returning empty array');
      return [];
    }

    console.log('[deviceStorage.loadDevices] Parsing JSON data');
    const storage: DeviceStorage = JSON.parse(data);
    console.log('[deviceStorage.loadDevices] Parsed storage:', storage);

    const devices = storage.devices || [];
    console.log('[deviceStorage.loadDevices] Returning', devices.length, 'devices');
    return devices;
  } catch (error) {
    console.error('[deviceStorage.loadDevices] Failed to load devices:', error);
    return [];
  }
}

/**
 * 保存设备到 LocalStorage
 * 如果设备已存在（相同 uuid），则更新；否则添加
 */
export function saveDevice(device: AndroidDeviceInfo): void {
  console.log('[deviceStorage.saveDevice] Start saving device:', device.uuid);
  try {
    console.log('[deviceStorage.saveDevice] Loading existing devices');
    const devices = loadDevices();
    console.log('[deviceStorage.saveDevice] Current devices count:', devices.length);

    console.log('[deviceStorage.saveDevice] Finding existing device with url:', device.url, 'or uuid:', device.uuid);
    // 优先使用 URL 来查找设备（URL 是唯一的）
    // 如果设备有真实 UUID，也通过 UUID 查找
    const existingIndex = devices.findIndex(d =>
      d.url === device.url ||
      (device.uuid && d.uuid === device.uuid)
    );
    console.log('[deviceStorage.saveDevice] Existing device index:', existingIndex);

    if (existingIndex >= 0) {
      // 更新现有设备
      console.log('[deviceStorage.saveDevice] Updating existing device at index:', existingIndex);
      devices[existingIndex] = {
        ...devices[existingIndex],
        ...device,
        lastUsedAt: Date.now(),
      };
      console.log('[deviceStorage.saveDevice] Updated device:', device.uuid);
    } else {
      // 添加新设备
      console.log('[deviceStorage.saveDevice] Adding new device');
      const newDevice = {
        ...device,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        enabled: true,
      };
      devices.push(newDevice);
      console.log('[deviceStorage.saveDevice] Added new device:', device.uuid, newDevice);
    }

    console.log('[deviceStorage.saveDevice] Preparing to save', devices.length, 'devices');
    const storage: DeviceStorage = { devices };
    const jsonString = JSON.stringify(storage);
    console.log('[deviceStorage.saveDevice] JSON string length:', jsonString.length);

    localStorage.setItem(STORAGE_KEY, jsonString);
    console.log('[deviceStorage.saveDevice] Successfully saved to localStorage');
  } catch (error) {
    console.error('[deviceStorage.saveDevice] Failed to save device:', error);
  }
}

/**
 * 更新设备信息
 */
export function updateDevice(uuid: string, updates: Partial<AndroidDeviceInfo>): void {
  console.log('[deviceStorage.updateDevice] Start updating device:', uuid, 'with updates:', updates);
  try {
    console.log('[deviceStorage.updateDevice] Loading devices');
    const devices = loadDevices();
    console.log('[deviceStorage.updateDevice] Finding device with uuid:', uuid);
    const index = devices.findIndex(d => d.uuid === uuid);
    console.log('[deviceStorage.updateDevice] Device index:', index);

    if (index >= 0) {
      console.log('[deviceStorage.updateDevice] Device found, updating...');
      devices[index] = {
        ...devices[index],
        ...updates,
        lastUsedAt: Date.now(),
      };
      console.log('[deviceStorage.updateDevice] Updated device data:', devices[index]);

      const storage: DeviceStorage = { devices };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
      console.log('[deviceStorage.updateDevice] Successfully updated device:', uuid);
    } else {
      console.warn('[deviceStorage.updateDevice] Device not found:', uuid);
    }
  } catch (error) {
    console.error('[deviceStorage.updateDevice] Failed to update device:', error);
  }
}

/**
 * 删除设备
 */
export function deleteDevice(uuid: string): void {
  console.log('[deviceStorage.deleteDevice] Start deleting device:', uuid);
  try {
    console.log('[deviceStorage.deleteDevice] Loading devices');
    const devices = loadDevices();
    console.log('[deviceStorage.deleteDevice] Current devices count:', devices.length);

    console.log('[deviceStorage.deleteDevice] Filtering out device with uuid:', uuid);
    const filtered = devices.filter(d => d.uuid !== uuid);
    console.log('[deviceStorage.deleteDevice] Devices after filter:', filtered.length);

    const storage: DeviceStorage = { devices: filtered };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    console.log('[deviceStorage.deleteDevice] Successfully deleted device:', uuid);
  } catch (error) {
    console.error('[deviceStorage.deleteDevice] Failed to delete device:', error);
  }
}

/**
 * 获取单个设备
 */
export function getDevice(uuid: string): AndroidDeviceInfo | undefined {
  console.log('[deviceStorage.getDevice] Getting device with uuid:', uuid);
  const devices = loadDevices();
  console.log('[deviceStorage.getDevice] Searching in', devices.length, 'devices');
  const found = devices.find(d => d.uuid === uuid);
  console.log('[deviceStorage.getDevice] Device found:', !!found);
  return found;
}

/**
 * 获取所有启用的设备
 */
export function getEnabledDevices(): AndroidDeviceInfo[] {
  console.log('[deviceStorage.getEnabledDevices] Getting enabled devices');
  const devices = loadDevices();
  console.log('[deviceStorage.getEnabledDevices] Total devices:', devices.length);
  const enabled = devices.filter(d => d.enabled);
  console.log('[deviceStorage.getEnabledDevices] Enabled devices:', enabled.length);
  return enabled;
}

/**
 * 清空所有设备
 */
export function clearAllDevices(): void {
  console.log('[deviceStorage.clearAllDevices] Clearing all devices');
  try {
    console.log('[deviceStorage.clearAllDevices] Removing key from localStorage:', STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    console.log('[deviceStorage.clearAllDevices] Successfully cleared all devices');
  } catch (error) {
    console.error('[deviceStorage.clearAllDevices] Failed to clear devices:', error);
  }
}
