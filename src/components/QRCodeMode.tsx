import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import QRCode from 'qrcode';
import { Connection } from '../types/connection';
import { ConnectionStorage } from '../types/connectionStorage';

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

const QRCodeMode: React.FC<QRCodeModeProps> = ({ onConnectionAdded }) => {
  const [port, setPort] = useState<number>(10035);
  const [state, setState] = useState<QRCodeModeState>({ type: 'idle' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pairingAbortRef = useRef<boolean>(false);

  // 组件挂载时查询后端状态
  useEffect(() => {
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
    try {
      const status = await invoke<ServerStatus | null>('get_temp_server_status');

      if (!status || !status.running) {
        // 后端没有运行的服务器，进入idle状态
        setState({ type: 'idle' });
        return;
      }

      if (status.waiting_for_pairing) {
        // 后端正在等待配对，恢复到 waiting_pairing 状态
        console.log('[QRCodeMode] Backend is waiting for pairing, restoring state');
        const localIp = await invoke<string>('get_local_ip');
        const url = `${localIp}:${status.port}`;

        setPort(status.port);
        setState({
          type: 'waiting_pairing',
          port: status.port,
          qrcodeUrl: url
        });

        // 继续等待配对
        waitForPairing();
      } else {
        // 服务器在运行但不在等待配对，可能是旧状态，进入idle
        setState({ type: 'idle' });
      }
    } catch (err) {
      console.error('[QRCodeMode] Failed to sync with backend:', err);
      setState({ type: 'idle' });
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

      // 获取IP并生成二维码URL
      const localIp = await invoke<string>('get_local_ip');
      const url = `${localIp}:${actualPort}`;

      setState({
        type: 'waiting_pairing',
        port: actualPort,
        qrcodeUrl: url
      });

      // 开始等待配对
      waitForPairing();

    } catch (err) {
      setState({
        type: 'error',
        message: err as string
      });
    }
  };

  const waitForPairing = async () => {
    if (pairingAbortRef.current) {
      pairingAbortRef.current = false;
      return;
    }

    try {
      // 等待180秒（3分钟）
      const pairingData = await invoke<PairingData>('wait_for_pairing', {
        timeoutSecs: 180
      });

      console.log('[QRCodeMode] Pairing data received:', pairingData);

      setState({
        type: 'pairing',
        port: state.type === 'waiting_pairing' ? state.port : 10035,
        qrcodeUrl: ''
      });

      // 停止临时服务器
      await invoke('stop_temp_server');

      // 创建新连接
      const connection: Connection = {
        id: `conn-${Date.now()}`,
        name: `设备 ${pairingData.url}`,
        host: pairingData.url,
        token: pairingData.token,
        enabled: true,
        createdAt: Date.now()
      };

      // 保存连接
      ConnectionStorage.add(connection);

      // 连接到安卓设备
      await invoke<string>('connect_to_android', {
        connectionId: connection.id,
        host: connection.host,
        token: connection.token
      });

      // 通知父组件
      setTimeout(() => {
        onConnectionAdded(connection.id);
      }, 500);

    } catch (err) {
      console.error('[QRCodeMode] Pairing failed:', err);
      setState({
        type: 'error',
        message: err as string
      });
      await invoke('stop_temp_server').catch(() => {});
    }
  };

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

  // 组件卸载时标记中止（但不停止服务器，让AddConnectionDialog的cleanup处理）
  useEffect(() => {
    return () => {
      pairingAbortRef.current = true;
    };
  }, []);

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
          正在启动服务器...
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
        启动服务器
      </button>
    </div>
  );
};

export default QRCodeMode;
