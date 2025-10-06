use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingData {
    pub url: String,
    pub token: String,
}

pub struct TempServer {
    listener: Option<TcpListener>,
    port: u16,
    running: Arc<Mutex<bool>>,
    waiting_for_pairing: Arc<Mutex<bool>>,
}

impl TempServer {
    pub fn new(port: u16) -> Result<Self, String> {
        println!("[TempServer] Creating server on port {}...", port);

        let listener = TcpListener::bind(format!("0.0.0.0:{}", port))
            .map_err(|e| {
                println!("[TempServer] ❌ Failed to bind port {}: {}", port, e);
                format!("Failed to bind port {}: {}", port, e)
            })?;

        println!("[TempServer] ✅ Port {} bound successfully", port);

        listener
            .set_nonblocking(true)
            .map_err(|e| {
                println!("[TempServer] ❌ Failed to set nonblocking: {}", e);
                format!("Failed to set nonblocking: {}", e)
            })?;

        println!("[TempServer] ✅ Server created successfully");
        println!("[TempServer] ⚠️  Server is NOT listening yet! Call wait_for_pairing() to start accepting connections");

        Ok(Self {
            listener: Some(listener),
            port,
            running: Arc::new(Mutex::new(true)),
            waiting_for_pairing: Arc::new(Mutex::new(false)),
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn is_waiting_for_pairing(&self) -> bool {
        *self.waiting_for_pairing.lock()
    }

    pub fn is_running(&self) -> bool {
        *self.running.lock()
    }

    /// 等待安卓端连接并接收配对数据
    /// 返回 (url, token)
    pub fn wait_for_pairing(&self, timeout_secs: u64) -> Result<PairingData, String> {
        println!("[TempServer] ▶️  wait_for_pairing() called");
        println!("[TempServer] 👂 Starting to ACTIVELY LISTEN for connections...");
        println!("[TempServer] ⏱️  Timeout: {} seconds", timeout_secs);

        // 设置正在等待配对
        *self.waiting_for_pairing.lock() = true;

        let listener = self.listener.as_ref()
            .ok_or("Server not initialized")?;

        println!("[TempServer] 🔊 Server is NOW listening on port {}!", self.port);
        println!("[TempServer] 📡 Waiting for incoming connections...");

        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(timeout_secs);

        loop {
            if start.elapsed() > timeout {
                // 超时，重置等待状态
                *self.waiting_for_pairing.lock() = false;
                return Err("Timeout waiting for pairing".to_string());
            }

            if !*self.running.lock() {
                *self.waiting_for_pairing.lock() = false;
                return Err("Server stopped".to_string());
            }

            match listener.accept() {
                Ok((stream, addr)) => {
                    println!("[TempServer] Client connected from: {}", addr);
                    // 将 stream 设置为阻塞模式，确保读写操作正常
                    stream.set_nonblocking(false)
                        .map_err(|e| format!("Failed to set stream blocking: {}", e))?;
                    let result = self.handle_pairing_client(stream);
                    // 配对完成（成功或失败），重置等待状态
                    *self.waiting_for_pairing.lock() = false;
                    return result;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // 非阻塞模式下没有连接，等待一会儿
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    continue;
                }
                Err(e) => {
                    *self.waiting_for_pairing.lock() = false;
                    return Err(format!("Accept error: {}", e));
                }
            }
        }
    }

    fn handle_pairing_client(&self, mut stream: TcpStream) -> Result<PairingData, String> {
        println!("[TempServer] Starting to handle client...");

        let mut reader = BufReader::new(stream.try_clone()
            .map_err(|e| {
                eprintln!("[TempServer] Failed to clone stream: {}", e);
                format!("Failed to clone stream: {}", e)
            })?);

        println!("[TempServer] Reading first line from client...");
        let mut first_line = String::new();
        reader.read_line(&mut first_line)
            .map_err(|e| {
                eprintln!("[TempServer] Failed to read from client: {}", e);
                format!("Failed to read from client: {}", e)
            })?;

        println!("[TempServer] First line: {}", first_line.trim());

        // 检查是否是 HTTP 请求
        if first_line.starts_with("POST /pair") || first_line.starts_with("POST /") {
            println!("[TempServer] Detected HTTP POST request");
            return self.handle_http_post(reader, stream);
        }

        // 否则按原来的 Socket 方式处理（兼容旧安卓客户端）
        println!("[TempServer] Using legacy socket mode");
        println!("[TempServer] Received raw data (length={}): {}", first_line.len(), first_line.trim());

        println!("[TempServer] Parsing JSON...");
        let pairing_data: PairingData = serde_json::from_str(first_line.trim())
            .map_err(|e| {
                eprintln!("[TempServer] Failed to parse JSON: {}", e);
                eprintln!("[TempServer] Received raw data: {}", first_line.trim());
                format!("Failed to parse pairing data: {}", e)
            })?;

        println!("[TempServer] JSON parsed successfully");

        // 发送确认响应
        let response = serde_json::json!({
            "success": true,
            "message": "Pairing successful"
        });

        println!("[TempServer] Sending response: {}", response);
        stream.write_all(format!("{}\n", response).as_bytes())
            .map_err(|e| {
                eprintln!("[TempServer] Failed to send response: {}", e);
                format!("Failed to send response: {}", e)
            })?;

        println!("[TempServer] Flushing stream...");
        stream.flush()
            .map_err(|e| {
                eprintln!("[TempServer] Failed to flush stream: {}", e);
                format!("Failed to flush stream: {}", e)
            })?;

        println!("[TempServer] Pairing successful: url={}, token_len={}",
            pairing_data.url, pairing_data.token.len());

        Ok(pairing_data)
    }

    fn handle_http_post(&self, mut reader: BufReader<TcpStream>, mut stream: TcpStream) -> Result<PairingData, String> {
        println!("[TempServer] Handling HTTP POST request");

        // 读取 HTTP headers
        let mut headers = Vec::new();
        let mut content_length = 0;

        loop {
            let mut line = String::new();
            reader.read_line(&mut line)
                .map_err(|e| format!("Failed to read header: {}", e))?;

            println!("[TempServer] Header: {}", line.trim());

            if line.trim().is_empty() {
                break; // 空行表示 headers 结束
            }

            // 查找 Content-Length
            if line.to_lowercase().starts_with("content-length:") {
                if let Some(len_str) = line.split(':').nth(1) {
                    content_length = len_str.trim().parse().unwrap_or(0);
                    println!("[TempServer] Content-Length: {}", content_length);
                }
            }

            headers.push(line);
        }

        // 读取 body
        if content_length == 0 {
            let error_response = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n";
            stream.write_all(error_response.as_bytes())
                .map_err(|e| format!("Failed to write error: {}", e))?;
            return Err("No content in POST request".to_string());
        }

        let mut body = vec![0u8; content_length];
        reader.read_exact(&mut body)
            .map_err(|e| {
                println!("[TempServer] Failed to read body: {}", e);
                format!("Failed to read body: {}", e)
            })?;

        let body_str = String::from_utf8_lossy(&body);
        println!("[TempServer] Request body: {}", body_str);

        // 解析 JSON
        let pairing_data: PairingData = serde_json::from_str(&body_str)
            .map_err(|e| {
                println!("[TempServer] JSON parse error: {}", e);
                let error_response = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n";
                let _ = stream.write_all(error_response.as_bytes());
                format!("Invalid JSON: {}", e)
            })?;

        println!("[TempServer] Pairing data: url={}, token_len={}",
            pairing_data.url, pairing_data.token.len());

        // 返回 HTTP 200 响应
        let response_json = serde_json::json!({
            "success": true,
            "message": "Pairing successful"
        });

        let response_body = serde_json::to_string(&response_json).unwrap();
        let response_str = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            response_body.len(),
            response_body
        );

        stream.write_all(response_str.as_bytes())
            .map_err(|e| format!("Failed to write response: {}", e))?;
        stream.flush()
            .map_err(|e| format!("Failed to flush: {}", e))?;

        println!("[TempServer] HTTP response sent successfully");

        Ok(pairing_data)
    }

    pub fn stop(&self) {
        println!("[TempServer] Stopping server on port {}...", self.port);
        *self.running.lock() = false;
        // Note: listener 无法在这里关闭，因为它在 Option 中且我们只有 &self
        // 但设置 running = false 会让监听循环退出
    }
}

impl Drop for TempServer {
    fn drop(&mut self) {
        *self.running.lock() = false;
        self.listener = None;
        println!("[TempServer] Server dropped");
    }
}
