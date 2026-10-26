// node scripts/optimize-shelf-art.mjs [ruta al módulo sharp]
// Conserva los PNG fuente; verifica alfa y todos los RGB visibles antes de servir WebP.
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const root = fileURLToPath(new URL('../', import.meta.url))
const configPath = path.join(root, 'apps/web/src/lib/helpers/goku-panorama.ts')
let config = await readFile(configPath, 'utf8')
const urls = [...new Set([...config.matchAll(/rawImg(?:Ataque)?: "(\/icons\/series-icons\/[^\"]+\.(?:png|webp))"/g)].map(match => match[1]))]
const rows = []
const hash = data => createHash('sha256').update(data).digest('hex')

for (const url of urls) {
    const source = url.replace(/\.(?:png|webp)$/, '.png')
    const sourcePath = path.join(root, 'apps/web/public', source)
    const original = await readFile(sourcePath)
    const encoded = await sharp(original).webp({ lossless: true, effort: 6 }).toBuffer()
    const before = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const after = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (before.info.width !== after.info.width || before.info.height !== after.info.height || before.data.length !== after.data.length) {
        throw new Error(`Dimensiones distintas: ${source}`)
    }
    let hiddenRgbDifferences = 0
    for (let i = 0; i < before.data.length; i += 4) {
        if (before.data[i + 3] !== after.data[i + 3]) throw new Error(`Alfa distinto: ${source}`)
        for (let channel = 0; channel < 3; channel++) {
            if (before.data[i + channel] === after.data[i + channel]) continue
            if (before.data[i + 3] !== 0) throw new Error(`Color visible distinto: ${source}`)
            hiddenRgbDifferences++
        }
    }
    const optimized = encoded.length < original.length ? source.replace(/\.png$/, '.webp') : source
    if (optimized.endsWith('.webp')) await writeFile(path.join(root, 'apps/web/public', optimized), encoded)
    config = config.replaceAll(`"${url}"`, `"${optimized}"`)
    rows.push({ source, optimized, originalBytes: original.length, servedBytes: optimized === source ? original.length : encoded.length,
        width: before.info.width, height: before.info.height, alphaAndVisibleRgbIdentical: true, hiddenRgbDifferences,
        originalSha256: hash(original), servedSha256: hash(optimized === source ? original : encoded) })
}
await writeFile(configPath, config)
const originalBytes = rows.reduce((sum, row) => sum + row.originalBytes, 0)
const servedBytes = rows.reduce((sum, row) => sum + row.servedBytes, 0)
const report = { originalBytes, servedBytes, reductionPercent: (1 - servedBytes / originalBytes) * 100, rows }
await writeFile(path.join(root, 'docs/auditoria/shelf-art-optimization.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ count: rows.length, originalBytes, servedBytes, reductionPercent: report.reductionPercent }, null, 2))
