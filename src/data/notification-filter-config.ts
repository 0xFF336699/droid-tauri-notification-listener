import { toProxy } from 'fanfanlo-deep-watcher';

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
    id: 'foreground-service',
    name: '前台服务通知',
    description: '过滤 channelId 包含 "foreground" 的通知',
    enabled: true
  },
  {
    id: 'group-summary',
    name: '分组摘要通知',
    description: '过滤 title 包含 "GroupSummary" 的通知',
    enabled: true
  },
  {
    id: 'running-service',
    name: '正在运行通知',
    description: '过滤 "正在运行" + "点按即可了解详情" 的通知',
    enabled: true
  },
  {
    id: 'package-blacklist',
    name: '包名黑名单',
    description: '过滤指定包名的通知 (支持正则)',
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
    name: '包名白名单',
    description: '只显示指定包名的通知 (支持正则)',
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
    console.error('[FilterConfig] Failed to load config:', e);
  }
  return { rules: [...DEFAULT_RULES] };
}

function saveConfig(config: FilterConfig) {
  try {
    const json = JSON.stringify(config);
    localStorage.setItem(STORAGE_KEY, json);
    console.log('[FilterConfig] Config saved');
  } catch (e) {
    console.error('[FilterConfig] Failed to save config:', e);
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
    console.log(`[FilterConfig] Rule "${ruleId}" ${enabled ? 'enabled' : 'disabled'}`);
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
    console.log(`[FilterConfig] Added pattern "${pattern}" to ${ruleId}`);
  }
}

function removePackagePattern(ruleId: string, pattern: string) {
  const rule = config.rules.find(r => r.id === ruleId);
  if (!rule || !rule.packageFilter) return;

  const index = rule.packageFilter.patterns.indexOf(pattern);
  if (index > -1) {
    rule.packageFilter.patterns.splice(index, 1);
    saveConfig(config);
    console.log(`[FilterConfig] Removed pattern "${pattern}" from ${ruleId}`);
  }
}

function setPackageFilterMode(ruleId: string, mode: 'blacklist' | 'whitelist') {
  const rule = config.rules.find(r => r.id === ruleId);
  if (!rule || !rule.packageFilter) return;

  rule.packageFilter.mode = mode;
  saveConfig(config);
  console.log(`[FilterConfig] Set ${ruleId} mode to ${mode}`);
}

function getPackageFilter(ruleId: string): PackageFilterRule | undefined {
  const rule = config.rules.find(r => r.id === ruleId);
  return rule?.packageFilter;
}

function resetConfig() {
  config.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  saveConfig(config);
  console.log('[FilterConfig] Config reset to defaults');
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
