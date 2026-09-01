use std::{
    process::Command,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};
use tauri_plugin_notification::NotificationExt;

static QUITTING: AtomicBool = AtomicBool::new(false);
static TRAY_CLICK_GENERATION: AtomicU64 = AtomicU64::new(0);
static TRAY_CLICK_SUPPRESSED_UNTIL: AtomicU64 = AtomicU64::new(0);

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

fn emit_tray_gesture(app: &AppHandle, gesture: &str) {
    let _ = app.emit("morrow://tray-gesture", gesture);
}

fn begin_tray_click(generation: &AtomicU64) -> u64 {
    generation.fetch_add(1, Ordering::SeqCst) + 1
}

fn cancel_pending_tray_click(generation: &AtomicU64) {
    generation.fetch_add(1, Ordering::SeqCst);
}

fn is_current_tray_click(generation: &AtomicU64, candidate: u64) -> bool {
    generation.load(Ordering::SeqCst) == candidate
}

fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn tray_click_is_suppressed(suppressed_until: &AtomicU64, now: u64) -> bool {
    suppressed_until.load(Ordering::SeqCst) > now
}

fn queue_tray_click(app: AppHandle) {
    if tray_click_is_suppressed(&TRAY_CLICK_SUPPRESSED_UNTIL, current_time_millis()) {
        return;
    }
    let generation = begin_tray_click(&TRAY_CLICK_GENERATION);
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(280));
        if is_current_tray_click(&TRAY_CLICK_GENERATION, generation) {
            emit_tray_gesture(&app, "click");
        }
    });
}

fn emit_tray_double_click(app: &AppHandle) {
    cancel_pending_tray_click(&TRAY_CLICK_GENERATION);
    TRAY_CLICK_SUPPRESSED_UNTIL.store(current_time_millis() + 500, Ordering::SeqCst);
    emit_tray_gesture(app, "doubleClick");
}

fn validate_tray_icon_data(rgba: &[u8], width: u32, height: u32) -> Result<(), String> {
    if width != 32 || height != 32 || rgba.len() != (width * height * 4) as usize {
        return Err("tray icon must be a 32x32 RGBA image".into());
    }
    Ok(())
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
            let _ = app.notification().builder().title(title).body(body).show();
        }
    });
}

#[tauri::command]
fn cancel_timer_notification(state: State<'_, TimerState>) {
    state.generation.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
fn show_main_window_command(app: AppHandle) {
    show_main_window(&app);
}

#[tauri::command]
fn set_tray_icon(
    state: State<'_, TrayState>,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    validate_tray_icon_data(&rgba, width, height)?;
    state
        .tray
        .set_icon(Some(Image::new_owned(rgba, width, height)))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn reset_tray_icon(app: AppHandle, state: State<'_, TrayState>) -> Result<(), String> {
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "default tray icon is unavailable".to_string())?;
    state
        .tray
        .set_icon(Some(icon))
        .map_err(|error| error.to_string())
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
            show_main_window_command,
            set_tray_icon,
            reset_tray_icon,
            set_app_language,
            open_release_page
        ])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
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
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => queue_tray_click(tray.app_handle().clone()),
                    TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => emit_tray_double_click(tray.app_handle()),
                    _ => {}
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn double_click_invalidates_pending_single_clicks() {
        let generation = AtomicU64::new(0);
        let first = begin_tray_click(&generation);
        assert!(is_current_tray_click(&generation, first));

        cancel_pending_tray_click(&generation);
        assert!(!is_current_tray_click(&generation, first));

        let second = begin_tray_click(&generation);
        assert!(is_current_tray_click(&generation, second));
    }

    #[test]
    fn click_after_double_click_is_temporarily_suppressed() {
        let suppressed_until = AtomicU64::new(1_500);
        assert!(tray_click_is_suppressed(&suppressed_until, 1_200));
        assert!(!tray_click_is_suppressed(&suppressed_until, 1_500));
        assert!(!tray_click_is_suppressed(&suppressed_until, 1_600));
    }

    #[test]
    fn tray_icon_requires_exact_rgba_dimensions() {
        assert!(validate_tray_icon_data(&vec![0; 32 * 32 * 4], 32, 32).is_ok());
        assert!(validate_tray_icon_data(&vec![0; 31 * 32 * 4], 31, 32).is_err());
        assert!(validate_tray_icon_data(&vec![0; 32 * 32 * 3], 32, 32).is_err());
    }
}
