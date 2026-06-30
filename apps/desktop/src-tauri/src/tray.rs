use std::sync::Arc;

use log::info;
use tauri::{
    AppHandle, Manager, Runtime,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::sidecar::SidecarManager;
use crate::window_manager::WindowManager;

pub struct TrayManager;

impl TrayManager {
    pub fn new() -> Self {
        Self
    }

    pub fn create_tray<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        sidecar_manager: Arc<SidecarManager>,
        _window_manager: Arc<WindowManager>,
        _settings: crate::settings::DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[Tray] Creating system tray");

        // Build tray menu
        let toggle_item = MenuItemBuilder::new("Toggle Visibility")
            .id("toggle_visibility")
            .build(app_handle)?;

        let quit_item = MenuItemBuilder::new("Quit KameHouse")
            .id("quit")
            .build(app_handle)?;

        let menu = MenuBuilder::new(app_handle)
            .items(&[&toggle_item, &quit_item])
            .build()?;

        // Get icon path
        let icon_path = self.get_icon_path(app_handle);

        // Create tray icon
        let menu_sidecar_manager = sidecar_manager.clone();
        let _tray = TrayIconBuilder::new()
            .icon(icon_path)
            .menu(&menu)
            .tooltip("KameHouse")
            .on_menu_event(move |app, event| match event.id.as_ref() {
                "toggle_visibility" => {
                    if !menu_sidecar_manager.get_status().eq(&crate::sidecar::ServerStatus::Running) {
                        return;
                    }
                    if let Some(main) = app.get_webview_window("main") {
                        if main.is_visible().unwrap_or(false) {
                            let _ = main.hide();
                        } else {
                            let _ = main.show();
                            let _ = main.set_focus();
                        }
                    }
                }
                "quit" => {
                    let sidecar_mgr = menu_sidecar_manager.clone();
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        sidecar_mgr.shutdown().await;
                        app_clone.exit(0);
                    });
                }
                _ => {}
            })
            .on_tray_icon_event(move |tray, event| {
                if let TrayIconEvent::Click { button, button_state, .. } = event {
                    if button == MouseButton::Left && button_state == MouseButtonState::Up {
                        if !sidecar_manager.get_status().eq(&crate::sidecar::ServerStatus::Running) {
                            return;
                        }
                        let app = tray.app_handle();
                        if let Some(main) = app.get_webview_window("main") {
                            if main.is_visible().unwrap_or(false) {
                                let _ = main.hide();
                            } else {
                                let _ = main.show();
                                let _ = main.set_focus();
                            }
                        }
                    }
                }
            })
            .build(app_handle)?;

        info!("[Tray] System tray created successfully");
        Ok(())
    }

    fn get_icon_path<R: Runtime>(&self, app_handle: &AppHandle<R>) -> tauri::image::Image<'_> {
        let icon_name = if cfg!(target_os = "macos") {
            "18x18.png"
        } else {
            "icon.ico"
        };

        let icon_path = if cfg!(debug_assertions) {
            let current_dir = std::env::current_dir().unwrap_or_default();
            current_dir.join("assets").join(icon_name)
        } else {
            app_handle
                .path()
                .resource_dir()
                .unwrap_or_default()
                .join("icons")
                .join(icon_name)
        };

        tauri::image::Image::from_path(icon_path).unwrap_or_else(|_| {
            // Fallback to a simple generated icon
            tauri::image::Image::from_bytes(include_bytes!("../../assets/icon.png")).unwrap()
        })
    }
}

impl Default for TrayManager {
    fn default() -> Self {
        Self::new()
    }
}