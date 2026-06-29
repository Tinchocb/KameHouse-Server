use std::sync::Arc;

use log::{debug, error, info, warn};
use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

use crate::sidecar::SidecarManager;
use crate::settings::{DesktopSettings, WindowBounds};

pub struct WindowManager {
    startup_ready: Arc<tokio::sync::RwLock<bool>>,
    should_maximize: Arc<tokio::sync::RwLock<bool>>,
    is_shutdown: Arc<tokio::sync::RwLock<bool>>,
}

impl WindowManager {
    pub fn new() -> Self {
        Self {
            startup_ready: Arc::new(tokio::sync::RwLock::new(false)),
            should_maximize: Arc::new(tokio::sync::RwLock::new(false)),
            is_shutdown: Arc::new(tokio::sync::RwLock::new(false)),
        }
    }

    pub fn create_windows<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating windows");

        // Create main window
        self.create_main_window(app_handle, is_dev, &settings)?;

        // Create splash screen
        self.create_splash_window(app_handle, is_dev, &settings)?;

        // Create crash screen
        self.create_crash_window(app_handle, is_dev)?;

        Ok(())
    }

    fn create_main_window<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: &DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating main window");

        *self.startup_ready.write() = false;

        let url = if is_dev {
            WebviewUrl::External("http://127.0.0.1:43210".parse().unwrap())
        } else {
            WebviewUrl::App("app://-".into())
        };

        let mut builder = WebviewWindowBuilder::new(app_handle, "main", url)
            .title("KameHouse")
            .inner_size(1920.0, 1080.0)
            .min_inner_size(800.0, 600.0)
            .resizable(true)
            .fullscreen(false)
            .visible(false)
            .background_color(tauri::utils::Color::from_hex("#111111").unwrap())
            .decorations(false)
            .transparent(false)
            .hidden_title(true);

        #[cfg(target_os = "macos")]
        {
            if !is_dev {
                builder = builder.title_bar_style(tauri::TitleBarStyle::HiddenInset);
            }
        }

        #[cfg(target_os = "windows")]
        {
            if !is_dev {
                builder = builder.title_bar_style(tauri::TitleBarStyle::Hidden);
            }
        }

        if let Some(bounds) = &settings.window_bounds {
            builder = builder
                .position(bounds.x as f64, bounds.y as f64)
                .inner_size(bounds.width as f64, bounds.height as f64);
        } else {
            builder = builder.center();
        }

        let window = builder.build()?;

        if is_dev {
            window.open_devtools();
        }

        // Handle window events
        let window_clone = window.clone();
        window.on_window_event(move |event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    let settings = crate::settings::SettingsManager::new().load();
                    if settings.minimize_to_tray {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                }
                WindowEvent::Minimized => {
                    let _ = window_clone.emit("window:minimized", ());
                }
                WindowEvent::Hidden => {
                    let _ = window_clone.emit("window:hidden", ());
                }
                WindowEvent::Maximized => {
                    let _ = window_clone.emit("window:maximized", ());
                }
                WindowEvent::Unmaximized => {
                    let _ = window_clone.emit("window:unmaximized", ());
                }
                WindowEvent::FullscreenChanged(fullscreen) => {
                    let _ = window_clone.emit("window:fullscreen", fullscreen);
                }
                WindowEvent::Focused(focused) => {
                    debug!("[WindowManager] Main window focused: {}", focused);
                }
                WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                    // Save window state - handled via IPC command
                }
                _ => {}
            }
        });

        window.once("ready-to-show", move |_| {
            info!("[WindowManager] Main window ready-to-show");
            let _ = window.show();
            let _ = window.set_focus();
        });

        Ok(())
    }

    fn create_splash_window<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: &DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating splash window");

        let url = if is_dev {
            WebviewUrl::External("http://127.0.0.1:43210/splashscreen".parse().unwrap())
        } else {
            WebviewUrl::App("app://-/splashscreen".into())
        };

        let window = WebviewWindowBuilder::new(app_handle, "splash", url)
            .title("KameHouse")
            .inner_size(800.0, 600.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .visible(!settings.open_in_background)
            .center()
            .build()?;

        Ok(())
    }

    fn create_crash_window<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        is_dev: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating crash window");

        let url = if is_dev {
            WebviewUrl::External("http://127.0.0.1:43210/splashscreen/crash".parse().unwrap())
        } else {
            WebviewUrl::App("app://-/splashscreen/crash".into())
        };

        let window = WebviewWindowBuilder::new(app_handle, "crash", url)
            .title("KameHouse - Error")
            .inner_size(800.0, 600.0)
            .resizable(false)
            .decorations(false)
            .visible(false)
            .center()
            .build()?;

        Ok(())
    }

    pub fn finalize_startup(&self, app_handle: &AppHandle, source: &str) {
        info!("[WindowManager] Finalizing startup from: {}", source);
        *self.startup_ready.write() = true;

        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.close();
        }

        // Show main window after a delay if not opening in background
        let settings = crate::settings::SettingsManager::new().load();
        if !settings.open_in_background {
            if let Some(main) = app_handle.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                    let _ = main.show();
                    let _ = main.set_focus();
                });
            }
        }
    }

    pub fn show_crash_screen(&self, app_handle: &AppHandle, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.close();
        }

        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.destroy();
        }

        if let Some(crash) = app_handle.get_webview_window("crash") {
            let _ = crash.show();
            let _ = crash.emit("crash", message);
        }

        Ok(())
    }

    pub fn show_main_window(&self, app_handle: &AppHandle) {
        if let Some(window) = app_handle.get_webview_window("main") {
            let settings = crate::settings::SettingsManager::new().load();

            if window.is_minimized().unwrap_or(false) {
                let _ = window.unminimize();
            }

            if !window.is_visible().unwrap_or(false) {
                let _ = window.show();
            }

            if settings.window_maximized && !window.is_maximized().unwrap_or(false) {
                let _ = window.maximize();
            }

            let _ = window.set_focus();
        }
    }

    pub fn hide_main_window(&self, app_handle: &AppHandle) {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.hide();
        }
    }

    pub fn set_shutdown(&self, val: bool) {
        *self.is_shutdown.write() = val;
    }

    pub fn is_shutdown(&self) -> bool {
        *self.is_shutdown.read()
    }

    pub fn is_startup_ready(&self) -> bool {
        *self.startup_ready.read()
    }

    pub fn set_startup_ready(&self, val: bool) {
        *self.startup_ready.write() = val;
    }

    pub fn emit_to_main(&self, app_handle: &AppHandle, event: &str, payload: impl serde::Serialize) {
        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.emit(event, payload);
        }
    }
}

impl Default for WindowManager {
    fn default() -> Self {
        Self::new()
    }
}