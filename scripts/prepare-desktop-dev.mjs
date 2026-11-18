import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = fileURLToPath(new URL("../apps/desktop/src-tauri/", import.meta.url));

// Cargo can reuse build-script output after a checkout is moved. Tauri's
// permission metadata contains absolute paths, so those scripts must run again.
// Compare locations even when the previous checkout still exists.
export function stalePermissionPackages(buildDir) {
  if (!fs.existsSync(buildDir)) return [];
  const packages = new Set();
  for (const entry of fs.readdirSync(buildDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageName = entry.name.match(/^(.*)-[a-f0-9]+$/)?.[1];
    const output = path.join(buildDir, entry.name, "output");
    if (!packageName || !fs.existsSync(output)) continue;
    const expectedDir = path.join(buildDir, entry.name, "out");
    for (const line of fs.readFileSync(output, "utf8").split(/\r?\n/)) {
      const permissionPath = line.match(/^cargo(?:::|:).*PERMISSION_FILES_PATH=(.+)$/)?.[1];
      if (!permissionPath) continue;
      const relative = path.relative(expectedDir, permissionPath);
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        packages.add(packageName);
        break;
      }
    }
  }
  return [...packages].sort();
}

function main() {
  const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--no-deps", "--format-version", "1"], {
    cwd: desktopDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }));
  const targetDir = metadata.target_directory;
  if (!fs.existsSync(targetDir)) return;
  const builds = [{ dir: path.join(targetDir, "debug", "build"), target: null }];
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "debug" && entry.name !== "release") {
      builds.push({ dir: path.join(targetDir, entry.name, "debug", "build"), target: entry.name });
    }
  }
  for (const { dir, target } of builds) {
    const packages = stalePermissionPackages(dir);
    if (packages.length === 0) continue;
    console.log(`[INFO] Regenerando cache de permisos trasladada: ${packages.join(", ")}`);
    execFileSync("cargo", [
      "clean", "--profile", "dev",
      ...(target ? ["--target", target] : []),
      ...packages.flatMap(name => ["-p", name]),
    ], { cwd: desktopDir, stdio: "inherit" });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error("[ERROR] No se pudo preparar la cache de Tauri:", error.message);
    process.exit(1);
  }
}
