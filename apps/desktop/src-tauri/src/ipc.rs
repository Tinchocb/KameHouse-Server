use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::mpv::{MpvManager, MpvPlayRequest};
use crate::settings::{DesktopSettings, SettingsManager};
use crate::sidecar::SidecarManager;
use crate::window_manager::WindowManager;

#[tauri::command]
pub async fn get_desktop_settings(
    settings_manager: State<'_, Arc<SettingsManager>>,
    app_handle: AppHandle,
) -> Result<DesktopSettings, String> {
    let path = settings_manager.get_settings_path(&app_handle);
    let settings = settings_manager.load_from_path(&path);
    Ok(settings)
}

#[tauri::command]
pub async fn set_desktop_settings(
    settings_manager: State<'_, Arc<SettingsManager>>,
    app_handle: AppHandle,
    updates: std::collections::HashMap<String, serde_json::Value>,
) -> Result<DesktopSettings, String> {
    settings_manager.update_partial(&app_handle, updates)
}


#[tauri::command]
pub async fn kill_server(
    sidecar_manager: State<'_, Arc<SidecarManager>>,
) -> Result<bool, String> {
    sidecar_manager.kill().await;
    Ok(true)
}

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
) -> Result<(), String> {
    window_manager.on_renderer_ready(&app_handle);
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