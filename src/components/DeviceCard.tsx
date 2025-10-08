import React from 'react';
import { useDeviceConnection } from '../hooks/useDeviceConnection';

export interface DeviceInfo {
  uuid: string;
  hostname: string;
  url: string;
  token: string;
  enabled?: boolean;
}

interface DeviceCardProps {
  deviceInfo: DeviceInfo;
  onDelete?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
}

/**
 * 设备卡片组件
 * 显示单个安卓设备的信息、连接状态和操作按钮
 *
 * @example
 * ```tsx
 * <DeviceCard
 *   deviceInfo={{
 *     uuid: 'android-xxx',
 *     hostname: 'Pixel 6',
 *     url: 'ws://192.168.1.101:6001',
 *     token: 'abc123',
 *   }}
 *   onDelete={() => console.log('Delete clicked')}
 * />
 * ```
 */
export function DeviceCard({ deviceInfo, onDelete, onToggleEnabled }: DeviceCardProps) {
  console.log('[DeviceCard] ===== Component rendering =====');
  console.log('[DeviceCard] Device UUID:', deviceInfo.uuid);
  console.log('[DeviceCard] Device hostname:', deviceInfo.hostname);
  console.log('[DeviceCard] Device URL:', deviceInfo.url);
  console.log('[DeviceCard] Device enabled:', deviceInfo.enabled);
  console.log('[DeviceCard] Will auto-connect:', deviceInfo.enabled !== false);

  const { connected, error, connect, disconnect } = useDeviceConnection({
    url: deviceInfo.url,
    token: deviceInfo.token,
    autoConnect: deviceInfo.enabled !== false,
  });

  console.log('[DeviceCard] After useDeviceConnection - connected:', connected);
  console.log('[DeviceCard] After useDeviceConnection - error:', error);

  const handleConnect = async () => {
    try {
      await connect();
      if (onToggleEnabled) {
        onToggleEnabled(true);
      }
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    if (onToggleEnabled) {
      onToggleEnabled(false);
    }
  };

  return (
    <div className="device-card" style={styles.card}>
      {/* 设备头部 */}
      <div className="device-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.hostname}>{deviceInfo.hostname}</h3>
          <span style={styles.uuid}>{deviceInfo.uuid}</span>
        </div>
        <div style={styles.headerRight}>
          <span
            className={`status ${connected ? 'connected' : 'disconnected'}`}
            style={{
              ...styles.status,
              ...(connected ? styles.statusConnected : styles.statusDisconnected),
            }}
          >
            {connected ? '● 已连接' : '○ 未连接'}
          </span>
        </div>
      </div>

      {/* 设备信息 */}
      <div className="device-info" style={styles.info}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>地址:</span>
          <span style={styles.infoValue}>{deviceInfo.url}</span>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="error" style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="device-actions" style={styles.actions}>
        {connected ? (
          <button onClick={handleDisconnect} style={styles.buttonSecondary}>
            断开连接
          </button>
        ) : (
          <button onClick={handleConnect} style={styles.buttonPrimary}>
            连接
          </button>
        )}
        <button onClick={onDelete} style={styles.buttonDanger}>
          删除设备
        </button>
      </div>

      {/* TODO: 添加通知列表 */}
      {/* {connected && <NotificationList deviceUuid={deviceInfo.uuid} />} */}
    </div>
  );
}

// 简单的内联样式（后续可以改为 CSS 模块或 Tailwind）
const styles: Record<string, React.CSSProperties> = {
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginLeft: '12px',
  },
  hostname: {
    margin: '0 0 4px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  uuid: {
    fontSize: '12px',
    color: '#666',
    fontFamily: 'monospace',
  },
  status: {
    fontSize: '14px',
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: '12px',
  },
  statusConnected: {
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  statusDisconnected: {
    color: '#757575',
    backgroundColor: '#f5f5f5',
  },
  info: {
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  infoItem: {
    display: 'flex',
    fontSize: '14px',
    marginBottom: '4px',
  },
  infoLabel: {
    fontWeight: 500,
    marginRight: '8px',
    color: '#666',
  },
  infoValue: {
    fontFamily: 'monospace',
    color: '#333',
  },
  error: {
    padding: '8px 12px',
    marginBottom: '12px',
    backgroundColor: '#fff3e0',
    color: '#e65100',
    borderRadius: '4px',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  buttonPrimary: {
    padding: '8px 16px',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  buttonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#757575',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  buttonDanger: {
    padding: '8px 16px',
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
};
