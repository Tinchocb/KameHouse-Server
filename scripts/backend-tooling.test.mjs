import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))

test("--cross fails before compilation, cleaning and dev staging", () => {
    const result = spawnSync(process.execPath, [path.join(scriptsDir, "build-server.mjs"), "--cross", "--clean", "--dev"], { encoding: "utf8" })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Cross-compilation is not implemented/)
    assert.equal(result.stdout, "")
})

test("full verification and codegen require Go before starting other checks", t => {
    const emptyPath = mkdtempSync(path.join(tmpdir(), "kamehouse-no-go-"))
    t.after(() => rmSync(emptyPath, { recursive: true, force: true }))
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path"))
    env.PATH = emptyPath
    for (const stage of ["pre-push", "all", "codegen"]) {
        const result = spawnSync(process.execPath, [path.join(scriptsDir, "verify.mjs"), stage], { env, encoding: "utf8" })
        assert.equal(result.status, 1, stage)
        assert.match(result.stderr, /Go no está en el PATH/, stage)
        assert.doesNotMatch(result.stdout, /verify .* OK|▶/, stage)
    }
})
