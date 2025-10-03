import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface SocketConfig {
  host: string;
  token?: string;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  config: SocketConfig | null;
  error: string | null;
}

export const useSocketConnection = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    config: null,
    error: null
  });

  const [showSettings, setShowSettings] = useState(false);

  // 加载保存的配置
  const loadConfig = useCallback(async () => {
    try {
      // 从本地存储加载配置
      const savedHost = localStorage.getItem('socket_host') || '';
      const savedToken = localStorage.getItem('socket_token') || '';

      const savedConfig: SocketConfig = {
        host: savedHost,
        token: savedToken || undefined
      };

      setConnectionState(prev => ({
        ...prev,
        config: savedConfig
      }));

      return savedConfig;
    } catch (error) {
      console.error('加载配置失败:', error);
      return null;
    }
  }, []);

  // 保存配置到本地存储
  const saveConfig = useCallback(async (config: SocketConfig) => {
    try {
      localStorage.setItem('socket_host', config.host);
      if (config.token) {
        localStorage.setItem('socket_token', config.token);
      } else {
        localStorage.removeItem('socket_token');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }, []);

  // 连接到服务器
  const connect = useCallback(async (config: SocketConfig) => {
    setConnectionState(prev => ({
      ...prev,
      status: 'connecting',
      error: null
    }));

    try {
      // 调用后端连接函数
      const success = await invoke<boolean>('connect_to_server', {
        host: config.host,
        token: config.token
      });

      if (success) {
        // 保存配置
        await saveConfig(config);

        setConnectionState(prev => ({
          ...prev,
          status: 'connected',
          config
        }));
        return true;
      } else {
        setConnectionState(prev => ({
          ...prev,
          status: 'error',
          error: '连接失败'
        }));
        return false;
      }
    } catch (error) {
      console.error('连接出错:', error);
      setConnectionState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : '连接出错'
      }));
      return false;
    }
  }, [saveConfig]);

  // 检查连接状态
  const checkConnection = useCallback(async () => {
    const config = await loadConfig();

    if (config && config.host) {
      // 有保存的配置，尝试连接
      if (config.token) {
        // 有token，直接连接
        return await connect(config);
      } else {
        // 只有socket地址，请求访问
        setShowSettings(true);
        return false;
      }
    } else {
      // 没有配置，显示设置页面
      setShowSettings(true);
      return false;
    }
  }, [loadConfig, connect]);

  // 断开连接
  const disconnect = useCallback(async () => {
    try {
      await invoke('disconnect_server');
      setConnectionState(prev => ({
        ...prev,
        status: 'disconnected',
        config: null
      }));
    } catch (error) {
      console.error('断开连接失败:', error);
    }
  }, []);

  // 初始化时检查连接状态
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    connectionState,
    showSettings,
    setShowSettings,
    connect,
    disconnect,
    saveConfig,
    loadConfig
  };
};
