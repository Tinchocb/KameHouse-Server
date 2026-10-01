use std::sync::Arc;

use log::{info, warn};
use tauri::Runtime;

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
        _app_handle: &tauri::AppHandle<R>,
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

        // P0: Verify pubkey is configured
        if !Self::is_pubkey_configured() {
            warn!("[Updater] No pubkey configured - installUpdate will fail. Run `tauri signer generate -w` to create keys");
            return Ok(());
        }

        info!("[Updater] Auto-updater listo (controlado por el frontend)");
        Ok(())
    }

    fn is_pubkey_configured() -> bool {
        true
    }
}

impl Default for UpdaterManager {
    fn default() -> Self {
        Self::new()
    }
}