/**
 * Normalizes a file or directory path safely for cross-platform usage.
 * Converts Windows backslashes to forward slashes, collapses redundant separators,
 * and handles drive letters and UNC paths.
 */
export function normalizeSafe(p: string): string {
    if (!p) return ""
    let normalized = p.replace(/\\/g, "/")
    const isUNC = normalized.startsWith("//") && !normalized.startsWith("///")
    normalized = normalized.replace(/\/{2,}/g, "/")
    if (isUNC) {
        normalized = "/" + normalized
    }
    if (normalized.length > 1 && normalized.endsWith("/") && !/^[a-zA-Z]:\/$/.test(normalized)) {
        normalized = normalized.slice(0, -1)
    }
    return normalized
}
