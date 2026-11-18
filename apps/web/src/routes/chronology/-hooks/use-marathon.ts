import { persistLibraryPatch } from "@/lib/server/persist-settings"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { fetchAnimeEntryLocalFiles } from "@/api/hooks/anime_entries.hooks"
import type { VolumeData } from "@/components/chronology/types"
import type { SpanProgress } from "@/components/chronology/data/spanProgress"
import {
    buildMarathonPlan,
    marathonAdded,
    marathonEpisodeRefs,
    marathonStartEpisode,
    marathonSummary,
    mergeMarathon,
    spansForMarathon,
    type LocalFileIndex,
    type MarathonMode,
    type MarathonPlan,
} from "@/components/chronology/data/marathon"
import { usePlayerStore, useQueueStore, useUIStore } from "@/lib/store"

interface PendingMarathon {
    plan: MarathonPlan
    existingCount: number
}

/** Episodio de un archivo local: el de los metadatos o el que dedujo el escáner. */
function episodeOfFile(file: { metadata?: { episode?: number } | null; parsedInfo?: { episode?: string } | null }): number | null {
    const raw = file.metadata?.episode ?? Number(file.parsedInfo?.episode)
    return Number.isFinite(raw) && Number(raw) > 0 ? Number(raw) : null
}

async function fetchFileIndex(mediaIds: number[]): Promise<LocalFileIndex> {
    const index = new Map<number, Map<number, string>>()
    await Promise.all(
        mediaIds.map(async (mediaId) => {
            const files = (await fetchAnimeEntryLocalFiles(mediaId)) ?? []
            const byEpisode = new Map<number, string>()
            for (const file of files) {
                const ep = episodeOfFile(file)
                if (ep !== null && file.path && !byEpisode.has(ep)) byEpisode.set(ep, file.path)
            }
            index.set(mediaId, byEpisode)
        }),
    )
    return index
}

/** Empieza el maratón por el primer elemento nuevo de Mi Lista, igual que el modo Maratón del resto de la app. */
function startMarathonPlayback(firstItemId: string | number, firstEpisode: number | undefined) {
    const queue = useQueueStore.getState().playlistQueue
    const index = queue.findIndex((i) => i.id === firstItemId && i.episodeNumber === firstEpisode)
    if (index < 0) return
    useQueueStore.getState().setCurrentQueueIndex(index)
    usePlayerStore.getState().setMarathonMode(true)
    persistLibraryPatch({ marathonMode: true })
}

/**
 * "Maratón desde acá": arma en Mi Lista los episodios desde un lapso hasta el final de su era.
 * Si Mi Lista ya tiene contenido no la pisa: pregunta si se añade al final o se reemplaza.
 */
export function useMarathonFromHere(
    orderedVolumes: readonly VolumeData[],
    progressById: ReadonlyMap<string, SpanProgress>,
) {
    const [pending, setPending] = useState<PendingMarathon | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)

    const commit = useCallback((plan: MarathonPlan, mode: MarathonMode) => {
        const store = useQueueStore.getState()
        const merged = mergeMarathon(store.playlistQueue, plan.items, mode)
        const added = marathonAdded(store.playlistQueue.length, merged.length, mode)
        useQueueStore.setState({
            playlistQueue: merged,
            currentQueueIndex: -1,
            activeQueuePlayItem: null,
        })
        useUIStore.getState().setGlobalQueueOpen(true)
        const first = plan.items[0]
        toast.success(mode === "replace" ? "Mi Lista reemplazada por el maratón" : "Maratón añadido a Mi Lista", {
            description: marathonSummary(added, plan),
            action: first
                ? { label: "Empezar maratón", onClick: () => startMarathonPlayback(first.id, first.episodeNumber) }
                : undefined,
        })
    }, [])

    const startMarathon = useCallback(
        async (volume: VolumeData) => {
            const spans = spansForMarathon(orderedVolumes, volume.id, "era")
            const firstEpisode = marathonStartEpisode(volume, progressById.get(volume.id))
            const refs = marathonEpisodeRefs(spans, firstEpisode)
            if (refs.length === 0) {
                toast.info(`La serie ${volume.seriesTag} no está en tu biblioteca.`, {
                    description: "Revisa tus carpetas en Ajustes › Biblioteca.",
                })
                return
            }
            setBusyId(volume.id)
            try {
                const index = await fetchFileIndex([...new Set(refs.map((r) => r.mediaId))])
                const plan = buildMarathonPlan(refs, index)
                if (plan.items.length === 0) {
                    toast.error("No se pudo armar el maratón", {
                        description: "Los episodios no tienen archivos locales. Revisa tus carpetas en Ajustes › Biblioteca.",
                    })
                    return
                }
                const existingCount = useQueueStore.getState().playlistQueue.length
                if (existingCount > 0) setPending({ plan, existingCount })
                else commit(plan, "replace")
            } catch (err) {
                console.error("[Maratón] no se pudo armar:", err)
                toast.error("No se pudo armar el maratón", { description: "Inténtalo de nuevo." })
            } finally {
                setBusyId(null)
            }
        },
        [orderedVolumes, progressById, commit],
    )

    const resolvePending = useCallback(
        (mode: MarathonMode | null) => {
            if (pending && mode) commit(pending.plan, mode)
            setPending(null)
        },
        [pending, commit],
    )

    return { startMarathon, busyId, pending, resolvePending }
}
