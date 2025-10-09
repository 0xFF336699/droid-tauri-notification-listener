import { Notification } from '../types/notification';

interface NotificationItemProps {
  notification: Notification;
  deviceUuid: string;
}

export function NotificationItem({ notification, deviceUuid }: NotificationItemProps) {
  const handleMarkRead = () => {
    // TODO: 调用标记已读函数
    console.log('[NotificationItem] Mark read:', deviceUuid, notification.id);
  };

  const handleDelete = () => {
    // TODO: 调用删除函数
    console.log('[NotificationItem] Delete:', deviceUuid, notification.id);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className={`notification-item ${notification.read ? 'read' : 'unread'}`}
      style={{
        backgroundColor: notification.read ? '#e6ffed' : '#ffe6e6',
        padding: '12px',
        borderRadius: '6px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
      }}
    >
      <div className="notification-content" style={{ flex: 1 }}>
        <div className="notification-title" style={{
          fontWeight: 600,
          marginBottom: '4px'
        }}>
          {notification.title || '(无标题)'}
        </div>
        <div className="notification-text" style={{
          opacity: 0.8,
          marginBottom: '8px'
        }}>
          {notification.text || '(无内容)'}
        </div>
        <div className="notification-meta" style={{
          fontSize: '12px',
          opacity: 0.6,
          display: 'flex',
          gap: '12px'
        }}>
          <span>{notification.package_name}</span>
          <span>{formatTime(notification.posted_at || notification.updated_at)}</span>
        </div>
      </div>

      <div className="notification-actions" style={{
        display: 'flex',
        gap: '4px',
        flexDirection: 'column'
      }}>
        <button
          onClick={handleMarkRead}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white'
          }}
        >
          已读
        </button>
        <button
          onClick={handleDelete}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#f44336',
            color: 'white'
          }}
        >
          删除
        </button>
      </div>
    </div>
  );
}
