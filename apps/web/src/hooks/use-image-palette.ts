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

/**
 * Extrae la paleta (izquierda/derecha) de una imagen ya descargada.
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
        const img = new Image()
        // TMDB sirve CORS abierto; getPixelSampleImage evita reusar la copia
        // cacheada sin CORS. En local (same-origin) es inocuo.
        img.crossOrigin = "anonymous"
        img.decoding = "async"
        // decode() y no onload: onload llega antes de decodificar y drawImage
        // decodificaba de golpe en el hilo principal (~20 ms con los fondos de
        // 1920 px, en cada rotación del carrusel). decode() lo hace aparte.
        const draw = () => {
            try {
                const canvas = document.createElement("canvas")
                canvas.width = PALETTE_W
                canvas.height = PALETTE_H
                const ctx = canvas.getContext("2d", { willReadFrequently: true })
                if (!ctx) return
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
                const result: ImagePalette = {
                    left: averageZone(data, 0, PALETTE_W / 2),
                    right: averageZone(data, PALETTE_W / 2, PALETTE_W),
                    zones,
                }
                if (paletteCache.size >= MAX_CACHE_SIZE) {
                    const first = paletteCache.keys().next().value
                    if (first) paletteCache.delete(first)
                }
                paletteCache.set(src, result)
                if (!cancelled) setPalette(result)
            } catch {
                // Canvas tainted (CORS) u otro fallo: el llamador usa su fallback.
            }
        }
        img.src = getPixelSampleImage(src)
        img.decode().then(draw).catch(() => {
            // Error de carga: el llamador usa su fallback.
        })
        return () => {
            cancelled = true
        }
    }, [src])

    return cached ?? palette
}
