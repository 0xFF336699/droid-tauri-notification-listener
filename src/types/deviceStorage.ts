// 安卓设备信息接口（从配对事件接收）
export interface AndroidDeviceInfo {
  uuid: string;           // 安卓设备 UUID
  hostname: string;       // 安卓设备名称
  url: string;            // WebSocket 地址 (ws://192.168.1.101:6001)
  token: string;          // 授权 token
  createdAt: number;      // 创建时间戳（毫秒）
  lastUsedAt: number;     // 最后使用时间戳（毫秒）
  enabled: boolean;       // 是否启用自动连接
}

// 设备存储接口
export interface DeviceStorage {
  devices: AndroidDeviceInfo[];
}

// 配对事件 payload 接口
export interface PairingReceivedPayload {
  url: string;                    // WebSocket URL
  token: string;                  // 授权 token
  device_uuid?: string;           // 安卓设备 UUID（可选）
  device_hostname?: string;       // 安卓设备名称（可选）
}
