

import { toProxy, proxyWatch, watchUpdates } from 'fanfanlo-deep-watcher';
import { AndroidDeviceInfo } from '../types/deviceStorage';
import { Notification } from '../types/notification';
import {
  loadDevices,
  saveDevice,
  deleteDevice,
  clearAllDevices as clearStorage
} from '../utils/deviceStorage';
import {
  connectDevice as handleConnect,
  disconnectDevice as handleDisconnect,
  disconnectAllDevices
} from './device-connection-handler';
import { filterNotifications } from '../utils/notificationFilter';
import { filterConfigController } from './notification-filter-config';

export enum ConnectionState {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Connecting = 'connecting',
}

export interface DeviceConnection {
  device: AndroidDeviceInfo;
  state: ConnectionState;
  allNotifications: Notification[];         // 所有通知 (原始数据)
  filteredNotifications: Notification[];    // 过滤后的通知 (用于显示)
  errorMessage?: string;
}

export interface AppData {
  allDevices: DeviceConnection[];
  enabledDevices: DeviceConnection[];
}

const savedDevices = loadDevices();
const initialDevices: DeviceConnection[] = savedDevices.map(device => ({
  device,
  state: ConnectionState.Disconnected,
  allNotifications: [],
  filteredNotifications: [],
}));

const data: AppData = toProxy({
  allDevices: initialDevices,
  enabledDevices: [],
});

// 监听 allDevices 变化,自动更新 enabledDevices
proxyWatch(data, 'allDevices', () => {
  onAllDevicesUpdate();
});

watchUpdates(data.allDevices, () => {
  onAllDevicesUpdate();
});

function onAllDevicesUpdate() {
  data.enabledDevices = data.allDevices.filter(conn => conn.device.enabled !== false);
}

function updateDeviceEnabled() {
  onAllDevicesUpdate();
}

// ========== 过滤相关 ==========

/**
 * 为单个设备重新计算过滤后的通知列表
 */
function recomputeFilteredNotifications(connection: DeviceConnection) {
  connection.filteredNotifications = filterNotifications(connection.allNotifications);
  console.log(
    `[mainModelController] Recomputed filtered notifications: ` +
    `${connection.allNotifications.length} -> ${connection.filteredNotifications.length}`
  );
}

/**
 * 为所有设备重新计算过滤后的通知列表
 * 当用户修改过滤配置时调用
 */
function recomputeAllFilteredNotifications() {
  console.log('[mainModelController] Recomputing all filtered notifications...');
  data.allDevices.forEach(conn => {
    recomputeFilteredNotifications(conn);
  });
}

// 监听每个设备的 allNotifications 变化,自动重新计算过滤
data.allDevices.forEach(conn => {
  proxyWatch(conn, 'allNotifications', () => {
    recomputeFilteredNotifications(conn);
  });
});

// 监听过滤配置变化,自动重新计算所有设备的过滤
// 使用 watchUpdates 监听深层变化 (rules 数组内部元素的属性变化)
watchUpdates(filterConfigController.config.rules, () => {
  console.log('[mainModelController] Filter config changed, recomputing all...');
  recomputeAllFilteredNotifications();
});

// ========== 设备管理方法 ==========

function addDevice(device: AndroidDeviceInfo) {
  console.log('[mainModelController] addDevice:', device.uuid);

  const exists = data.allDevices.find(conn => conn.device.uuid === device.uuid);
  if (exists) {
    console.warn('[mainModelController] Device already exists:', device.uuid);
    return;
  }

  const connection: DeviceConnection = {
    device,
    state: ConnectionState.Disconnected,
    allNotifications: [],
    filteredNotifications: [],
  };

  data.allDevices.push(connection);

  // 为新设备添加 allNotifications 监听
  proxyWatch(connection, 'allNotifications', () => {
    recomputeFilteredNotifications(connection);
  });

  saveDevice(device);
  console.log('[mainModelController] Device added:', device.uuid);
}

function removeDevice(uuid: string) {
  console.log('[mainModelController] removeDevice:', uuid);

  const index = data.allDevices.findIndex(conn => conn.device.uuid === uuid);
  if (index === -1) {
    console.warn('[mainModelController] Device not found:', uuid);
    return;
  }

  const connection = data.allDevices[index];
  handleDisconnect(uuid, connection);
  data.allDevices.splice(index, 1);
  deleteDevice(uuid);

  console.log('[mainModelController] Device removed:', uuid);
}

function clearAllDevices() {
  console.log('[mainModelController] clearAllDevices');
  disconnectAllDevices(data.allDevices);
  data.allDevices.length = 0;
  clearStorage();
  console.log('[mainModelController] All devices cleared');
}

function connectDevice(uuid: string) {
  console.log('[mainModelController] connectDevice:', uuid);

  const connection = data.allDevices.find(conn => conn.device.uuid === uuid);
  if (!connection) {
    console.warn('[mainModelController] Device not found:', uuid);
    return;
  }

  handleConnect(connection, uuid);
}

function disconnectDevice(uuid: string) {
  console.log('[mainModelController] disconnectDevice:', uuid);

  const connection = data.allDevices.find(conn => conn.device.uuid === uuid);
  if (!connection) {
    console.warn('[mainModelController] Device not found:', uuid);
    return;
  }

  handleDisconnect(uuid, connection);
}

// ========== 自动连接启用的设备 ==========

function initAutoConnect() {
  console.log('[mainModelController] initAutoConnect: Checking enabled devices...');
  console.log('[mainModelController] Total devices:', data.allDevices.length);
  console.log('[mainModelController] Enabled devices:', data.enabledDevices.length);

  if (data.enabledDevices.length === 0) {
    console.log('[mainModelController] No enabled devices to connect');
    return;
  }

  data.enabledDevices.forEach(conn => {
    console.log('[mainModelController] Auto-connecting device:', conn.device.uuid, conn.device.hostname);
    connectDevice(conn.device.uuid);
  });

  console.log('[mainModelController] Auto-connect initiated for', data.enabledDevices.length, 'devices');
}

setTimeout(() => {
  console.log('[mainModelController] Running initAutoConnect after delay...');
  initAutoConnect();
}, 100);

export const mainModelController = {
  data,
  updateDeviceEnabled,
  addDevice,
  removeDevice,
  clearAllDevices,
  connectDevice,
  disconnectDevice,
  recomputeAllFilteredNotifications,
};
