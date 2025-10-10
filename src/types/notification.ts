export interface Notification {
  id: string;                    // 通知 ID
  package_name?: string;         // 应用包名
  packageName?: string;          // 应用包名 (安卓端使用的字段名)
  title?: string;                // 通知标题
  text?: string;                 // 通知内容
  subtext?: string;              // 子文本
  big_text?: string;             // 大文本
  icon?: string;                 // 图标（base64）
  posted_at?: number;            // 发布时间戳（毫秒）
  postTime?: number;             // 发布时间戳（毫秒,安卓端使用的字段名）
  updated_at?: number;           // 更新时间戳（毫秒）
  read: boolean;                 // 是否已读
  channelId?: string;            // 通知渠道 ID (用于过滤)
}
