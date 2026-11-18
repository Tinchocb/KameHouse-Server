// Prewarms the video player's JS payload so pressing play never waits on a chunk
// download (nor flashes the "Cargando Reproductor" Suspense fallback).
//
// The player is code-split behind two lazy boundaries: player.tsx (loaded lazily
// by the root) and player-orchestrator.tsx (loaded lazily by player.tsx).
// Importing the orchestrator transitively pulls player-core + its static deps
// (hls.js, jassub), so warming these two dynamic imports warms the whole payload.
//
// Call once from playback-capable detail views (series/$seriesId, movies/$movieId) at browser idle.

import { isDataSavingEnabled } from "@/lib/network-preferences"
import { queueIdlePreload } from "@/lib/idle-preload-queue"

let prewarmed = false
let disposed = false

if (import.meta.webpackHot) {
    import.meta.webpackHot.dispose(() => {
        disposed = true
    })
}

export function prewarmVideoPlayer() {
    if (prewarmed || typeof window === "undefined" || isDataSavingEnabled()) return
    prewarmed = true

    queueIdlePreload("player:shell", async () => {
        if (disposed || isDataSavingEnabled()) return
        await import("./player")
        queueIdlePreload("player:orchestrator", async () => {
            if (disposed || isDataSavingEnabled()) return
            await import("./player-orchestrator")
        }, 1)
    }, 1)
}
