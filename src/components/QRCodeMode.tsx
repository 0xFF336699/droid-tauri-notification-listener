import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import QRCode from 'qrcode';
import { QRCodeData } from '../types/device';
import { getDeviceInfo } from '../utils/deviceUtils';

const LOG_TAG = '[QR-STABLE]';
const SERVER_PORT = 10035; // 固定端口号

interface QRCodeModeProps {
  onConnectionAdded: (connectionId: string) => void;
}

const QRCodeMode: React.FC<QRCodeModeProps> = ({ onConnectionAdded: _onConnectionAdded }) => {
  console.log(`${LOG_TAG} 组件渲染`);

  const [status, setStatus] = useState<'waiting' | 'starting' | 'ready' | 'error'>('waiting');
  const [statusMessage, setStatusMessage] = useState<string>('准备启动服务器...');
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('');
  const [serverPort, setServerPort] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const startTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 强制停止服务器
  const stopServer = useCallback(async () => {
    console.log(`${LOG_TAG} 正在停止服务器...`);
    setStatusMessage('正在停止服务器...');
    
    try {
      await invoke('stop_temp_server');
      console.log(`${LOG_TAG} 服务器已停止`);
      return true;
    } catch (error) {
      console.error(`${LOG_TAG} 停止服务器时出错:`, error);
      return false;
    } finally {
      if (isMountedRef.current) {
        setStatus('waiting');
      }
    }
  }, []);

  // 启动服务器
  const startServer = useCallback(async () => {
    console.log(`${LOG_TAG} 开始启动服务器`);
    
    if (!isMountedRef.current) {
      console.log(`${LOG_TAG} 组件已卸载，取消启动服务器`);
      return;
    }

    setStatus('starting');
    setStatusMessage('正在准备启动服务器...');

    try {
      // 1. 停止现有服务器
      console.log(`${LOG_TAG} 步骤 1/4: 停止现有服务器`);
      setStatusMessage('正在停止现有服务器...');
      await stopServer();

      if (!isMountedRef.current) return;

      // 2. 启动新服务器
      console.log(`${LOG_TAG} 步骤 2/4: 启动服务器`);
      setStatusMessage(`正在启动服务器 (端口 ${SERVER_PORT})...`);
      
      const port = await invoke<number>('start_temp_server', { port: SERVER_PORT });
      console.log(`${LOG_TAG} 服务器已启动，端口:`, port);
      setServerPort(port);

      if (!isMountedRef.current) return;

      // 3. 获取设备信息
      console.log(`${LOG_TAG} 步骤 3/4: 获取设备信息`);
      setStatusMessage('正在获取设备信息...');
      const deviceInfo = await getDeviceInfo();

      if (!isMountedRef.current) return;

      // 4. 获取本机IP
      console.log(`${LOG_TAG} 步骤 4/5: 获取本机IP`);
      setStatusMessage('正在获取本机IP...');
      const localIp = await invoke<string>('get_local_ip');

      if (!isMountedRef.current) return;

      // 5. 生成二维码
      console.log(`${LOG_TAG} 步骤 5/5: 生成二维码`);
      setStatusMessage('正在生成二维码...');

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
        setStatusMessage('扫描二维码连接设备');
      }

    } catch (error) {
      console.error(`${LOG_TAG} 启动服务器时出错:`, error);
      if (isMountedRef.current) {
        setStatus('error');
        setStatusMessage(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, [stopServer]);

  // 组件挂载时启动服务器
  useEffect(() => {
    console.log(`${LOG_TAG} 组件挂载`);
    isMountedRef.current = true;

    // 添加防抖延迟
    startTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        startServer().catch(console.error);
      }
    }, 1000);

    // 清理函数
    return () => {
      console.log(`${LOG_TAG} 组件卸载清理`);
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
      <h2>扫码连接</h2>
      
      <div className="status-message">
        {statusMessage}
      </div>

      {status === 'ready' && qrcodeUrl && (
        <div className="qrcode-container">
          <img 
            src={qrcodeUrl} 
            alt="设备连接二维码" 
            className="qrcode-image"
          />
          <p className="connection-info">
            请使用手机扫描二维码连接
            <br />
            服务器运行在端口: {serverPort}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="error-container">
          <p>启动服务器时出错，请重试</p>
          <button 
            onClick={() => startServer()}
            className="retry-button"
          >
            重试
          </button>
        </div>
      )}

      <style jsx>{`
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
          display: inline-block;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        .qrcode-image {
          width: 200px;
          height: 200px;
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