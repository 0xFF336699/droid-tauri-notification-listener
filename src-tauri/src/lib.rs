// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod types;
mod commands;
mod network_utils;
mod temp_server;
mod simple_server;
mod android_client;
use std::time::{Instant, Duration};
use lazy_static::lazy_static;
use std::sync::Mutex;
use tauri::{Manager, tray::MouseButton, image::Image, Emitter};

lazy_static! {
    static ref LAST_CLICK: Mutex<Option<Instant>> = Mutex::new(None);
}
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn set_tray_tooltip(_app: tauri::AppHandle, _text: String) -> bool {
    // TODO: 后续将托盘句柄存入全局状态，再在此更新 tooltip。
    // 目前先作为 no-op，保证编译与运行。
    true
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 模块声明：应用自定义 types 与 commands
    // 注意：初期开启较多日志，稳定后再降级
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 全局状态管理：内存版，后续可替换为 SQLite 持久化
        .manage(crate::commands::AppState::default())
        .setup(|app| {
            use tauri::{menu::MenuItemBuilder, tray::TrayIconBuilder};

            // 初始化主窗口的位置和大小
            if let Some(win) = app.get_webview_window("main") {
                init_window_state(&win);
                setup_window_state_listeners(&win);
            }

            // 构建托盘菜单
            let toggle = MenuItemBuilder::with_id("toggle", "显示/隐藏").build(app)?;
            let settings = MenuItemBuilder::with_id("settings", "设置").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = tauri::menu::MenuBuilder::new(app)
                .items(&[&toggle, &settings, &quit])
                .build()?;

            // 创建托盘图标
            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Notification Listener")
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        // 只处理左键点击
                        if !matches!(button, MouseButton::Left) {
                            return;
                        }

                        // 获取当前时间
                        let now = Instant::now();
                        let mut last_click = LAST_CLICK.lock().unwrap();
                        
                        // 检查是否是双击（300ms内）
                        let is_double_click = if let Some(last) = *last_click {
                            now.duration_since(last) < Duration::from_millis(300)
                        } else {
                            false
                        };
                        
                        // 更新最后点击时间
                        *last_click = Some(now);
                        
                        // 只处理双击事件
                        if !is_double_click {
                            return;
                        }
                        
                        // 双击处理：切换主窗口显示/隐藏
                        let app = tray.app_handle();
                        toggle_main_window(&app);
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "toggle" => toggle_main_window(app),
                        "settings" => {
                            ensure_main_window_visible(app);
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.emit("open-settings", ());
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .build(app)?;
            // 生成一个简单的 32x32 RGBA 圆形图标作为托盘图标
            let mut rgba = vec![0u8; 32 * 32 * 4];
            let cx = 16.0f32;
            let cy = 16.0f32;
            let r2 = 12.0f32 * 12.0f32;
            for y in 0..32 {
                for x in 0..32 {
                    let dx = x as f32 + 0.5 - cx;
                    let dy = y as f32 + 0.5 - cy;
                    let idx = (y * 32 + x) * 4;
                    let inside = dx * dx + dy * dy <= r2;
                    if inside {
                        // 绿色圆
                        rgba[idx] = 0x2a;      // R
                        rgba[idx + 1] = 0xc5; // G
                        rgba[idx + 2] = 0x74; // B
                        rgba[idx + 3] = 0xff; // A
                    } else {
                        // 透明背景
                        rgba[idx] = 0x00;
                        rgba[idx + 1] = 0x00;
                        rgba[idx + 2] = 0x00;
                        rgba[idx + 3] = 0x00;
                    }
                }
            }
            let img = Image::new_owned(rgba, 32, 32);
            let _ = tray.set_icon(Some(img));
            // 开发模式下，自动显示主窗口，避免用户找不到托盘图标
            #[cfg(debug_assertions)]
            {
                let handle = app.handle();
                ensure_main_window_visible(&handle);
            }

            // 拦截主窗口关闭事件：改为隐藏到托盘
            if let Some(win) = app.get_webview_window("main") {
                let win_handle = win.clone();
                win.on_window_event(move |e| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                        api.prevent_close();
                        let _ = win_handle.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            crate::commands::get_counts,
            crate::commands::list_notifications,
            crate::commands::mark_read,
            crate::commands::delete,
            crate::commands::delete_all,
            set_tray_tooltip,
            crate::commands::add_dummy,
            // 网络相关命令
            crate::commands::test_connect_to_server,
            crate::commands::check_port_available,
            crate::commands::find_available_port,
            crate::commands::get_local_ip,
            crate::commands::get_device_uuid,
            crate::commands::get_os_type,
            crate::commands::get_os_version,
            crate::commands::get_hostname,
            crate::commands::start_temp_server,
            crate::commands::stop_temp_server,
            crate::commands::get_temp_server_status,
            crate::commands::connect_to_android,
            crate::commands::disconnect_android,
            crate::commands::test_socket_server,
            crate::commands::test_http_pairing,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn ensure_main_window_visible(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        // 若窗口被最小化，先恢复
        if let Ok(true) = win.is_minimized() {
            let _ = win.unminimize();
        }
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if let Ok(visible) = win.is_visible() {
            if visible {
                let _ = win.hide();
            } else {
                if let Ok(true) = win.is_minimized() {
                    let _ = win.unminimize();
                }
                let _ = win.show();
                let _ = win.set_focus();
            }
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

// 窗口状态管理
const WINDOW_STATE_KEY: &str = "window_state";

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

/// 初始化窗口状态（大小和位置）
fn init_window_state(win: &tauri::WebviewWindow) {
    use tauri::Manager;

    // 获取主显示器信息
    let monitor = win.current_monitor().ok().flatten();
    let screen_size = monitor.as_ref().map(|m| m.size());

    // 尝试从本地存储读取窗口状态
    let state_json = win.app_handle()
        .path()
        .app_local_data_dir()
        .ok()
        .and_then(|dir| {
            std::fs::create_dir_all(&dir).ok()?;
            let state_file = dir.join("window_state.json");
            std::fs::read_to_string(&state_file).ok()
        });

    if let Some(json) = state_json {
        // 尝试恢复保存的状态
        if let Ok(state) = serde_json::from_str::<WindowState>(&json) {
            let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: state.width,
                height: state.height,
            }));
            let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: state.x,
                y: state.y,
            }));
            let _ = win.show();
            return;
        }
    }

    // 没有保存的状态，使用默认值
    let default_width = 800;
    let default_height = if let Some(size) = screen_size {
        (size.height as f32 * 0.65) as u32
    } else {
        600
    };

    let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: default_width,
        height: default_height,
    }));

    // 居中显示
    if let Some(size) = screen_size {
        let x = (size.width as i32 - default_width as i32) / 2;
        let y = (size.height as i32 - default_height as i32) / 2;
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x.max(0),
            y: y.max(0),
        }));
    }

    let _ = win.show();
}

/// 监听窗口状态变化并保存
fn setup_window_state_listeners(win: &tauri::WebviewWindow) {
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    // 防抖：避免频繁保存
    let last_save = std::sync::Arc::new(Mutex::new(Instant::now()));
    let save_debounce = Duration::from_millis(500);

    let win_clone = win.clone();
    win.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                let mut last = last_save.lock().unwrap();
                let now = Instant::now();

                // 防抖：500ms内只保存一次
                if now.duration_since(*last) < save_debounce {
                    return;
                }
                *last = now;
                drop(last);

                // 保存窗口状态
                save_window_state(&win_clone);
            }
            _ => {}
        }
    });
}

/// 保存窗口状态到本地文件
fn save_window_state(win: &tauri::WebviewWindow) {
    use tauri::Manager;

    let position = win.outer_position().ok();
    let size = win.outer_size().ok();

    if let (Some(pos), Some(size)) = (position, size) {
        let state = WindowState {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
        };

        if let Ok(json) = serde_json::to_string_pretty(&state) {
            let _ = win.app_handle()
                .path()
                .app_local_data_dir()
                .ok()
                .and_then(|dir| {
                    std::fs::create_dir_all(&dir).ok()?;
                    let state_file = dir.join("window_state.json");
                    std::fs::write(&state_file, &json).ok()
                });
        }
    }
}
