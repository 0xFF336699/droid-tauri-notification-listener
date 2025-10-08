import { useState, useEffect, useRef } from 'react';
import { AndroidWebSocketClient } from '../services/AndroidWebSocketClient';

interface DeviceConnectionProps {
  url: string;
  token: string;
  autoConnect?: boolean;
}

interface UseDeviceConnectionReturn {
  connected: boolean;
  error: string | null;
  client: AndroidWebSocketClient | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook 用于管理单个设备的 WebSocket 连接
 *
 * @param url - WebSocket 服务器地址 (ws://192.168.1.101:6001)
 * @param token - 授权 token
 * @param autoConnect - 是否自动连接（默认 true）
 *
 * @example
 * ```tsx
 * const { connected, error, client } = useDeviceConnection({
 *   url: 'ws://192.168.1.101:6001',
 *   token: 'abc123',
 * });
 * ```
 */
export function useDeviceConnection({
  url,
  token,
  autoConnect = true
}: DeviceConnectionProps): UseDeviceConnectionReturn {
  console.log('[useDeviceConnection] ===== Hook called =====');
  console.log('[useDeviceConnection] URL:', url);
  console.log('[useDeviceConnection] Token length:', token?.length);
  console.log('[useDeviceConnection] Auto connect:', autoConnect);

  const [connected, setConnected] = useState(false);
  console.log('[useDeviceConnection] Initial connected state:', connected);

  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<AndroidWebSocketClient | null>(null);
  const isConnectingRef = useRef(false);

  // 连接函数
  const connect = async () => {
    console.log('[useDeviceConnection.connect] Connect function called');
    console.log('[useDeviceConnection.connect] Client exists:', !!clientRef.current);
    console.log('[useDeviceConnection.connect] Is connecting:', isConnectingRef.current);

    if (!clientRef.current || isConnectingRef.current) {
      console.log('[useDeviceConnection.connect] Skipping connection (client missing or already connecting)');
      return;
    }

    console.log('[useDeviceConnection.connect] Starting connection process...');
    isConnectingRef.current = true;
    setError(null);

    try {
      console.log('[useDeviceConnection.connect] Connecting to:', url);
      await clientRef.current.connect();
      console.log('[useDeviceConnection.connect] WebSocket connected successfully');

      console.log('[useDeviceConnection.connect] Logging in with token...');
      await clientRef.current.login(token);
      console.log('[useDeviceConnection.connect] Login successful');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      console.error('[useDeviceConnection.connect] Connection error:', errorMessage, err);
      setError(errorMessage);
    } finally {
      isConnectingRef.current = false;
      console.log('[useDeviceConnection.connect] Connection process finished');
    }
  };

  // 断开连接函数
  const disconnect = () => {
    console.log('[useDeviceConnection.disconnect] Disconnect function called');
    if (clientRef.current) {
      console.log('[useDeviceConnection.disconnect] Disconnecting client...');
      clientRef.current.disconnect();
      console.log('[useDeviceConnection.disconnect] Client disconnected');
    } else {
      console.log('[useDeviceConnection.disconnect] No client to disconnect');
    }
  };

  useEffect(() => {
    console.log('[useDeviceConnection] ===== useEffect started =====');
    console.log('[useDeviceConnection] Initializing client for:', url);
    console.log('[useDeviceConnection] Token length:', token?.length);
    console.log('[useDeviceConnection] Auto connect:', autoConnect);

    // 创建 WebSocket 客户端
    console.log('[useDeviceConnection] Creating AndroidWebSocketClient...');
    const client = new AndroidWebSocketClient(url, token);
    clientRef.current = client;
    console.log('[useDeviceConnection] Client created');

    // 监听连接状态变化
    console.log('[useDeviceConnection] Setting up connection change listener');
    client.onConnectionChange((isConnected) => {
      console.log('[useDeviceConnection.onConnectionChange] Connection state changed:', isConnected);
      setConnected(isConnected);

      if (!isConnected) {
        console.log('[useDeviceConnection.onConnectionChange] Connection lost, setting error');
        setError('Connection lost');
      } else {
        console.log('[useDeviceConnection.onConnectionChange] Connected, clearing error');
        setError(null);
      }
    });

    // 监听错误
    console.log('[useDeviceConnection] Setting up error listener');
    client.onError((err) => {
      console.error('[useDeviceConnection.onError] Error received:', err);
      setError(err);
    });

    // 自动连接
    if (autoConnect) {
      console.log('[useDeviceConnection] Auto connect is enabled, starting connection...');
      connect();
    } else {
      console.log('[useDeviceConnection] Auto connect is disabled');
    }

    // 清理函数
    return () => {
      console.log('[useDeviceConnection] ===== Cleanup started =====');
      if (clientRef.current) {
        console.log('[useDeviceConnection] Disconnecting and cleaning up client');
        clientRef.current.disconnect();
        clientRef.current = null;
        console.log('[useDeviceConnection] Client cleaned up');
      } else {
        console.log('[useDeviceConnection] No client to clean up');
      }
      console.log('[useDeviceConnection] ===== Cleanup complete =====');
    };
  }, [url, token, autoConnect]);

  return {
    connected,
    error,
    client: clientRef.current,
    connect,
    disconnect,
  };
}
