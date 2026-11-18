import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"

/** Subconjunto recursivo: un parche puede traer solo algunos campos de cada sección. */
export type DeepPartial<T> = T extends (infer U)[]
    ? DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T

/** Lo que PATCH /settings acepta: cualquier parte de SaveSettings_Variables. */
export type SettingsPatch = DeepPartial<SaveSettings_Variables>

const SERVER_FIELDS = new Set(["id", "createdAt", "updatedAt", "updated", "lastScanAt"])

/** Only send changed fields; immediate saves and server-owned fields stay intact. */
export function changedSettings(values: object, baseline: object | undefined): SettingsPatch {
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
    // Se arma clave a clave; el tipo describe lo que el servidor acepta.
    return patch as SettingsPatch
}

/**
 * Devuelve `base` con los cambios de `patch` aplicados sección a sección, sin modificar `base`.
 * Las listas, los escalares y los null se reemplazan tal cual.
 */
export function applySettingsPatch<T extends object>(base: T, patch: object): T {
    const out: Record<string, unknown> = Object.fromEntries(Object.entries(base))
    for (const [key, value] of Object.entries(patch)) {
        const current = out[key]
        out[key] = isPlainRecord(value) && isPlainRecord(current) ? applySettingsPatch(current, value) : value
    }
    return out as T
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}
