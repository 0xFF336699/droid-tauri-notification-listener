// 消息项 (用于 MessagingStyle 通知)
export interface NotificationMessageItem {
  text?: string;                 // 消息文本
  timestamp?: number;            // 消息时间戳
  sender?: string;               // 发送者
}

export interface Notification {
  // === 基本信息 ===
  id: string;                    // 通知 ID (暂时保持 string，后续统一改为 number)
  packageName?: string;          // 应用包名 (与 Android 端一致)
  postTime?: number;             // 发布时间戳（毫秒，与 Android 端一致）

  // === 文本内容 ===
  title?: string;                // 通知标题
  text?: string;                 // 通知内容
  subText?: string;              // 子文本 (与 Android 端一致)
  summaryText?: string;          // 摘要文本
  bigText?: string;              // 大文本 (与 Android 端一致)
  textLines?: string[];          // 多行文本列表

  // === 消息样式 (聊天应用) ===
  template?: string;             // 通知模板类型
  people?: string[];             // 参与者列表
  conversationTitle?: string;    // 会话标题
  messages?: NotificationMessageItem[];  // 消息列表
  infoText?: string;             // 附加信息

  // === 图标信息 ===
  hasLargeIcon?: boolean;        // 是否有大图标
  hasSmallIcon?: boolean;        // 是否有小图标
  iconKey?: string;              // 图标缓存键
  largeIconBase64?: string;      // 大图标 (base64)
  smallIconBase64?: string;      // 小图标 (base64)

  // === 通道与元数据 ===
  channelId?: string;            // 通知渠道 ID (用于过滤)
  action?: string;               // 通知动作: "init" | "posted" | "removed"
  isInit?: boolean;              // 是否为初始化快照

  // === 过滤相关 ===
  isOngoing?: boolean;           // 是否为常驻通知
  priority?: number;             // 优先级 (Android ≤7.1)
  importance?: number;           // 重要性 (Android ≥8.0)

  // === UI 状态 (Tauri 独有) ===
  updated_at?: number;           // 更新时间戳（毫秒）
  read: boolean;                 // 是否已读
}
