import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import AddConnectionDialog from "./components/AddConnectionDialog";
import ConnectionManager from "./components/ConnectionManager";
import { ConnectionStorage } from "./types/connectionStorage";

type Notification = {
  id: string;
  package_name?: string;
  title?: string;
  text?: string;
  read: boolean;
  posted_at?: number;
  updated_at?: number;
};

type Counts = {
  unread: number;
  total: number;
};

function App() {
  const [counts, setCounts] = useState<Counts>({ unread: 0, total: 0 });
  const [items, setItems] = useState<Notification[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 添加连接管理相关状态
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 迁移旧配置
  useEffect(() => {
    ConnectionStorage.migrateFromOldConfig();
  }, []);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const log = (msg: string, options?: { data?: unknown }) => {
    // 初期详细日志，稳定后可降级
    if (options?.data) {
      console.log(`[UI] ${msg}`, options.data);
    } else {
      console.log(`[UI] ${msg}`);
    }
  };

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [c, list] = await Promise.all([
        invoke<Counts>("get_counts"),
        invoke<Notification[]>("list_notifications"),
      ]);
      setCounts(c);
      setItems(list);
      try {
        await invoke("set_tray_tooltip", { text: `未读 ${c.unread} / 总数 ${c.total}` });
      } catch (e) {
        console.warn("set_tray_tooltip failed", e);
      }
      log("refreshAll ok", { data: { counts: c, size: list.length } });
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();

    // 监听后端发来的"打开设置"事件
    const unlistenPromise = listen("open-settings", () => {
      log("event: open-settings");
      setShowSettings(true);
    });

    return () => {
      unlistenPromise.then((un) => un());
    };
  }, []);

  // 连接添加成功回调
  const handleConnectionAdded = (connectionId: string) => {
    log("连接已添加", { data: connectionId });
    setShowAddDialog(false);
    // 可以在这里触发连接到新添加的设备
  };

  function toggleSelect(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function doMarkRead() {
    if (selectedIds.length === 0) return;
    try {
      await invoke("mark_read", { options: { ids: selectedIds } });
      log("mark_read", { data: selectedIds });
      setSelected({});
      await refreshAll();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function doDelete(id: string) {
    try {
      await invoke("delete", { options: { id } });
      log("delete", { data: id });
      await refreshAll();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  async function doDeleteAll() {
    try {
      await invoke("delete_all");
      log("delete_all");
      await refreshAll();
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }

  // 如果显示设置页面，渲染连接管理界面
  if (showSettings) {
    return (
      <main className="container">
        {/* 可拖动标题栏 */}
        <div
          data-tauri-drag-region
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "linear-gradient(to right, #667eea 0%, #764ba2 100%)",
            color: "white",
            borderBottom: "1px solid #5568d3",
            position: "sticky",
            top: 0,
            zIndex: 10,
            cursor: "move",
            userSelect: "none",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "14px" }}>⚙️ 连接设置</div>
          <button
            onClick={async () => {
              try {
                const appWindow = getCurrentWindow();
                await appWindow.minimize();
              } catch (error) {
                console.error('最小化窗口失败:', error);
              }
            }}
            title="最小化"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '16px',
              borderRadius: '4px',
              color: 'white',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ─
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2>连接设置</h2>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              返回
            </button>
          </div>

          <button
            onClick={() => setShowAddDialog(true)}
            style={{
              marginBottom: '20px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + 添加连接
          </button>

          <ConnectionManager />
        </div>
      </main>
    );
  }

  // 主界面 - 只有在有连接时才显示
  return (
    <main className="container">
      {/* 自定义标题栏：可拖拽区域 */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "linear-gradient(to right, #667eea 0%, #764ba2 100%)",
          color: "white",
          borderBottom: "1px solid #5568d3",
          position: "sticky",
          top: 0,
          zIndex: 10,
          cursor: "move",
          userSelect: "none",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "14px" }}>📱 通知中心</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button
            onClick={() => setShowAddDialog(true)}
            title="添加连接"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '16px',
              borderRadius: '4px',
              color: 'white',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ➕
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="设置连接"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '16px',
              borderRadius: '4px',
              color: 'white',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ⚙️
          </button>
          <button
            onClick={async () => {
              try {
                const appWindow = getCurrentWindow();
                await appWindow.minimize();
              } catch (error) {
                console.error('最小化窗口失败:', error);
              }
            }}
            title="最小化"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '16px',
              borderRadius: '4px',
              color: 'white',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ─
          </button>
        </div>
      </div>

      <h2>通知列表</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div>
          <b>未读</b>: {counts.unread}
        </div>
        <div>
          <b>总数</b>: {counts.total}
        </div>
        <button onClick={refreshAll} disabled={loading}>
          刷新
        </button>
        <button
          onClick={async () => {
            try {
              await invoke("add_dummy", { options: { count: 5 } });
              log("add_dummy");
              await refreshAll();
            } catch (e) {
              console.error(e);
              setError(String(e));
            }
          }}
        >
          生成示例数据
        </button>
        <button onClick={doMarkRead} disabled={selectedIds.length === 0}>
          标记所选为已读
        </button>
        <button onClick={doDeleteAll} disabled={counts.total === 0}>
          全部删除
        </button>
      </div>

      {error && (
        <div style={{ color: "red", marginTop: 8 }}>错误: {error}</div>
      )}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((n) => {
          const time = n.updated_at ?? n.posted_at;
          const bg = n.read ? "#e6ffed" : "#ffe6e6"; // 绿 for 已读，红 for 未读
          return (
            <div
              key={n.id}
              style={{
                background: bg,
                padding: 8,
                borderRadius: 6,
                display: "flex",
                gap: 8,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={!!selected[n.id]}
                  onChange={() => toggleSelect(n.id)}
                  title="选择以标记为已读"
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{n.title ?? "(无标题)"}</div>
                  <div style={{ opacity: 0.8 }}>{n.text ?? "(无内容)"}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {n.package_name ?? "(unknown)"} · {time ?? "-"}
                  </div>
                </div>
              </div>
              <div>
                <button onClick={() => doDelete(n.id)}>删除</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 添加连接对话框 */}
      {showAddDialog && (
        <AddConnectionDialog
          onConnectionAdded={handleConnectionAdded}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </main>
  );
}

export default App;
