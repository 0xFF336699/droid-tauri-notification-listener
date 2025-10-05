use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthRequest {
    pub action: String,
    #[serde(rename = "requestId")]
    pub request_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: Option<String>,
    pub token: Option<String>,
    pub rejected: Option<bool>,
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
    pub pending: Option<bool>,
}

pub struct AndroidSocketClient {
    stream: Arc<Mutex<TcpStream>>,
    #[allow(dead_code)]
    connection_id: String,
}

impl AndroidSocketClient {
    /// 连接到安卓端socket服务器
    pub fn connect(host: &str, connection_id: String) -> Result<Self, String> {
        println!("[AndroidClient] Connecting to {}", host);

        let stream = TcpStream::connect_timeout(
            &host.parse().map_err(|e| format!("Invalid host: {}", e))?,
            Duration::from_secs(10)
        ).map_err(|e| format!("Connection failed: {}", e))?;

        stream.set_read_timeout(Some(Duration::from_secs(30)))
            .map_err(|e| format!("Failed to set read timeout: {}", e))?;

        stream.set_write_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| format!("Failed to set write timeout: {}", e))?;

        println!("[AndroidClient] Connected to {}", host);

        Ok(Self {
            stream: Arc::new(Mutex::new(stream)),
            connection_id,
        })
    }

    /// 请求授权token（手动输入模式）
    pub fn request_token(&self) -> Result<String, String> {
        let request_id = format!("socket_{}_{}",
            chrono::Utc::now().timestamp_millis(),
            rand::random::<u16>()
        );

        let request = AuthRequest {
            action: "request_token".to_string(),
            request_id: request_id.clone(),
            token: None,
        };

        self.send_json(&request)?;

        // 读取响应
        let response: AuthResponse = self.read_json()?;

        println!("[AndroidClient] Token request response: success={}, pending={:?}, rejected={:?}",
            response.success, response.pending, response.rejected);

        // 如果是pending状态，继续等待真正的授权响应
        if response.pending.unwrap_or(false) {
            println!("[AndroidClient] Waiting for user authorization...");
            let auth_response: AuthResponse = self.read_json()?;

            if auth_response.rejected.unwrap_or(false) {
                return Err("Authorization rejected by user".to_string());
            }

            if let Some(token) = auth_response.token {
                println!("[AndroidClient] Authorization successful, token length: {}", token.len());
                return Ok(token);
            } else {
                return Err("No token in authorization response".to_string());
            }
        }

        if let Some(token) = response.token {
            Ok(token)
        } else {
            Err(response.message.unwrap_or("Failed to get token".to_string()))
        }
    }

    /// 使用token登录（扫码模式或后续连接）
    pub fn login(&self, token: &str) -> Result<(), String> {
        let request_id = format!("socket_{}_{}",
            chrono::Utc::now().timestamp_millis(),
            rand::random::<u16>()
        );

        let request = AuthRequest {
            action: "login".to_string(),
            request_id,
            token: Some(token.to_string()),
        };

        self.send_json(&request)?;

        let response: AuthResponse = self.read_json()?;

        if response.success {
            println!("[AndroidClient] Login successful");
            Ok(())
        } else {
            Err(response.message.unwrap_or("Login failed".to_string()))
        }
    }

    /// 发送JSON请求
    fn send_json<T: Serialize>(&self, data: &T) -> Result<(), String> {
        let json = serde_json::to_string(data)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        let mut stream = self.stream.lock();
        stream.write_all(format!("{}\n", json).as_bytes())
            .map_err(|e| format!("Failed to send: {}", e))?;
        stream.flush()
            .map_err(|e| format!("Failed to flush: {}", e))?;

        println!("[AndroidClient] Sent: {}", json);
        Ok(())
    }

    /// 读取JSON响应
    fn read_json<T: for<'de> Deserialize<'de>>(&self) -> Result<T, String> {
        let stream = self.stream.lock().try_clone()
            .map_err(|e| format!("Failed to clone stream: {}", e))?;

        let mut reader = BufReader::new(stream);
        let mut line = String::new();

        reader.read_line(&mut line)
            .map_err(|e| format!("Failed to read response: {}", e))?;

        println!("[AndroidClient] Received: {}", line.trim());

        serde_json::from_str(line.trim())
            .map_err(|e| format!("Failed to parse JSON: {}", e))
    }
}

// 需要添加 rand crate，但为了避免添加新依赖，用时间戳替代
mod rand {
    pub fn random<T>() -> T
    where
        T: From<u16>
    {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .subsec_nanos() as u16;
        T::from(ts % 10000)
    }
}
