import { DeviceConnection } from './main-model-controller';

interface WebSocketMessage {
  type: string;
  data?: any;
  notification?: any;
}

/**
 * 处理 WebSocket 消息
 * ⚠️ 重要: 所有通知都存入 allNotifications,不进行过滤
 */
export function handleWebSocketMessage(
  message: WebSocketMessage,
  connection: DeviceConnection,
  uuid: string
) {
  console.log('[NotificationMessageHandler] Received message:', uuid, message.type);

  if (message.type === 'initial' && Array.isArray(message.data)) {
    handleInitialNotifications(message.data, connection, uuid);
    return;
  }

  if (message.type === 'notification' && message.notification) {
    handleNewNotification(message.notification, connection, uuid);
    return;
  }

  console.log('[NotificationMessageHandler] Unknown message type:', message.type);
}

/**
 * 处理初始通知列表
 * 全部存入 allNotifications,不过滤
 */
function handleInitialNotifications(
  notifications: any[],
  connection: DeviceConnection,
  uuid: string
) {
  console.log('[NotificationMessageHandler] Processing initial notifications:', notifications.length);

  // 直接存入内存,不过滤
  connection.allNotifications = notifications;

  console.log(`[NotificationMessageHandler] Synced ${notifications.length} notifications for device: ${uuid}`);
}

/**
 * 处理新通知
 * 直接添加到 allNotifications,不过滤
 */
function handleNewNotification(
  notification: any,
  connection: DeviceConnection,
  uuid: string
) {
  console.log('[NotificationMessageHandler] Processing new notification:', notification.id);

  // 直接添加,不过滤
  connection.allNotifications.push(notification);

  console.log(`[NotificationMessageHandler] Total notifications: ${connection.allNotifications.length}`);
}
