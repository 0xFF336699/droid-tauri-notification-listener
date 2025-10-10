import { Notification } from '../types/notification';

/**
 * 判断通知是否应该显示给用户
 *
 * 过滤规则:
 * 1. 前台服务通知 - channelId 包含 "foreground" 或 "hide_foreground"
 * 2. 分组摘要通知 - title 包含 "GroupSummary"
 * 3. "正在运行"通知 - title 包含 "正在运行" 且 text 包含 "点按即可了解详情"
 *
 * @param notification 通知对象
 * @returns true 表示应该显示, false 表示应该过滤
 */
export function isVisibleNotification(notification: any): boolean {
  // 1. 过滤前台服务通知
  const channelId = notification.channelId || '';
  if (channelId.toLowerCase().includes('foreground') ||
      channelId.toLowerCase().includes('hide_foreground')) {
    console.log('[notificationFilter] Filtered: foreground service -', {
      id: notification.id,
      packageName: notification.packageName,
      channelId: notification.channelId,
      title: notification.title
    });
    return false;
  }

  // 2. 过滤分组摘要通知
  const title = notification.title || '';
  if (title.includes('GroupSummary')) {
    console.log('[notificationFilter] Filtered: group summary -', {
      id: notification.id,
      packageName: notification.packageName,
      title: notification.title
    });
    return false;
  }

  // 3. 过滤"正在运行"通知
  const text = notification.text || '';
  if (title.includes('正在运行') && text.includes('点按即可了解详情')) {
    console.log('[notificationFilter] Filtered: running service -', {
      id: notification.id,
      packageName: notification.packageName,
      title: notification.title,
      text: notification.text
    });
    return false;
  }

  // 通过所有过滤规则,显示该通知
  return true;
}

/**
 * 过滤通知数组
 * @param notifications 通知数组
 * @returns 过滤后的通知数组
 */
export function filterNotifications(notifications: any[]): any[] {
  const beforeCount = notifications.length;
  const filtered = notifications.filter(isVisibleNotification);
  const afterCount = filtered.length;
  const filteredCount = beforeCount - afterCount;

  if (filteredCount > 0) {
    console.log(`[notificationFilter] Filtered ${filteredCount} notifications (${beforeCount} -> ${afterCount})`);
  }

  return filtered;
}
