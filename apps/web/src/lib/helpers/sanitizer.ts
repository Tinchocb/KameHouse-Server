/**
 * Strips all HTML tags and returns plain text.
 * Suitable for titles, short descriptions, cards and heros.
 */
export function stripHtml(html: string | null | undefined): string {
    if (!html) return ""
    return html.replace(/<[^>]*>/g, "").trim()
}

