import { toProxy } from 'fanfanlo-deep-watcher';
import i18n from 'i18next';

// 包名过滤规则
export interface PackageFilterRule {
  id: string;
  enabled: boolean;
  mode: 'blacklist' | 'whitelist';
  patterns: string[];
}

// 过滤规则配置接口
export interface FilterRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  packageFilter?: PackageFilterRule;
}

// 过滤配置数据
export interface FilterConfig {
  rules: FilterRule[];
}

const STORAGE_KEY = 'notification-filter-config';

const DEFAULT_RULES: FilterRule[] = [
  {
    id: 'ongoing-notification',
    name: i18n.t('notificationFilter.rules.ongoing'),
    description: i18n.t('notificationFilter.rules.ongoingDesc'),
    enabled: true
  },
  {
    id: 'system-notification',
    name: i18n.t('notificationFilter.rules.system'),
    description: i18n.t('notificationFilter.rules.systemDesc'),
    enabled: true
  },
  {
    id: 'empty-content',
    name: i18n.t('notificationFilter.rules.empty'),
    description: i18n.t('notificationFilter.rules.emptyDesc'),
    enabled: true
  },
  {
    id: 'low-priority',
    name: i18n.t('notificationFilter.rules.lowPriority'),
    description: i18n.t('notificationFilter.rules.lowPriorityDesc'),
    enabled: true
  },
  {
    id: 'foreground-service',
    name: i18n.t('notificationFilter.rules.foreground'),
    description: i18n.t('notificationFilter.rules.foregroundDesc'),
    enabled: true
  },
  {
    id: 'group-summary',
    name: i18n.t('notificationFilter.rules.groupSummary'),
    description: i18n.t('notificationFilter.rules.groupSummaryDesc'),
    enabled: true
  },
  {
    id: 'running-service',
    name: i18n.t('notificationFilter.rules.runningService'),
    description: i18n.t('notificationFilter.rules.runningServiceDesc'),
    enabled: true
  },
  {
    id: 'package-blacklist',
    name: i18n.t('notificationFilter.rules.packageBlacklist'),
    description: i18n.t('notificationFilter.rules.packageBlacklistDesc'),
    enabled: false,
    packageFilter: {
      id: 'package-blacklist',
      enabled: false,
      mode: 'blacklist',
      patterns: []
    }
  },
  {
    id: 'package-whitelist',
    name: i18n.t('notificationFilter.rules.packageWhitelist'),
    description: i18n.t('notificationFilter.rules.packageWhitelistDesc'),
    enabled: false,
    packageFilter: {
      id: 'package-whitelist',
      enabled: false,
      mode: 'whitelist',
      patterns: []
    }
  }
];

function loadConfig(): FilterConfig {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const saved = JSON.parse(json);
      const mergedRules = DEFAULT_RULES.map(defaultRule => {
        const savedRule = saved.rules?.find((r: FilterRule) => r.id === defaultRule.id);
        if (savedRule) {
          if (defaultRule.packageFilter && savedRule.packageFilter) {
            return {
              ...defaultRule,
              ...savedRule,
              packageFilter: {
                ...defaultRule.packageFilter,
                ...savedRule.packageFilter
              }
            };
          }
          return savedRule;
        }
        return defaultRule;
      });
      return { rules: mergedRules };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(i18n.t('notificationFilter.messages.configLoadError', { error: errorMessage }));
  }
  return { rules: [...DEFAULT_RULES] };
}

function saveConfig(config: FilterConfig) {
  try {
    const json = JSON.stringify(config);
    localStorage.setItem(STORAGE_KEY, json);
    console.log(i18n.t('notificationFilter.messages.configSaved'));
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(i18n.t('notificationFilter.messages.configSaveError', { error: errorMessage }));
  }
}

const config: FilterConfig = toProxy(loadConfig());

function setRuleEnabled(ruleId: string, enabled: boolean) {
  const rule = config.rules.find(r => r.id === ruleId);
  if (rule) {
    rule.enabled = enabled;
    if (rule.packageFilter) {
      rule.packageFilter.enabled = enabled;
    }
    saveConfig(config);
    console.log(`[FilterConfig] Rule "${ruleId}" ${enabled ? i18n.t('common.enabled') : i18n.t('common.disabled')}`);
  }
}

function isRuleEnabled(ruleId: string): boolean {
  const rule = config.rules.find(r => r.id === ruleId);
  return rule?.enabled ?? false;
}

function addPackagePattern(ruleId: string, pattern: string) {
  const rule = config.rules.find(r => r.id === ruleId);
  if (!rule || !rule.packageFilter) return;

  if (!rule.packageFilter.patterns.includes(pattern)) {
    rule.packageFilter.patterns.push(pattern);
    saveConfig(config);
    console.log(i18n.t('notificationFilter.messages.patternAdded', { pattern }));
  }
}

function removePackagePattern(ruleId: string, pattern: string) {
  const rule = config.rules.find(r => r.id === ruleId);
  if (!rule || !rule.packageFilter) return;

  const index = rule.packageFilter.patterns.indexOf(pattern);
  if (index > -1) {
    rule.packageFilter.patterns.splice(index, 1);
    saveConfig(config);
    console.log(i18n.t('notificationFilter.messages.patternRemoved', { pattern }));
  }
}

function setPackageFilterMode(ruleId: string, mode: 'blacklist' | 'whitelist') {
  const rule = config.rules.find(r => r.id === ruleId);
  if (!rule || !rule.packageFilter) return;

  rule.packageFilter.mode = mode;
  saveConfig(config);
  console.log(i18n.t('notificationFilter.messages.modeChanged', { mode: i18n.t(`notificationFilter.modes.${mode}`) }));
}

function getPackageFilter(ruleId: string): PackageFilterRule | undefined {
  const rule = config.rules.find(r => r.id === ruleId);
  return rule?.packageFilter;
}

function resetConfig() {
  config.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  saveConfig(config);
  console.log(i18n.t('notificationFilter.messages.configReset'));
}

export const filterConfigController = {
  config,
  setRuleEnabled,
  isRuleEnabled,
  addPackagePattern,
  removePackagePattern,
  setPackageFilterMode,
  getPackageFilter,
  resetConfig,
};
