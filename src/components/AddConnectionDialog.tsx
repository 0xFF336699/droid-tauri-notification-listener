import React, { useState, useEffect } from 'react';
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

  // 组件卸载时清理临时服务器
  useEffect(() => {
    return () => {
      invoke('stop_temp_server').catch(() => {
        // 忽略错误，可能服务器已经停止
      });
    };
  }, []);

  // 关闭按钮处理 - 先清理再关闭
  const handleClose = async () => {
    try {
      await invoke('stop_temp_server');
    } catch (err) {
      // 忽略错误
    }
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
          <h2 style={{ margin: 0 }}>添加连接</h2>
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
            扫码添加
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
            手动输入
          </button>
        </div>

        {/* 内容区域 */}
        <div>
          {activeTab === 'qrcode' && (
            <QRCodeMode
              onConnectionAdded={onConnectionAdded}
            />
          )}
          {activeTab === 'manual' && (
            <ManualInputMode
              onConnectionAdded={onConnectionAdded}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AddConnectionDialog;
