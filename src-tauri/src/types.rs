//! 通用数据结构定义（初期最小集）。
//! 注意：初期全部打印日志，稳定后再降级。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub package_name: Option<String>,
    pub title: Option<String>,
    pub text: Option<String>,
    pub read: bool,
    pub posted_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub event_type: String, // added | updated | removed
    pub seq: i64,
    pub notification: Option<Notification>,
    pub id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConnectOptions {
    pub host: Option<String>,
    pub port: Option<u16>,
    pub token: Option<String>,
}
