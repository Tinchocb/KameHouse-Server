import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "apps", "server");
const binariesDir = path.join(rootDir, "apps", "desktop", "src-tauri", "binaries");

const isDev = process.argv.includes("--dev");
const isClean = process.argv.includes("--clean");
const exeExt = process.platform === "win32" ? ".exe" : "";
const outputName = `kamehouse${exeExt}`;
const serverExe = path.join(serverDir, outputName);

console.log(isDev ? "⚡ Compiling Go server (dev mode)..." : "🔨 Compiling Go server...");

if (isClean) {
  if (fs.existsSync(binariesDir)) {
    fs.rmSync(binariesDir, { recursive: true, force: true });
  }
  console.log("🧹 Cleaned binaries directory.");
}

if (!fs.existsSync(serverDir)) {
  console.error("Server directory not found:", serverDir);
  process.exit(1);
}

// Ensure apps/server/web exists so //go:embed all:web does not fail
const serverWebDir = path.join(serverDir, "web");
const webOutDir = path.join(rootDir, "apps", "web", "out");
if (fs.existsSync(webOutDir) && fs.readdirSync(webOutDir).length > 0) {
  if (!fs.existsSync(serverWebDir)) {
    fs.mkdirSync(serverWebDir, { recursive: true });
  }
  fs.cpSync(webOutDir, serverWebDir, { recursive: true });
} else if (!fs.existsSync(serverWebDir) || fs.readdirSync(serverWebDir).length === 0) {
  fs.mkdirSync(serverWebDir, { recursive: true });
  fs.writeFileSync(path.join(serverWebDir, "index.html"), "<!DOCTYPE html><html><body>KameHouse Dev</body></html>");
}

try {
  // Verify go exists
  execFileSync("go", ["version"], { stdio: "ignore" });
} catch {
  console.error("Go not found in PATH. Install from https://go.dev/dl/");
  process.exit(1);
}

try {
  execFileSync("go", ["build", "-trimpath", "-o", outputName, "."], {
    cwd: serverDir,
    stdio: "inherit",
  });
} catch (e) {
  console.error("Go build failed:", e.message);
  process.exit(1);
}

if (!fs.existsSync(binariesDir)) {
  fs.mkdirSync(binariesDir, { recursive: true });
}

if (isDev) {
  // En dev el sidecar ejecuta apps/server/kamehouse.exe directo; binaries/ solo
  // tiene que existir para el chequeo de externalBin de tauri_build. Re-copiarlo
  // en cada arranque cambiaba su mtime y, por `rerun-if-changed=binaries/` en
  // build.rs, forzaba a recompilar el crate de Tauri entero cada vez.
  const devTarget = path.join(binariesDir, `kamehouse-server-${getHostTarget()}${exeExt}`);
  if (!fs.existsSync(devTarget) || fs.statSync(devTarget).size === 0) {
    fs.copyFileSync(serverExe, devTarget);
  }
  console.log("✅ Go server binary staged for dev.");
  process.exit(0);
}

console.log("📦 Copying sidecar binaries for Tauri desktop...");

// Build cross-platform only when explicitly asked; otherwise build for current host
const shouldCross = process.argv.includes("--cross");
const targets = shouldCross ? getCrossTargets() : [getHostTarget()];

let copied = 0;
for (const target of targets) {
  const destName = `kamehouse-server-${target}${exeExt}`;
  const destPath = path.join(binariesDir, destName);
  try {
    if (shouldCross) {
      console.warn(`Cross-compile for ${target} not implemented; copying host binary as fallback.`);
    }
    fs.copyFileSync(serverExe, destPath);
    copied++;
  } catch (e) {
    console.error(`Failed to copy ${destName}:`, e.message);
  }
}

if (copied === 0) {
  console.error("No sidecar binaries were copied successfully.");
  process.exit(1);
}

console.log(`✅ Go server binaries built and staged (${copied} target(s)).`);

function getHostTarget() {
  switch (process.platform) {
    case "win32": return "x86_64-pc-windows-msvc";
    case "darwin": return process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
    case "linux": return process.arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu";
    default: return "x86_64-pc-windows-msvc";
  }
}

function getCrossTargets() {
  switch (process.platform) {
    case "win32": return ["x86_64-pc-windows-msvc"];
    case "darwin": return ["x86_64-apple-darwin", "aarch64-apple-darwin"];
    case "linux": return ["x86_64-unknown-linux-gnu", "aarch64-unknown-linux-gnu"];
    default: return ["x86_64-pc-windows-msvc"];
  }
}