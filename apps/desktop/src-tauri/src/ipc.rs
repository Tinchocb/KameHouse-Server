use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::mpv::{MpvManager, MpvPlayRequest};
use crate::settings::SettingsManager;
use crate::sidecar::SidecarManager;
use crate::window_manager::WindowManager;

#[tauri::command]
pub async fn get_local_server_port(
    sidecar_manager: State<'_, Arc<SidecarManager>>,
) -> Result<u16, String> {
    Ok(sidecar_manager.get_port())
}

#[tauri::command]
pub async fn startup_renderer_ready(
    window_manager: State<'_, Arc<WindowManager>>,
    app_handle: AppHandle,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    // La URL de quien avisa permite ignorar a la página vieja mientras se cambia de interfaz.
    let page_url = window.url().ok();
    window_manager.on_renderer_ready_from(&app_handle, page_url.as_ref());
    Ok(())
}

#[tauri::command]
pub async fn mpv_play(
    mpv_manager: State<'_, Arc<MpvManager>>,
    settings_manager: State<'_, Arc<SettingsManager>>,
    app_handle: AppHandle,
    request: MpvPlayRequest,
) -> Result<(), String> {
    let path = settings_manager.get_settings_path(&app_handle);
    let settings = settings_manager.load_from_path(&path);
    mpv_manager.play(app_handle.clone(), settings.mpv_path, request).await
}

#[tauri::command]
pub async fn mpv_stop(
    mpv_manager: State<'_, Arc<MpvManager>>,
) -> Result<(), String> {
    mpv_manager.stop().await;
    Ok(())
}

#[tauri::command]
pub async fn mpv_is_available(
    settings_manager: State<'_, Arc<SettingsManager>>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    let path = settings_manager.get_settings_path(&app_handle);
    let settings = settings_manager.load_from_path(&path);
    Ok(MpvManager::is_available(&settings.mpv_path).await)
}

/// Abre la carpeta de registros (la misma que lista la pestaña Sistema de los ajustes).
#[tauri::command]
pub async fn open_logs_folder(app_handle: AppHandle) -> Result<(), String> {
    let dir = crate::shared_logs_dir(cfg!(debug_assertions));
    let _ = std::fs::create_dir_all(&dir);
    app_handle
        .opener()
        .open_path(dir.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Open a URL in the system default browser.
/// Strict allowlist: only http(s) URLs, no whitespace/control chars, no
/// embedded dangerous schemes. Full `url::Url` parsing is Etapa 5.
#[tauri::command]
pub async fn shell_open(app_handle: AppHandle, url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.len() > 2048 {
        return Err("shell_open: URL too long".to_string());
    }
    if trimmed.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("shell_open: URL contains whitespace/control characters".to_string());
    }
    let lower = trimmed.to_ascii_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        return Err("shell_open: only http/https URLs are supported".to_string());
    }
    // Reject smuggled schemes (case already normalized for the check).
    for scheme in ["javascript:", "data:", "file:", "vbscript:", "blob:"] {
        if lower.contains(scheme) {
            return Err(format!("shell_open: forbidden scheme in URL ({scheme})"));
        }
    }
    app_handle
        .opener()
        .open_url(trimmed, None::<&str>)
        .map_err(|e| e.to_string())
}