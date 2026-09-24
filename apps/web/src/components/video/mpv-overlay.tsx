import React from "react"
import { IconStatusMonitorPlay, IconMediaStop } from "@/components/ui/icons";
import { PLAYER_PRIMARY_BTN } from "./player-theme"

interface MpvOverlayProps {
    title?: string
    episodeLabel?: string
    onStop: () => void
}

/**
 * Shown over the player while playback is handed off to an external mpv window.
 * Progress keeps syncing to the server via the mpv IPC bridge; closing mpv
 * (or pressing "Detener") closes the player.
 */
export function MpvOverlay({ title, episodeLabel, onStop }: MpvOverlayProps) {
    return (
        <div className="fixed inset-0 z-player-overlay bg-black/90 flex items-center justify-center">
            <div className="max-w-md w-full mx-6 flex flex-col items-center gap-5 text-center">
                <IconStatusMonitorPlay className="w-10 h-10 text-brand-accent" />
                <div className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold uppercase tracking-widest text-brand-accent">
                        Reproduciendo en mpv
                    </span>
                    <h2 className="font-display text-white text-2xl font-medium tracking-tight truncate max-w-full">
                        {episodeLabel || title || "Reproducción externa"}
                    </h2>
                    <p className="text-on-surface-variant text-sm">
                        El progreso se sigue guardando automáticamente.
                    </p>
                </div>
                <button
                    onClick={onStop}
                    className={PLAYER_PRIMARY_BTN}
                >
                    <IconMediaStop className="w-4 h-4" />
                    Detener
                </button>
            </div>
        </div>
    )
}
