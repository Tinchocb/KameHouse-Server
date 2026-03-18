import { useState, useEffect } from "react"
import { extractPaletteFromImage, type ExtractedPalette } from "@/lib/helpers/color-extractor"

/**
 * Hook to extract and manage a dynamic palette from an image URL.
 * Automatically updates when the URL changes.
 */
export function useExtractColor(imageUrl: string | undefined) {
    const [palette, setPalette] = useState<ExtractedPalette | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!imageUrl) {
            setPalette(null)
            return
        }

        let isMounted = true
        setIsLoading(true)

        extractPaletteFromImage(imageUrl).then((result) => {
            if (isMounted) {
                setPalette(result)
                setIsLoading(false)
                
                // Update global CSS variables for immersive backgrounds
                if (result?.vibrant) {
                    document.documentElement.style.setProperty("--extracted-vibrant", result.vibrant)
                }
                if (result?.darkVibrant) {
                    document.documentElement.style.setProperty("--extracted-vibrant-dark", result.darkVibrant)
                }
                if (result?.lightVibrant) {
                    document.documentElement.style.setProperty("--extracted-vibrant-light", result.lightVibrant)
                }
                if (result?.muted) {
                    document.documentElement.style.setProperty("--extracted-muted", result.muted)
                }
                
                // Create a dynamic radial gradient background variable
                const primaryColor = result?.darkVibrant || result?.vibrant || "rgba(0,0,0,0)"
                document.documentElement.style.setProperty(
                    "--extracted-bg-gradient",
                    `radial-gradient(circle at 20% 0%, ${primaryColor}33, transparent 50%), 
                     radial-gradient(circle at 80% 0%, ${result?.muted || primaryColor}22, transparent 50%)`
                )
            }
        })

        return () => {
            isMounted = false
        }
    }, [imageUrl])

    return { palette, isLoading }
}
