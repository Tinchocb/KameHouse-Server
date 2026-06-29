use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    // Copy external binaries to the resource directory
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let target_dir = out_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("binaries");

    let resource_dir = out_dir.join("resources");

    // Ensure resource directory exists
    fs::create_dir_all(&resource_dir).ok();

    // Copy Windows binary
    let windows_bin = PathBuf::from("binaries/kamehouse-server-windows.exe");
    if windows_bin.exists() {
        let dest = resource_dir.join("kamehouse-server-windows.exe");
        fs::copy(&windows_bin, &dest).ok();
        println!("cargo:rustc-env=KAMEHOUSE_WINDOWS_BIN={}", dest.display());
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