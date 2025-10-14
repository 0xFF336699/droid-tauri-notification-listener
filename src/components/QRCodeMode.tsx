import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import QRCode from 'qrcode';
import { QRCodeData } from '../types/device';
import { getDeviceInfo } from '../utils/deviceUtils';

const SERVER_PORT = 10035; // 固定端口号

interface QRCodeModeProps {
  onConnectionAdded: (connectionId: string) => void;
}

const QRCodeMode: React.FC<QRCodeModeProps> = ({ onConnectionAdded: _onConnectionAdded }) => {
  const { t } = useTranslation();
  
  console.log(t('connection.qrcode.logs.componentRendered'));

  const [status, setStatus] = useState<'waiting' | 'starting' | 'ready' | 'error'>('waiting');
  const [statusMessage, setStatusMessage] = useState<string>(t('connection.qrcode.status.preparing'));
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('');
  const [serverPort, setServerPort] = useState<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const startTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 强制停止服务器
  const stopServer = useCallback(async () => {
    console.log(t('connection.qrcode.logs.serverStopping'));
    setStatusMessage(t('connection.server.stopping'));
    
    try {
      await invoke('stop_temp_server');
      console.log(t('connection.qrcode.logs.serverStopped'));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(t('connection.qrcode.logs.serverError'), errorMessage);
      return false;
    } finally {
      if (isMountedRef.current) {
        setStatus('waiting');
      }
    }
  }, []);

  // 启动服务器
  const startServer = useCallback(async () => {
    console.log(t('connection.qrcode.logs.serverStarting'));
    
    if (!isMountedRef.current) {
      console.log(t('connection.qrcode.logs.componentUnmounted'));
      return;
    }

    setStatus('starting');
    setStatusMessage(t('connection.qrcode.status.startingServer', { port: SERVER_PORT }));

    try {
      // 1. 停止现有服务器
      console.log(t('connection.qrcode.steps.stoppingServer'));
      setStatusMessage(t('connection.qrcode.status.stoppingServer'));
      await stopServer();

      if (!isMountedRef.current) return;

      // 2. 启动新服务器
      console.log(t('connection.qrcode.steps.startingServer'));
      setStatusMessage(t('connection.qrcode.status.startingServer', { port: SERVER_PORT }));
      
      const port = await invoke<number>('start_temp_server', { port: SERVER_PORT });
      console.log(t('connection.qrcode.logs.serverStarted'), port);
      setServerPort(port);

      if (!isMountedRef.current) return;

      // 3. 获取设备信息
      console.log(t('connection.qrcode.steps.fetchingDeviceInfo'));
      setStatusMessage(t('connection.qrcode.status.fetchingDeviceInfo'));
      const deviceInfo = await getDeviceInfo();

      if (!isMountedRef.current) return;

      // 4. 获取本机IP
      console.log(t('connection.qrcode.steps.gettingLocalIp'));
      setStatusMessage(t('connection.qrcode.status.gettingLocalIp'));
      const localIp = await invoke<string>('get_local_ip');

      if (!isMountedRef.current) return;

      // 5. 生成二维码
      console.log(t('connection.qrcode.steps.generatingQrCode'));
      setStatusMessage(t('connection.qrcode.status.generatingQrCode'));

      const qrData: QRCodeData = {
        url: `${localIp}:${port}`,
        device: deviceInfo
      };

      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      if (isMountedRef.current) {
        setQrcodeUrl(qrCodeDataUrl);
        setStatus('ready');
        setStatusMessage(t('connection.qrcode.status.ready'));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(t('connection.qrcode.logs.startServerError'), errorMessage);
      if (isMountedRef.current) {
        setStatus('error');
        setStatusMessage(t('connection.qrcode.error.title'));
      }
    }
  }, [stopServer]);

  // 组件挂载时启动服务器
  useEffect(() => {
    console.log(t('connection.qrcode.logs.componentMounted'));
    isMountedRef.current = true;

    // 添加防抖延迟
    startTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        startServer().catch(console.error);
      }
    }, 1000);

    // 清理函数
    return () => {
      console.log(t('connection.qrcode.logs.componentUnmounting'));
      isMountedRef.current = false;

      // 清除定时器
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }

      // 停止服务器
      stopServer().catch(console.error);
    };
  }, [startServer, stopServer]);

  // 渲染UI
  return (
    <div className="qrcode-mode">
      <h2>{t('connection.qrcode.title')}</h2>
      
      <div className="status-message">
        {statusMessage}
      </div>

      {status === 'ready' && qrcodeUrl && (
        <div className="qrcode-container">
          <img 
            src={qrcodeUrl} 
            alt={t('connection.qrcode.title')} 
            className="qrcode-image"
          />
          <p className="connection-info">
            {t('connection.qrcode.connectionInfo')}
            <br />
            {t('connection.qrcode.serverPort', { port: serverPort })}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="error-container">
          <p>{t('connection.qrcode.error.title')}</p>
          <button 
            onClick={() => startServer()}
            className="retry-button"
          >
            {t('connection.qrcode.error.retryButton')}
          </button>
        </div>
      )}

      <style >{`
        .qrcode-mode {
          text-align: center;
          padding: 20px;
        }
        
        .status-message {
          margin: 15px 0;
          color: #666;
          min-height: 24px;
        }
        
        .qrcode-container {
          margin: 20px auto;
          padding: 20px;
          background: #fff;
          border-radius: 8px;
          display: block;
          max-width: min(400px, 90%);
          width: fit-content;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .qrcode-image {
          width: clamp(150px, 80vw, 300px);
          height: auto;
          display: block;
          margin: 0 auto;
        }
        
        .connection-info {
          margin-top: 15px;
          color: #333;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .error-container {
          color: #d32f2f;
          margin: 20px 0;
        }
        
        .retry-button {
          margin-top: 10px;
          padding: 8px 16px;
          background-color: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .retry-button:hover {
          background-color: #1565c0;
        }
      `}</style>
    </div>
  );
};

export default QRCodeMode;