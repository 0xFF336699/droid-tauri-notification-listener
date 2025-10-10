import { useState } from 'react';
import { useProxyWatch } from 'fanfanlo-deep-watcher';
import { DeviceConnection } from '../data/main-model-controller';
import { mainModelController } from '../data/main-model-controller';
import { NotificationList } from './NotificationList';
import { FilterSettings } from './FilterSettings';

interface DeviceCardProps {
  connection: DeviceConnection;
}

export function DeviceCard({ connection }: DeviceCardProps) {
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

  return (
    <div className="device-card" style={styles.card}>
      <div className="device-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.hostname}>{connection.device.hostname}</h3>
          <span style={styles.uuid}>{connection.device.uuid}</span>
        </div>
        <div style={styles.headerRight}>
          <span
            className={`status ${state}`}
            style={{
              ...styles.status,
              ...(state === 'connected' ? styles.statusConnected : styles.statusDisconnected),
            }}
          >
            {state === 'connected' ? '● 已连接' : '○ 未连接'}
          </span>
          <button
            onClick={() => {
              if (window.confirm(`确定要删除设备 "${connection.device.hostname}" 吗？`)) {
                mainModelController.removeDevice(connection.device.uuid);
              }
            }}
            style={styles.deleteButton}
            title="删除设备"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="device-info" style={styles.info}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>地址:</span>
          <span style={styles.infoValue}>{connection.device.url}</span>
        </div>
      </div>

      {errorMessage && state === 'disconnected' && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠️</span>
          <div style={styles.errorContent}>
            <div style={styles.errorTitle}>连接失败</div>
            <div style={styles.errorText}>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* 过滤器按钮 */}
      <div style={styles.filterButtonContainer}>
        <button
          onClick={() => setShowFilterSettings(!showFilterSettings)}
          style={styles.filterButton}
        >
          {showFilterSettings ? '🔽 隐藏过滤器' : '🔼 显示过滤器'}
        </button>
      </div>

      {/* 过滤器设置面板 */}
      {showFilterSettings && (
        <div style={{ marginBottom: '12px' }}>
          <FilterSettings />
        </div>
      )}

      <NotificationList
        notifications={filteredNotifications}
        deviceUuid={connection.device.uuid}
      />

      {/* 调试信息 - 显示过滤统计 */}
      {allNotifications.length > 0 && (
        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f0f7ff', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
          <span>显示 {filteredNotifications.length} / {allNotifications.length} 条通知</span>
        </div>
      )}
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
};
