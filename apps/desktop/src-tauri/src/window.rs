use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use log::{debug, info, warn};
use tauri::{
    webview::PageLoadEvent, AppHandle, Emitter, Manager, Runtime, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

use crate::settings::{DesktopSettings, SettingsManager, WindowBounds};

pub struct WindowManager {
    settings_manager: Arc<SettingsManager>,
    /// Monotonic counter used to debounce window-state saves: only the most
    /// recent queued save (matching the latest generation) is written to disk.
    save_generation: Arc<AtomicU64>,
    /// Handshake de arranque: la ventana principal solo se revela cuando el
    /// backend está listo (sidecar) Y el renderer terminó de pintar (React).
    /// Mientras tanto el usuario ve la ventana `splash` (HTML local, instantánea).
    server_ready: Arc<AtomicBool>,
    renderer_ready: Arc<AtomicBool>,
    splash_closed: Arc<AtomicBool>,
    open_in_background: Arc<AtomicBool>,
    /// La ventana principal se crea recién cuando el splash terminó de pintar,
    /// para que las dos WebView2 no compitan durante el primer frame.
    main_created: Arc<AtomicBool>,
}

impl WindowManager {
    pub fn new(settings_manager: Arc<SettingsManager>) -> Self {
        Self {
            settings_manager,
            save_generation: Arc::new(AtomicU64::new(0)),
            server_ready: Arc::new(AtomicBool::new(false)),
            renderer_ready: Arc::new(AtomicBool::new(false)),
            splash_closed: Arc::new(AtomicBool::new(false)),
            open_in_background: Arc::new(AtomicBool::new(false)),
            main_created: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn create_windows<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating windows");

        self.server_ready.store(false, Ordering::SeqCst);
        self.renderer_ready.store(false, Ordering::SeqCst);
        self.splash_closed.store(false, Ordering::SeqCst);
        self.main_created.store(false, Ordering::SeqCst);
        self.open_in_background.store(settings.open_in_background, Ordering::SeqCst);

        // Splash primero: es HTML estático (public/splash.html), pinta al instante.
        // La ventana principal se crea recién cuando el splash terminó de cargar
        // (o tras un timeout de seguridad), y carga React oculta en segundo plano.
        if !settings.open_in_background {
            self.create_splash_window(app_handle, is_dev, settings.clone())?;

            let app = app_handle.clone();
            let main_created = self.main_created.clone();
            let splash_closed = self.splash_closed.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(1500)).await;
                Self::ensure_main_window(&app, is_dev, &settings, &main_created, &splash_closed, "timeout");
            });
        } else {
            // Arranque en segundo plano: sin splash, la app vive en el tray.
            self.splash_closed.store(true, Ordering::SeqCst);
            self.main_created.store(true, Ordering::SeqCst);
            Self::create_main_window(app_handle, is_dev, &settings)?;
        }

        Ok(())
    }

    /// Crea la ventana principal una única vez (la dispara el splash al terminar
    /// de cargar, o el timeout de seguridad, lo que ocurra primero).
    fn ensure_main_window<R: Runtime>(
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: &DesktopSettings,
        main_created: &AtomicBool,
        splash_closed: &AtomicBool,
        source: &str,
    ) {
        // splash_closed antes de crear main => hubo crash: no tiene sentido crearla.
        if splash_closed.load(Ordering::SeqCst) {
            return;
        }
        if main_created.swap(true, Ordering::SeqCst) {
            return;
        }
        info!("[WindowManager] Creating main window (trigger: {})", source);
        if let Err(e) = Self::create_main_window(app_handle, is_dev, settings) {
            warn!("[WindowManager] Failed to create main window: {}", e);
        }
    }

    fn create_main_window<R: Runtime>(
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: &DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating main window");

        let url = if is_dev {
            WebviewUrl::External("http://127.0.0.1:43210".parse().unwrap())
        } else {
            WebviewUrl::App("index.html".into())
        };

        // Calculate dynamic initial dimensions based on primary monitor (e.g. 85% of logical size)
        let (default_width, default_height) = if let Ok(Some(monitor)) = app_handle.primary_monitor() {
            let scale = monitor.scale_factor();
            let logical_w = monitor.size().width as f64 / scale;
            let logical_h = monitor.size().height as f64 / scale;
            let target_w = (logical_w * 0.85).clamp(960.0, 1920.0);
            let target_h = (logical_h * 0.85).clamp(640.0, 1080.0);
            (target_w, target_h)
        } else {
            (1280.0, 800.0)
        };

        let mut builder = WebviewWindowBuilder::new(app_handle, "main", url)
            .title("KameHouse")
            .min_inner_size(800.0, 600.0)
            .resizable(true)
            .fullscreen(false)
            // Siempre oculta al inicio: se revela en try_reveal_main cuando el
            // backend (sidecar) y el renderer (React) están listos. Mientras
            // tanto el usuario ve la ventana splash.
            .visible(false)
            .background_color(tauri::window::Color(9, 9, 11, 255))
            .decorations(true)
            .transparent(false);

        #[cfg(target_os = "macos")]
        {
            if !is_dev {
                builder = builder.title_bar_style(tauri::TitleBarStyle::HiddenInset);
            }
        }

        let valid_bounds = settings.window_bounds.as_ref().filter(|b| b.is_valid());
        if let Some(bounds) = valid_bounds {
            let is_on_screen = if let Ok(monitors) = app_handle.available_monitors() {
                monitors.iter().any(|m| {
                    let m_pos = m.position();
                    let m_size = m.size();
                    bounds.x >= m_pos.x - 200 && bounds.x < (m_pos.x + m_size.width as i32) &&
                    bounds.y >= m_pos.y - 200 && bounds.y < (m_pos.y + m_size.height as i32)
                })
            } else {
                true
            };

            if is_on_screen {
                builder = builder
                    .position(bounds.x as f64, bounds.y as f64)
                    .inner_size(bounds.width as f64, bounds.height as f64);
            } else {
                builder = builder.inner_size(default_width, default_height).center();
            }
        } else {
            builder = builder.inner_size(default_width, default_height).center();
        }

        if settings.window_maximized {
            builder = builder.maximized(true);
        }

        let window = builder.build()?;

        #[cfg(debug_assertions)]
        if is_dev {
            window.open_devtools();
        }

        // Handle window events
        let window_clone = window.clone();
        // Close/tray/shutdown and window-state persistence are handled centrally in
        // lib.rs's `on_window_event`. Here we only relay fullscreen changes to the frontend.
        let last_fullscreen = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let last_fullscreen_clone = last_fullscreen.clone();

        window.on_window_event(move |event| {
            match event {
                WindowEvent::Focused(focused) => {
                    debug!("[WindowManager] Main window focused: {}", focused);
                }
                WindowEvent::Resized(_) => {
                    let current_fullscreen = window_clone.is_fullscreen().unwrap_or(false);
                    let previous_fullscreen = last_fullscreen_clone.swap(current_fullscreen, std::sync::atomic::Ordering::Relaxed);
                    if current_fullscreen != previous_fullscreen {
                        let _ = window_clone.emit("window:fullscreen", current_fullscreen);
                    }
                }
                _ => {}
            }
        });

        Ok(())
    }

    /// Ventana de carga instantánea (HTML local, sin depender del dev server ni
    /// del backend). Se muestra mientras el sidecar arranca y React carga.
    fn create_splash_window<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating splash window");

        let url = if is_dev {
            WebviewUrl::External("http://127.0.0.1:43210/splash.html".parse().unwrap())
        } else {
            WebviewUrl::App("splash.html".into())
        };

        let main_created = self.main_created.clone();
        let splash_closed = self.splash_closed.clone();

        WebviewWindowBuilder::new(app_handle, "splash", url)
            .on_page_load(move |window, payload| {
                if payload.event() != PageLoadEvent::Finished {
                    return;
                }
                // No crear ventanas dentro del handler (deadlock en Windows):
                // se delega a una tarea async.
                let app = window.app_handle().clone();
                let settings = settings.clone();
                let main_created = main_created.clone();
                let splash_closed = splash_closed.clone();
                tauri::async_runtime::spawn(async move {
                    Self::ensure_main_window(&app, is_dev, &settings, &main_created, &splash_closed, "splash loaded");
                });
            })
            .title("KameHouse")
            .inner_size(460.0, 380.0)
            .min_inner_size(380.0, 320.0)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .decorations(false)
            .transparent(false)
            .background_color(tauri::window::Color(9, 9, 11, 255))
            .visible(true)
            .center()
            .focused(true)
            .skip_taskbar(true)
            .always_on_top(true)
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
            WebviewUrl::App("index.html".into())
        };

        WebviewWindowBuilder::new(app_handle, "crash", url)
            .title("KameHouse - Error")
            .inner_size(800.0, 600.0)
            .min_inner_size(500.0, 380.0)
            .resizable(true)
            .decorations(true)
            .visible(false)
            .center()
            .build()?;

        Ok(())
    }

    pub fn finalize_startup<R: Runtime>(&self, app_handle: &AppHandle<R>, source: &str) {
        info!("[WindowManager] Finalizing startup from: {}", source);
        let already_ready = self.server_ready.swap(true, Ordering::SeqCst);
        self.set_splash_status(app_handle, "Cargando interfaz...");
        self.emit_to_main(app_handle, "server-status", "ready");
        self.try_reveal_main(app_handle);

        // Red de seguridad: si React nunca avisa `renderer_ready` (error de
        // runtime, página cargada mientras Rsbuild compilaba, etc.) el splash
        // quedaba para siempre con la principal oculta. Tras el timeout se
        // revela igual; en dev con devtools abiertas para ver el error.
        if !already_ready {
            let app = app_handle.clone();
            let timeout_secs = if cfg!(debug_assertions) { 30 } else { 15 };
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(timeout_secs)).await;
                let wm = app.state::<Arc<WindowManager>>();
                if !wm.renderer_ready.load(Ordering::SeqCst) {
                    warn!("[WindowManager] Renderer did not report ready after {}s, revealing main window anyway", timeout_secs);
                    wm.on_renderer_ready(&app);
                }
            });
        }
    }

    /// El renderer (React) avisa cuando terminó de pintar la interfaz
    /// (ver `__root.tsx`). Solo entonces, con el backend ya listo, se revela
    /// la ventana principal y se cierra el splash.
    pub fn on_renderer_ready<R: Runtime>(&self, app_handle: &AppHandle<R>) {
        if !self.renderer_ready.swap(true, Ordering::SeqCst) {
            info!("[WindowManager] Renderer ready, checking reveal");
        }
        self.try_reveal_main(app_handle);
    }

    /// Muestra la ventana principal una única vez, cuando backend y renderer
    /// están listos. Antes de eso el usuario solo ve el splash.
    fn try_reveal_main<R: Runtime>(&self, app_handle: &AppHandle<R>) {
        if !self.server_ready.load(Ordering::SeqCst) || !self.renderer_ready.load(Ordering::SeqCst) {
            return;
        }
        if self.splash_closed.swap(true, Ordering::SeqCst) {
            return; // ya revelada (o cerrada por crash / tray)
        }
        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.destroy();
        }
        if self.open_in_background.load(Ordering::SeqCst) {
            info!("[WindowManager] Startup complete in background (tray only)");
            return;
        }
        info!("[WindowManager] Revealing main window");
        self.show_main_window(app_handle);
    }

    pub fn show_crash_screen<R: Runtime>(&self, app_handle: &AppHandle<R>, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // El crash reemplaza a todo: ni splash ni main tienen sentido ya.
        self.splash_closed.store(true, Ordering::SeqCst);
        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.destroy();
        }
        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.destroy();
        }

        if app_handle.get_webview_window("crash").is_none() {
            let is_dev = cfg!(debug_assertions);
            let _ = self.create_crash_window(app_handle, is_dev);
        }

        if let Some(crash) = app_handle.get_webview_window("crash") {
            let _ = crash.show();
            let _ = crash.emit("crash", message);
        }

        Ok(())
    }

    /// Actualiza el texto de estado del splash (ver `window.setStatus` en splash.html).
    pub fn set_splash_status<R: Runtime>(&self, app_handle: &AppHandle<R>, text: &str) {
        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.eval(format!("window.setStatus && window.setStatus({:?})", text));
        }
    }

    pub fn show_main_window<R: Runtime>(&self, app_handle: &AppHandle<R>) {
        // Si la principal todavía no existe (arranque muy temprano), el splash
        // sigue siendo lo único que mostrar.
        if app_handle.get_webview_window("main").is_none() {
            if let Some(splash) = app_handle.get_webview_window("splash") {
                let _ = splash.set_focus();
            }
            return;
        }
        // Si el usuario fuerza la ventana (tray / segunda instancia) durante el
        // arranque, el splash ya cumplió: se cierra y se muestra la principal
        // aunque el handshake aún no terminó (React muestra su propio loader).
        if !self.splash_closed.swap(true, Ordering::SeqCst) {
            if let Some(splash) = app_handle.get_webview_window("splash") {
                let _ = splash.destroy();
            }
        }
        if let Some(window) = app_handle.get_webview_window("main") {
            let settings = self.settings_manager.load(app_handle);

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


    pub fn emit_to_main<R: Runtime>(&self, app_handle: &AppHandle<R>, event: &str, payload: impl serde::Serialize + Clone) {
        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.emit(event, payload);
        }
    }

    pub fn save_window_state<R: Runtime>(&self, window: &tauri::Window<R>) -> Result<(), String> {
        let is_minimized = window.is_minimized().unwrap_or(false);
        if is_minimized {
            return Ok(());
        }

        let is_maximized = window.is_maximized().unwrap_or(false);
        
        let position = window.outer_position().unwrap_or(tauri::PhysicalPosition { x: 0, y: 0 });
        let size = window.inner_size().unwrap_or(tauri::PhysicalSize { width: 800, height: 600 });
        let scale_factor = window.scale_factor().unwrap_or(1.0);
        let logical_pos = position.to_logical::<f64>(scale_factor);
        let logical_size = size.to_logical::<f64>(scale_factor);
        
        let bounds = if !is_maximized {
            let candidate = WindowBounds {
                x: logical_pos.x.round() as i32,
                y: logical_pos.y.round() as i32,
                width: logical_size.width.round() as u32,
                height: logical_size.height.round() as u32,
            };
            if candidate.is_valid() {
                Some(candidate)
            } else {
                None
            }
        } else {
            None
        };

        let app_handle = window.app_handle();
        let mut settings = self.settings_manager.load(app_handle);

        settings.window_maximized = is_maximized;
        if bounds.is_some() {
            settings.window_bounds = bounds;
        }

        self.settings_manager.save(app_handle, &settings)
    }

    /// Debounced variant of [`save_window_state`]. Called on every `Resized`/`Moved`
    /// event during a drag; captures the current bounds synchronously (window queries
    /// must run on the event thread) and defers the disk write by 500ms. Only the most
    /// recent queued save actually writes, so a burst of events becomes a single write.
    pub fn queue_save_window_state<R: Runtime>(&self, window: &tauri::Window<R>) {
        let app_handle = window.app_handle().clone();
        let window_clone = window.clone();
        let settings_manager = self.settings_manager.clone();
        let generation = self.save_generation.clone();
        let my_gen = generation.fetch_add(1, Ordering::SeqCst) + 1;

        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(500)).await;
            // A newer event superseded this one; skip the write.
            if generation.load(Ordering::SeqCst) != my_gen {
                return;
            }

            let is_minimized = window_clone.is_minimized().unwrap_or(false);
            if is_minimized {
                return;
            }

            let is_maximized = window_clone.is_maximized().unwrap_or(false);
            let position = window_clone.outer_position().unwrap_or(tauri::PhysicalPosition { x: 0, y: 0 });
            let size = window_clone.inner_size().unwrap_or(tauri::PhysicalSize { width: 800, height: 600 });
            let scale_factor = window_clone.scale_factor().unwrap_or(1.0);
            let logical_pos = position.to_logical::<f64>(scale_factor);
            let logical_size = size.to_logical::<f64>(scale_factor);

            let bounds = if !is_maximized {
                let candidate = WindowBounds {
                    x: logical_pos.x.round() as i32,
                    y: logical_pos.y.round() as i32,
                    width: logical_size.width.round() as u32,
                    height: logical_size.height.round() as u32,
                };
                if candidate.is_valid() {
                    Some(candidate)
                } else {
                    None
                }
            } else {
                None
            };

            let mut settings = settings_manager.load(&app_handle);
            settings.window_maximized = is_maximized;
            if bounds.is_some() {
                settings.window_bounds = bounds;
            }
            if let Err(e) = settings_manager.save(&app_handle, &settings) {
                warn!("[WindowManager] Failed to debounce-save window state: {}", e);
            }
        });
    }
}

impl Default for WindowManager {
    fn default() -> Self {
        Self::new(Arc::new(SettingsManager::new()))
    }
}