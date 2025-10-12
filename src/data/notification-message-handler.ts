import { DeviceConnection, mainModelController } from './main-model-controller';

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
 * 根据 action 字段决定是添加还是移除通知
 */
function handleNewNotification(
  notification: any,
  connection: DeviceConnection,
  uuid: string
) {
  console.log('[NotificationMessageHandler] Processing notification:', notification.id, 'action:', notification.action);

  // 检查 action 类型
  if (notification.action === 'removed') {
    // 移除通知
    const index = connection.allNotifications.findIndex(n => n.id === notification.id);
    if (index !== -1) {
      connection.allNotifications.splice(index, 1);
      console.log(`[NotificationMessageHandler] Removed notification: ${notification.id}, total: ${connection.allNotifications.length}`);

      // 手动触发过滤更新，确保 UI 同步
      mainModelController.recomputeFilteredNotifications(connection);
    } else {
      console.warn(`[NotificationMessageHandler] Notification not found for removal: ${notification.id}`);
    }
  } else if (notification.action === 'posted' || notification.action === 'init') {
    // 添加新通知（posted 是新发布，init 是初始化）
    connection.allNotifications.push(notification);
    console.log(`[NotificationMessageHandler] Added notification: ${notification.id}, total: ${connection.allNotifications.length}`);

    // 手动触发过滤更新，确保 UI 同步
    mainModelController.recomputeFilteredNotifications(connection);
  } else {
    console.warn('[NotificationMessageHandler] Unknown action:', notification.action);
  }
}
