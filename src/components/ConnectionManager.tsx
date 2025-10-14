import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Connection } from '../types/connection';
import { ConnectionStorage } from '../types/connectionStorage';

interface ConnectionManagerProps {
  onConnectionsChange?: () => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onConnectionsChange }) => {
  const { t } = useTranslation();
  const [connections, setConnections] = useState<Connection[]>([]);

  const loadConnections = () => {
    const loaded = ConnectionStorage.getAll();
    setConnections(loaded);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleToggleEnabled = (connection: Connection) => {
    // 切换启用状态
    ConnectionStorage.update(connection.id, { enabled: !connection.enabled });

    // 如果禁用，断开连接
    if (connection.enabled) {
      invoke('disconnect_android', { connectionId: connection.id })
        .catch(console.error);
    }

    loadConnections();
    onConnectionsChange?.();
  };

  const handleDelete = async (connection: Connection) => {
    if (!confirm(t('connection.manager.deleteConfirm', { name: connection.name }))) {
      return;
    }

    // 如果已连接，先断开
    try {
      await invoke('disconnect_android', { connectionId: connection.id });
    } catch (err) {
      console.warn('Disconnect error (may not be connected):', err);
    }

    // 删除连接
    ConnectionStorage.remove(connection.id);

    loadConnections();
    onConnectionsChange?.();
  };

  if (connections.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
        <div style={{ fontSize: '16px' }}>{t('connection.manager.noConnections')}</div>
        <div style={{ fontSize: '14px', marginTop: '8px' }}>
          {t('connection.manager.addConnectionPrompt')}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        marginBottom: '16px',
        fontSize: '14px',
        color: '#666'
      }}>
        {t('connection.manager.totalConnections', { count: connections.length })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {connections.map((conn) => (
          <div
            key={conn.id}
            style={{
              padding: '16px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: conn.enabled ? '#fff' : '#f5f5f5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: conn.enabled ? '#4caf50' : '#9e9e9e'
                }} />
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {conn.name}
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#666', marginLeft: '22px' }}>
                <div>{t('connection.manager.connectionDetails.address')}: {conn.host}</div>
                <div>
                  {t('connection.manager.connectionDetails.token')}: {conn.token ? `${conn.token.substring(0, 20)}...` : t('connection.manager.connectionDetails.none')}
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  {t('connection.manager.connectionDetails.createdAt')}: {new Date(conn.createdAt).toLocaleString('zh-CN')}
                  {conn.lastConnected && (
                    <span> · {t('connection.manager.connectionDetails.lastConnected')}: {new Date(conn.lastConnected).toLocaleString('zh-CN')}</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="checkbox"
                  checked={conn.enabled}
                  onChange={() => handleToggleEnabled(conn)}
                  style={{ cursor: 'pointer' }}
                />
                {t('connection.manager.actions.enable')}
              </label>

              <button
                onClick={() => handleDelete(conn)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {t('connection.manager.actions.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionManager;
