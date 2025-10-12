import { AndroidWebSocketClient } from '../services/AndroidWebSocketClient';
import { DeviceConnection, ConnectionState } from './main-model-controller';
import { handleWebSocketMessage } from './notification-message-handler';

// WebSocket 客户端管理
const clientMap = new Map<string, AndroidWebSocketClient>();


export function getClientByUuid(uuid: string): AndroidWebSocketClient | undefined {
  return clientMap.get(uuid);
}

export function removeClientByUuid(uuid: string) {
  clientMap.delete(uuid);
}
/**
 * 连接到设备
 */
export function connectDevice(connection: DeviceConnection, uuid: string) {
  console.log('[DeviceConnectionHandler] connectDevice:', uuid);

  // 如果已连接,先断开
  const existingClient = clientMap.get(uuid);
  if (existingClient) {
    existingClient.disconnect();
  }

  // 更新状态为连接中
  connection.state = ConnectionState.Connecting;

  // 创建 WebSocket 客户端
  const client = new AndroidWebSocketClient(connection, connection.device.url);

  // 设置连接状态回调
  client.onConnectionChange(async (connected) => {
    await handleConnectionChange(connected, connection, client, uuid);
  });

  // 设置错误回调
  client.onError((error) => {
    handleConnectionError(error, connection, uuid);
  });

  // 设置消息回调
  client.onMessage((message) => {
    handleWebSocketMessage(message, connection, uuid);
  });

  // 保存客户端到 Map
  clientMap.set(uuid, client);

  // 连接
  // client.connect();

  console.log('[DeviceConnectionHandler] Connecting to device:', uuid);
}

/**
 * 手动重连设备
 */
export async function manualReconnectDevice(connection: DeviceConnection, uuid: string) {
  console.log('[DeviceConnectionHandler] manualReconnectDevice:', uuid);

  const client = clientMap.get(uuid);
  if (!client) {
    console.log('[DeviceConnectionHandler] No existing client, creating new connection');
    connectDevice(connection, uuid);
    return;
  }

  // 更新状态为连接中
  connection.state = ConnectionState.Connecting;
  connection.errorMessage = undefined;

  try {
    console.log('[DeviceConnectionHandler] Calling client.manualReconnect()');
    await client.manualReconnect();

    // 登录
    const token = connection.device.token;
    if (!token) {
      console.error('[DeviceConnectionHandler] No token available for device:', uuid);
      connection.errorMessage = '登录失败: 缺少授权 token';
      connection.state = ConnectionState.Disconnected;
      return;
    }

    console.log('[DeviceConnectionHandler] Logging in after manual reconnect...');
    await client.login(token);

    console.log('[DeviceConnectionHandler] Manual reconnect successful for device:', uuid);
    connection.state = ConnectionState.Connected;
    connection.errorMessage = undefined;

  } catch (error) {
    console.error('[DeviceConnectionHandler] Manual reconnect failed:', error);
    connection.errorMessage = `重连失败: ${error}`;
    connection.state = ConnectionState.Disconnected;
  }
}

/**
 * 断开设备连接
 */
export function disconnectDevice(uuid: string, connection: DeviceConnection) {
  console.log('[DeviceConnectionHandler] disconnectDevice:', uuid);

  // 断开连接并删除 client
  const client = clientMap.get(uuid);
  if (client) {
    client.disconnect();
    clientMap.delete(uuid);
  }

  // 更新状态
  connection.state = ConnectionState.Disconnected;

  console.log('[DeviceConnectionHandler] Device disconnected:', uuid);
}

/**
 * 清理所有客户端连接
 */
export function disconnectAllDevices(connections: DeviceConnection[]) {
  console.log('[DeviceConnectionHandler] Disconnecting all devices');

  connections.forEach(conn => {
    const client = clientMap.get(conn.device.uuid);
    if (client) {
      client.disconnect();
    }
  });

  clientMap.clear();
  console.log('[DeviceConnectionHandler] All devices disconnected');
}

// ========== 内部辅助函数 ==========

/**
 * 处理连接状态变化
 */
async function handleConnectionChange(
  connected: boolean,
  connection: DeviceConnection,
  client: AndroidWebSocketClient,
  uuid: string
) {
  console.log('[DeviceConnectionHandler] Connection state changed:', uuid, connected);

  if (connected) {
    // 连接成功,尝试登录
    console.log('[DeviceConnectionHandler] Connection established, attempting login...');

    try {
      // 获取 token
      const token = connection.device.token;
      if (!token) {
        console.error('[DeviceConnectionHandler] No token available for device:', uuid);
        connection.errorMessage = '登录失败: 缺少授权 token';
        connection.state = ConnectionState.Disconnected;
        client.disconnect();
        return;
      }

      console.log('[DeviceConnectionHandler] Logging in with token...');
      await client.login(token);

      console.log('[DeviceConnectionHandler] Login successful for device:', uuid);
      connection.state = ConnectionState.Connected;
      connection.errorMessage = undefined;

    } catch (error) {
      console.error('[DeviceConnectionHandler] Login failed:', error);
      connection.errorMessage = `登录失败: ${error}`;
      connection.state = ConnectionState.Disconnected;
      client.disconnect();
    }
  } else {
    // 连接断开
    connection.state = ConnectionState.Disconnected;
  }
}

/**
 * 处理连接错误
 */
function handleConnectionError(error: string, connection: DeviceConnection, uuid: string) {
  console.error('[DeviceConnectionHandler] WebSocket error:', uuid, error);
  connection.state = ConnectionState.Disconnected;
  connection.errorMessage = error;
}
