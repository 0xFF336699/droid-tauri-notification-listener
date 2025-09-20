//! Tauri commands 与应用状态（临时内存版，后续接入 SQLite）。
//! 初期打开日志，稳定后再降级。

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::types::Notification;

#[derive(Default)]
pub struct AppState {
    // 通知存储（临时内存实现）：id -> Notification
    notifications: Mutex<HashMap<String, Notification>>,
    // 已读集合
    read_set: Mutex<HashSet<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Counts {
    pub unread: usize,
    pub total: usize,
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
