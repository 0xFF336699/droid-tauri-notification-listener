use std::io::{BufRead, BufReader, Write};
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
        let listener = TcpListener::bind(format!("0.0.0.0:{}", port))
            .map_err(|e| format!("Failed to bind port {}: {}", port, e))?;

        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to set nonblocking: {}", e))?;

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

    /// 等待安卓端连接并接收配对数据
    /// 返回 (url, token)
    pub fn wait_for_pairing(&self, timeout_secs: u64) -> Result<PairingData, String> {
        // 设置正在等待配对
        *self.waiting_for_pairing.lock() = true;

        let listener = self.listener.as_ref()
            .ok_or("Server not initialized")?;

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
        let mut reader = BufReader::new(stream.try_clone()
            .map_err(|e| format!("Failed to clone stream: {}", e))?);

        let mut line = String::new();
        reader.read_line(&mut line)
            .map_err(|e| format!("Failed to read from client: {}", e))?;

        println!("[TempServer] Received: {}", line.trim());

        let pairing_data: PairingData = serde_json::from_str(line.trim())
            .map_err(|e| format!("Failed to parse pairing data: {}", e))?;

        // 发送确认响应
        let response = serde_json::json!({
            "success": true,
            "message": "Pairing successful"
        });

        stream.write_all(format!("{}\n", response).as_bytes())
            .map_err(|e| format!("Failed to send response: {}", e))?;

        println!("[TempServer] Pairing successful: url={}, token_len={}",
            pairing_data.url, pairing_data.token.len());

        Ok(pairing_data)
    }

    pub fn stop(&mut self) {
        *self.running.lock() = false;
        self.listener = None;
        println!("[TempServer] Server stopped");
    }
}

impl Drop for TempServer {
    fn drop(&mut self) {
        self.stop();
    }
}
