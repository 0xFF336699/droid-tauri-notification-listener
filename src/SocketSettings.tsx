import React, { useState } from 'react';

interface SocketConfig {
  host: string;
  token?: string;
}

interface SocketSettingsProps {
  onConnected: (config: SocketConfig) => void;
  showTokenInput?: boolean;
}

const SocketSettings: React.FC<SocketSettingsProps> = ({ onConnected, showTokenInput = false }) => {
  const [config, setConfig] = useState<SocketConfig>({
    host: '',
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.host.trim()) {
      setError('请输入服务器地址');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await onConnected(config);
    } catch (err) {
      setError('连接失败，请检查服务器地址');
      setIsConnecting(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '400px',
      margin: '0 auto',
      backgroundColor: '#f9f9f9',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Socket连接设置</h3>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            服务器地址:
          </label>
          <textarea
            value={config.host}
            onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
            placeholder={`例如：
192.168.1.100:8080
ws://192.168.1.100:8080
https://example.com
wss://api.example.com/ws`}
            rows={8}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}
            required
          />
          <div style={{
            fontSize: '12px',
            color: '#666',
            marginTop: '4px',
            lineHeight: '1.4'
          }}>
            支持IP+端口、ws://、wss://域名等格式
          </div>
        </div>

        {showTokenInput && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              认证令牌 (可选):
            </label>
            <input
              type="password"
              value={config.token || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
              placeholder="输入认证令牌"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {error && (
          <div style={{
            color: 'red',
            marginBottom: '15px',
            padding: '8px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="submit"
            disabled={isConnecting}
            style={{
              padding: '10px 20px',
              backgroundColor: isConnecting ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {isConnecting ? '连接中...' : '连接'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SocketSettings;
