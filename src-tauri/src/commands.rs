//! Tauri commands 与应用状态（临时内存版，后续接入 SQLite）。
//! 初期打开日志，稳定后再降级。

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::sync::Arc;
use parking_lot::RwLock as ParkingLotRwLock;
use tokio::sync::RwLock as TokioRwLock;

use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

use crate::types::Notification;
use crate::network_utils;
use crate::temp_server::TempServer;
use crate::android_client::AndroidSocketClient;

pub struct AppState {
    // 通知存储（临时内存实现）：id -> Notification
    notifications: Mutex<HashMap<String, Notification>>,
    // 已读集合
    read_set: Mutex<HashSet<String>>,
    // 临时服务器（用于扫码配对）- 使用tokio::sync::RwLock因为需要跨await
    temp_server: Arc<TokioRwLock<Option<TempServer>>>,
    // 配对数据（独立于TempServer，避免长时间持有server锁）
    pairing_data: Arc<TokioRwLock<Option<crate::temp_server::PairingData>>>,
    // 客户端连接池：connection_id -> AndroidSocketClient
    clients: Arc<ParkingLotRwLock<HashMap<String, Arc<AndroidSocketClient>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            notifications: Mutex::new(HashMap::new()),
            read_set: Mutex::new(HashSet::new()),
            temp_server: Arc::new(TokioRwLock::new(None)),
            pairing_data: Arc::new(TokioRwLock::new(None)),
            clients: Arc::new(ParkingLotRwLock::new(HashMap::new())),
        }
    }
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

#[tauri::command]
pub fn get_device_uuid() -> Result<String, String> {
    // 从配置文件读取UUID，如果不存在则生成新的
    use std::fs;
    use uuid::Uuid;

    let config_dir = dirs::config_dir()
        .ok_or("Failed to get config directory")?;
    let app_config_dir = config_dir.join("notification-listener-project");
    let uuid_file = app_config_dir.join("device_uuid.txt");

    // 创建配置目录（如果不存在）
    if !app_config_dir.exists() {
        fs::create_dir_all(&app_config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // 读取或生成UUID
    if uuid_file.exists() {
        fs::read_to_string(&uuid_file)
            .map_err(|e| format!("Failed to read UUID file: {}", e))
    } else {
        let new_uuid = Uuid::new_v4().to_string();
        fs::write(&uuid_file, &new_uuid)
            .map_err(|e| format!("Failed to write UUID file: {}", e))?;
        Ok(new_uuid)
    }
}

#[tauri::command]
pub fn get_os_type() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn get_os_version() -> Result<String, String> {
    Ok(format!(
        "{} {}",
        sysinfo::System::name().unwrap_or_else(|| "Unknown".to_string()),
        sysinfo::System::os_version().unwrap_or_else(|| "Unknown".to_string())
    ))
}

#[tauri::command]
pub fn get_hostname() -> Result<String, String> {
    Ok(sysinfo::System::host_name().unwrap_or_else(|| "Unknown".to_string()))
}

// ============ PC临时服务器命令（用于扫码配对） ============

/// 测试连接到服务器（用于调试）
#[tauri::command]
pub async fn test_connect_to_server(host: String, port: u16) -> Result<String, String> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpStream;

    println!("[cmd] test_connect_to_server -> {}:{}", host, port);

    let addr = format!("{}:{}", host, port);
    println!("[TestClient] Connecting to {}...", addr);

    let stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    println!("[TestClient] Connected!");

    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // 发送测试数据
    let test_data = r#"{"url":"192.168.177.180:10035","token":"test_token_12345"}"#;
    println!("[TestClient] Sending: {}", test_data);

    writer
        .write_all(format!("{}\n", test_data).as_bytes())
        .await
        .map_err(|e| format!("Failed to write: {}", e))?;

    writer
        .flush()
        .await
        .map_err(|e| format!("Failed to flush: {}", e))?;

    println!("[TestClient] Data sent, waiting for response...");

    // 读取响应
    let mut response = String::new();
    reader
        .read_line(&mut response)
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    println!("[TestClient] Received: {}", response.trim());

    Ok(response)
}

#[tauri::command]
pub async fn start_temp_server(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    port: u16
) -> Result<u16, String> {
    println!("[cmd] start_temp_server -> port={}", port);

    // 先停止旧服务器
    {
        let mut temp_server_lock = state.temp_server.write().await;
        if let Some(server) = temp_server_lock.as_mut() {
            println!("[cmd] Stopping existing server");
            server.stop();
        }
        *temp_server_lock = None;
    }

    // 等待端口释放
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // 创建并启动新服务器
    let mut server = TempServer::new(port)?;
    let actual_port = server.port();

    println!("[cmd] Starting server on port {}", actual_port);
    // 传入pairing_data引用给server
    server.start(state.pairing_data.clone()).await?;

    *state.temp_server.write().await = Some(server);

    println!("[cmd] Server started successfully on port {}", actual_port);

    // 启动pairing_data监听任务，收到配对数据后发送事件给前端
    let pairing_data_arc = state.pairing_data.clone();
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        println!("[cmd] Pairing data listener started");

        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            // 检查是否有新的配对数据
            let data = pairing_data_arc.read().await.clone();
            if let Some(pairing) = data {
                println!("[cmd] ✅ Pairing data detected: url={}, token_len={}", pairing.url, pairing.token.len());

                // 发送Tauri事件给前端
                if let Err(e) = app_handle_clone.emit("pairing-received", &pairing) {
                    println!("[cmd] ❌ Failed to emit pairing-received event: {}", e);
                } else {
                    println!("[cmd] 📤 Emitted pairing-received event to frontend");
                }

                // 清空配对数据，避免重复发送
                *pairing_data_arc.write().await = None;
            }
        }
    });

    Ok(actual_port)
}

#[tauri::command]
pub async fn stop_temp_server(state: State<'_, AppState>) -> Result<(), String> {
    println!("[cmd] stop_temp_server");

    let mut server_lock = state.temp_server.write().await;
    if let Some(server) = server_lock.as_mut() {
        server.stop();
        println!("[cmd] Server stop signal sent");
    }
    *server_lock = None;

    println!("[cmd] Server stopped");
    Ok(())
}

#[tauri::command]
pub async fn get_temp_server_status(state: State<'_, AppState>) -> Result<Option<TempServerStatus>, String> {
    let temp_server_lock = state.temp_server.read().await;

    if let Some(server) = temp_server_lock.as_ref() {
        Ok(Some(TempServerStatus {
            running: server.is_running(),
            port: server.port(),
            waiting_for_pairing: false, // 不再需要这个状态
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

// ============ Socket 测试命令（7秒后自动测试）============

/// 测试 Socket 服务器（启动服务器 + 7秒后自动客户端连接测试）
#[tauri::command]
pub async fn test_socket_server() -> Result<String, String> {
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;
    use std::thread;
    use std::time::Duration;

    let port = 10056;
    let tag = "[SocketServerTest]";

    println!("{} Starting socket server test on port {}...", tag, port);

    // 1. 启动服务器
    println!("{} Binding server to 0.0.0.0:{}...", tag, port);
    let listener = TcpListener::bind(("0.0.0.0", port))
        .map_err(|e| {
            println!("{} Failed to bind port {}: {}", tag, port, e);
            format!("Failed to bind port {}: {}", port, e)
        })?;

    println!("{} Server bound successfully", tag);

    listener.set_nonblocking(true)
        .map_err(|e| {
            println!("{} Failed to set nonblocking: {}", tag, e);
            format!("Failed to set nonblocking: {}", e)
        })?;

    println!("{} Server set to nonblocking mode", tag);

    // 2. 在后台线程启动服务器监听
    println!("{} Spawning server thread...", tag);
    let server_thread = thread::spawn(move || {
        println!("{} Server thread started, waiting for connections...", tag);

        let start_time = std::time::Instant::now();
        let timeout = Duration::from_secs(30);

        for stream in listener.incoming() {
            println!("{} Server incoming loop iteration", tag);

            if start_time.elapsed() > timeout {
                println!("{} Server timeout after 30s", tag);
                break;
            }

            match stream {
                Ok(mut stream) => {
                    println!("{} Client connected from: {:?}", tag, stream.peer_addr());

                    stream.set_nonblocking(false)
                        .map_err(|e| format!("Failed to set blocking: {}", e))?;
                    println!("{} Stream set to blocking mode", tag);

                    stream.set_read_timeout(Some(Duration::from_secs(10)))
                        .map_err(|e| format!("Failed to set read timeout: {}", e))?;
                    println!("{} Read timeout set to 10s", tag);

                    let mut reader = BufReader::new(stream.try_clone()
                        .map_err(|e| format!("Failed to clone stream: {}", e))?);
                    println!("{} BufferedReader created", tag);

                    // 读取客户端数据
                    println!("{} Reading line from client...", tag);
                    let mut line = String::new();
                    reader.read_line(&mut line)
                        .map_err(|e| {
                            println!("{} Failed to read from client: {}", tag, e);
                            format!("Failed to read: {}", e)
                        })?;

                    println!("{} Received from client: {}", tag, line.trim());

                    // 解析 JSON
                    println!("{} Parsing JSON...", tag);
                    let _pairing_data: serde_json::Value = serde_json::from_str(line.trim())
                        .map_err(|e| {
                            println!("{} JSON parse error: {}", tag, e);
                            format!("JSON parse error: {}", e)
                        })?;
                    println!("{} JSON parsed successfully", tag);

                    // 发送响应
                    println!("{} Sending response to client...", tag);
                    let response = r#"{"success":true,"message":"Pairing successful"}"#;
                    stream.write_all(format!("{}\n", response).as_bytes())
                        .map_err(|e| {
                            println!("{} Failed to write response: {}", tag, e);
                            format!("Failed to write: {}", e)
                        })?;

                    stream.flush()
                        .map_err(|e| {
                            println!("{} Failed to flush: {}", tag, e);
                            format!("Failed to flush: {}", e)
                        })?;

                    println!("{} Response sent successfully", tag);
                    break;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(100));
                    continue;
                }
                Err(e) => {
                    println!("{} Accept error: {}", tag, e);
                    continue;
                }
            }
        }

        println!("{} Server thread finished", tag);
        Ok::<(), String>(())
    });

    // 3. 等待7秒
    println!("{} Waiting 7 seconds before client connection...", tag);
    tokio::time::sleep(Duration::from_secs(7)).await;
    println!("{} 7 seconds elapsed, starting client...", tag);

    // 4. 创建测试客户端
    println!("{} Connecting client to 127.0.0.1:{}...", tag, port);
    let client_result = tokio::task::spawn_blocking(move || {
        use std::net::TcpStream;

        println!("{} Client: Attempting connection...", tag);
        let mut stream = TcpStream::connect(("127.0.0.1", port))
            .map_err(|e| {
                println!("{} Client: Connection failed: {}", tag, e);
                format!("Connection failed: {}", e)
            })?;

        println!("{} Client: Connected successfully", tag);

        stream.set_read_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| {
                println!("{} Client: Failed to set read timeout: {}", tag, e);
                format!("Failed to set read timeout: {}", e)
            })?;
        println!("{} Client: Read timeout set", tag);

        // 发送测试数据
        let test_data = r#"{"url":"127.0.0.1:10056","token":"test_token_12345"}"#;
        println!("{} Client: Sending data: {}", tag, test_data);

        stream.write_all(format!("{}\n", test_data).as_bytes())
            .map_err(|e| {
                println!("{} Client: Failed to send data: {}", tag, e);
                format!("Failed to send: {}", e)
            })?;

        stream.flush()
            .map_err(|e| {
                println!("{} Client: Failed to flush: {}", tag, e);
                format!("Failed to flush: {}", e)
            })?;

        println!("{} Client: Data sent, reading response...", tag);

        // 读取响应
        let mut reader = BufReader::new(&stream);
        let mut response = String::new();
        reader.read_line(&mut response)
            .map_err(|e| {
                println!("{} Client: Failed to read response: {}", tag, e);
                format!("Failed to read response: {}", e)
            })?;

        println!("{} Client: Received response: {}", tag, response.trim());

        Ok::<String, String>(response.trim().to_string())
    })
    .await
    .map_err(|e| {
        println!("{} Client task join error: {:?}", tag, e);
        format!("Client task error: {:?}", e)
    })??;

    // 5. 等待服务器线程结束
    println!("{} Waiting for server thread to finish...", tag);
    server_thread.join()
        .map_err(|e| {
            println!("{} Server thread panic: {:?}", tag, e);
            format!("Server thread panic: {:?}", e)
        })?
        .map_err(|e| {
            println!("{} Server thread error: {}", tag, e);
            e
        })?;

    println!("{} Test completed successfully", tag);
    println!("{} Client response: {}", tag, client_result);

    Ok(format!("Test successful. Server response: {}", client_result))
}

// ============ HTTP POST 测试命令（测试 temp_server 的 HTTP 支持）============

/// 测试 temp_server 的 HTTP POST 功能
/// 启动 temp_server 后 7 秒自动发送 HTTP POST 请求
#[tauri::command]
pub async fn test_http_pairing(state: State<'_, AppState>) -> Result<String, String> {
    let tag = "[HTTPPairingTest]";
    println!("{} Starting HTTP pairing test...", tag);

    // 1. 启动 temp_server
    let port = 10057; // 使用不同的端口避免冲突
    println!("{} Starting temp_server on port {}...", tag, port);

    // 先停止旧服务器
    {
        let mut temp_server_lock = state.temp_server.write().await;
        if let Some(server) = temp_server_lock.as_mut() {
            println!("{} Stopping existing server", tag);
            server.stop();
        }
        *temp_server_lock = None;
    }

    // 等待端口释放
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // 启动新服务器
    let mut server = crate::temp_server::TempServer::new(port)?;
    let actual_port = server.port();

    println!("{} Starting server on port {}", tag, actual_port);
    server.start(state.pairing_data.clone()).await?;

    // 保存服务器到状态
    *state.temp_server.write().await = Some(server);

    // 启动配对等待任务（轮询AppState中的pairing_data）
    let pairing_data_arc = state.pairing_data.clone();
    let server_handle = tokio::spawn(async move {
        println!("{} Starting pairing wait task...", tag);

        let start = tokio::time::Instant::now();
        let timeout = tokio::time::Duration::from_secs(30);

        loop {
            if start.elapsed() > timeout {
                println!("{} Pairing timeout", tag);
                return Err("Timeout waiting for pairing".to_string());
            }

            // 检查pairing_data（短时间持有锁）
            let data = pairing_data_arc.read().await.clone();
            if let Some(pairing) = data {
                println!("{} Pairing successful: url={}, token_len={}", tag, pairing.url, pairing.token.len());
                // 清空数据
                *pairing_data_arc.write().await = None;
                return Ok(pairing);
            }

            // 等待一段时间再检查
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    });

    // 2. 等待 7 秒
    println!("{} Waiting 7 seconds before sending HTTP POST...", tag);
    tokio::time::sleep(tokio::time::Duration::from_secs(7)).await;
    println!("{} 7 seconds elapsed, sending HTTP POST request...", tag);

    // 3. 发送 HTTP POST 请求
    println!("{} Client: Sending HTTP POST to 127.0.0.1:{}...", tag, actual_port);
    let client_result = match reqwest::Client::new()
        .post(format!("http://127.0.0.1:{}/pair", actual_port))
        .header("Content-Type", "application/json")
        .body(r#"{"url":"127.0.0.1:10057","token":"test_http_token_12345"}"#)
        .send()
        .await
    {
        Ok(response) => {
            println!("{} Client: HTTP request successful!", tag);
            println!("{} Status: {}", tag, response.status());
            match response.text().await {
                Ok(text) => {
                    println!("{} Response: {}", tag, text);
                    text
                }
                Err(e) => {
                    println!("{} Failed to read response: {}", tag, e);
                    format!("Failed to read response: {}", e)
                }
            }
        }
        Err(e) => {
            println!("{} HTTP request failed: {}", tag, e);
            return Err(format!("HTTP request failed: {}", e));
        }
    };

    // 4. 等待服务器端配对完成
    println!("{} Waiting for server-side pairing to complete...", tag);
    let pairing_result = server_handle.await
        .map_err(|e| {
            println!("{} Server task join error: {:?}", tag, e);
            format!("Server task error: {:?}", e)
        })?;

    match pairing_result {
        Ok(data) => {
            println!("{} Test completed successfully!", tag);
            println!("{} Pairing data: url={}, token={}", tag, data.url, data.token);
            Ok(format!(
                "✅ HTTP Pairing Test Successful!\n\nPairing Data:\n- URL: {}\n- Token: {}\n\nHTTP Response:\n{}",
                data.url, data.token, client_result
            ))
        }
        Err(e) => {
            println!("{} Test failed: {}", tag, e);
            Err(format!("Pairing failed: {}", e))
        }
    }
}
