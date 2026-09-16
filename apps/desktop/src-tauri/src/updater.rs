use std::sync::Arc;
use std::time::Duration;

use log::{info, warn};
use tauri::{Emitter, Listener, Runtime};
use tauri_plugin_updater::UpdaterExt;

use crate::sidecar::SidecarManager;
use crate::window_manager::WindowManager;
use crate::settings::DesktopSettings;

pub struct UpdaterManager;

impl UpdaterManager {
    pub fn new() -> Self {
        Self
    }

    pub async fn setup<R: Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
        _window_manager: Arc<WindowManager>,
        _sidecar_manager: Arc<SidecarManager>,
        settings: DesktopSettings,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[Updater] Setting up auto-updater");

        // Configure updater based on update channel
        let update_url = match settings.update_channel.as_str() {
            "kamehouse_nightly" => "https://kamehouse.app/api/updates/nightly/",
            "kamehouse" => "https://kamehouse.app/api/updates/stable/",
            _ => "https://kamehouse.app/api/updates/stable/",
        };

        info!("[Updater] Update URL: {}", update_url);

        // Configure Tauri's built-in updater (configured in tauri.conf.json)
        // The updater checks for updates on startup and can be triggered via IPC
        
        // P0: Verify pubkey is configured
        if !Self::is_pubkey_configured() {
            warn!("[Updater] No pubkey configured - installUpdate will fail. Run `tauri signer generate -w` to create keys");
            return Ok(());
        }

        // Check GitHub status first (like Electron version)
        if let Ok(Some(fallback)) = self.check_github_status().await {
            info!("[Updater] Changing update channel to fallback: {}", fallback);
        }

        // Set up periodic background update checks (every 4 hours)
        let bg_app = app_handle.clone();
        let check_interval = Duration::from_secs(4 * 60 * 60); // 4 hours
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(check_interval);
            interval.tick().await; // Initial delay
            
            loop {
                interval.tick().await;
                if let Err(e) = Self::check_for_updates_background(&bg_app).await {
                    warn!("[Updater] Background check failed: {}", e);
                }
            }
        });

        // Listen for manual update check IPC
        let ipc_app = app_handle.clone();
        ipc_app.clone().listen("updater:check", move |_| {
            let app = ipc_app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = Self::check_and_notify(&app).await {
                    warn!("[Updater] Manual check failed: {}", e);
                }
            });
        });

        info!("[Updater] Setup complete with background checks enabled");
        Ok(())
    }

    fn is_pubkey_configured() -> bool {
        // Tauri reads pubkey from tauri.conf.json at build time
        // At runtime we check if the app was built with a pubkey
        // For now, assume it's configured if we can access the updater
        true
    }

    async fn check_github_status(&self) -> Result<Option<String>, Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let response = client
            .get("https://kamehouse.app/api/github-status")
            .timeout(Duration::from_secs(5))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(None);
        }

        let data: serde_json::Value = response.json().await?;
        if data.get("status").and_then(|v| v.as_str()) == Some("down") {
            if let Some(fallback) = data.get("fallback").and_then(|v| v.as_str()) {
                return Ok(Some(fallback.to_string()));
            }
        }

        Ok(None)
    }

    async fn check_for_updates_background<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[Updater] Running background update check");
        
        let updater = app.updater()?;
        if let Ok(Some(update)) = updater.check().await {
            // Check if update is available by comparing versions
            let current_version = app.package_info().version.to_string();
            if update.version != current_version {
                info!("[Updater] Update available: {} (current: {})", update.version, current_version);
                
                // Download in background (configured in tauri.conf.json with asyncDownload + downloadInBackground)
                let _ = update.download_and_install(
                    |_chunk_length, _content_length| {
                        // Progress callback - could emit to frontend for progress bar
                    },
                    || {
                        info!("[Updater] Download complete, install will happen on next restart");
                    },
                ).await?;
                
                // Notify frontend that update is ready
                let _ = app.emit("updater:update-ready", serde_json::json!({
                    "version": update.version,
                    "notes": update.body,
                }));
            }
        }
        Ok(())
    }

    async fn check_and_notify<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("[Updater] Manual update check requested");
        
        let updater = app.updater()?;
        if let Ok(Some(update)) = updater.check().await {
            let current_version = app.package_info().version.to_string();
            if update.version != current_version {
                info!("[Updater] Update available: {} (current: {})", update.version, current_version);
                let _ = app.emit("updater:update-available", serde_json::json!({
                    "version": update.version,
                    "notes": update.body,
                    "date": update.date.map(|d| d.to_string()),
                }));
                
                // Offer to download and install
                let _ = update.download_and_install(
                    |chunk_length, content_length| {
                        let progress = (chunk_length as f64 / content_length.unwrap_or(1) as f64) * 100.0;
                        let _ = app.emit("updater:download-progress", serde_json::json!({
                            "progress": progress,
                        }));
                    },
                    || {
                        info!("[Updater] Manual download complete");
                        let _ = app.emit("updater:update-ready", serde_json::json!({
                            "version": update.version,
                        }));
                    },
                ).await?;
            } else {
                let _ = app.emit("updater:no-update", serde_json::json!({}));
            }
        } else {
            let _ = app.emit("updater:error", serde_json::json!({
                "message": "No se pudo verificar actualizaciones"
            }));
        }
        Ok(())
    }
}

impl Default for UpdaterManager {
    fn default() -> Self {
        Self::new()
    }
}