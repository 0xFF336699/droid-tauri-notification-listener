import React, { useState } from 'react';
import { AndroidDeviceInfo } from '../types/deviceStorage';
import { mainModelController } from '../data/main-model-controller';

interface ManualInputModeProps {
  onConnectionAdded: (connectionId: string) => void;
}

const ManualInputMode: React.FC<ManualInputModeProps> = ({ onConnectionAdded }) => {
  const [host, setHost] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  // 智能构造 WebSocket URL
  const buildWebSocketUrl = (host: string): string => {
    const trimmedHost = host.trim();

    // 1. 如果已经带了协议，直接使用
    if (trimmedHost.startsWith('ws://') || trimmedHost.startsWith('wss://')) {
      return trimmedHost;
    }

    // 2. 提取主机部分（去除端口）
    const hostPart = trimmedHost.split(':')[0];

    // 3. 判断是否是IP地址或localhost
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostPart);
    const isLocalhost = hostPart === 'localhost' || hostPart === '127.0.0.1';

    // 4. IP地址/localhost用 ws://，域名用 wss://
    const protocol = (isIpAddress || isLocalhost) ? 'ws://' : 'wss://';

    return `${protocol}${trimmedHost}`;
  };

  const handleConnect = async () => {
    if (!host.trim()) {
      setError('请输入Socket地址');
      return;
    }

    setError('');
    setStatus('正在添加设备...');
    setConnecting(true);

    try {
      // 生成 UUID
      const uuid = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 智能构造 WebSocket URL
      const wsUrl = buildWebSocketUrl(host);

      // 创建设备信息对象
      const deviceInfo: AndroidDeviceInfo = {
        uuid: uuid,
        hostname: deviceName.trim() || `设备 ${host}`,
        url: wsUrl,
        enabled: true,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // 添加设备到全局状态
      mainModelController.addDevice(deviceInfo);

      setStatus('设备已添加！');
      setTimeout(() => {
        onConnectionAdded(uuid);
      }, 500);

    } catch (err) {
      const errorMsg = err as string;
      setError(`添加失败: ${errorMsg}`);
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
        输入设备的 Socket 地址，支持以下格式：<br/>
        • IP地址:端口 (如 192.168.1.100:6001)<br/>
        • 域名:端口 (如 example.com:6001)<br/>
        • ws://地址 或 wss://地址 (手动指定协议)
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
        {connecting ? '添加中...' : '添加设备'}
      </button>
    </div>
  );
};

export default ManualInputMode;
