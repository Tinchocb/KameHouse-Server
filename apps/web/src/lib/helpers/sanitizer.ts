import DOMPurify from "dompurify"

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * Uses DOMPurify to strip dangerous tags and attributes.
 * 
 * @param html The raw HTML string to sanitize.
 * @returns A safe HTML string.
 */
export function sanitizeHtml(html: string | undefined | null): string {
    if (!html) return ""
    
    // In SSR/Node environments, DOMPurify might need a window object,
    // but in a standard React app (Vite/Rsbuild), it usually handles it.
    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        // Allow some specific things if needed, but default is safe
        ALLOWED_TAGS: ["b", "i", "em", "strong", "br", "p", "ul", "ol", "li", "a", "span"],
        ALLOWED_ATTR: ["href", "target", "rel", "class"],
    })
}
