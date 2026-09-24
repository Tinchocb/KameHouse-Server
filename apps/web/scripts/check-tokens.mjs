#!/usr/bin/env node
/**
 * check-tokens — detecta estilos que se pierden en silencio.
 *
 * 1. Clases usadas en el código que ni Tailwind ni el CSS propio generan
 *    (p. ej. `bg-token/60` sobre un color definido con un var() pelado, o un
 *    paso de espaciado que no existe como `h-6.5`).
 * 2. Variables CSS usadas con `var(--x)` (sin fallback) que no se definen en
 *    ningún lado, y el patrón inválido `var(--x)HH` (alfa hex pegado a un var).
 *
 * Uso: npm run lint:tokens   (sale con código 1 si encuentra problemas)
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(ROOT, "src")

// Clases "marcador" sin estilo propio: se usan como hooks de JS/CSS o de tests.
const MARKER_CLASSES = new Set([
    "bg-music-toggle-btn",
    "blur-when-unavailable",
    "content-level-detonante",
    "content-level-climax",
    "content-level-lore",
    "content-level-contexto",
])
// Variables que inyecta una librería en tiempo de ejecución.
const RUNTIME_VAR_PREFIXES = ["--tw-", "--radix-"]

const walk = (dir, out = []) => {
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name)
        if (fs.statSync(p).isDirectory()) walk(p, out)
        else out.push(p)
    }
    return out
}
const rel = (p) => path.relative(ROOT, p).replaceAll("\\", "/")

const files = walk(SRC).filter((f) => !f.includes(`${path.sep}generated${path.sep}`))
const codeFiles = files.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f))
const cssFiles = files.filter((f) => f.endsWith(".css"))

// ─── Extracción de nombres de clase desde CSS (desescapando selectores) ───────
const unescapeCss = (s) =>
    s.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex, ch) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch))

function classNamesFromCss(css) {
    const names = new Set()
    const preludeRe = /([^{}]+)\{/g
    let m
    while ((m = preludeRe.exec(css))) {
        const prelude = m[1].trim()
        if (prelude.startsWith("@")) continue
        for (let i = 0; i < prelude.length; i++) {
            if (prelude[i] !== ".") continue
            // Un "." precedido de dígito es un número (0.5), no un selector de clase.
            if (i > 0 && /[0-9]/.test(prelude[i - 1])) continue
            let j = i + 1
            let raw = ""
            while (j < prelude.length) {
                const c = prelude[j]
                if (c === "\\") {
                    raw += prelude.slice(j, j + 2)
                    j += 2
                    // escape hex: consumir dígitos y el espacio opcional
                    while (j < prelude.length && /[0-9a-fA-F ]/.test(prelude[j]) && /\\[0-9a-fA-F]+$/.test(raw)) {
                        raw += prelude[j]
                        if (prelude[j] === " ") { j++; break }
                        j++
                    }
                    continue
                }
                if (/[\s,>+~:.[\]()#{]/.test(c)) break
                raw += c
                j++
            }
            if (raw) names.add(unescapeCss(raw))
        }
    }
    return names
}

// ─── Candidatos: strings del código que parecen listas de clases ──────────────
const looksTw = /^(?:[a-z0-9-[\]&:>*@_]+:)*!?-?(?:flex|grid|block|inline|hidden|text-|bg-|p[xytblr]?-|m[xytblr]?-|rounded|border|w-|h-|min-|max-|gap-|space-|shadow|ring|opacity-|z-|top-|left-|right-|bottom-|inset|font-|leading-|tracking-|duration-|ease-|transition|backdrop-|blur|from-|to-|via-|items-|justify-|self-|overflow|object-|aspect-|translate|scale|rotate|cursor-|select-|pointer-|line-clamp|truncate|whitespace|break-|fill-|stroke-|outline|divide|order-|col-|row-|grow|shrink|basis|place-|content-|size-|animate-|drop-shadow|saturate|contrast|brightness|grayscale|mix-blend|will-change|delay-|decoration|placeholder)/

const candidates = new Map()
const strRe = /(["'`])((?:(?!\1)[^\n\\]|\\.)*)\1/g
for (const f of codeFiles) {
    const src = fs.readFileSync(f, "utf8")
    let m
    while ((m = strRe.exec(src))) {
        const str = m[2]
        if (!str || str.includes("${")) continue
        // Strings de CSS en línea (transition: 'flex-grow 600ms cubic-bezier(...)') no son clases.
        if (/\b\d+m?s\b|cubic-bezier|,\s/.test(str)) continue
        const parts = str.split(/\s+/).filter(Boolean)
        // Una lista de clases real tiene varias; así se evitan ids y textos sueltos.
        if (parts.length < 2 || parts.filter((p) => looksTw.test(p)).length < 2) continue
        for (const c of parts) {
            if (c.length > 100 || /[{}();=,'"]/.test(c) || !looksTw.test(c)) continue
            if (/^(group|peer)(\/|$)/.test(c) || MARKER_CLASSES.has(c)) continue
            if (!candidates.has(c)) candidates.set(c, f)
        }
    }
}

// ─── Qué genera Tailwind para esos candidatos ─────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "check-tokens-"))
const html = path.join(tmp, "content.html")
const input = path.join(tmp, "input.css")
fs.writeFileSync(html, `<div class="${[...candidates.keys()].join(" ")}"></div>`)
fs.writeFileSync(input, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n")
// El paquete puede estar hoisteado a la raíz del monorepo: se resuelve como módulo.
const twCli = createRequire(path.join(ROOT, "package.json")).resolve("tailwindcss/lib/cli.js")
const generated = execFileSync(process.execPath, [twCli, "-c", "tailwind.config.ts", "-i", input, "--content", html], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1e8,
})
fs.rmSync(tmp, { recursive: true, force: true })

const known = classNamesFromCss(generated)
for (const f of cssFiles) for (const n of classNamesFromCss(fs.readFileSync(f, "utf8"))) known.add(n)

const deadClasses = [...candidates].filter(([c]) => {
    if (known.has(c)) return false
    const last = c.replace(/^!/, "").split(":").pop().replace(/^!/, "")
    return !known.has(last)
})

// ─── Variables CSS ────────────────────────────────────────────────────────────
const defined = new Set()
const used = new Map()
const badHexAlpha = []
const allForVars = [...codeFiles, ...cssFiles, path.join(ROOT, "tailwind.config.ts"), path.join(ROOT, "index.html")]
for (const f of allForVars) {
    const s = fs.readFileSync(f, "utf8")
    for (const m of s.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) defined.add(m[1])
    for (const m of s.matchAll(/["'`](--[a-zA-Z0-9_-]+)["'`]\s*[,:\]]/g)) defined.add(m[1])
    for (const m of s.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(,)?/g)) {
        if (m[2] || RUNTIME_VAR_PREFIXES.some((p) => m[1].startsWith(p))) continue
        if (!used.has(m[1])) used.set(m[1], new Set())
        used.get(m[1]).add(rel(f))
    }
    for (const m of s.matchAll(/var\(--[a-zA-Z0-9_-]+\)[0-9a-fA-F]{2}\b/g)) badHexAlpha.push([m[0], rel(f)])
}
// Comentarios de ejemplo con var(--x) no cuentan.
const deadVars = [...used].filter(([v]) => !defined.has(v) && v !== "--x")

// ─── Arbitrarios que ya tienen token ──────────────────────────────────────────
// Mismo valor, pero escrito a mano: se desalinean del sistema la próxima vez que
// cambie el token. Se reportan con su reemplazo.
const TOKENIZED = new Map([
    ["text-[11px]", "text-2xs"],
    ["text-[10px]", "text-3xs"],
    ["text-[9px]", "text-4xs"],
    ["text-[8px]", "text-5xs"],
    ["tracking-[0.2em]", "tracking-ultra"],
    ["shadow-[var(--shadow-brand-primary)]", "shadow-brand-primary"],
    ["bg-[var(--bg-primary)]", "bg-bg-primary"],
])
const tokenized = []
for (const f of [...codeFiles, ...cssFiles]) {
    const s = fs.readFileSync(f, "utf8")
    for (const [raw, token] of TOKENIZED) {
        // Un modificador de opacidad (bg-[var(--x)]/70) no tiene equivalente en el token.
        const re = new RegExp(`(?<![\\w-])${raw.replace(/[[\]().-]/g, "\\$&")}(?!/)`, "g")
        if (re.test(s)) tokenized.push([raw, token, rel(f)])
    }
    // Brillo superior del vidrio escrito a mano → --glass-highlight-{sm,md,lg}.
    for (const m of s.matchAll(/inset_0_1px_1px(?:_0)?_rgba\(255,255,255,(0?\.\d+)\)/g)) {
        const a = Number(m[1])
        const lv = a >= 0.07 && a <= 0.12 ? "sm" : a >= 0.15 && a <= 0.2 ? "md" : a >= 0.25 && a <= 0.3 ? "lg" : null
        if (lv) tokenized.push([m[0], `var(--glass-highlight-${lv})`, rel(f)])
    }
}

// Tailwind 3 toma shadow-[var(--x)...] (empieza con var) por un COLOR de sombra
// (--tw-shadow-color) y no pinta nada. Usar el token o el hint: shadow-[shadow:var(--x)].
// Si empieza con los offsets (shadow-[0_0_8px_hsl(var(--x))]) no hay ambigüedad.
const untypedShadowVars = []
for (const f of codeFiles) {
    const s = fs.readFileSync(f, "utf8")
    for (const m of s.matchAll(/(?<![\w-])shadow-\[var\(--[^\]\s]*\]/g)) untypedShadowVars.push([m[0], rel(f)])
}

// ─── Reporte ──────────────────────────────────────────────────────────────────
let problems = 0
if (tokenized.length) {
    problems += tokenized.length
    console.log(`
✖ ${tokenized.length} valor(es) arbitrario(s) que ya tienen token:`)
    for (const [raw, token, f] of tokenized) console.log(`   ${raw} → ${token}`.padEnd(44) + ` ${f}`)
}
if (untypedShadowVars.length) {
    problems += untypedShadowVars.length
    console.log(`\n✖ ${untypedShadowVars.length} sombra(s) con var() sin hint (Tailwind la toma por color y no se ve; usar shadow-[shadow:var(...)]):`)
    for (const [c, f] of untypedShadowVars) console.log(`   ${c.padEnd(40)} ${f}`)
}
if (deadClasses.length) {
    problems += deadClasses.length
    console.log(`\n✖ ${deadClasses.length} clase(s) sin estilo generado:`)
    for (const [c, f] of deadClasses) console.log(`   ${c.padEnd(40)} ${rel(f)}`)
}
if (deadVars.length) {
    problems += deadVars.length
    console.log(`\n✖ ${deadVars.length} variable(s) CSS usadas sin definir:`)
    for (const [v, fs_] of deadVars) console.log(`   ${v.padEnd(40)} ${[...fs_].slice(0, 3).join(", ")}`)
}
if (badHexAlpha.length) {
    problems += badHexAlpha.length
    console.log(`\n✖ ${badHexAlpha.length} alfa hex pegado a var() (CSS inválido; usar color-mix):`)
    for (const [v, f] of badHexAlpha) console.log(`   ${v.padEnd(40)} ${f}`)
}
if (problems) {
    console.log(`\n${problems} problema(s) de tokens. Ver scripts/check-tokens.mjs.`)
    process.exit(1)
}
console.log(`✔ Tokens OK: ${candidates.size} clases y ${used.size} variables CSS verificadas.`)
