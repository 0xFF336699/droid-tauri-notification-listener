import React, { useState } from 'react';

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
        <div style={styles.itemInfo}>
          <div style={styles.itemTitle}>
            {!notification.read && <span style={styles.unreadDot}>●</span>}
            <h4 style={styles.title}>{notification.title || '无标题'}</h4>
          </div>
          <div style={styles.itemMeta}>
            <span style={styles.packageName}>{notification.package_name}</span>
            <span style={styles.timestamp}>
              {formatTimestamp(notification.posted_at || notification.updated_at)}
            </span>
          </div>
        </div>
        <button
          onClick={() => onDelete(notification.id)}
          style={styles.deleteButton}
          title="删除"
        >
          ✕
        </button>
      </div>
      {notification.text && (
        <div style={styles.itemText}>
          <p style={styles.text}>{notification.text}</p>
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
  },
  itemTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
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
    marginLeft: '28px', // 对齐到 checkbox 之后
  },
  text: {
    margin: 0,
    fontSize: '14px',
    color: '#333',
    lineHeight: 1.5,
  },
};
