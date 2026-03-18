import Vibrant from "node-vibrant"

export interface ExtractedPalette {
    vibrant?: string
    darkVibrant?: string
    lightVibrant?: string
    muted?: string
    darkMuted?: string
    lightMuted?: string
}

/**
 * Extracts a palette of dominant colors from an image URL.
 * Uses node-vibrant to analyze the image and return hex codes.
 */
export async function extractPaletteFromImage(url: string): Promise<ExtractedPalette | null> {
    try {
        // We use the browser-compatible version of Vibrant
        const palette = await Vibrant.from(url).getPalette()
        
        return {
            vibrant: palette.Vibrant?.getHex(),
            darkVibrant: palette.DarkVibrant?.getHex(),
            lightVibrant: palette.LightVibrant?.getHex(),
            muted: palette.Muted?.getHex(),
            darkMuted: palette.DarkMuted?.getHex(),
            lightMuted: palette.LightMuted?.getHex(),
        }
    } catch (error) {
        console.error("Failed to extract palette:", error)
        return null
    }
}
