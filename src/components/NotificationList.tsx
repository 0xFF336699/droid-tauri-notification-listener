import React, { useState } from 'react';
import { filterConfigController } from '../data/notification-filter-config';

export interface Notification {
  id: string;
  package_name?: string;
  title?: string;
  text?: string;
  read: boolean;
  posted_at?: number;
  updated_at?: number;
}

interface NotificationListProps {
  notifications?: Notification[];
  onMarkRead?: (ids: string[]) => void;
  onDelete?: (id: string) => void;
}

/**
 * 通知列表组件
 * 显示单个设备的通知，支持标记已读和删除操作
 *
 * @example
 * ```tsx
 * <NotificationList
 *   notifications={notifications}
 *   onMarkRead={(ids) => console.log('Mark read:', ids)}
 *   onDelete={(id) => console.log('Delete:', id)}
 * />
 * ```
 */
export function NotificationList({
  notifications = [],
  onMarkRead,
  onDelete,
}: NotificationListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectNotification = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleMarkReadSelected = () => {
    if (selectedIds.size > 0 && onMarkRead) {
      onMarkRead(Array.from(selectedIds));
      setSelectedIds(new Set()); // 清空选择
    }
  };

  const handleDeleteNotification = (id: string) => {
    if (onDelete) {
      onDelete(id);
    }
    // 从选中列表移除
    const newSelected = new Set(selectedIds);
    newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="notification-list" style={styles.container}>
      {/* 工具栏 */}
      {notifications.length > 0 && (
        <div className="toolbar" style={styles.toolbar}>
          <div style={styles.toolbarLeft}>
            <span style={styles.count}>
              共 {notifications.length} 条通知
              {selectedIds.size > 0 && ` (已选 ${selectedIds.size} 条)`}
            </span>
          </div>
          <div style={styles.toolbarRight}>
            {selectedIds.size > 0 && (
              <button onClick={handleMarkReadSelected} style={styles.toolbarButton}>
                标记为已读
              </button>
            )}
          </div>
        </div>
      )}

      {/* 通知列表 */}
      {notifications.length === 0 ? (
        <div style={styles.empty}>
          <p>暂无通知</p>
        </div>
      ) : (
        <div className="notification-items" style={styles.items}>
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              selected={selectedIds.has(notification.id)}
              onSelect={handleSelectNotification}
              onDelete={handleDeleteNotification}
              formatTimestamp={formatTimestamp}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 单个通知项组件
interface NotificationItemProps {
  notification: Notification;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  formatTimestamp: (timestamp?: number) => string;
}

function NotificationItem({
  notification,
  selected,
  onSelect,
  onDelete,
  formatTimestamp,
}: NotificationItemProps) {
  // 展开/折叠状态
  const [expanded, setExpanded] = useState(false);

  // 兼容两种命名方式
  const packageName = notification.packageName || notification.package_name;
  const timestamp = notification.postTime || notification.posted_at || notification.updated_at;

  // 添加到黑名单
  function handleAddToBlacklist() {
    if (!packageName) return;

    if (!window.confirm(`确定要将 "${packageName}" 添加到黑名单吗？\n\n该应用的所有通知将被过滤。`)) {
      return;
    }

    // 先禁用白名单
    filterConfigController.setRuleEnabled('package-whitelist', false);
    // 启用黑名单
    filterConfigController.setRuleEnabled('package-blacklist', true);
    // 添加包名
    filterConfigController.addPackagePattern('package-blacklist', packageName);
  }

  // 添加到白名单
  function handleAddToWhitelist() {
    if (!packageName) return;

    if (!window.confirm(`确定要将 "${packageName}" 添加到白名单吗？\n\n将只显示该应用的通知,其他应用的通知将被过滤。`)) {
      return;
    }

    // 先禁用黑名单
    filterConfigController.setRuleEnabled('package-blacklist', false);
    // 启用白名单
    filterConfigController.setRuleEnabled('package-whitelist', true);
    // 添加包名
    filterConfigController.addPackagePattern('package-whitelist', packageName);
  }

  return (
    <div
      className={`notification-item ${notification.read ? 'read' : 'unread'}`}
      style={{
        ...styles.item,
        ...(notification.read ? styles.itemRead : styles.itemUnread),
      }}
    >
      <div style={styles.itemHeader}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(notification.id, e.target.checked)}
          style={styles.checkbox}
        />
        <div style={styles.itemInfo} onClick={() => setExpanded(!expanded)}>
          <div style={styles.itemTitle}>
            {!notification.read && <span style={styles.unreadDot}>●</span>}
            <h4 style={styles.title}>{notification.title || '无标题'}</h4>
            <span style={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
          </div>
          {!expanded && (
            <div style={styles.itemMeta}>
              <span style={styles.packageName}>{packageName}</span>
              <span style={styles.timestamp}>
                {formatTimestamp(timestamp)}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(notification.id)}
          style={styles.deleteButton}
          title="删除"
        >
          ✕
        </button>
      </div>

      {/* 展开后显示的详细信息 */}
      {expanded && (
        <div style={styles.itemDetails}>
          {notification.text && (
            <div style={styles.itemText}>
              <div style={styles.detailLabel}>内容:</div>
              <p style={styles.text}>{notification.text}</p>
            </div>
          )}
          <div style={styles.itemMeta}>
            <div style={styles.metaRow}>
              <span style={styles.detailLabel}>包名:</span>
              <span style={styles.packageName}>{packageName || '未知'}</span>
              {packageName && (
                <div style={styles.filterButtons}>
                  <button
                    onClick={handleAddToBlacklist}
                    style={styles.blacklistButton}
                    title="加入黑名单"
                  >
                    加入黑名单
                  </button>
                  <button
                    onClick={handleAddToWhitelist}
                    style={styles.whitelistButton}
                    title="加入白名单"
                  >
                    加入白名单
                  </button>
                </div>
              )}
            </div>
            <div style={styles.metaRow}>
              <span style={styles.detailLabel}>时间:</span>
              <span style={styles.timestamp}>
                {formatTimestamp(timestamp)}
              </span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.detailLabel}>ID:</span>
              <span style={styles.monospace}>{notification.id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 样式定义
const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '16px',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  toolbarLeft: {
    flex: 1,
  },
  toolbarRight: {
    display: 'flex',
    gap: '8px',
  },
  count: {
    fontSize: '14px',
    color: '#666',
  },
  toolbarButton: {
    padding: '4px 12px',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  empty: {
    padding: '32px',
    textAlign: 'center',
    color: '#999',
  },
  items: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  item: {
    padding: '12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fff',
  },
  itemUnread: {
    borderLeftWidth: '3px',
    borderLeftColor: '#1976d2',
    backgroundColor: '#f0f7ff',
  },
  itemRead: {
    opacity: 0.7,
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  checkbox: {
    marginTop: '4px',
    cursor: 'pointer',
  },
  itemInfo: {
    flex: 1,
    cursor: 'pointer',
  },
  itemTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  expandIcon: {
    fontSize: '10px',
    color: '#999',
    marginLeft: 'auto',
  },
  unreadDot: {
    color: '#1976d2',
    fontSize: '10px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 500,
  },
  itemMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#666',
  },
  packageName: {
    fontFamily: 'monospace',
  },
  timestamp: {},
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    fontSize: '16px',
  },
  itemText: {
    marginTop: '8px',
    marginBottom: '8px',
  },
  text: {
    margin: 0,
    fontSize: '14px',
    color: '#333',
    lineHeight: 1.5,
  },
  itemDetails: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e0e0e0',
    marginLeft: '28px',
  },
  detailLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    marginRight: '8px',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  monospace: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#666',
  },
  filterButtons: {
    display: 'flex',
    gap: '8px',
    marginLeft: '8px',
  },
  blacklistButton: {
    padding: '4px 10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  whitelistButton: {
    padding: '4px 10px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
};
