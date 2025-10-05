//! Tauri commands 与应用状态（临时内存版，后续接入 SQLite）。
//! 初期打开日志，稳定后再降级。

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::sync::Arc;
use parking_lot::RwLock;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::types::Notification;
use crate::network_utils;
use crate::temp_server::{TempServer, PairingData};
use crate::android_client::AndroidSocketClient;

#[derive(Default)]
pub struct AppState {
    // 通知存储（临时内存实现）：id -> Notification
    notifications: Mutex<HashMap<String, Notification>>,
    // 已读集合
    read_set: Mutex<HashSet<String>>,
    // 临时服务器（用于扫码配对）
    temp_server: Arc<RwLock<Option<TempServer>>>,
    // 客户端连接池：connection_id -> AndroidSocketClient
    clients: Arc<RwLock<HashMap<String, Arc<AndroidSocketClient>>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Counts {
    pub unread: usize,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempServerStatus {
    pub running: bool,
    pub port: u16,
    pub waiting_for_pairing: bool,
}

impl AppState {
    fn counts(&self) -> Counts {
        let map = self.notifications.lock().unwrap();
        let read = self.read_set.lock().unwrap();
        let total = map.len();
        let unread = total.saturating_sub(read.len());
        Counts { unread, total }
    }
}

#[tauri::command]
pub fn get_counts(state: State<AppState>) -> Counts {
    let counts = state.counts();
    println!("[cmd] get_counts -> unread={}, total={}", counts.unread, counts.total);
    counts
}

#[tauri::command]
pub fn list_notifications(state: State<AppState>) -> Vec<Notification> {
    let map = state.notifications.lock().unwrap();
    let mut list: Vec<Notification> = map.values().cloned().collect();
    // 新 -> 旧（按 updated_at/posted_at）
    list.sort_by(|a, b| {
        let at = a.updated_at.or(a.posted_at).unwrap_or_default();
        let bt = b.updated_at.or(b.posted_at).unwrap_or_default();
        bt.cmp(&at)
    });
    println!("[cmd] list_notifications -> {} items", list.len());
    list
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdsOptions {
    pub ids: Vec<String>,
}

#[tauri::command]
pub fn mark_read(state: State<AppState>, options: IdsOptions) -> bool {
    let mut read = state.read_set.lock().unwrap();
    let mut map = state.notifications.lock().unwrap();
    for id in options.ids.iter() {
        read.insert(id.clone());
        if let Some(n) = map.get_mut(id) {
            n.read = true;
        }
    }
    println!("[cmd] mark_read -> {} ids", options.ids.len());
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdOptions {
    pub id: String,
}

#[tauri::command]
pub fn delete(state: State<AppState>, options: IdOptions) -> bool {
    let mut map = state.notifications.lock().unwrap();
    let mut read = state.read_set.lock().unwrap();
    map.remove(&options.id);
    read.remove(&options.id);
    println!("[cmd] delete -> {}", options.id);
    true
}

#[tauri::command]
pub fn delete_all(state: State<AppState>) -> bool {
    let mut map = state.notifications.lock().unwrap();
    let mut read = state.read_set.lock().unwrap();
    let n = map.len();
    map.clear();
    read.clear();
    println!("[cmd] delete_all -> cleared {} items", n);
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddDummyOptions {
    pub count: Option<u32>,
}

#[tauri::command]
pub fn add_dummy(state: State<AppState>, options: Option<AddDummyOptions>) -> bool {
    let count = options.and_then(|o| o.count).unwrap_or(5).clamp(1, 50);
    let mut map = state.notifications.lock().unwrap();
    let now = chrono::Utc::now().timestamp();
    for i in 0..count {
        let id = format!("demo-{}-{}", now, i);
        let n = Notification {
            id: id.clone(),
            package_name: Some("com.demo.app".into()),
            title: Some(format!("演示标题 {}", i + 1)),
            text: Some(format!("这是第 {} 条示例通知", i + 1)),
            read: false,
            posted_at: Some(now + i as i64),
            updated_at: None,
        };
        map.insert(id, n);
    }
    println!("[cmd] add_dummy -> {} items", count);
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectToServerOptions {
    pub host: String,
    pub token: Option<String>,
}

// ============ 网络工具命令 ============

#[tauri::command]
pub fn check_port_available(port: u16) -> bool {
    network_utils::check_port_available(port)
}

#[tauri::command]
pub fn find_available_port(start_port: u16) -> Option<u16> {
    network_utils::find_available_port(start_port)
}

#[tauri::command]
pub fn get_local_ip() -> Result<String, String> {
    network_utils::get_local_ip()
}

// ============ PC临时服务器命令（用于扫码配对） ============

#[tauri::command]
pub async fn start_temp_server(state: State<'_, AppState>, port: u16) -> Result<u16, String> {
    println!("[cmd] start_temp_server -> port={}", port);

    // 先停止旧服务器（如果存在）
    {
        let mut temp_server_lock = state.temp_server.write();
        if temp_server_lock.is_some() {
            println!("[cmd] start_temp_server -> stopping existing server");
            *temp_server_lock = None; // 丢弃旧服务器，自动释放端口
        }
    }

    // 启动新服务器
    let server = TempServer::new(port)?;
    let actual_port = server.port();

    *state.temp_server.write() = Some(server);

    println!("[cmd] start_temp_server -> started on port {}", actual_port);
    Ok(actual_port)
}

#[tauri::command]
pub async fn wait_for_pairing(state: State<'_, AppState>, timeout_secs: u64) -> Result<PairingData, String> {
    println!("[cmd] wait_for_pairing -> timeout_secs={}", timeout_secs);

    let server_guard = state.temp_server.read();
    let server = server_guard.as_ref()
        .ok_or("Temp server not started")?;

    let result = server.wait_for_pairing(timeout_secs);

    println!("[cmd] wait_for_pairing -> result: {:?}", result.is_ok());
    result
}

#[tauri::command]
pub async fn stop_temp_server(state: State<'_, AppState>) -> Result<(), String> {
    println!("[cmd] stop_temp_server");

    let mut server_guard = state.temp_server.write();
    if let Some(mut server) = server_guard.take() {
        server.stop();
    }

    Ok(())
}

#[tauri::command]
pub async fn get_temp_server_status(state: State<'_, AppState>) -> Result<Option<TempServerStatus>, String> {
    let temp_server_lock = state.temp_server.read();

    if let Some(server) = temp_server_lock.as_ref() {
        Ok(Some(TempServerStatus {
            running: true,
            port: server.port(),
            waiting_for_pairing: server.is_waiting_for_pairing(),
        }))
    } else {
        Ok(None)
    }
}

// ============ 安卓客户端连接命令 ============

#[tauri::command]
pub async fn connect_to_android(
    state: State<'_, AppState>,
    connection_id: String,
    host: String,
    token: Option<String>,
) -> Result<String, String> {
    println!("[cmd] connect_to_android -> connection_id={}, host={}, has_token={}",
        connection_id, host, token.is_some());

    // 创建客户端连接
    let client = AndroidSocketClient::connect(&host, connection_id.clone())?;

    // 如果有token，直接登录；否则请求token
    let final_token = if let Some(t) = token {
        client.login(&t)?;
        t
    } else {
        client.request_token()?
    };

    // 保存客户端到连接池
    state.clients.write().insert(connection_id.clone(), Arc::new(client));

    println!("[cmd] connect_to_android -> success, token_len={}", final_token.len());
    Ok(final_token)
}

#[tauri::command]
pub async fn disconnect_android(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<(), String> {
    println!("[cmd] disconnect_android -> connection_id={}", connection_id);

    state.clients.write().remove(&connection_id);

    println!("[cmd] disconnect_android -> removed");
    Ok(())
}

// ============ 旧的connect_to_server命令（保留兼容性） ============

#[tauri::command]
pub fn connect_to_server(_state: State<AppState>, options: ConnectToServerOptions) -> bool {
    println!("[cmd] connect_to_server (deprecated) -> host={}, token={}",
        options.host,
        options.token.as_ref().map(|_| "***").unwrap_or("none"));

    println!("[cmd] This command is deprecated, use connect_to_android instead");
    false
}
