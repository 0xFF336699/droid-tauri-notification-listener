import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

const SocketTest: React.FC = () => {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(`[SocketTest] ${message}`);
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const runSocketTest = async () => {
    if (isTesting) return;
    
    setIsTesting(true);
    setLogs([]);
    
    try {
      addLog('Starting socket test...');
      
      // 启动服务器
      addLog('Starting socket server on port 10055...');
      await invoke('start_socket_server', { port: 10055 });
      addLog('Socket server started');
      
      // 等待7秒
      addLog('Waiting 7 seconds before connecting client...');
      await new Promise(resolve => setTimeout(resolve, 7000));
      
      // 启动客户端
      addLog('Starting socket client...');
      const result = await invoke<string>('connect_to_socket', { 
        host: '127.0.0.1',
        port: 10055 
      });
      
      addLog(`Client connected: ${result}`);
      
    } catch (error) {
      addLog(`Error: ${error}`);
    } finally {
      setIsTesting(false);
      
      // 清理
      try {
        await invoke('stop_socket_server');
        addLog('Socket server stopped');
      } catch (e) {
        console.error('Error stopping server:', e);
      }
    }
  };

  return (
    <div style={{ 
      padding: '16px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      marginTop: '16px',
      maxWidth: '600px'
    }}>
      <h3>{t('connection.socketTestTitle', 'Socket 测试')}</h3>
      <button 
        onClick={runSocketTest}
        disabled={isTesting}
        style={{
          padding: '8px 16px',
          background: isTesting ? '#cccccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isTesting ? 'not-allowed' : 'pointer'
        }}
      >
        {isTesting ? t('connection.testing', '测试中...') : t('connection.startSocketTest', '开始 Socket 测试')}
      </button>
      
      <div style={{ 
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        fontFamily: 'monospace',
        height: '200px',
        overflowY: 'auto',
        fontSize: '12px'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#999' }}>{t('connection.clickToStartTest', '点击按钮开始测试...')}</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '4px' }}>{log}</div>
          ))
        )}
      </div>
    </div>
  );
};

export default SocketTest;
