use serde::{Deserialize, Serialize};
use axum::{
    routing::post,
    http::StatusCode,
    response::Json,
    Router,
    extract::State as AxumState,
};
use std::sync::Arc;
use tokio::sync::{oneshot, RwLock};

const LOG_TAG: &str = "[TempServer]";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingData {
    pub url: String,
    pub token: String,
}

#[derive(Debug, Clone, Serialize)]
struct PairingResponse {
    success: bool,
    message: String,
}

// 服务器管理器结构体
pub struct TempServer {
    port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl TempServer {
    pub fn new(port: u16) -> Result<Self, String> {
        println!("{} Creating server on port {}...", LOG_TAG, port);

        Ok(Self {
            port,
            shutdown_tx: None,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn is_running(&self) -> bool {
        self.shutdown_tx.is_some()
    }

    /// 启动服务器
    pub async fn start(&mut self, pairing_data: Arc<RwLock<Option<PairingData>>>) -> Result<(), String> {
        println!("{} Starting server on port {}...", LOG_TAG, self.port);

        if self.shutdown_tx.is_some() {
            return Err("Server already running".to_string());
        }

        let addr = format!("0.0.0.0:{}", self.port);
        println!("{} Binding to {}...", LOG_TAG, addr);

        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind port {}: {}", self.port, e))?;

        println!("{} Server bound successfully", LOG_TAG);

        // 创建 shutdown 通道
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);

        // 构建路由 - 使用外部传入的pairing_data
        let app = Router::new()
            .route("/pair", post(|AxumState(pairing_data): AxumState<Arc<RwLock<Option<PairingData>>>>, body: String| async move {
                println!("{} Received pairing request: {}", LOG_TAG, body);

                // 解析 JSON
                match serde_json::from_str::<PairingData>(&body) {
                    Ok(data) => {
                        println!("{} Pairing data: url={}, token_len={}", LOG_TAG, data.url, data.token.len());

                        // 保存配对数据到AppState
                        *pairing_data.write().await = Some(data);

                        (StatusCode::OK, Json(PairingResponse {
                            success: true,
                            message: "Pairing successful".to_string(),
                        }))
                    }
                    Err(e) => {
                        println!("{} JSON parse error: {}", LOG_TAG, e);
                        (StatusCode::BAD_REQUEST, Json(PairingResponse {
                            success: false,
                            message: format!("Invalid JSON: {}", e),
                        }))
                    }
                }
            }))
            .with_state(pairing_data);

        println!("{} Routes configured", LOG_TAG);

        // 启动服务器
        println!("{} Server starting on {}...", LOG_TAG, addr);
        tokio::spawn(async move {
            println!("{} Server task spawned", LOG_TAG);

            let server = axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    println!("{} Waiting for shutdown signal...", LOG_TAG);
                    let _ = shutdown_rx.await;
                    println!("{} Shutdown signal received!", LOG_TAG);
                });

            if let Err(e) = server.await {
                println!("{} Server error: {}", LOG_TAG, e);
            } else {
                println!("{} Server stopped gracefully", LOG_TAG);
            }
        });

        println!("{} Server is now listening on port {}", LOG_TAG, self.port);
        Ok(())
    }

    /// 停止服务器
    pub fn stop(&mut self) {
        println!("{} Stopping server on port {}...", LOG_TAG, self.port);

        if let Some(tx) = self.shutdown_tx.take() {
            println!("{} Sending shutdown signal...", LOG_TAG);
            if tx.send(()).is_err() {
                println!("{} Failed to send shutdown signal (receiver already dropped)", LOG_TAG);
            } else {
                println!("{} Shutdown signal sent successfully", LOG_TAG);
            }
        } else {
            println!("{} Server not running", LOG_TAG);
        }
    }

}

impl Drop for TempServer {
    fn drop(&mut self) {
        println!("{} TempServer dropped", LOG_TAG);
        self.stop();
    }
}
