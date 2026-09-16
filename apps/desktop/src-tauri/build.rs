use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    // Ensure target sidecar binary exists for tauri_build::build()
    let target = env::var("TARGET").unwrap_or_default();
    let ext = if target.contains("windows") { ".exe" } else { "" };
    let sidecar_dest = PathBuf::from(format!("binaries/kamehouse-server-{}{}", target, ext));
    let sidecar_root_dest = PathBuf::from(format!("kamehouse-server-{}{}", target, ext));

    let _ = fs::create_dir_all("binaries");
    if !sidecar_dest.exists() {
        let candidates = [
            PathBuf::from(format!("binaries/kamehouse-server-windows{}", ext)),
            PathBuf::from(format!("binaries/kamehouse-server{}", ext)),
            PathBuf::from(format!("../../apps/server/kamehouse{}", ext)),
            PathBuf::from(format!("../server/kamehouse{}", ext)),
        ];
        for c in &candidates {
            if c.exists() {
                let _ = fs::copy(c, &sidecar_dest);
                break;
            }
        }
    }

    // Safety fallback: if no candidate existed yet (e.g. Go still compiling in background),
    // write a placeholder dummy file so tauri_build doesn't abort compilation.
    if !sidecar_dest.exists() {
        let _ = fs::write(&sidecar_dest, b"");
    }

    // Mirror to root if not present
    if !sidecar_root_dest.exists() && sidecar_dest.exists() {
        let _ = fs::copy(&sidecar_dest, &sidecar_root_dest);
    }

    tauri_build::build();

    // Copy external binaries to the resource directory
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    let resource_dir = out_dir.join("resources");

    // Ensure resource directory exists
    fs::create_dir_all(&resource_dir).ok();

    // Copy Windows binary
    let windows_candidates = [
        PathBuf::from("binaries/kamehouse-server-windows.exe"),
        PathBuf::from("binaries/kamehouse-server.exe"),
        PathBuf::from(format!("binaries/kamehouse-server-{}.exe", target)),
    ];
    for windows_bin in &windows_candidates {
        if windows_bin.exists() {
            let dest_windows = resource_dir.join("kamehouse-server-windows.exe");
            let dest_canonical = resource_dir.join("kamehouse-server.exe");
            let _ = fs::copy(windows_bin, &dest_windows);
            let _ = fs::copy(windows_bin, &dest_canonical);
            println!("cargo:rustc-env=KAMEHOUSE_WINDOWS_BIN={}", dest_windows.display());
            break;
        }
    }

    // Copy macOS binaries if they exist
    for arch in ["amd64", "arm64"] {
        let mac_bin = PathBuf::from(format!("binaries/kamehouse-server-darwin-{}", arch));
        if mac_bin.exists() {
            let dest = resource_dir.join(format!("kamehouse-server-darwin-{}", arch));
            fs::copy(&mac_bin, &dest).ok();
            // Make executable
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&dest).unwrap().permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&dest, perms).ok();
            }
        }
    }

    // Copy Linux binaries if they exist
    for arch in ["amd64", "arm64"] {
        let linux_bin = PathBuf::from(format!("binaries/kamehouse-server-linux-{}", arch));
        if linux_bin.exists() {
            let dest = resource_dir.join(format!("kamehouse-server-linux-{}", arch));
            fs::copy(&linux_bin, &dest).ok();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&dest).unwrap().permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&dest, perms).ok();
            }
        }
    }

    // Tell Cargo to rerun if binaries change
    println!("cargo:rerun-if-changed=binaries/");
}