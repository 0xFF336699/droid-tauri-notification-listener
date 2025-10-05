import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Connection } from '../types/connection';
import { ConnectionStorage } from '../types/connectionStorage';

interface ManualInputModeProps {
  onConnectionAdded: (connectionId: string) => void;
}

const ManualInputMode: React.FC<ManualInputModeProps> = ({ onConnectionAdded }) => {
  const [host, setHost] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!host.trim()) {
      setError('请输入Socket地址');
      return;
    }

    setError('');
    setStatus('正在连接...');
    setConnecting(true);

    try {
      // 创建连接对象（不含token）
      const connection: Connection = {
        id: `conn-${Date.now()}`,
        name: deviceName.trim() || `设备 ${host}`,
        host: host.trim(),
        token: undefined, // 首次连接无token
        enabled: true,
        createdAt: Date.now()
      };

      // 连接到安卓设备并请求token
      setStatus('正在请求授权...');
      const receivedToken = await invoke<string>('connect_to_android', {
        connectionId: connection.id,
        host: connection.host,
        token: null // 手动输入模式，没有预先的token
      });

      // 更新连接的token
      connection.token = receivedToken;

      // 保存连接
      ConnectionStorage.add(connection);

      setStatus('连接成功！');
      setTimeout(() => {
        onConnectionAdded(connection.id);
      }, 500);

    } catch (err) {
      const errorMsg = err as string;
      if (errorMsg.includes('rejected')) {
        setError('授权被拒绝，请在安卓端允许连接');
      } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        setError('连接超时，请检查网络或安卓端是否正在运行');
      } else {
        setError(`连接失败: ${errorMsg}`);
      }
      setStatus('');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          设备名称（可选）:
        </label>
        <input
          type="text"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="例如: 小米手机"
          disabled={connecting}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          不填写则自动生成
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Socket地址 *:
        </label>
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="例如: 192.168.1.100:6001"
          disabled={connecting}
          required
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          支持格式: IP:端口、域名:端口
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          marginBottom: '15px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {status && !error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#e8f5e8',
          border: '1px solid #c3e6c3',
          borderRadius: '4px',
          color: '#2d5',
          marginBottom: '15px',
          fontSize: '14px'
        }}>
          {status}
        </div>
      )}

      <div style={{
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        marginBottom: '20px',
        fontSize: '13px',
        color: '#555',
        lineHeight: '1.6'
      }}>
        <strong>提示:</strong><br/>
        首次连接时，安卓端会弹出授权对话框。<br/>
        请在安卓设备上点击"允许"，PC端将自动保存token。
      </div>

      <button
        onClick={handleConnect}
        disabled={connecting || !host.trim()}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: connecting || !host.trim() ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: connecting || !host.trim() ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        {connecting ? '连接中...' : '连接'}
      </button>
    </div>
  );
};

export default ManualInputMode;
