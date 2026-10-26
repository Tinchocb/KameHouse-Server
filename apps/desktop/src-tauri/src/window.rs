use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use log::{debug, info, warn};
use tauri::{
    webview::PageLoadEvent, AppHandle, Emitter, Manager, Runtime, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

use crate::settings::{DesktopSettings, SettingsManager, WindowBounds};
use crate::sidecar::SidecarManager;

/// Evento a la ventana principal cuando el arranque de Tauri (backend + renderer) está listo:
/// su loader HTML inicia el crossfade de salida en ese instante (ver __root.tsx).
pub const SPLASH_CLOSED_EVENT: &str = "splash-closed";

/// Cuánto espera a que la interfaz servida por el sidecar avise que pintó antes de
/// volver a la empaquetada (red de seguridad: si algo falla, la app sigue abriendo).
const SIDECAR_UI_TIMEOUT_SECS: u64 = 12;

/// De dónde se está mostrando la interfaz en la ventana principal.
const UI_PACKAGED: u8 = 0; // la empaquetada con la app (`tauri.localhost`)
const UI_SIDECAR_LOADING: u8 = 1; // navegando a la del sidecar, esperando que pinte
const UI_SIDECAR_READY: u8 = 2; // la del sidecar ya avisó que pintó

/// Qué interfaz arranca en la ventana principal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum StartupUi {
    /// Directo a la interfaz del sidecar (producción). La principal arranca en `splash.html`
    /// estático y navega cuando el servidor responde.
    Sidecar,
    /// La interfaz empaquetada (desarrollo, `-no-binary` o KAMEHOUSE_PACKAGED_UI=1).
    Packaged,
}

pub(crate) fn startup_ui(is_dev: bool, no_binary: bool, packaged_override: bool) -> StartupUi {
    if is_dev || no_binary || packaged_override {
        StartupUi::Packaged
    } else {
        StartupUi::Sidecar
    }
}

pub(crate) fn current_startup_ui(is_dev: bool) -> StartupUi {
    let no_binary = std::env::args().any(|a| a == "-no-binary");
    let packaged_override = std::env::var("KAMEHOUSE_PACKAGED_UI").map(|v| v == "1").unwrap_or(false);
    startup_ui(is_dev, no_binary, packaged_override)
}

/// `index.html` junto a la página del splash (misma raíz de la app empaquetada).
pub(crate) fn packaged_index_url(splash: &tauri::Url) -> Option<tauri::Url> {
    splash.join("index.html").ok()
}

pub(crate) fn is_blank_url(url: &tauri::Url) -> bool {
    url.as_str() == "about:blank"
}

/// ¿La ventana principal sigue en `about:blank` (la interfaz del sidecar aún no se navegó)?
pub(crate) fn main_is_blank<R: Runtime>(app_handle: &AppHandle<R>) -> bool {
    app_handle
        .get_webview_window("main")
        .and_then(|w| w.url().ok())
        .map(|u| is_blank_url(&u))
        .unwrap_or(false)
}


/// URL de la interfaz que sirve el propio sidecar. Con la página y la API en el mismo
/// origen, el navegador cachea las imágenes y el Service Worker funciona como en la web
/// (desde `tauri.localhost` cada imagen del servidor es cross-origin y no se cachea).
pub(crate) fn sidecar_ui_url(port: u16) -> Option<tauri::Url> {
    if port == 0 {
        return None;
    }
    format!("http://127.0.0.1:{}/", port).parse().ok()
}

/// ¿La página es la interfaz servida por el sidecar (y no la empaquetada)?
pub(crate) fn is_sidecar_origin(url: &tauri::Url) -> bool {
    url.scheme() == "http" && url.host_str() == Some("127.0.0.1")
}

/// Decide si un aviso de «interfaz pintada» vale y en qué estado queda la ventana.
/// Mientras se navega al sidecar, un aviso de la página vieja (la empaquetada) no cuenta:
/// revelaría la ventana con la interfaz equivocada a medio cargar.
pub(crate) fn ready_signal(state: u8, from_sidecar_page: bool) -> (bool, u8) {
    match state {
        UI_SIDECAR_LOADING if from_sidecar_page => (true, UI_SIDECAR_READY),
        UI_SIDECAR_LOADING => (false, UI_SIDECAR_LOADING),
        other => (true, other),
    }
}

pub struct WindowManager {
    settings_manager: Arc<SettingsManager>,
    /// Monotonic counter used to debounce window-state saves: only the most
    /// recent queued save (matching the latest generation) is written to disk.
    save_generation: Arc<AtomicU64>,
    /// Handshake de arranque: cuando el backend está listo (sidecar) Y el renderer
    /// terminó de pintar (React), se emite `SPLASH_CLOSED_EVENT` para iniciar el crossfade.
    server_ready: Arc<AtomicBool>,
    renderer_ready: Arc<AtomicBool>,
    splash_closed: Arc<AtomicBool>,
    open_in_background: Arc<AtomicBool>,
    /// Qué interfaz muestra la ventana principal (`UI_*`).
    ui_state: Arc<AtomicU8>,
    /// Ya se intentó pasar a la interfaz del sidecar (una sola vez por arranque).
    ui_switch_attempted: Arc<AtomicBool>,
    /// URL de la interfaz empaquetada (`index.html` junto al splash), para volver a ella si la
    /// del sidecar falla.
    packaged_url: Arc<OnceLock<tauri::Url>>,
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
            ui_state: Arc::new(AtomicU8::new(UI_PACKAGED)),
            ui_switch_attempted: Arc::new(AtomicBool::new(false)),
            packaged_url: Arc::new(OnceLock::new()),
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
        self.splash_closed.store(settings.open_in_background, Ordering::SeqCst);
        self.ui_state.store(UI_PACKAGED, Ordering::SeqCst);
        self.ui_switch_attempted.store(false, Ordering::SeqCst);
        self.open_in_background.store(settings.open_in_background, Ordering::SeqCst);

        // Una única ventana principal desde el inicio: muestra su propio loader (#global-loader
        // o splash.html en producción mientras levanta el sidecar) y hace crossfade directo a la
        // interfaz sin abrir ni solapar una segunda ventana de 460x380.
        let ui = if settings.open_in_background {
            StartupUi::Packaged
        } else {
            current_startup_ui(is_dev)
        };
        Self::create_main_window(app_handle, is_dev, &settings, ui, self.packaged_url.clone())?;
        self.try_switch_to_sidecar_ui(app_handle, "main created");

        Ok(())
    }

    fn create_main_window<R: Runtime>(
        app_handle: &AppHandle<R>,
        is_dev: bool,
        settings: &DesktopSettings,
        ui: StartupUi,
        packaged_url: Arc<OnceLock<tauri::Url>>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[WindowManager] Creating main window ({:?})", ui);

        let url = if is_dev {
            WebviewUrl::External("http://127.0.0.1:43210".parse().unwrap())
        } else {
            match ui {
                // En producción arranca mostrando splash.html estático en la misma ventana
                // principal y navega a la interfaz del sidecar cuando este responde.
                StartupUi::Sidecar => WebviewUrl::App("splash.html".into()),
                StartupUi::Packaged => WebviewUrl::App("index.html".into()),
            }
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

        let show_immediately = !settings.open_in_background;
        let mut builder = WebviewWindowBuilder::new(app_handle, "main", url)
            .icon(Self::window_icon())?
            .on_page_load(move |_window, payload| {
                if payload.event() != PageLoadEvent::Finished {
                    return;
                }
                if packaged_url.get().is_none()
                    && !is_blank_url(payload.url())
                    && !is_sidecar_origin(payload.url())
                {
                    if let Some(url) = packaged_index_url(payload.url()) {
                        let _ = packaged_url.set(url);
                    }
                }
            })
            .title("KameHouse")
            .min_inner_size(800.0, 600.0)
            .resizable(true)
            .fullscreen(false)
            .visible(show_immediately)
            .focused(show_immediately)
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

    /// Icono de las ventanas (barra de titulo y taskbar); sin esto Windows muestra el globo.
    fn window_icon() -> tauri::image::Image<'static> {
        tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png")).unwrap()
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
            .icon(Self::window_icon())?
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
        // Antes de revelar: si pasa a la interfaz del sidecar, hay que esperar a que ESA pinte.
        self.try_switch_to_sidecar_ui(app_handle, source);
        self.set_splash_status(app_handle, "Cargando interfaz...", 0.6);
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

    /// Pasa la ventana principal de la interfaz empaquetada a la que sirve el sidecar
    /// (`http://127.0.0.1:<puerto>/`), una sola vez por arranque y solo en producción.
    /// Si la nueva no avisa que pintó en `SIDECAR_UI_TIMEOUT_SECS`, vuelve a la empaquetada.
    /// `KAMEHOUSE_PACKAGED_UI=1` lo desactiva.
    fn try_switch_to_sidecar_ui<R: Runtime>(&self, app_handle: &AppHandle<R>, source: &str) {
        if source == "no-binary-flag" || current_startup_ui(cfg!(debug_assertions)) == StartupUi::Packaged {
            return;
        }
        if !self.server_ready.load(Ordering::SeqCst) {
            return;
        }
        let Some(main) = app_handle.get_webview_window("main") else {
            return; // todavía no existe
        };
        let port = app_handle
            .try_state::<Arc<SidecarManager>>()
            .map(|s| s.get_port())
            .unwrap_or(0);
        let Some(target) = sidecar_ui_url(port) else {
            return;
        };
        if self.ui_switch_attempted.swap(true, Ordering::SeqCst) {
            return;
        }

        if self.packaged_url.get().is_none() {
            if let Ok(current) = main.url() {
                if !is_blank_url(&current) && !is_sidecar_origin(&current) {
                    if let Some(index_url) = packaged_index_url(&current) {
                        let _ = self.packaged_url.set(index_url);
                    }
                }
            }
        }
        let was_ready = self.renderer_ready.swap(false, Ordering::SeqCst);
        self.ui_state.store(UI_SIDECAR_LOADING, Ordering::SeqCst);
        info!("[WindowManager] Switching main window to the sidecar UI {} (trigger: {})", target, source);
        if let Err(e) = main.navigate(target) {
            warn!("[WindowManager] Could not navigate to the sidecar UI: {}", e);
            self.ui_state.store(UI_PACKAGED, Ordering::SeqCst);
            self.renderer_ready.store(was_ready, Ordering::SeqCst);
            if let Some(url) = self.packaged_url.get() {
                let _ = main.navigate(url.clone());
            }
            return;
        }

        let app = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_secs(SIDECAR_UI_TIMEOUT_SECS)).await;
            let Some(wm) = app.try_state::<Arc<WindowManager>>() else { return };
            if wm
                .ui_state
                .compare_exchange(UI_SIDECAR_LOADING, UI_PACKAGED, Ordering::SeqCst, Ordering::SeqCst)
                .is_err()
            {
                return; // ya pintó (o se canceló)
            }
            warn!(
                "[WindowManager] Sidecar UI did not report ready after {}s, going back to the packaged UI",
                SIDECAR_UI_TIMEOUT_SECS
            );
            match (app.get_webview_window("main"), wm.packaged_url.get()) {
                (Some(main), Some(url)) => {
                    let _ = main.navigate(url.clone());
                }
                _ => warn!("[WindowManager] No packaged UI URL to fall back to"),
            }
        });
    }

    /// Aviso de «interfaz pintada» con la URL de la página que lo envió: durante el cambio a
    /// la interfaz del sidecar se ignoran los avisos que llegan de la empaquetada.
    pub fn on_renderer_ready_from<R: Runtime>(&self, app_handle: &AppHandle<R>, page_url: Option<&tauri::Url>) {
        let from_sidecar = page_url.map(is_sidecar_origin).unwrap_or(false);
        let state = self.ui_state.load(Ordering::SeqCst);
        let (accept, next) = ready_signal(state, from_sidecar);
        if !accept {
            debug!("[WindowManager] Ignoring renderer-ready from a stale page while switching UI");
            return;
        }
        if next != state {
            let _ = self.ui_state.compare_exchange(state, next, Ordering::SeqCst, Ordering::SeqCst);
        }
        self.on_renderer_ready(app_handle);
    }

    /// El renderer (React) avisa cuando terminó de pintar la interfaz
    /// (ver `__root.tsx`). Solo entonces, con el backend ya listo, se completa
    /// el arranque y se dispara la salida del loader.
    pub fn on_renderer_ready<R: Runtime>(&self, app_handle: &AppHandle<R>) {
        if !self.renderer_ready.swap(true, Ordering::SeqCst) {
            info!("[WindowManager] Renderer ready, checking reveal");
        }
        self.try_reveal_main(app_handle);
    }

    /// Completa el arranque una única vez cuando backend y renderer están listos.
    fn try_reveal_main<R: Runtime>(&self, app_handle: &AppHandle<R>) {
        if !self.server_ready.load(Ordering::SeqCst) || !self.renderer_ready.load(Ordering::SeqCst) {
            return;
        }
        // La principal sigue en about:blank: no hay página que revelar. Se navega a la empaquetada
        // (respaldo); su aviso de "pintada" hará el reveal.
        if main_is_blank(app_handle) {
            if let Some(url) = self.packaged_url.get() {
                if let Some(main) = app_handle.get_webview_window("main") {
                    warn!("[WindowManager] Main window still blank at reveal, going to the packaged UI");
                    self.ui_state.store(UI_PACKAGED, Ordering::SeqCst);
                    let _ = main.navigate(url.clone());
                }
                return;
            }
        }
        if self.splash_closed.swap(true, Ordering::SeqCst) {
            return; // ya revelada (o cerrada por crash / tray)
        }
        if self.open_in_background.load(Ordering::SeqCst) {
            if let Some(splash) = app_handle.get_webview_window("splash") {
                let _ = splash.destroy();
            }
            info!("[WindowManager] Startup complete in background (tray only)");
            return;
        }
        // Sin ventana splash secundaria: el loader de la propia ventana principal pasa a "Listo"
        // y recibe de inmediato `SPLASH_CLOSED_EVENT` para iniciar el crossfade hacia la app.
        self.set_splash_status(app_handle, "Listo", 1.0);
        info!("[WindowManager] Revealing main window");
        self.show_main_window(app_handle);
        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.emit(SPLASH_CLOSED_EVENT, ());
        }
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

    /// Actualiza texto y progreso (0.0..=1.0, monótono) del loader en la ventana principal
    /// (compatible con `window.khLoader.set` en index.html y `window.setStatus` en splash.html).
    pub fn set_splash_status<R: Runtime>(&self, app_handle: &AppHandle<R>, text: &str, progress: f32) {
        let script = format!(
            "if (window.khLoader && window.khLoader.set) {{ window.khLoader.set({:?}, {}); }} else if (window.setStatus) {{ window.setStatus({:?}, {}); }}",
            text, progress, text, progress
        );
        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.eval(&script);
        }
        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.eval(&script);
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
        // La principal todavía está en about:blank (la interfaz del sidecar no se ha navegado):
        // mostrarla ahora dejaría una pantalla en blanco. Sigue viéndose el splash.
        if let Some(main) = app_handle.get_webview_window("main") {
            if main.url().map(|u| is_blank_url(&u)).unwrap_or(false) {
                if let Some(splash) = app_handle.get_webview_window("splash") {
                    let _ = splash.set_focus();
                }
                return;
            }
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

#[cfg(test)]
mod sidecar_ui_tests {
    use super::*;

    #[test]
    fn url_del_sidecar() {
        assert_eq!(sidecar_ui_url(43211).unwrap().as_str(), "http://127.0.0.1:43211/");
        assert!(sidecar_ui_url(0).is_none(), "sin puerto no hay a dónde navegar");
    }

    #[test]
    fn reconoce_solo_la_interfaz_del_sidecar() {
        let u = |s: &str| s.parse::<tauri::Url>().unwrap();
        assert!(is_sidecar_origin(&u("http://127.0.0.1:43211/series")));
        assert!(is_sidecar_origin(&u("http://127.0.0.1:60123/")));
        assert!(!is_sidecar_origin(&u("http://tauri.localhost/index.html")));
        assert!(!is_sidecar_origin(&u("https://127.0.0.1:43211/")));
        assert!(!is_sidecar_origin(&u("http://127.0.0.1.evil.example/")));
        assert!(!is_sidecar_origin(&u("http://localhost:43211/")));
    }

    #[test]
    fn arranque_directo_al_sidecar_solo_en_produccion() {
        assert_eq!(startup_ui(false, false, false), StartupUi::Sidecar);
        assert_eq!(startup_ui(true, false, false), StartupUi::Packaged, "desarrollo: empaquetada");
        assert_eq!(startup_ui(false, true, false), StartupUi::Packaged, "-no-binary: empaquetada");
        assert_eq!(startup_ui(false, false, true), StartupUi::Packaged, "KAMEHOUSE_PACKAGED_UI=1");
    }

    #[test]
    fn index_empaquetado_es_vecino_del_splash() {
        let win: tauri::Url = "http://tauri.localhost/splash.html".parse().unwrap();
        assert_eq!(packaged_index_url(&win).unwrap().as_str(), "http://tauri.localhost/index.html");
        let mac: tauri::Url = "tauri://localhost/splash.html".parse().unwrap();
        assert_eq!(packaged_index_url(&mac).unwrap().as_str(), "tauri://localhost/index.html");
    }

    #[test]
    fn about_blank_se_reconoce() {
        assert!(is_blank_url(&"about:blank".parse().unwrap()));
        assert!(!is_blank_url(&"http://127.0.0.1:43211/".parse().unwrap()));
    }

    #[test]
    fn avisos_de_pagina_vieja_no_revelan_durante_el_cambio() {
        // Navegando al sidecar: el aviso de la empaquetada se ignora, el del sidecar vale y confirma.
        assert_eq!(ready_signal(UI_SIDECAR_LOADING, false), (false, UI_SIDECAR_LOADING));
        assert_eq!(ready_signal(UI_SIDECAR_LOADING, true), (true, UI_SIDECAR_READY));
        // Sin cambio de interfaz (desarrollo o marcha atrás) todo aviso vale.
        assert_eq!(ready_signal(UI_PACKAGED, false), (true, UI_PACKAGED));
        assert_eq!(ready_signal(UI_PACKAGED, true), (true, UI_PACKAGED));
        assert_eq!(ready_signal(UI_SIDECAR_READY, true), (true, UI_SIDECAR_READY));
    }
}
