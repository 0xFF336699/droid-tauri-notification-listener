import { proxyWatch } from "fanfanlo-deep-watcher";
import { DeviceConnection } from "../data/main-model-controller";

/**
 * Android WebSocket 客户端类
 * 用于管理与安卓设备的 WebSocket 连接
 */
export class AndroidWebSocketClient {
  private deviceConnection!: DeviceConnection;
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000; // 初始延迟 3 秒
  private maxReconnectDelay = 30000; // 最大延迟 30 秒
  private isManuallyDisconnected = false; // 是否手动断开连接
  private unwatch: (() => void) | null = null;

  // 事件回调
  private messageHandler: ((data: any) => void) | null = null;
  private connectionChangeHandler: ((connected: boolean) => void) | null = null;
  private errorHandler: ((error: string) => void) | null = null;

  // 待处理的请求队列
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(deviceConnection:DeviceConnection, url: string, token?: string) {
    console.log('[AndroidWebSocketClient.constructor] Creating client');
    console.log('[AndroidWebSocketClient.constructor] URL:', url);
    console.log('[AndroidWebSocketClient.constructor] Token provided:', !!token);
    this.deviceConnection = deviceConnection;
    this.url = url;
    this.token = token || null;
    this.init();
    console.log('[AndroidWebSocketClient.constructor] Client initialized');
  }

  private  init(){
    console.log('[AndroidWebSocketClient.init]');
    const {unwatch} = proxyWatch(this.deviceConnection.device, 'enabled', this.onEnabledChange.bind(this));
    this.unwatch = unwatch;
    console.log('[AndroidWebSocketClient.init] watch set up');
  }
  private onEnabledChange(){
     const enabled = this.deviceConnection.device.enabled;
    console.log('[AndroidWebSocketClient.init] enabled changed:', enabled);
    if(enabled){
      this.connect();
    }else{
      this.disconnect();
    }
  }
  /**
   * 连接到 WebSocket 服务器
   */
  async connect(): Promise<void> {
    console.log('[AndroidWebSocketClient.connect] Starting connection');
    return new Promise((resolve, reject) => {
      try {
        console.log('[AndroidWebSocketClient.connect] Creating WebSocket connection to:', this.url);

        this.ws = new WebSocket(this.url);
        console.log('[AndroidWebSocketClient.connect] WebSocket object created');

        this.ws.onopen = () => {
          console.log('[AndroidWebSocketClient.onopen] ===== WebSocket connected =====');
          console.log('[AndroidWebSocketClient.onopen] Resetting reconnect attempts');
          this.reconnectAttempts = 0;
          console.log('[AndroidWebSocketClient.onopen] Notifying connection change');
          this.notifyConnectionChange(true);
          console.log('[AndroidWebSocketClient.onopen] Resolving promise');
          resolve();
        };

        this.ws.onmessage = (event) => {
          console.log('[AndroidWebSocketClient.onmessage] Received message');
          console.log('[AndroidWebSocketClient.onmessage] Raw data:', event.data);
          try {
            const data = JSON.parse(event.data);
            console.log('[AndroidWebSocketClient.onmessage] Parsed data:', JSON.stringify(data, null, 2));
            this.handleMessage(data);
          } catch (error) {
            console.error('[AndroidWebSocketClient.onmessage] Failed to parse message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[AndroidWebSocketClient.onclose] ===== Connection closed =====');
          console.log('[AndroidWebSocketClient.onclose] Close code:', event.code);
          console.log('[AndroidWebSocketClient.onclose] Close reason:', event.reason);
          console.log('[AndroidWebSocketClient.onclose] Was clean:', event.wasClean);
          console.log('[AndroidWebSocketClient.onclose] Notifying connection change');
          this.notifyConnectionChange(false);
          console.log('[AndroidWebSocketClient.onclose] Handling reconnect');
          this.handleReconnect();
        };

        this.ws.onerror = (event) => {
          console.error('[AndroidWebSocketClient.onerror] ===== WebSocket error =====');
          console.error('[AndroidWebSocketClient.onerror] Error event:', event);
          console.error('[AndroidWebSocketClient.onerror] Notifying error handler');
          this.notifyError('WebSocket connection error');
          console.error('[AndroidWebSocketClient.onerror] Rejecting promise');
          reject(new Error('WebSocket connection failed'));
        };

        console.log('[AndroidWebSocketClient.connect] Event handlers set up');

      } catch (error) {
        console.error('[AndroidWebSocketClient.connect] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    console.log('[AndroidWebSocketClient] Disconnecting...');

    // 标记为手动断开
    this.isManuallyDisconnected = true;

    // 停止重连
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 关闭 WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // 清理待处理的请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();

    this.notifyConnectionChange(false);
  }

  /**
   * 发送消息到服务器（保留供将来使用）
   */
  // private send(action: string, data: any = {}): void {
  //   if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
  //     throw new Error('WebSocket is not connected');
  //   }

  //   const message = {
  //     action,
  //     requestId: this.generateRequestId(),
  //     ...data
  //   };

  //   console.log('[AndroidWebSocketClient] Sending:', message);
  //   this.ws.send(JSON.stringify(message));
  // }

  /**
   * 发送请求并等待响应
   */
  private sendRequest(action: string, data: any = {}, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const message = {
        action,
        requestId,
        ...data
      };

      console.log('[AndroidWebSocketClient] Sending request:', message);

      // 设置超时
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${action}`));
      }, timeout);

      // 保存到待处理队列
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      // 发送消息
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeoutHandle);
        reject(new Error('WebSocket is not connected'));
        return;
      }

      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * 登录（使用 token）
   */
  async login(token?: string): Promise<void> {
    const authToken = token || this.token;
    if (!authToken) {
      throw new Error('Token is required for login');
    }

    console.log('[AndroidWebSocketClient] Logging in with token...');

    const response = await this.sendRequest('login', { token: authToken });

    if (response.success) {
      console.log('[AndroidWebSocketClient] Login successful');
      this.token = authToken;
    } else {
      throw new Error(response.message || 'Login failed');
    }
  }

  /**
   * 请求授权 token（首次连接）
   */
  async requestToken(deviceInfo: any): Promise<string> {
    console.log('[AndroidWebSocketClient] Requesting authorization with device info:', deviceInfo);

    const response = await this.sendRequest('request_token', { device: deviceInfo }, 60000);

    // 检查是否需要等待用户授权
    if (response.pending) {
      console.log('[AndroidWebSocketClient] Waiting for user authorization...');
      // pending 响应后，继续等待真正的授权响应
      // 这个会通过 handleMessage 处理
      return new Promise((resolve, reject) => {
        // 临时存储，等待授权响应
        const checkAuth = (data: any) => {
          if (data.requestId === response.requestId) {
            if (data.success && data.token) {
              console.log('[AndroidWebSocketClient] Authorization successful, token:', data.token);
              this.token = data.token;
              resolve(data.token);
            } else if (data.rejected) {
              reject(new Error('Authorization rejected by user'));
            }
          }
        };

        // 注册临时监听器
        const originalHandler = this.messageHandler;
        this.messageHandler = (data) => {
          checkAuth(data);
          if (originalHandler) originalHandler(data);
        };
      });
    }

    if (response.success && response.token) {
      console.log('[AndroidWebSocketClient] Token received:', response.token);
      this.token = response.token;
      return response.token;
    }

    throw new Error(response.message || 'Failed to request token');
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: any): void {
    // 检查是否是请求的响应
    if (data.requestId) {
      const pending = this.pendingRequests.get(data.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(data.requestId);

        if (data.success !== false || data.pending) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(data.message || 'Request failed'));
        }
        return;
      }
    }

    // 其他消息（推送通知等）
    if (this.messageHandler) {
      this.messageHandler(data);
    }
  }

  /**
   * 处理重连逻辑
   */
  private handleReconnect(): void {
    // 如果是手动断开，不自动重连
    if (this.isManuallyDisconnected) {
      console.log('[AndroidWebSocketClient] Manual disconnect, skipping reconnect');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[AndroidWebSocketClient] Max reconnect attempts reached');
      this.notifyError('connection-failed-max-attempts');
      return;
    }

    // 计算延迟（指数退避）
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[AndroidWebSocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();

        // 重连成功后，如果有 token，自动登录
        if (this.token) {
          await this.login();
        }
      } catch (error) {
        console.error('[AndroidWebSocketClient] Reconnect failed:', error);
        // 失败后会触发 onclose，继续重连
      }
    }, delay);
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 注册消息处理器
   */
  onMessage(handler: (data: any) => void): void {
    this.messageHandler = handler;
  }

  /**
   * 注册连接状态变化处理器
   */
  onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionChangeHandler = handler;
  }

  /**
   * 注册错误处理器
   */
  onError(handler: (error: string) => void): void {
    this.errorHandler = handler;
  }

  /**
   * 通知连接状态变化
   */
  private notifyConnectionChange(connected: boolean): void {
    if (this.connectionChangeHandler) {
      this.connectionChangeHandler(connected);
    }
  }

  /**
   * 通知错误
   */
  private notifyError(error: string): void {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 获取 token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * 设置 token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * 清除指定的通知
   * @param ids 通知ID数组
   */
  async clearNotifications(ids: number[]): Promise<void> {
    console.log('[AndroidWebSocketClient] Clearing notifications:', ids);

    if (!this.token) {
      throw new Error('Token is required to clear notifications');
    }

    const response = await this.sendRequest('clear_messages', {
      token: this.token,
      ids: ids
    });

    if (response.success) {
      console.log('[AndroidWebSocketClient] Notifications cleared successfully');
    } else {
      throw new Error(response.message || 'Failed to clear notifications');
    }
  }

  /**
   * 手动重连（重置计数器）
   */
  async manualReconnect(): Promise<void> {
    console.log('[AndroidWebSocketClient] Manual reconnect requested');

    // 重置状态
    this.reconnectAttempts = 0;
    this.isManuallyDisconnected = false;

    // 清理现有连接
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // 发起连接
    try {
      await this.connect();

      // 如果有 token，自动登录
      if (this.token) {
        await this.login();
      }

      console.log('[AndroidWebSocketClient] Manual reconnect successful');
    } catch (error) {
      console.error('[AndroidWebSocketClient] Manual reconnect failed:', error);
      throw error;
    }
  }

  /**
   * 检查是否正在重连
   */
  isReconnecting(): boolean {
    return this.reconnectTimer !== null;
  }

  /**
   * 检查连接状态并主动连接
   * 用于窗口激活时检测连接
   */
  async checkAndConnect(): Promise<void> {
    console.log('[AndroidWebSocketClient] Checking connection status');

    // 1. 如果已连接，无需操作
    if (this.isConnected()) {
      console.log('[AndroidWebSocketClient] Already connected, skipping');
      return;
    }

    // 2. 如果正在重连，无需操作
    if (this.isReconnecting()) {
      console.log('[AndroidWebSocketClient] Already reconnecting, skipping');
      return;
    }

    // 3. 如果是手动断开，无需操作
    if (this.isManuallyDisconnected) {
      console.log('[AndroidWebSocketClient] Manually disconnected, skipping');
      return;
    }

    // 4. 发起连接
    console.log('[AndroidWebSocketClient] Not connected and not reconnecting, initiating connection');
    try {
      await this.connect();

      // 如果有 token，自动登录
      if (this.token) {
        await this.login();
      }

      console.log('[AndroidWebSocketClient] Connection established successfully');
    } catch (error) {
      console.error('[AndroidWebSocketClient] Failed to establish connection:', error);
      // 失败后会触发 onclose，开始重连逻辑
    }
  }
  destroy(){
    if(this.unwatch){
      this.unwatch();
      this.unwatch = null;
    }
    this.disconnect();
  }
}
