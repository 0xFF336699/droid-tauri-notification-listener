import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import i18n from './i18n';

// 日志工具函数
const log = {
  debug: (message: string, data?: any) => {
    console.log(`[SocketConnection] ${message}`, data || '');
  },
  info: (message: string, data?: any) => {
    console.info(`[SocketConnection] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[SocketConnection] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[SocketConnection] ${message}`, error || '');
  }
};

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
  log.debug('Initializing useSocketConnection hook');
  
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => {
    const initialState = {
      status: 'disconnected' as const,
      config: null,
      error: null
    };
    log.debug('Initial state set', { initialState });
    return initialState;
  });

  const [showSettings, setShowSettings] = useState(() => {
    const initialShowSettings = false;
    log.debug('Initial showSettings', { showSettings: initialShowSettings });
    return initialShowSettings;
  });

  // 加载保存的配置
  const loadConfig = useCallback(async () => {
    log.info('Loading configuration from localStorage');
    try {
      // 从本地存储加载配置
      const savedHost = localStorage.getItem('socket_host') || '';
      const savedToken = localStorage.getItem('socket_token') || '';
      log.debug('Loaded config from localStorage', { savedHost, hasToken: !!savedToken });

      const savedConfig: SocketConfig = {
        host: savedHost,
        token: savedToken || undefined
      };

      log.debug('Updating connection state with loaded config');
      setConnectionState(prev => {
        const newState = {
          ...prev,
          config: savedConfig
        };
        log.debug('Connection state updated', { newState });
        return newState;
      });

      log.info('Configuration loaded successfully');
      return savedConfig;
    } catch (error) {
      log.error('Failed to load configuration', error);
      return null;
    }
  }, []);

  // 保存配置到本地存储
  const saveConfig = useCallback(async (config: SocketConfig) => {
    log.info('Saving configuration to localStorage', { host: config.host, hasToken: !!config.token });
    try {
      localStorage.setItem('socket_host', config.host);
      if (config.token) {
        localStorage.setItem('socket_token', config.token);
        log.debug('Saved token to localStorage');
      } else {
        localStorage.removeItem('socket_token');
        log.debug('Removed token from localStorage');
      }
      log.info('Configuration saved successfully');
    } catch (error) {
      log.error('Failed to save configuration', error);
    }
  }, []);

  // 连接到服务器
  const connect = useCallback(async (config: SocketConfig) => {
    log.info('Initiating connection', { host: config.host });
    setConnectionState(prev => {
      const newState = {
        ...prev,
        status: 'connecting' as const,
        error: null
      };
      log.debug('Connection state updated to connecting', { newState });
      return newState;
    });

    try {
      log.debug('Calling backend to connect to server');
      const success = await invoke<boolean>('connect_to_server', {
        host: config.host,
        token: config.token
      });

      if (success) {
        log.info('Backend connection successful, saving configuration');
        await saveConfig(config);

        setConnectionState(prev => {
          const newState = {
            ...prev,
            status: 'connected' as const,
            config
          };
          log.info('Connection established successfully', { newState });
          return newState;
        });
        return true;
      } else {
        const errorMsg = i18n.t('connection.backendConnectionFailed', '后端连接失败');
        log.warn(errorMsg);
        setConnectionState(prev => {
          const newState = {
            ...prev,
            status: 'error' as const,
            error: i18n.t('connection.connectionFailed')
          };
          log.warn('Connection failed', { newState });
          return newState;
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : i18n.t('connection.unknownConnectionError', '未知连接错误');
      log.error('Connection error occurred', { error: errorMessage });
      setConnectionState(prev => {
        const newState = {
          ...prev,
          status: 'error' as const,
          error: errorMessage
        };
        log.error('Connection error state', { newState });
        return newState;
      });
      return false;
    }
  }, [saveConfig]);

  // 检查连接状态
  const checkConnection = useCallback(async () => {
    log.debug('Checking connection status');
    const config = await loadConfig();

    if (config && config.host) {
      log.info('Found saved configuration', { host: config.host, hasToken: !!config.token });
      
      if (config.token) {
        // 有token，直接连接
        log.debug('Found token, attempting to connect automatically');
        return await connect(config);
      } else {
        // 只有socket地址，请求访问
        log.info('No token found, showing settings');
        setShowSettings(true);
        return false;
      }
    } else {
      // 没有配置，显示设置页面
      log.info('No saved configuration found, showing settings');
      setShowSettings(true);
      return false;
    }
  }, [loadConfig, connect]);

  // 断开连接
  const disconnect = useCallback(async () => {
    log.info('Disconnecting from server');
    try {
      await invoke('disconnect_server');
      log.debug('Backend disconnect successful');
      setConnectionState(prev => {
        const newState = {
          ...prev,
          status: 'disconnected' as const,
          config: null
        };
        log.info('Disconnected successfully', { newState });
        return newState;
      });
    } catch (error) {
      log.error('Failed to disconnect', error);
    }
  }, []);

  // 初始化时检查连接状态
  useEffect(() => {
    log.debug('useEffect: Initial connection check');
    checkConnection().then(result => {
      log.debug('Initial connection check completed', { success: result });
    });
  }, [checkConnection]);

  const api = {
    connectionState,
    showSettings,
    setShowSettings: (value: boolean) => {
      log.debug('setShowSettings called', { value });
      setShowSettings(value);
    },
    connect: async (config: SocketConfig) => {
      log.debug('connect API method called', { host: config.host });
      return connect(config);
    },
    disconnect: async () => {
      log.debug('disconnect API method called');
      return disconnect();
    },
    saveConfig: async (config: SocketConfig) => {
      log.debug('saveConfig API method called', { host: config.host });
      return saveConfig(config);
    },
    loadConfig: async () => {
      log.debug('loadConfig API method called');
      return loadConfig();
    }
  };

  log.debug('Rendering useSocketConnection hook with state', { 
    connectionState,
    showSettings 
  });

  return api;
};
