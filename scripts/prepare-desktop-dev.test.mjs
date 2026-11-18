import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { stalePermissionPackages } from "./prepare-desktop-dev.mjs";

test("only invalidates relocated permission producers, even if the old checkout exists", t => {
  const root = mkdtempSync(path.join(tmpdir(), "kamehouse-permissions-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const build = path.join(root, "new", "debug", "build");
  const oldOut = path.join(root, "old", "debug", "build", "tauri-ab12", "out");
  mkdirSync(oldOut, { recursive: true });
  const fixture = (name, content) => {
    const dir = path.join(build, name);
    mkdirSync(path.join(dir, "out"), { recursive: true });
    writeFileSync(path.join(dir, "output"), content);
    return path.join(dir, "out");
  };
  fixture("tauri-ab12", `cargo:core:app__CORE_PLUGIN___PERMISSION_FILES_PATH=${path.join(oldOut, "permissions")}\r\n`);
  fixture("tauri-ab34", `cargo:PERMISSION_FILES_PATH=${path.join(oldOut, "permissions")}\n`);
  fixture("tauri-plugin-dialog-cd12", `cargo::PERMISSION_FILES_PATH=${path.join(oldOut, "permissions")}\n`);
  const current = fixture("tauri-plugin-log-ef12", "");
  fixture("tauri-plugin-log-ef12", `cargo:PERMISSION_FILES_PATH=${path.join(current, "permissions")}\n`);
  const app = fixture("kamehouse-desktop-ab12", "");
  fixture("kamehouse-desktop-ab12", `cargo:PERMISSION_FILES_PATH=${path.join(app, "app-manifest", "__app__-permission-files")}\n`);
  fixture("ring-ab12", `cargo:rustc-link-search=native=${oldOut}\n`);
  assert.deepEqual(stalePermissionPackages(build), ["tauri", "tauri-plugin-dialog"]);
  assert.deepEqual(stalePermissionPackages(path.join(root, "missing")), []);
});
