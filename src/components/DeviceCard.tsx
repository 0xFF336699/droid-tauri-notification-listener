import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProxyWatch } from 'fanfanlo-deep-watcher';
import { DeviceConnection } from '../data/main-model-controller';
import { mainModelController } from '../data/main-model-controller';
import { NotificationList } from './NotificationList';
import { FilterSettings } from './FilterSettings';
import { manualReconnectDevice, getClientByUuid } from '../data/device-connection-handler';

interface DeviceCardProps {
  connection: DeviceConnection;
}

export function DeviceCard({ connection }: DeviceCardProps) {
  const { t } = useTranslation();
  const [state] = useProxyWatch(connection, 'state', connection.state);
  const [filteredNotifications] = useProxyWatch(
    connection,
    'filteredNotifications',
    connection.filteredNotifications
  );
  const [allNotifications] = useProxyWatch(
    connection,
    'allNotifications',
    connection.allNotifications
  );
  const [errorMessage] = useProxyWatch(
    connection,
    'errorMessage',
    connection.errorMessage
  );

  // 控制过滤器面板的显示/隐藏
  const [showFilterSettings, setShowFilterSettings] = useState(false);

  // 控制地址、过滤器、删除按钮区域的折叠/展开
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="device-card" style={styles.card}>
      <div className="device-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.hostname}>{connection.device.hostname}</h3>
        </div>
        <div style={styles.headerRight}>
          <span
            className={`status ${state}`}
            style={{
              ...styles.status,
              ...(state === 'connected' ? styles.statusConnected : styles.statusDisconnected),
            }}
          >
            {state === 'connected' ? t('connection.connected') : t('connection.disconnected')}
          </span>

          {/* 未连接时显示重连按钮 */}
          {state === 'disconnected' && (
            <button
              onClick={async () => {
                console.log('[DeviceCard] Reconnect button clicked');
                await manualReconnectDevice(connection, connection.device.uuid);
              }}
              style={styles.reconnectButton}
              title={t('common.actions.reconnect')}
            >
              {t('common.actions.reconnect')}
            </button>
          )}

          {/* 折叠/展开按钮 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={styles.expandButton}
            title={isExpanded ? t('common.actions.collapse') : t('common.actions.expandDetails')}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* 可折叠的详细信息区域 */}
      {isExpanded && (
        <>
          <div className="device-info" style={styles.info}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>{t('common.labels.address')}:</span>
              <span style={styles.infoValue}>{connection.device.url}</span>
            </div>
          </div>

          {/* 过滤器按钮 */}
          <div style={styles.filterButtonContainer}>
            <button
              onClick={() => setShowFilterSettings(!showFilterSettings)}
              style={styles.filterButton}
            >
              {showFilterSettings ? t('filter.actions.hide') : t('filter.actions.show')}
            </button>
          </div>

          {/* 过滤器设置面板 */}
          {showFilterSettings && (
            <div style={{ marginBottom: '12px' }}>
              <FilterSettings />
            </div>
          )}

          {/* 删除设备按钮 */}
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => {
                if (window.confirm(t('device.confirmDelete', { name: connection.device.hostname }))) {
                  mainModelController.removeDevice(connection.device.uuid);
                }
              }}
              style={styles.deleteButton}
              title={t('device.actions.delete')}
            >
              {t('device.actions.delete')}
            </button>
          </div>
        </>
      )}

      {/* 错误信息和通知列表始终显示 */}
      {errorMessage && state === 'disconnected' && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠️</span>
          <div style={styles.errorContent}>
            <div style={styles.errorTitle}>{t('errors.connectionFailed')}</div>
            <div style={styles.errorText}>{errorMessage}</div>
          </div>
          <button
            onClick={async () => {
              console.log('[DeviceCard] Manual reconnect button clicked');
              await manualReconnectDevice(connection, connection.device.uuid);
            }}
            style={styles.reconnectButton}
            title={t('common.actions.manualReconnect')}
          >
            {t('common.actions.reconnect')}
          </button>
        </div>
      )}

      <NotificationList
        notifications={filteredNotifications}
        device={connection.device}
        onDelete={async (id) => {
          try {
            // 将字符串 ID 转换为数字
            const numericId = parseInt(id, 10);
            if (isNaN(numericId)) {
              console.error('[DeviceCard] Invalid notification ID:', id);
              return;
            }

            console.log('[DeviceCard] Deleting notification:', numericId);

            // 通过 getClientByUuid 获取 WebSocket 客户端
            const wsClient = getClientByUuid(connection.device.uuid);

            if (!wsClient) {
              console.error('[DeviceCard] WebSocket client not available for device:', connection.device.uuid);
              alert(t('errors.websocketNotInitialized'));
              return;
            }

            if (!wsClient.isConnected()) {
              console.error('[DeviceCard] WebSocket not connected');
              alert(t('errors.websocketNotConnected'));
              return;
            }

            console.log('[DeviceCard] Calling clearNotifications...');
            await wsClient.clearNotifications([numericId]);
            console.log('[DeviceCard] Notification deleted successfully');
          } catch (error) {
            console.error('[DeviceCard] Failed to delete notification:', error);
            console.error('[DeviceCard] Error stack:', (error as Error).stack);
            alert(t('errors.deleteFailed') + (error as Error).message);
          }
        }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
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
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  filterButtonContainer: {
    marginBottom: '12px',
  },
  filterButton: {
    padding: '6px 12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '12px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    marginBottom: '12px',
    gap: '8px',
  },
  errorIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#856404',
    marginBottom: '4px',
  },
  errorText: {
    fontSize: '13px',
    color: '#856404',
    lineHeight: '1.4',
  },
  reconnectButton: {
    padding: '6px 12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
};
