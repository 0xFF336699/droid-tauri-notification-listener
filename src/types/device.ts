// 设备信息接口
export interface DeviceInfo {
  uuid: string;           // 设备唯一标识（UUID v4）
  os: string;             // 操作系统（Windows/macOS/Linux）
  osVersion: string;      // 操作系统版本
  hostname: string;       // 主机名
  timestamp: number;      // 生成时间戳（毫秒）
}

// 二维码数据接口
export interface QRCodeData {
  url: string;            // Socket URL (IP:端口)
  device: DeviceInfo;     // PC 设备信息
}
