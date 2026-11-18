const SERVER_FIELDS = new Set(["id", "createdAt", "updatedAt", "updated", "lastScanAt"])

/** Only send changed fields; immediate saves and server-owned fields stay intact. */
export function changedSettings(values: object, baseline: object | undefined): Record<string, unknown> {
    const previous = (baseline ?? {}) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(values)) {
        if (SERVER_FIELDS.has(key)) continue
        if (value === undefined || JSON.stringify(value) === JSON.stringify(previous[key])) continue
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            const nested = changedSettings(value, previous[key] as object | undefined)
            if (Object.keys(nested).length) patch[key] = nested
        } else {
            patch[key] = value
        }
    }
    return patch
}
