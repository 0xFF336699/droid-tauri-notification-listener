import { filterConfigController } from '../data/notification-filter-config';

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
  const packageName = notification.packageName || notification.package_name || '';

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
