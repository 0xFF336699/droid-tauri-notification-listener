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
 * 合并去重，避免重连后消息重复
 */
function handleInitialNotifications(
  notifications: any[],
  connection: DeviceConnection,
  uuid: string
) {
  console.log('[NotificationMessageHandler] Processing initial notifications:', notifications.length);

  // 不直接覆盖，而是合并去重
  // 为每个初始通知检查是否已存在
  const existingMap = new Map<string, any>();

  // 先记录现有的通知（用 packageName_id 作为key）
  connection.allNotifications.forEach(n => {
    const key = `${n.packageName}_${n.id}`;
    existingMap.set(key, n);
  });

  // 用新通知更新或添加
  notifications.forEach(newNotif => {
    const key = `${newNotif.packageName}_${newNotif.id}`;
    existingMap.set(key, newNotif); // 覆盖旧的或添加新的
  });

  // 将合并后的结果写回
  connection.allNotifications = Array.from(existingMap.values());

  console.log(`[NotificationMessageHandler] Merged ${notifications.length} initial notifications, total: ${connection.allNotifications.length}`);
}

/**
 * 处理新通知
 * 根据 action 字段决定是添加还是移除通知
 * 添加去重检查，避免重复消息
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
    // 添加去重检查：检查是否已存在相同 packageName + id 的通知
    const existingIndex = connection.allNotifications.findIndex(
      n => n.packageName === notification.packageName && n.id === notification.id
    );

    if (existingIndex !== -1) {
      // 如果已存在，更新它而不是添加新的
      console.log(`[NotificationMessageHandler] Updating existing notification: ${notification.id}`);
      connection.allNotifications[existingIndex] = notification;
    } else {
      // 不存在才添加
      connection.allNotifications.push(notification);
      console.log(`[NotificationMessageHandler] Added notification: ${notification.id}, total: ${connection.allNotifications.length}`);
    }

    // 手动触发过滤更新，确保 UI 同步
    mainModelController.recomputeFilteredNotifications(connection);
  } else {
    console.warn('[NotificationMessageHandler] Unknown action:', notification.action);
  }
}
