import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SocketConfig {
  host: string;
  token?: string;
}

interface SocketSettingsProps {
  onConnected: (config: SocketConfig) => void;
  showTokenInput?: boolean;
}

const SocketSettings: React.FC<SocketSettingsProps> = ({ onConnected, showTokenInput = false }) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SocketConfig>({
    host: '',
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.host.trim()) {
      setError(t('connection.serverAddressRequired', '请输入服务器地址'));
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await onConnected(config);
    } catch (err) {
      setError(t('connection.connectionFailedCheckAddress', '连接失败，请检查服务器地址'));
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
      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>{t('connection.socketSettings', 'Socket连接设置')}</h3>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            {t('connection.serverAddress', '服务器地址')}:
          </label>
          <textarea
            value={config.host}
            onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
            placeholder={t('connection.serverAddressPlaceholder', '例如：\n192.168.1.100:8080\nws://192.168.1.100:8080\nhttps://example.com\nwss://api.example.com/ws')}
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
            {t('connection.supportedFormats', '支持IP+端口、ws://、wss://域名等格式')}
          </div>
        </div>

        {showTokenInput && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              {t('connection.authToken', '认证令牌')} ({t('common.optional', '可选')}):
            </label>
            <input
              type="password"
              value={config.token || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
              placeholder={t('connection.enterAuthToken', '输入认证令牌')}
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
            {isConnecting ? t('connection.connecting', '连接中...') : t('connection.connect', '连接')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SocketSettings;
