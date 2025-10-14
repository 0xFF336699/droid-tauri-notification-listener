import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import QRCodeMode from './QRCodeMode';
import ManualInputMode from './ManualInputMode';

type TabType = 'qrcode' | 'manual';

interface AddConnectionDialogProps {
  onConnectionAdded: (connectionId: string) => void;
  onClose: () => void;
}

const AddConnectionDialog: React.FC<AddConnectionDialogProps> = ({ onConnectionAdded, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('qrcode');
  
  // 服务器相关状态已移至 QRCodeMode 组件中管理

  const { t } = useTranslation();
  
  // 组件挂载时启动服务器
  // useEffect(() => {
  //   const startServer = async () => {
  //     try {
  //       console.log(t('connection.server.starting'));
  //       const port = 10035;
  //       const actualPort = await invoke<number>('start_temp_server', { port });
  //       console.log(t('connection.server.started', { port: actualPort }));
  //       setServerPort(actualPort);
  //       setServerRunning(true);
  //     } catch (err) {
  //       const errorMessage = err instanceof Error ? err.message : String(err);
  //       console.error(t('connection.server.startFailed', { error: errorMessage }));
  //     }
  //   };

  //   startServer();

  //   // 组件卸载时停止服务器
  //   return () => {
  //     console.log(t('connection.server.stopping'));
  //     invoke('stop_temp_server').catch(() => {
  //       // 忽略错误
  //     });
  //     setServerRunning(false);
  //     console.log(t('connection.server.stopped'));
  //   };
  // }, [t]);

  // 关闭按钮处理
  const handleClose = () => {
    // cleanup 会处理服务器停止
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        minWidth: '500px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0 }}>{t('connection.addTitle')}</h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Tab 切换 */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setActiveTab('qrcode')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'qrcode' ? '3px solid #007bff' : 'none',
              fontWeight: activeTab === 'qrcode' ? 'bold' : 'normal',
              color: activeTab === 'qrcode' ? '#007bff' : '#666'
            }}
          >
            {t('connection.tabs.qrcode')}
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'manual' ? '3px solid #007bff' : 'none',
              fontWeight: activeTab === 'manual' ? 'bold' : 'normal',
              color: activeTab === 'manual' ? '#007bff' : '#666'
            }}
          >
            {t('connection.tabs.manual')}
          </button>
        </div>

        {/* 内容区域 */}
        <div>
          <div style={{ display: activeTab === 'qrcode' ? 'block' : 'none' }}>
            <QRCodeMode
              onConnectionAdded={onConnectionAdded}
            />
          </div>
          <div style={{ display: activeTab === 'manual' ? 'block' : 'none' }}>
            <ManualInputMode
              onConnectionAdded={onConnectionAdded}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddConnectionDialog;
