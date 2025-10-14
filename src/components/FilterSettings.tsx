import { useState } from 'react';
import { useProxyWatch, useProxyWatchUpdates } from 'fanfanlo-deep-watcher';
import { filterConfigController, FilterRule } from '../data/notification-filter-config';
import { useTranslation } from 'react-i18next';

// 基础过滤规则组件
function BasicFilterRuleItem({ ruleId }: { ruleId: string }) {
  const rule = filterConfigController.config.rules.find(r => r.id === ruleId);

  // 监听该规则的 enabled 属性
  const [enabled] = useProxyWatch(
    rule!,
    'enabled',
    rule!.enabled
  );

  if (!rule) return null;

  return (
    <div style={styles.ruleItem}>
      <label style={styles.ruleLabel}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            filterConfigController.setRuleEnabled(ruleId, e.target.checked)
          }
          style={styles.checkbox}
        />
        <div style={styles.ruleLabelText}>
          <div style={styles.ruleName}>{rule.name}</div>
          <div style={styles.ruleDesc}>{rule.description}</div>
        </div>
      </label>
    </div>
  );
}

// 包名过滤规则组件
function PackageFilterRuleItem({ ruleId }: { ruleId: string }) {
  const { t } = useTranslation();
  const rule = filterConfigController.config.rules.find(r => r.id === ruleId);

  // 监听该规则的 enabled 属性
  const [enabled] = useProxyWatch(
    rule!,
    'enabled',
    rule!.enabled
  );

  // 监听 packageFilter.patterns 的变化
  // const [patterns] = useProxyWatch(
  //   rule!.packageFilter!,
  //   'patterns',
  //   rule!.packageFilter!.patterns
  // );

  const [patterns] = useProxyWatchUpdates(rule!, 'packageFilter.patterns', rule?.packageFilter?.patterns || []);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  if (!rule || !rule.packageFilter) return null;

  // 验证正则表达式
  function validatePattern(pattern: string): boolean {
    if (!pattern.trim()) return false;
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }

  // 添加包名模式
  function handleAddPattern() {
    const trimmed = input.trim();
    if (!trimmed) {
      setInputError(t('filter.enterPackageOrRegex', '请输入包名或正则表达式'));
      return;
    }

    if (!validatePattern(trimmed)) {
      setInputError(t('filter.invalidRegex', '无效的正则表达式'));
      return;
    }

    filterConfigController.addPackagePattern(ruleId, trimmed);
    setInput('');
    setInputError(null);
  }

  // 删除包名模式
  function handleRemovePattern(pattern: string) {
    const ruleName = rule.name;
    if (window.confirm(t('filter.confirmRemovePattern', { rule: ruleName, pattern }))) {
      filterConfigController.removePackagePattern(ruleId, pattern);
    }
  }

  // 处理黑白名单互斥逻辑
  function handleToggle(checked: boolean) {
    if (checked) {
      // 启用当前规则时,禁用对方规则
      const otherRuleId = ruleId === 'package-blacklist'
        ? 'package-whitelist'
        : 'package-blacklist';
      filterConfigController.setRuleEnabled(otherRuleId, false);
    }
    filterConfigController.setRuleEnabled(ruleId, checked);
  }

  return (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>{rule.name}</h4>
      <div style={styles.ruleItem}>
        <label style={styles.ruleLabel}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            style={styles.checkbox}
          />
          <div style={styles.ruleLabelText}>
            <div style={styles.ruleName}>{rule.name}</div>
            <div style={styles.ruleDesc}>{rule.description}</div>
          </div>
        </label>

        {enabled && (
          <div style={styles.patternList}>
            {/* 已有的模式列表 */}
            {patterns.map((pattern) => (
              <div key={pattern} style={styles.patternItem}>
                <span style={styles.patternText}>{pattern}</span>
                <button
                  onClick={() => handleRemovePattern(pattern)}
                  style={styles.deleteButton}
                  title={t('common.delete', '删除')}
                >
                  ×
                </button>
              </div>
            ))}

            {/* 添加新模式 */}
            <div style={styles.addPattern}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPattern();
                  }
                }}
                placeholder={t('filter.enterPackageOrRegexPlaceholder', '输入包名或正则表达式')}
                style={styles.input}
              />
              <button
                onClick={handleAddPattern}
                style={styles.addButton}
              >
                {t('filter.actions.addPattern', '添加模式')}
              </button>
            </div>

            {/* 输入提示 */}
            <div style={styles.hint}>
              <div style={styles.hintTitle}>{t('filter.hint.title', '提示:')}</div>
              <div style={styles.hintItem}>• {t('filter.hint.exact', '精确匹配: com.tencent.mm')}</div>
              <div style={styles.hintItem}>• {t('filter.hint.wildcard', '通配符: com.jd.*, *.xiaomi.*')}</div>
              <div style={styles.hintItem}>• {t('filter.hint.regex', '正则: ^com\\.(jd|jingdong)\\..*$')}</div>
            </div>

            {inputError && <div style={styles.error}>{inputError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// 主组件
export function FilterSettings() {
  const { t } = useTranslation();
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📋 {t('filter.title', '过滤规则')}</h3>
        <button
          onClick={() => {
            if (window.confirm(t('filter.confirmReset', '确定要重置为默认配置吗？'))) {
              filterConfigController.resetConfig();
            }
          }}
          style={styles.resetButton}
        >
          {t('filter.actions.reset', '重置为默认')}
        </button>
      </div>

      {/* 基础过滤规则 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>{t('filter.basicRulesTitle', '基础过滤规则')}</h4>

        {/* ✅ 从 Android 端迁移的过滤规则 */}
        <BasicFilterRuleItem ruleId="ongoing-notification" />
        <BasicFilterRuleItem ruleId="system-notification" />
        <BasicFilterRuleItem ruleId="empty-content" />
        <BasicFilterRuleItem ruleId="low-priority" />

        {/* 原有的过滤规则 */}
        <BasicFilterRuleItem ruleId="foreground-service" />
        <BasicFilterRuleItem ruleId="group-summary" />
        <BasicFilterRuleItem ruleId="running-service" />
      </div>

      {/* 包名黑名单 */}
      <PackageFilterRuleItem ruleId="package-blacklist" />

      {/* 包名白名单 */}
      <PackageFilterRuleItem ruleId="package-whitelist" />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '2px solid #e0e0e0',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
  },
  resetButton: {
    padding: '6px 12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: 600,
    color: '#444',
  },
  ruleItem: {
    marginBottom: '12px',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
  },
  ruleLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    cursor: 'pointer',
    gap: '8px',
  },
  checkbox: {
    marginTop: '2px',
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  },
  ruleLabelText: {
    flex: 1,
  },
  ruleName: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px',
  },
  ruleDesc: {
    fontSize: '12px',
    color: '#666',
    lineHeight: '1.4',
  },
  patternList: {
    marginTop: '12px',
    paddingLeft: '24px',
  },
  patternItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginBottom: '6px',
  },
  patternText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#333',
  },
  deleteButton: {
    padding: '2px 8px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  addPattern: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'monospace',
  },
  addButton: {
    padding: '6px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  hint: {
    padding: '8px 12px',
    backgroundColor: '#e7f3ff',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#555',
  },
  hintTitle: {
    fontWeight: 600,
    marginBottom: '4px',
  },
  hintItem: {
    marginLeft: '8px',
    lineHeight: '1.6',
  },
  error: {
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#ffe6e6',
    border: '1px solid #ff4d4d',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#c00',
  },
};
