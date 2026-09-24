import { useCallback, useState } from "react"
import { LEGACY_VOLUME_TO_SPANS } from "@/components/chronology/data/volumes"

const READ_IDS_KEY = "dragonball_timeline_read"
const SHOW_INTERLUDES_KEY = "dragonball_timeline_show_interludes"

function readStoredIds(): Set<string> {
    try {
        const saved = localStorage.getItem(READ_IDS_KEY)
        if (saved) {
            const parsed: unknown = JSON.parse(saved)
            if (Array.isArray(parsed)) {
                const cleaned = parsed.filter((id): id is string => typeof id === "string")
                const expanded = expandLegacyReadIds(cleaned)
                if (expanded.size !== cleaned.length || cleaned.some((id) => LEGACY_VOLUME_TO_SPANS[id])) {
                    writeStoredIds(expanded)
                }
                return expanded
            }
        }
    } catch (e) {
        console.error("Error loading read volumes from localStorage:", e)
    }
    return new Set<string>()
}

function writeStoredIds(ids: Set<string> | string[]) {
    try {
        localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(ids)))
    } catch (e) {
        console.error("Error saving read volumes to localStorage:", e)
    }
}

function expandLegacyReadIds(ids: Iterable<string>): Set<string> {
    const out = new Set<string>()
    for (const id of ids) {
        const spans = LEGACY_VOLUME_TO_SPANS[id]
        if (spans) {
            for (const s of spans) out.add(s)
        } else {
            out.add(id)
        }
    }
    return out
}

/** Tomos marcados como leídos (vistos), persistidos en localStorage con migración legacy. */
export function useReadVolumeIds() {
    const [readVolumeIds, setReadVolumeIds] = useState<Set<string>>(readStoredIds)

    const handleToggleRead = useCallback((volumeId: string) => {
        setReadVolumeIds((prev) => {
            const next = new Set(prev)
            if (next.has(volumeId)) {
                next.delete(volumeId)
            } else {
                next.add(volumeId)
            }
            writeStoredIds(next)
            return next
        })
    }, [])

    const handleMarkAllRead = useCallback((allIds: string[]) => {
        const ids = new Set(allIds)
        setReadVolumeIds(ids)
        writeStoredIds(ids)
    }, [])

    const handleResetRead = useCallback(() => {
        setReadVolumeIds(new Set<string>())
        writeStoredIds([])
    }, [])

    const mergeServerWatched = useCallback((watchedIds: Iterable<string>) => {
        setReadVolumeIds((prev) => {
            const merged = new Set([...prev, ...watchedIds])
            return merged
        })
    }, [])

    return { readVolumeIds, handleToggleRead, handleMarkAllRead, handleResetRead, mergeServerWatched }
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
