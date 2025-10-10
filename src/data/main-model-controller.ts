

import { toProxy, proxyWatch, watchUpdates } from 'fanfanlo-deep-watcher';
import { AndroidDeviceInfo } from '../types/deviceStorage';
import { AndroidWebSocketClient } from '../services/AndroidWebSocketClient';
import { Notification } from '../types/notification';
import {
  loadDevices,
  saveDevice,
  deleteDevice,
  clearAllDevices as clearStorage
} from '../utils/deviceStorage';
import { filterNotifications, isVisibleNotification } from '../utils/notificationFilter';

export enum ConnectionState {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Connecting = 'connecting',
}

export interface DeviceConnection {
  device: AndroidDeviceInfo;
  state: ConnectionState;
  notifications: Notification[];
  errorMessage?: string;
}

export interface AppData {
  allDevices: DeviceConnection[];      // 全部设备
  enabledDevices: DeviceConnection[];  // 启用的设备（自动筛选）
}

// ========== WebSocket 客户端管理（在 toProxy 之外） ==========
const clientMap = new Map<string, AndroidWebSocketClient>();

// 加载已保存的设备并转换为 DeviceConnection
const savedDevices = loadDevices();
const initialDevices: DeviceConnection[] = savedDevices.map(device => ({
  device,
  state: ConnectionState.Disconnected,
  notifications: [],
}));

const data: AppData = toProxy({
  allDevices: initialDevices,
  enabledDevices: [],
});

// 监听 allDevices 变化，自动更新 enabledDevices
proxyWatch(data, 'allDevices', () => {
  onAllDevicesUpdate();
});

watchUpdates(data.allDevices, () =>{
  onAllDevicesUpdate();
})

function onAllDevicesUpdate(){
  data.enabledDevices = data.allDevices.filter(conn => conn.device.enabled !== false);
}

function updateDeviceEnabled(){
  onAllDevicesUpdate();
}

// ========== 设备管理方法 ==========

/**
 * 添加设备
 */
function addDevice(device: AndroidDeviceInfo) {
  console.log('[mainModelController] addDevice:', device.uuid);

  // 检查是否已存在
  const exists = data.allDevices.find(conn => conn.device.uuid === device.uuid);
  if (exists) {
    console.warn('[mainModelController] Device already exists:', device.uuid);
    return;
  }

  // 创建连接对象
  const connection: DeviceConnection = {
    device,
    state: ConnectionState.Disconnected,
    notifications: [],
  };

  // 添加到列表
  data.allDevices.push(connection);

  // 保存到 LocalStorage
  saveDevice(device);

  console.log('[mainModelController] Device added:', device.uuid);
}

/**
 * 删除设备
 */
function removeDevice(uuid: string) {
  console.log('[mainModelController] removeDevice:', uuid);

  // 查找设备
  const index = data.allDevices.findIndex(conn => conn.device.uuid === uuid);
  if (index === -1) {
    console.warn('[mainModelController] Device not found:', uuid);
    return;
  }

  // 先断开连接并删除 client
  const client = clientMap.get(uuid);
  if (client) {
    client.disconnect();
    clientMap.delete(uuid);
  }

  // 从列表删除
  data.allDevices.splice(index, 1);

  // 从 LocalStorage 删除
  deleteDevice(uuid);

  console.log('[mainModelController] Device removed:', uuid);
}

/**
 * 清空所有设备
 */
function clearAllDevices() {
  console.log('[mainModelController] clearAllDevices');

  // 断开所有连接并清空 clientMap
  data.allDevices.forEach(conn => {
    const client = clientMap.get(conn.device.uuid);
    if (client) {
      client.disconnect();
    }
  });
  clientMap.clear();

  // 清空列表
  data.allDevices.length = 0;

  // 清空 LocalStorage
  clearStorage();

  console.log('[mainModelController] All devices cleared');
}

/**
 * 连接到设备
 */
function connectDevice(uuid: string) {
  console.log('[mainModelController] connectDevice:', uuid);

  // 查找设备
  const connection = data.allDevices.find(conn => conn.device.uuid === uuid);
  if (!connection) {
    console.warn('[mainModelController] Device not found:', uuid);
    return;
  }

  // 如果已连接，先断开
  const existingClient = clientMap.get(uuid);
  if (existingClient) {
    existingClient.disconnect();
  }

  // 更新状态为连接中
  connection.state = ConnectionState.Connecting;

  // 创建 WebSocket 客户端
  const client = new AndroidWebSocketClient(connection.device.url);

  // 设置回调
  client.onConnectionChange(async (connected) => {
    console.log('[mainModelController] Connection state changed:', uuid, connected);

    if (connected) {
      // 连接成功，尝试登录
      console.log('[mainModelController] Connection established, attempting login...');

      try {
        // 获取 token
        const token = connection.device.token;
        if (!token) {
          console.error('[mainModelController] No token available for device:', uuid);
          connection.errorMessage = '登录失败: 缺少授权 token';
          connection.state = ConnectionState.Disconnected;
          client.disconnect();
          return;
        }

        console.log('[mainModelController] Logging in with token...');
        await client.login(token);

        console.log('[mainModelController] Login successful for device:', uuid);
        connection.state = ConnectionState.Connected;
        connection.errorMessage = undefined;

      } catch (error) {
        console.error('[mainModelController] Login failed:', error);
        connection.errorMessage = `登录失败: ${error}`;
        connection.state = ConnectionState.Disconnected;
        // 登录失败，断开连接
        client.disconnect();
      }
    } else {
      // 连接断开
      connection.state = ConnectionState.Disconnected;
    }
  });

  client.onError((error) => {
    console.error('[mainModelController] WebSocket error:', uuid, error);
    connection.state = ConnectionState.Disconnected;
    connection.errorMessage = error;
  });

  client.onMessage((message) => {
    console.log('[mainModelController] WebSocket message:', uuid, message);

    // 处理初始通知列表（连接成功后同步）
    if (message.type === 'initial' && Array.isArray(message.data)) {
      console.log('[mainModelController] Received initial notifications:', message.data.length);

      // 过滤通知列表
      const filteredNotifications = filterNotifications(message.data);

      // 替换整个通知列表
      connection.notifications = filteredNotifications;
      console.log('[mainModelController] Synced', filteredNotifications.length, 'notifications (filtered from', message.data.length, ') for device:', uuid);
      return;
    }

    // 处理单条新通知（实时推送）
    if (message.type === 'notification' && message.notification) {
      console.log('[mainModelController] Received new notification:', message.notification.id);

      // 过滤通知
      if (isVisibleNotification(message.notification)) {
        connection.notifications.push(message.notification);
        console.log('[mainModelController] Added notification, total:', connection.notifications.length);
      } else {
        console.log('[mainModelController] Notification filtered out:', message.notification.id);
      }
      return;
    }

    // 其他消息类型
    console.log('[mainModelController] Unknown message type:', message.type);
  });

  // 保存客户端到 Map
  clientMap.set(uuid, client);

  // 连接
  client.connect();

  console.log('[mainModelController] Connecting to device:', uuid);
}

/**
 * 断开设备连接
 */
function disconnectDevice(uuid: string) {
  console.log('[mainModelController] disconnectDevice:', uuid);

  // 查找设备
  const connection = data.allDevices.find(conn => conn.device.uuid === uuid);
  if (!connection) {
    console.warn('[mainModelController] Device not found:', uuid);
    return;
  }

  // 断开连接并删除 client
  const client = clientMap.get(uuid);
  if (client) {
    client.disconnect();
    clientMap.delete(uuid);
  }

  // 更新状态
  connection.state = ConnectionState.Disconnected;

  console.log('[mainModelController] Device disconnected:', uuid);
}

// ========== 自动连接启用的设备 ==========

/**
 * 初始化时自动连接所有启用的设备
 */
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

// 延迟执行，确保 enabledDevices 已通过 watcher 更新
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
};
