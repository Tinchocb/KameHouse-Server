// Verificación local para los git hooks (.githooks/) y para uso manual.
//
//   node scripts/verify.mjs pre-commit   typecheck + eslint (staged) + go vet, según lo staged
//   node scripts/verify.mjs pre-push     vitest + go test -short + codegen sin drift
//   node scripts/verify.mjs codegen      solo el chequeo de drift del codegen
//   node scripts/verify.mjs all          todo lo anterior sobre el árbol completo
//
// Sin dependencias nuevas: usa las herramientas que ya instala pnpm y `go`.
// Saltar puntualmente: `git commit --no-verify` / `git push --no-verify`.

import { spawnSync, execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const webDir = path.join(rootDir, "apps", "web")
const serverDir = path.join(rootDir, "apps", "server")
const webRequire = createRequire(path.join(webDir, "package.json"))
const isWindows = process.platform === "win32"

const GENERATED_DIRS = ["apps/server/codegen/generated", "apps/web/src/api/generated"]

function binOf(pkg, bin) {
    const pkgJson = webRequire.resolve(`${pkg}/package.json`)
    const { bin: bins } = webRequire(pkgJson)
    const rel = typeof bins === "string" ? bins : bins[bin ?? pkg]
    return path.join(path.dirname(pkgJson), rel)
}

function run(label, cmd, args, cwd) {
    console.log(`\n▶ ${label}`)
    const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: isWindows && cmd !== process.execPath })
    if (res.status !== 0) {
        console.error(`\n✖ ${label} falló. Usa --no-verify solo si sabes lo que haces.`)
        process.exit(res.status ?? 1)
    }
}

function node(label, script, args, cwd = webDir) {
    run(label, process.execPath, ["--max-old-space-size=8192", script, ...args], cwd)
}

function git(args) {
    return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" })
}

function stagedFiles() {
    return git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]).split("\n").filter(Boolean)
}

function hasGo() {
    return spawnSync("go", ["version"], { stdio: "ignore", shell: isWindows }).status === 0
}

// routeTree.gen.ts lo genera rsbuild al arrancar; sin él tsc falla en un clon
// recién hecho. Misma config (tsr.config.json) que el plugin de rsbuild.
async function ensureRouteTree() {
    // Entrada ESM explícita: la CJS emite un aviso de dependencia circular.
    const pkgJson = webRequire.resolve("@tanstack/router-generator/package.json")
    const entry = path.join(path.dirname(pkgJson), webRequire(pkgJson).exports["."].import.default)
    const { Generator, getConfig } = await import(pathToFileURL(entry).href)
    await new Generator({ config: getConfig({}, webDir), root: webDir }).run()
}

async function checkWeb({ lintFiles }) {
    await ensureRouteTree()
    node("web: typecheck", binOf("typescript", "tsc"), ["--noEmit"])
    if (lintFiles === "all") node("web: eslint", binOf("eslint"), ["src/"])
    else if (lintFiles.length > 0) node("web: eslint (staged)", binOf("eslint"), ["--no-warn-ignored", ...lintFiles])
}

function checkGoVet() {
    if (!hasGo()) return console.warn("⚠ go no está en el PATH: se omite go vet")
    run("server: go vet", "go", ["vet", "./internal/...", "./codegen/..."], serverDir)
}

function checkCodegen() {
    if (!hasGo()) return console.warn("⚠ go no está en el PATH: se omite el chequeo de codegen")
    run("codegen: regenerar", "go", ["run", "main.go"], path.join(serverDir, "codegen"))
    // git status (no git diff): también detecta archivos generados nuevos sin trackear.
    const drift = git(["status", "--porcelain", "--", ...GENERATED_DIRS]).trim()
    if (drift) {
        console.error(`\n✖ Drift de codegen: los archivos generados no están al día.\n${drift}\n` +
            "Ejecuta `pnpm codegen` y commitea el resultado.")
        process.exit(1)
    }
    console.log("✔ codegen sin drift")
}

async function preCommit() {
    const staged = stagedFiles()
    const web = staged.filter(f => f.startsWith("apps/web/"))
    const go = staged.filter(f => f.startsWith("apps/server/") && f.endsWith(".go"))
    if (web.length === 0 && go.length === 0) return console.log("✔ nada que verificar (sin cambios en apps/web ni .go)")

    if (web.length > 0) {
        const lintFiles = web
            .filter(f => /^apps\/web\/src\/.*\.(ts|tsx)$/.test(f) && existsSync(path.join(rootDir, f)))
            .map(f => path.relative(webDir, path.join(rootDir, f)))
        await checkWeb({ lintFiles })
    }
    if (go.length > 0) checkGoVet()
}

function prePush() {
    node("web: vitest", binOf("vitest"), ["run"])
    if (hasGo()) run("server: go test -short", "go", ["test", "-short", "./internal/...", "./codegen/..."], serverDir)
    else console.warn("⚠ go no está en el PATH: se omite go test")
    checkCodegen()
}

const stage = process.argv[2]
switch (stage) {
    case "pre-commit":
        await preCommit()
        break
    case "pre-push":
        prePush()
        break
    case "codegen":
        checkCodegen()
        break
    case "all":
        await checkWeb({ lintFiles: "all" })
        checkGoVet()
        prePush()
        break
    default:
        console.error("Uso: node scripts/verify.mjs <pre-commit|pre-push|codegen|all>")
        process.exit(2)
}
console.log(`\n✔ verify ${stage} OK`)
