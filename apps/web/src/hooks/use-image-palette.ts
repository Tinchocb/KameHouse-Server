import * as React from "react"
import { getPixelSampleImage } from "@/lib/helpers/images"

export interface ImagePalette {
    /** Color promedio de la mitad izquierda (zona del texto). */
    left: string
    /** Color promedio de la mitad derecha (zona del personaje). */
    right: string
    /**
     * Grilla `ZONE_COLS`×`ZONE_ROWS` de colores promedio (fila a fila, de
     * arriba a la izquierda): para pintar un relleno con el color real de cada
     * región sin arrastrar formas de la imagen.
     */
    zones: string[]
    /** Color dominante o más vibrante/saturado de la imagen (rgb(...)). */
    accent?: string
    /** Versión calibrada para texto sobre fondos oscuros (contrast-safe >= 4.5:1). */
    accentText?: string
    /** Tono oscuro profundo para fondo de paneles/drawers (rgb(...)). */
    dark?: string
    /** Tono de superficie intermedia para degradados (rgb(...)). */
    surface?: string
}

export const ZONE_COLS = 8
export const ZONE_ROWS = 6

const paletteCache = new Map<string, ImagePalette>()
const MAX_CACHE_SIZE = 100

const PALETTE_W = 32
const PALETTE_H = 18

function averageZone(
    data: Uint8ClampedArray,
    x0: number,
    x1: number,
    y0 = 0,
    y1 = PALETTE_H,
): string {
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * PALETTE_W + x) * 4
            // Ignora píxeles casi transparentes (no aportan al wash).
            if (data[i + 3] < 128) continue
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            n++
        }
    }
    if (n === 0) return "rgb(20, 20, 24)"
    return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`
}

interface ExtractedColors {
    accent: string
    accentText: string
    dark: string
    surface: string
}

/**
 * Extrae la paleta cromática dominante a partir de los datos crudos del canvas.
 * Identifica los matices vibrantes mediante binning de tono HSL ponderado por croma
 * y luminancia equilibrada, asegurando texto contrastado y fondos atmosféricos.
 */
export function extractPaletteColors(
    data: Uint8ClampedArray,
    width: number,
    height: number,
): ExtractedColors {
    const bins = Array.from({ length: 16 }, () => ({
        rSum: 0,
        gSum: 0,
        bSum: 0,
        totalChroma: 0,
        count: 0,
    }))

    let fallbackR = 0
    let fallbackG = 0
    let fallbackB = 0
    let fallbackCount = 0

    const totalPixels = width * height
    for (let p = 0; p < totalPixels; p++) {
        const i = p * 4
        if (data[i + 3] < 128) continue

        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const chroma = max - min
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const lightness = (max + min) / 510

        if (lum > 30 && lum < 225) {
            fallbackR += r
            fallbackG += g
            fallbackB += b
            fallbackCount++
        }

        // Candidatos vibrantes: croma nítido y sin extremos de blanco o negro
        if (chroma >= 28 && lightness >= 0.18 && lightness <= 0.85) {
            let h = 0
            if (max === r) {
                h = ((g - b) / chroma) % 6
            } else if (max === g) {
                h = (b - r) / chroma + 2
            } else {
                h = (r - g) / chroma + 4
            }
            h = Math.round(h * 60)
            if (h < 0) h += 360

            const binIdx = Math.floor(h / 22.5) % 16
            // Recompensa croma alto y luminosidad media
            const lightnessWeight = Math.max(0.1, 1 - Math.abs(lightness - 0.52) * 1.5)
            const weight = chroma * lightnessWeight

            const bin = bins[binIdx]
            bin.rSum += r * weight
            bin.gSum += g * weight
            bin.bSum += b * weight
            bin.totalChroma += weight
            bin.count++
        }
    }

    let bestBin: (typeof bins)[0] | null = null
    let bestScore = 0

    for (const bin of bins) {
        if (bin.count < 3) continue
        const score = bin.totalChroma * Math.sqrt(bin.count)
        if (score > bestScore) {
            bestScore = score
            bestBin = bin
        }
    }

    let accentR: number
    let accentG: number
    let accentB: number

    if (bestBin && bestBin.totalChroma > 0) {
        accentR = Math.round(bestBin.rSum / bestBin.totalChroma)
        accentG = Math.round(bestBin.gSum / bestBin.totalChroma)
        accentB = Math.round(bestBin.bSum / bestBin.totalChroma)
    } else if (fallbackCount > 0) {
        accentR = Math.round(fallbackR / fallbackCount)
        accentG = Math.round(fallbackG / fallbackCount)
        accentB = Math.round(fallbackB / fallbackCount)
    } else {
        accentR = 245
        accentG = 158
        accentB = 11
    }

    const accent = `rgb(${accentR}, ${accentG}, ${accentB})`

    // Garantizar contraste >= 4.5:1 para texto sobre fondo oscuro
    const relLum = (0.2126 * accentR + 0.7152 * accentG + 0.0722 * accentB) / 255
    let textR = accentR
    let textG = accentG
    let textB = accentB
    if (relLum < 0.38) {
        const factor = Math.min(1, (0.42 - relLum) / 0.42)
        textR = Math.round(accentR + (255 - accentR) * factor * 0.65)
        textG = Math.round(accentG + (255 - accentG) * factor * 0.65)
        textB = Math.round(accentB + (255 - accentB) * factor * 0.65)
    }
    const accentText = `rgb(${textR}, ${textG}, ${textB})`

    // Fondo oscuro entintado para drawer
    const darkR = Math.min(255, Math.max(8, Math.round(accentR * 0.08 + 10)))
    const darkG = Math.min(255, Math.max(10, Math.round(accentG * 0.08 + 12)))
    const darkB = Math.min(255, Math.max(16, Math.round(accentB * 0.08 + 18)))
    const dark = `rgb(${darkR}, ${darkG}, ${darkB})`

    // Superficie intermedia
    const surfR = Math.min(255, Math.max(12, Math.round(accentR * 0.16 + 14)))
    const surfG = Math.min(255, Math.max(14, Math.round(accentG * 0.16 + 16)))
    const surfB = Math.min(255, Math.max(20, Math.round(accentB * 0.16 + 22)))
    const surface = `rgb(${surfR}, ${surfG}, ${surfB})`

    return {
        accent,
        accentText,
        dark,
        surface,
    }
}

const pendingPalettes = new Map<string, Promise<ImagePalette | null>>()

let sharedPaletteCanvas: HTMLCanvasElement | null = null

function getSharedPaletteContext(): CanvasRenderingContext2D | null {
    if (typeof document === "undefined") return null
    if (!sharedPaletteCanvas) {
        sharedPaletteCanvas = document.createElement("canvas")
        sharedPaletteCanvas.width = PALETTE_W
        sharedPaletteCanvas.height = PALETTE_H
    }
    return sharedPaletteCanvas.getContext("2d", { willReadFrequently: true })
}

/** Share image decode and canvas extraction across simultaneous consumers. */
function loadPalette(src: string): Promise<ImagePalette | null> {
    const cached = paletteCache.get(src)
    if (cached) return Promise.resolve(cached)
    const pending = pendingPalettes.get(src)
    if (pending) return pending
    const task = new Promise<ImagePalette | null>(resolve => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.decoding = "async"
        const draw = () => {
            try {
                const ctx = getSharedPaletteContext()
                if (!ctx) return null
                ctx.clearRect?.(0, 0, PALETTE_W, PALETTE_H)
                ctx.drawImage(img, 0, 0, PALETTE_W, PALETTE_H)
                const data = ctx.getImageData(0, 0, PALETTE_W, PALETTE_H).data
                const cw = PALETTE_W / ZONE_COLS
                const ch = PALETTE_H / ZONE_ROWS
                const zones: string[] = []
                for (let row = 0; row < ZONE_ROWS; row++) {
                    for (let col = 0; col < ZONE_COLS; col++) {
                        zones.push(averageZone(data, col * cw, (col + 1) * cw, row * ch, (row + 1) * ch))
                    }
                }
                const extracted = extractPaletteColors(data, PALETTE_W, PALETTE_H)
                const result: ImagePalette = {
                    left: averageZone(data, 0, PALETTE_W / 2),
                    right: averageZone(data, PALETTE_W / 2, PALETTE_W),
                    zones,
                    ...extracted,
                }
                if (paletteCache.size >= MAX_CACHE_SIZE) {
                    const first = paletteCache.keys().next().value
                    if (first) paletteCache.delete(first)
                }
                paletteCache.set(src, result)
                return result
            } catch {
                return null // Canvas/CORS failure: allow a later retry.
            }
        }
        const complete = () => resolve(draw())
        img.onerror = () => resolve(null)
        // Register the fallback before setting src (cached images may load immediately).
        if (typeof img.decode !== "function") img.onload = complete
        img.src = getPixelSampleImage(src)
        if (typeof img.decode === "function") img.decode().then(complete, () => resolve(null))
    }).then(result => {
        pendingPalettes.delete(src)
        return result
    }, () => {
        pendingPalettes.delete(src)
        return null
    })
    pendingPalettes.set(src, task)
    return task
}

/**
 * Extrae la paleta (izquierda/derecha/zonas y tonos dominantes) de una imagen ya descargada.
 * Dibuja a un canvas minúsculo: imposible que queden formas reconocibles,
 * solo el color real de cada zona. Con caché por URL y fallback a null
 * (canvas tainted por CORS o error de carga).
 */
export function useImagePalette(src: string | null | undefined): ImagePalette | null {
    const cached = src ? (paletteCache.get(src) ?? null) : null
    const [palette, setPalette] = React.useState<ImagePalette | null>(() => cached)
    const [prevSrc, setPrevSrc] = React.useState(src)

    if (src !== prevSrc) {
        setPrevSrc(src)
        if (!src || cached) {
            setPalette(cached)
        }
    }

    React.useEffect(() => {
        if (!src || paletteCache.has(src)) return
        let cancelled = false
        void loadPalette(src).then(result => {
            if (!cancelled && result) setPalette(result)
        })
        return () => { cancelled = true }
    }, [src])

    return cached ?? palette
}

export interface PosterPalette {
    accent: string
    hoverBorder: string
    hoverShadow: string
    drawerBackground: string
    drawerBorder: string
    pillBackground: string
    pillBorder: string
    pillText: string
    titleHover: string
}

/**
 * Hook para tarjetas de película (en Home y listados): deriva una paleta completa
 * optimizada para la tarjeta expandida (drawer lateral, halos, bordes y píldoras)
 * basada en la portada real de la película, con fallback transparente a los acentos de la era.
 */
export function usePosterPalette(
    src: string | null | undefined,
    fallbackColors?: { accent?: string; ambientGlow1?: string },
): PosterPalette {
    const palette = useImagePalette(src)

    return React.useMemo(() => {
        const fallbackAccent = fallbackColors?.accent || "#f59e0b"
        const fallbackText = fallbackColors?.ambientGlow1 || fallbackColors?.accent || "#fb923c"

        const accent = palette?.accent || fallbackAccent
        const accentText = palette?.accentText || fallbackText
        const dark = palette?.dark || "#0c0e14"
        const surface = palette?.surface || "#12151e"

        const hoverBorder = palette?.accent
            ? `color-mix(in srgb, ${accent} 75%, rgba(255, 255, 255, 0.35))`
            : `color-mix(in srgb, ${fallbackAccent} 75%, rgba(255, 255, 255, 0.3))`

        const hoverShadow = palette?.accent
            ? `0 14px 34px -12px color-mix(in srgb, ${accent} 45%, transparent)`
            : `0 14px 34px -12px color-mix(in srgb, ${fallbackAccent} 35%, transparent)`

        const drawerBackground = palette?.dark
            ? `radial-gradient(ellipse 90% 80% at 100% 0%, color-mix(in srgb, ${accent} 18%, transparent) 0%, transparent 75%), linear-gradient(to right, color-mix(in srgb, ${dark} 92%, #080a0f) 0%, color-mix(in srgb, ${surface} 45%, #0c0e14) 100%)`
            : `radial-gradient(ellipse 90% 80% at 100% 0%, color-mix(in srgb, ${fallbackAccent} 15%, transparent) 0%, transparent 75%), linear-gradient(to right, #0c0e14 0%, #12151e 100%)`

        const drawerBorder = palette?.accent
            ? `color-mix(in srgb, ${accent} 25%, rgba(255, 255, 255, 0.06))`
            : "rgba(255, 255, 255, 0.06)"

        const pillBackground = `color-mix(in srgb, ${accent} 20%, transparent)`
        const pillBorder = `color-mix(in srgb, ${accent} 38%, transparent)`
        const pillText = accentText
        const titleHover = accentText

        return {
            accent,
            hoverBorder,
            hoverShadow,
            drawerBackground,
            drawerBorder,
            pillBackground,
            pillBorder,
            pillText,
            titleHover,
        }
    }, [palette, fallbackColors?.accent, fallbackColors?.ambientGlow1])
}
