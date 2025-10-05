/**
 * 连接配置接口
 */
export interface Connection {
  id: string;              // 唯一标识
  name: string;            // 设备名称
  host: string;            // socket地址 (支持 ws://、wss://、IP+端口等格式)
  token?: string;          // 认证token（首次连接后由安卓端返回）
  enabled: boolean;        // 是否启用
  createdAt: number;       // 添加时间（时间戳）
  lastConnected?: number;  // 最后连接时间（时间戳）
}

/**
 * 连接状态
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * 单个连接的状态信息
 */
export interface ConnectionState {
  connection: Connection;
  status: ConnectionStatus;
  error?: string;
}
