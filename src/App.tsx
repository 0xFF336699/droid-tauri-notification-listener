import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { useSocketConnection } from "./useSocketConnection";
import SocketSettings from "./SocketSettings";

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

  // 使用Socket连接管理
  const {
    connectionState,
    showSettings,
    setShowSettings,
    connect
  } = useSocketConnection();

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

  // Socket连接成功回调
  const handleSocketConnected = async (config: any) => {
    try {
      const success = await connect(config);
      if (success) {
        setShowSettings(false);
        log("Socket连接成功", { data: config });
      } else {
        log("Socket连接失败");
      }
    } catch (error) {
      log("Socket连接出错", { data: error });
    }
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

  // 如果显示设置页面，渲染设置界面
  if (showSettings) {
    return (
      <main className="container">
        <SocketSettings
          onConnected={handleSocketConnected}
        />
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
          padding: "6px 10px",
          background: "#f2f3f5",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 600 }}>通知中心</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowSettings(true)}
            title="设置连接"
            style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer' }}
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
            style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer' }}
          >
            ─
          </button>
        </div>
      </div>

      {/* 连接状态指示器 */}
      <div style={{
        padding: "8px 16px",
        backgroundColor: connectionState.status === 'connected' ? '#e8f5e8' :
                        connectionState.status === 'error' ? '#ffebee' : '#f5f5f5',
        borderBottom: "1px solid #ddd",
        fontSize: "14px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor:
              connectionState.status === 'connected' ? '#4caf50' :
              connectionState.status === 'connecting' ? '#ff9800' :
              connectionState.status === 'error' ? '#f44336' : '#9e9e9e'
          }}></span>
          <span>
            {connectionState.status === 'connected' && '已连接'}
            {connectionState.status === 'connecting' && '连接中...'}
            {connectionState.status === 'error' && `连接错误: ${connectionState.error}`}
            {connectionState.status === 'disconnected' && '未连接'}
          </span>
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
    </main>
  );
}

export default App;
