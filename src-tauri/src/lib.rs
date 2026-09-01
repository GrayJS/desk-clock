use std::{
    process::Command,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    thread,
    time::Duration,
};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WindowEvent, Wry,
};
use tauri_plugin_notification::NotificationExt;

static QUITTING: AtomicBool = AtomicBool::new(false);

#[derive(Default)]
struct TimerState {
    generation: AtomicU64,
}

struct TrayState {
    show_item: MenuItem<Wry>,
    quit_item: MenuItem<Wry>,
    tray: TrayIcon<Wry>,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn schedule_timer_notification(
    app: AppHandle,
    state: State<'_, TimerState>,
    seconds: u64,
    title: String,
    body: String,
) {
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;

    thread::spawn(move || {
        thread::sleep(Duration::from_secs(seconds));
        let state = app.state::<TimerState>();
        if state.generation.load(Ordering::SeqCst) == generation {
            let _ = app
                .notification()
                .builder()
                .title(title)
                .body(body)
                .show();
        }
    });
}

#[tauri::command]
fn cancel_timer_notification(state: State<'_, TimerState>) {
    state.generation.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
fn set_app_language(state: State<'_, TrayState>, locale: String) {
    let is_english = locale == "en-US";
    let _ = state.show_item.set_text(if is_english {
        "Show main window"
    } else {
        "显示主窗口"
    });
    let _ = state.quit_item.set_text(if is_english {
        "Quit Morrow"
    } else {
        "退出 Morrow"
    });
    let _ = state.tray.set_tooltip(Some(if is_english {
        "Morrow Desk Clock"
    } else {
        "Morrow 桌面时钟"
    }));
}

#[tauri::command]
fn open_release_page(url: String) -> Result<(), String> {
    const RELEASES_URL: &str = "https://github.com/GrayJS/desk-clock/releases/";
    if !url.starts_with(RELEASES_URL) {
        return Err("unsupported release URL".into());
    }

    Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(TimerState::default())
        .invoke_handler(tauri::generate_handler![
            schedule_timer_notification,
            cancel_timer_notification,
            set_app_language,
            open_release_page
        ])
        .setup(|app| {
            let show_item =
                MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出 Morrow", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray = TrayIconBuilder::with_id("morrow-tray")
                .tooltip("Morrow 桌面时钟")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "quit" => {
                        QUITTING.store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }

            let tray = tray.build(app)?;
            app.manage(TrayState {
                show_item,
                quit_item,
                tray,
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !QUITTING.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Morrow");
}
