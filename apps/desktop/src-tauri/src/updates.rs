use crate::sidecar::SidecarManager;
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

pub fn check(app: AppHandle, sidecar: Arc<SidecarManager>) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = check_and_prompt(&app, sidecar).await {
            log::warn!("[Updater] {error}");
        }
    });
}

async fn check_and_prompt(
    app: &AppHandle,
    sidecar: Arc<SidecarManager>,
) -> tauri_plugin_updater::Result<()> {
    let signed_build = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|config| config["pubkey"].as_str())
        .is_some_and(|key| !key.is_empty());
    if !signed_build {
        return Ok(());
    }
    let updater = app.updater()?;
    let Some(update) = updater.check().await? else {
        return Ok(());
    };
    let install = app
        .dialog()
        .message(format!(
            "Está disponible KameHouse {}. La aplicación se cerrará para instalarla.",
            update.version
        ))
        .title("Actualización de KameHouse")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Actualizar".into(),
            "Más tarde".into(),
        ))
        .blocking_show();
    if install {
        match update.download(|_, _| {}, || {}).await {
            Ok(bytes) => {
                sidecar.shutdown().await;
                if let Err(error) = update.install(bytes) {
                    app.dialog()
                        .message(format!(
                            "Falló la instalación. KameHouse se reiniciará.\n{error}"
                        ))
                        .blocking_show();
                    app.restart();
                }
            }
            Err(error) => {
                app.dialog()
                    .message(format!(
                        "No se pudo descargar o verificar la actualización.\n{error}"
                    ))
                    .blocking_show();
                return Err(error);
            }
        }
    }
    Ok(())
}
