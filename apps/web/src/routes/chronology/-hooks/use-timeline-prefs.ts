import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LEGACY_VOLUME_TO_SPANS } from "@/components/chronology/data/volumes"
import { computeSpanProgress, overrideFor, type SpanProgress, type SpanRange } from "@/components/chronology/data/spanProgress"
import { useGetChronologyProgress, useSaveChronologySpanOverrides } from "@/api/hooks/chronology.hooks"

/** Clave del progreso previo a guardarlo en el servidor; se migra una vez y se borra. */
const LEGACY_READ_IDS_KEY = "dragonball_timeline_read"
const SHOW_INTERLUDES_KEY = "dragonball_timeline_show_interludes"

function takeLegacyReadIds(): string[] {
    try {
        const saved = localStorage.getItem(LEGACY_READ_IDS_KEY)
        if (!saved) return []
        const parsed: unknown = JSON.parse(saved)
        if (!Array.isArray(parsed)) return []
        const out = new Set<string>()
        for (const id of parsed) {
            if (typeof id !== "string") continue
            for (const spanId of LEGACY_VOLUME_TO_SPANS[id] ?? [id]) out.add(spanId)
        }
        return [...out]
    } catch {
        return []
    }
}

function dropLegacyReadIds() {
    try {
        localStorage.removeItem(LEGACY_READ_IDS_KEY)
    } catch {
        // Sin storage no hay nada que migrar.
    }
}

/**
 * Progreso por lapso: episodios vistos (historial y lista) más marcas manuales,
 * todo guardado en el servidor por cuenta.
 */
export function useChronologyProgress(spans: SpanRange[]) {
    const { data, isLoading } = useGetChronologyProgress()
    const { mutate: saveOverrides } = useSaveChronologySpanOverrides()

    const progressById = useMemo(() => computeSpanProgress(spans, data), [spans, data])
    const readVolumeIds = useMemo(() => {
        const ids = new Set<string>()
        for (const [id, p] of progressById) if (p.watched) ids.add(id)
        return ids
    }, [progressById])

    // Migración única: lo marcado en localStorage pasa al servidor como marca manual.
    const migrated = useRef(false)
    useEffect(() => {
        if (!data || migrated.current) return
        migrated.current = true
        const legacy = takeLegacyReadIds()
        if (legacy.length === 0) return
        const overrides: Record<string, boolean | null> = {}
        for (const id of legacy) {
            const p = progressById.get(id)
            if (p && !p.watched) overrides[id] = true
        }
        if (Object.keys(overrides).length === 0) {
            dropLegacyReadIds()
            return
        }
        saveOverrides({ overrides }, { onSuccess: dropLegacyReadIds })
    }, [data, progressById, saveOverrides])

    const setWatched = useCallback(
        (ids: Iterable<string>, desired: boolean) => {
            const overrides: Record<string, boolean | null> = {}
            for (const id of ids) {
                const p = progressById.get(id)
                if (p?.watched === desired) continue
                overrides[id] = overrideFor(p, desired)
            }
            if (Object.keys(overrides).length > 0) saveOverrides({ overrides })
        },
        [progressById, saveOverrides],
    )

    const handleToggleRead = useCallback(
        (id: string) => setWatched([id], !readVolumeIds.has(id)),
        [readVolumeIds, setWatched],
    )

    /** Foto de las marcas actuales, para deshacer "marcar todos" y "reiniciar". */
    const snapshotOverrides = useCallback((): Record<string, boolean | null> => {
        const current = data?.overrides ?? {}
        const snapshot: Record<string, boolean | null> = {}
        for (const span of spans) snapshot[span.id] = current[span.id] ?? null
        return snapshot
    }, [data, spans])

    const restoreOverrides = useCallback(
        (snapshot: Record<string, boolean | null>) => saveOverrides({ overrides: snapshot }),
        [saveOverrides],
    )

    return {
        isLoading,
        progressById: progressById as ReadonlyMap<string, SpanProgress>,
        readVolumeIds,
        handleToggleRead,
        setWatched,
        snapshotOverrides,
        restoreOverrides,
    }
}

/** Mostrar u ocultar los interludios entre lapsos, persistido en localStorage. */
export function useShowInterludes() {
    const [showInterludes, setShowInterludes] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(SHOW_INTERLUDES_KEY)
            if (saved === "false") return false
        } catch (e) {
            console.error("Error loading interludes preference from localStorage:", e)
        }
        return true
    })

    const handleToggleInterludes = useCallback(() => {
        setShowInterludes((prev) => {
            const next = !prev
            try {
                localStorage.setItem(SHOW_INTERLUDES_KEY, JSON.stringify(next))
            } catch (e) {
                console.error("Error saving interludes preference to localStorage:", e)
            }
            return next
        })
    }, [])

    return { showInterludes, handleToggleInterludes }
}
