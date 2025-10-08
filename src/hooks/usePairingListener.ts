import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { PairingReceivedPayload, AndroidDeviceInfo } from '../types/deviceStorage';
import { saveDevice } from '../utils/deviceStorage';

interface UsePairingListenerOptions {
  onPairingReceived?: (deviceInfo: AndroidDeviceInfo) => void;
}

/**
 * Hook 用于监听配对事件
 * 当收到配对事件时，自动保存设备信息到 LocalStorage
 *
 * @example
 * ```tsx
 * usePairingListener({
 *   onPairingReceived: (device) => {
 *     console.log('New device paired:', device);
 *   }
 * });
 * ```
 */
export function usePairingListener({ onPairingReceived }: UsePairingListenerOptions = {}) {
  useEffect(() => {
    console.log('[usePairingListener] Setting up pairing event listener...');
    console.log('[usePairingListener] onPairingReceived callback:', !!onPairingReceived);

    // 监听 pairing-received 事件
    const unlisten = listen<PairingReceivedPayload>('pairing-received', (event) => {
      console.log('[usePairingListener] ===== Received pairing-received event =====');
      const payload = event.payload;
      console.log('[usePairingListener] Event payload:', JSON.stringify(payload, null, 2));
      console.log('[usePairingListener] Payload url:', payload.url);
      console.log('[usePairingListener] Payload token length:', payload.token?.length);
      console.log('[usePairingListener] Payload device_uuid:', payload.device_uuid);
      console.log('[usePairingListener] Payload device_hostname:', payload.device_hostname);

      // 生成设备 UUID（如果安卓端未提供）
      const deviceUuid = payload.device_uuid || `android_${Date.now()}`;
      const deviceHostname = payload.device_hostname || 'Unknown Device';
      console.log('[usePairingListener] Generated deviceUuid:', deviceUuid);
      console.log('[usePairingListener] Generated deviceHostname:', deviceHostname);

      // 处理 URL：确保有 ws:// 前缀
      let wsUrl = payload.url;
      if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
        wsUrl = `ws://${wsUrl}`;
        console.log('[usePairingListener] Added ws:// prefix to URL:', wsUrl);
      }

      // 创建设备信息
      const deviceInfo: AndroidDeviceInfo = {
        uuid: deviceUuid,
        hostname: deviceHostname,
        url: wsUrl,
        token: payload.token,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        enabled: true,
      };
      console.log('[usePairingListener] Created deviceInfo:', JSON.stringify(deviceInfo, null, 2));

      // 保存到 LocalStorage
      console.log('[usePairingListener] Saving device to LocalStorage...');
      saveDevice(deviceInfo);
      console.log('[usePairingListener] Device saved to LocalStorage successfully');

      // 回调
      if (onPairingReceived) {
        console.log('[usePairingListener] Calling onPairingReceived callback');
        onPairingReceived(deviceInfo);
        console.log('[usePairingListener] Callback executed');
      } else {
        console.log('[usePairingListener] No callback provided');
      }
      console.log('[usePairingListener] ===== Pairing event handling complete =====');
    });

    console.log('[usePairingListener] Event listener registered');

    // 清理监听器
    return () => {
      console.log('[usePairingListener] Cleaning up listener...');
      unlisten.then(unlistenFn => {
        console.log('[usePairingListener] Listener cleaned up');
        unlistenFn();
      });
    };
  }, [onPairingReceived]);
}
