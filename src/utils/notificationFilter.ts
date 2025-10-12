import { filterConfigController } from '../data/notification-filter-config';

// 重要的系统应用白名单 - 即使是 com.android.* 也不过滤
const SYSTEM_APP_WHITELIST = [
  'com.android.mms',      // 短信
  'com.android.phone',    // 电话
];

// 系统应用黑名单 - 强制过滤这些系统应用（优先级最高）
const SYSTEM_APP_BLACKLIST: string[] = [
  // 用户可以在这里添加想要过滤的系统应用
  // 例如：'com.android.mms' 如果想过滤短信
];

function matchesPackagePattern(packageName: string, pattern: string): boolean {
  try {
    let regexPattern = pattern;
    if (!pattern.includes('\\')) {
      regexPattern = regexPattern.replace(/\./g, '\\.');
      regexPattern = regexPattern.replace(/\*/g, '.*');
    }
    if (!regexPattern.startsWith('^')) {
      regexPattern = '^' + regexPattern;
    }
    if (!regexPattern.endsWith('$')) {
      regexPattern = regexPattern + '$';
    }
    const regex = new RegExp(regexPattern);
    return regex.test(packageName);
  } catch (e) {
    console.warn('[notificationFilter] Invalid regex pattern:', pattern, e);
    return false;
  }
}

function shouldFilterByPackage(notification: any): boolean {
  const packageName = notification.packageName || '';

  const blacklist = filterConfigController.getPackageFilter('package-blacklist');
  if (blacklist && blacklist.enabled && blacklist.patterns.length > 0) {
    const matched = blacklist.patterns.some(pattern =>
      matchesPackagePattern(packageName, pattern)
    );
    if (matched) {
      return true;
    }
  }

  const whitelist = filterConfigController.getPackageFilter('package-whitelist');
  if (whitelist && whitelist.enabled && whitelist.patterns.length > 0) {
    const matched = whitelist.patterns.some(pattern =>
      matchesPackagePattern(packageName, pattern)
    );
    if (!matched) {
      return true;
    }
  }

  return false;
}

export function isVisibleNotification(notification: any): boolean {
  if (shouldFilterByPackage(notification)) {
    return false;
  }

  // 1. 过滤常驻通知 (FLAG_ONGOING_EVENT)
  if (filterConfigController.isRuleEnabled('ongoing-notification')) {
    const flags = notification.flags || 0;
    const FLAG_ONGOING_EVENT = 0x00000002; // Android Notification.FLAG_ONGOING_EVENT
    if ((flags & FLAG_ONGOING_EVENT) !== 0) {
      return false;
    }
  }

  // 2. 过滤系统通知
  if (filterConfigController.isRuleEnabled('system-notification')) {
    const packageName = notification.packageName || '';

    // 优先检查黑名单，如果在黑名单中，直接过滤
    const isBlacklisted = SYSTEM_APP_BLACKLIST.some(blacklistedPkg =>
      packageName === blacklistedPkg
    );
    if (isBlacklisted) {
      return false;
    }

    // 检查是否在白名单中
    const isWhitelisted = SYSTEM_APP_WHITELIST.some(whitelistedPkg =>
      packageName === whitelistedPkg
    );

    // 只有不在白名单中的系统应用才会被过滤
    if (!isWhitelisted && (packageName === 'android' || packageName.startsWith('com.android.'))) {
      return false;
    }
  }

  // 3. 过滤无内容通知
  if (filterConfigController.isRuleEnabled('empty-content')) {
    const title = (notification.title || '').trim();
    const text = (notification.text || '').trim();
    if (!title && !text) {
      return false;
    }
  }

  // 4. 过滤低优先级通知
  if (filterConfigController.isRuleEnabled('low-priority')) {
    // Android priority: -2 (MIN), -1 (LOW), 0 (DEFAULT), 1 (HIGH), 2 (MAX)
    const priority = notification.priority ?? 0;
    // Android importance: 0 (NONE), 1 (MIN), 2 (LOW), 3 (DEFAULT), 4 (HIGH), 5 (MAX)
    const importance = notification.importance ?? 3;

    // 过滤优先级 < 0 或重要性 < 3 的通知
    if (priority < 0 || importance < 3) {
      return false;
    }
  }

  if (filterConfigController.isRuleEnabled('foreground-service')) {
    const channelId = notification.channelId || '';
    if (channelId.toLowerCase().includes('foreground') ||
        channelId.toLowerCase().includes('hide_foreground')) {
      return false;
    }
  }

  if (filterConfigController.isRuleEnabled('group-summary')) {
    const title = notification.title || '';
    if (title.includes('GroupSummary')) {
      return false;
    }
  }

  if (filterConfigController.isRuleEnabled('running-service')) {
    const title = notification.title || '';
    const text = notification.text || '';
    if (title.includes('正在运行') && text.includes('点按即可了解详情')) {
      return false;
    }
  }

  return true;
}

export function filterNotifications(notifications: any[]): any[] {
  return notifications.filter(isVisibleNotification);
}
