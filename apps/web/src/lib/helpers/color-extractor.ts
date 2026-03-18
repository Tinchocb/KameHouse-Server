// color-extractor.ts
// Pure browser implementation using Canvas API — no external library needed.
// Extracts dominant colors from an image URL by sampling pixel data.

export interface ExtractedPalette {
    vibrant?: string
    darkVibrant?: string
    lightVibrant?: string
    muted?: string
    darkMuted?: string
    lightMuted?: string
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
}

function getLuminance(r: number, g: number, b: number): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function getSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return max === 0 ? 0 : (max - min) / max
}

/**
 * Extracts a palette of dominant colors from an image URL.
 * Uses Canvas API to sample pixels and derive color swatches.
 */
export async function extractPaletteFromImage(url: string): Promise<ExtractedPalette | null> {
    try {
        const img = new Image()
        img.crossOrigin = "anonymous"
        
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = url
        })

        const canvas = document.createElement("canvas")
        const SIZE = 64 // downsample for perf
        canvas.width = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, SIZE, SIZE)
        
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data
        
        const pixels: Array<[number, number, number]> = []
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]!
            const g = data[i + 1]!
            const b = data[i + 2]!
            const a = data[i + 3]!
            if (a < 128) continue // skip transparent
            pixels.push([r, g, b])
        }
        
        if (pixels.length === 0) return null
        
        // Sort by saturation and luminance to find key swatches
        const withMeta = pixels.map(([r, g, b]) => ({
            r, g, b,
            sat: getSaturation(r, g, b),
            lum: getLuminance(r, g, b),
        }))
        
        const vibrant = withMeta
            .filter(p => p.sat > 0.4 && p.lum > 80 && p.lum < 200)
            .sort((a, b) => b.sat - a.sat)[0]
            
        const darkVibrant = withMeta
            .filter(p => p.sat > 0.4 && p.lum < 80)
            .sort((a, b) => b.sat - a.sat)[0]
            
        const lightVibrant = withMeta
            .filter(p => p.sat > 0.3 && p.lum >= 200)
            .sort((a, b) => b.sat - a.sat)[0]
            
        const muted = withMeta
            .filter(p => p.sat > 0.05 && p.sat < 0.4 && p.lum > 80 && p.lum < 200)
            .sort((a, b) => b.sat - a.sat)[0]
            
        const darkMuted = withMeta
            .filter(p => p.sat > 0.05 && p.sat < 0.4 && p.lum < 80)
            .sort((a, b) => b.sat - a.sat)[0]

        const lightMuted = withMeta
            .filter(p => p.sat > 0.05 && p.sat <= 0.3 && p.lum >= 200)
            .sort((a, b) => b.sat - a.sat)[0]

        return {
            vibrant: vibrant ? rgbToHex(vibrant.r, vibrant.g, vibrant.b) : undefined,
            darkVibrant: darkVibrant ? rgbToHex(darkVibrant.r, darkVibrant.g, darkVibrant.b) : undefined,
            lightVibrant: lightVibrant ? rgbToHex(lightVibrant.r, lightVibrant.g, lightVibrant.b) : undefined,
            muted: muted ? rgbToHex(muted.r, muted.g, muted.b) : undefined,
            darkMuted: darkMuted ? rgbToHex(darkMuted.r, darkMuted.g, darkMuted.b) : undefined,
            lightMuted: lightMuted ? rgbToHex(lightMuted.r, lightMuted.g, lightMuted.b) : undefined,
        }
    } catch (error) {
        console.error("Failed to extract palette:", error)
        return null
    }
}
