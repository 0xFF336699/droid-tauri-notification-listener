import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import QRCode from 'qrcode';
import { Connection } from '../types/connection';
import { ConnectionStorage } from '../types/connectionStorage';
import { QRCodeData } from '../types/device';
import { getDeviceInfo } from '../utils/deviceUtils';

interface QRCodeModeProps {
  onConnectionAdded: (connectionId: string) => void;
}

interface PairingData {
  url: string;
  token: string;
}

interface ServerStatus {
  running: boolean;
  port: number;
  waiting_for_pairing: boolean;
}

// 状态机定义
type QRCodeModeState =
  | { type: 'idle' }
  | { type: 'starting' }
  | { type: 'waiting_pairing'; port: number; qrcodeUrl: string }
  | { type: 'pairing'; port: number; qrcodeUrl: string }
  | { type: 'error'; message: string };

const STORAGE_KEY_PORT = 'qrcode_server_port';

const QRCodeMode: React.FC<QRCodeModeProps> = ({ onConnectionAdded }) => {
  const [port, setPort] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PORT);
    return saved ? parseInt(saved, 10) : 10035;
  });
  const [state, setState] = useState<QRCodeModeState>({ type: 'idle' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoStartInProgressRef = useRef<boolean>(false); // 防止重复自动启动

  // 组件挂载时查询后端状态
  useEffect(() => {
    console.log('[QRCodeMode] Component mounted, syncing with backend');
    syncWithBackend();
  }, []);

  // 当状态变为 waiting_pairing 时，绘制二维码
  useEffect(() => {
    if (state.type === 'waiting_pairing' && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, state.qrcodeUrl, {
        width: 256,
        margin: 2
      }).catch(err => {
        console.error('[QRCodeMode] Failed to generate QR code:', err);
      });
    }
  }, [state]);

  // 与后端同步状态
  const syncWithBackend = async () => {
    console.log('[QRCodeMode] syncWithBackend called');
    try {
      console.log('[QRCodeMode] Invoking get_temp_server_status...');
      const status = await invoke<ServerStatus | null>('get_temp_server_status');
      console.log('[QRCodeMode] Server status:', status);

      if (!status || !status.running) {
        // 后端没有运行的服务器，自动启动
        console.log('[QRCodeMode] No server running, auto-starting...');
        await autoStartServer();
        return;
      }

      console.log('[QRCodeMode] Server is running, waiting_for_pairing:', status.waiting_for_pairing);
      if (status.waiting_for_pairing) {
        // 后端正在等待配对，恢复UI状态
        console.log('[QRCodeMode] Backend is waiting for pairing, restoring UI');

        // 获取设备信息并重建二维码数据
        console.log('[QRCodeMode] Getting device info...');
        const deviceInfo = await getDeviceInfo();
        console.log('[QRCodeMode] Getting local IP...');
        const localIp = await invoke<string>('get_local_ip');
        const url = `${localIp}:${status.port}`;
        console.log('[QRCodeMode] URL:', url);

        const qrcodeData: QRCodeData = {
          url,
          device: deviceInfo
        };
        const qrcodeString = JSON.stringify(qrcodeData);
        console.log('[QRCodeMode] QR code data ready');

        setPort(status.port);
        setState({
          type: 'waiting_pairing',
          port: status.port,
          qrcodeUrl: qrcodeString
        });

        // 调用 waitForPairing 以接收结果，但 ref 会防止重复调用
        console.log('[QRCodeMode] Starting waitForPairing...');
        waitForPairing();
      } else {
        // 服务器在运行但不在等待配对，可能是旧状态，进入idle
        console.log('[QRCodeMode] Server running but not waiting, setting idle');
        setState({ type: 'idle' });
      }
    } catch (err) {
      console.error('[QRCodeMode] Failed to sync with backend:', err);
      setState({ type: 'idle' });
    }
  };

  // 自动启动服务器
  const autoStartServer = async () => {
    console.log('[QRCodeMode] autoStartServer called, current state:', state.type);

    // 防止重复启动
    if (autoStartInProgressRef.current) {
      console.log('[QRCodeMode] autoStartServer already in progress, skipping');
      return;
    }

    autoStartInProgressRef.current = true;
    console.log('[QRCodeMode] Setting state to starting');
    setState({ type: 'starting' });

    try {
      // 先停止可能存在的旧服务器
      try {
        console.log('[QRCodeMode] Stopping old server...');
        await invoke('stop_temp_server');
        console.log('[QRCodeMode] Old server stopped');
      } catch (err) {
        console.log('[QRCodeMode] No old server to stop:', err);
      }

      // 启动新服务器
      console.log('[QRCodeMode] Starting new server on port:', port);
      const actualPort = await invoke<number>('start_temp_server', { port });
      console.log('[QRCodeMode] Server started on port:', actualPort);

      // 保存端口到localStorage
      console.log('[QRCodeMode] Saving port to localStorage');
      localStorage.setItem(STORAGE_KEY_PORT, actualPort.toString());

      // 获取设备信息和IP
      console.log('[QRCodeMode] Getting device info...');
      const deviceInfo = await getDeviceInfo();
      console.log('[QRCodeMode] Getting local IP...');
      const localIp = await invoke<string>('get_local_ip');
      const url = `${localIp}:${actualPort}`;
      console.log('[QRCodeMode] URL:', url);

      // 构建二维码数据
      const qrcodeData: QRCodeData = {
        url,
        device: deviceInfo
      };
      const qrcodeString = JSON.stringify(qrcodeData);
      console.log('[QRCodeMode] QR code data:', qrcodeString);

      console.log('[QRCodeMode] Setting state to waiting_pairing');
      setState({
        type: 'waiting_pairing',
        port: actualPort,
        qrcodeUrl: qrcodeString
      });

      console.log('[QRCodeMode] Server is now running and waiting for clients');

    } catch (err) {
      // 自动启动失败，进入error状态，让用户手动操作
      console.error('[QRCodeMode] Auto-start failed:', err);
      setState({
        type: 'error',
        message: `自动启动失败: ${err}. 请检查端口后手动启动。`
      });
    } finally {
      autoStartInProgressRef.current = false;
      console.log('[QRCodeMode] autoStartServer finished');
    }
  };

  const handleStartServer = async () => {
    // 防止在非idle状态下启动
    if (state.type !== 'idle' && state.type !== 'error') {
      console.log('[QRCodeMode] Server already running, ignoring start request');
      return;
    }

    setState({ type: 'starting' });

    try {
      // 先停止可能存在的旧服务器
      try {
        await invoke('stop_temp_server');
      } catch (err) {
        // 忽略
      }

      // 启动新服务器
      const actualPort = await invoke<number>('start_temp_server', { port });

      // 保存端口到localStorage
      localStorage.setItem(STORAGE_KEY_PORT, actualPort.toString());

      // 获取设备信息和IP
      const deviceInfo = await getDeviceInfo();
      const localIp = await invoke<string>('get_local_ip');
      const url = `${localIp}:${actualPort}`;

      // 构建二维码数据
      const qrcodeData: QRCodeData = {
        url,
        device: deviceInfo
      };
      const qrcodeString = JSON.stringify(qrcodeData);

      setState({
        type: 'waiting_pairing',
        port: actualPort,
        qrcodeUrl: qrcodeString
      });

      console.log('[QRCodeMode] Server started, waiting for clients');

    } catch (err) {
      setState({
        type: 'error',
        message: err as string
      });
    }
  };

  // HTTP 方案：不再需要轮询等待，安卓端会直接 HTTP POST 到后端

  const handleCheckPort = async () => {
    try {
      const available = await invoke<boolean>('check_port_available', { port });
      if (available) {
        setState({ type: 'idle' });  // 清除之前的错误
      } else {
        setState({
          type: 'error',
          message: `端口 ${port} 被占用`
        });
      }
    } catch (err) {
      setState({
        type: 'error',
        message: err as string
      });
    }
  };

  // HTTP 方案：组件卸载时不需要特殊处理（服务器由 AddConnectionDialog 管理）

  // === 渲染逻辑完全由状态机驱动 ===

  if (state.type === 'waiting_pairing' || state.type === 'pairing') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          <canvas ref={canvasRef} style={{ border: '2px solid #ddd', borderRadius: '8px' }} />
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
            扫描二维码或手动输入地址:
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {state.qrcodeUrl}
          </div>
        </div>

        <div style={{
          padding: '10px',
          backgroundColor: '#e8f5e8',
          border: '1px solid #c3e6c3',
          borderRadius: '4px',
          color: '#2d5',
          marginBottom: '15px'
        }}>
          {state.type === 'pairing' ? '正在配对中...' : '等待安卓设备扫码连接...'}
        </div>

        <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.6' }}>
          请在安卓设备上扫描二维码<br />
          扫码后设备将自动连接
        </div>
      </div>
    );
  }

  // idle, starting, error 状态
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          端口号:
        </label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            min={1024}
            max={65535}
            disabled={state.type === 'starting'}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={handleCheckPort}
            disabled={state.type === 'starting'}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: state.type === 'starting' ? 'not-allowed' : 'pointer',
              opacity: state.type === 'starting' ? 0.6 : 1
            }}
          >
            检测
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          默认端口: 10035
        </div>
      </div>

      {state.type === 'error' && (
        <div style={{
          padding: '10px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          marginBottom: '15px'
        }}>
          {state.message}
        </div>
      )}

      {state.type === 'starting' && (
        <div style={{
          padding: '10px',
          backgroundColor: '#e8f5e8',
          border: '1px solid #c3e6c3',
          borderRadius: '4px',
          color: '#2d5',
          marginBottom: '15px'
        }}>
          正在自动启动服务器...
        </div>
      )}

      {state.type === 'idle' && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          color: '#6c757d',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          提示：首次打开会自动启动服务器。如需更换端口，请先修改端口号再点击下方按钮。
        </div>
      )}

      <button
        onClick={handleStartServer}
        disabled={state.type === 'starting'}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: state.type === 'starting' ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: state.type === 'starting' ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        {state.type === 'idle' ? '重新启动服务器' : '启动服务器'}
      </button>
    </div>
  );
};

export default QRCodeMode;
