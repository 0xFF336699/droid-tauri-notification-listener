use std::sync::Arc;
use parking_lot::Mutex;
use std::net::{TcpListener, TcpStream};
use std::io::{BufRead, BufReader, Write};
use std::thread;
use std::time::Duration;

// 使用现有的 PairingData 定义
pub use crate::temp_server::PairingData;

#[derive(Clone)]
pub struct SimpleServer {
    port: u16,
    running: Arc<Mutex<bool>>,
}

impl SimpleServer {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn is_running(&self) -> bool {
        *self.running.lock()
    }

    pub fn stop(&self) {
        println!("[SimpleServer] Stopping server on port {}...", self.port);
        *self.running.lock() = false;
    }

    /// 启动服务器（持久化，支持多客户端）
    pub fn start(&self) -> Result<(), String> {
        println!("[SimpleServer] Starting on port {}...", self.port);

        let listener = TcpListener::bind(("0.0.0.0", self.port))
            .map_err(|e| format!("Failed to bind port {}: {}", self.port, e))?;

        listener.set_nonblocking(true)
            .map_err(|e| format!("Failed to set nonblocking: {}", e))?;

        *self.running.lock() = true;
        println!("[SimpleServer] Server started on port {}", self.port);

        let running = self.running.clone();

        thread::spawn(move || {
            println!("[SimpleServer] Listening for connections...");

            for stream in listener.incoming() {
                if !*running.lock() {
                    println!("[SimpleServer] Server stopped");
                    break;
                }

                match stream {
                    Ok(stream) => {
                        println!("[SimpleServer] New client connected: {:?}", stream.peer_addr());

                        // 每个连接在独立线程中处理
                        thread::spawn(move || {
                            if let Err(e) = Self::handle_client(stream) {
                                eprintln!("[SimpleServer] Client handler error: {}", e);
                            }
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(100));
                        continue;
                    }
                    Err(e) => {
                        eprintln!("[SimpleServer] Accept error: {}", e);
                        continue;
                    }
                }
            }

            println!("[SimpleServer] Server thread finished");
        });

        Ok(())
    }

    /// 处理单个客户端连接（保持现有协议）
    fn handle_client(mut stream: TcpStream) -> Result<(), String> {
        println!("[SimpleServer] Handling client...");

        // 设置为阻塞模式
        stream.set_nonblocking(false)
            .map_err(|e| format!("Failed to set blocking: {}", e))?;

        // 设置超时
        stream.set_read_timeout(Some(Duration::from_secs(30)))
            .map_err(|e| format!("Failed to set read timeout: {}", e))?;

        let mut reader = BufReader::new(stream.try_clone()
            .map_err(|e| format!("Failed to clone stream: {}", e))?);

        // 1. 读取客户端发送的 PairingData
        println!("[SimpleServer] Reading pairing data from client...");
        let mut line = String::new();
        reader.read_line(&mut line)
            .map_err(|e| format!("Failed to read from client: {}", e))?;

        println!("[SimpleServer] Received: {}", line.trim());

        // 解析 PairingData
        let pairing_data: PairingData = serde_json::from_str(line.trim())
            .map_err(|e| {
                eprintln!("[SimpleServer] Failed to parse JSON: {}", e);
                format!("Failed to parse pairing data: {}", e)
            })?;

        println!("[SimpleServer] Pairing data parsed: url={}, token_len={}",
            pairing_data.url, pairing_data.token.len());

        // 2. 发送确认响应（保持现有格式）
        let response = serde_json::json!({
            "success": true,
            "message": "Pairing successful"
        });

        println!("[SimpleServer] Sending response: {}", response);
        stream.write_all(format!("{}\n", response).as_bytes())
            .map_err(|e| format!("Failed to send response: {}", e))?;

        stream.flush()
            .map_err(|e| format!("Failed to flush: {}", e))?;

        println!("[SimpleServer] Pairing completed for client");

        // TODO: 这里可以触发回调保存配对信息到 AppState
        // 暂时只打印日志

        Ok(())
    }
}
