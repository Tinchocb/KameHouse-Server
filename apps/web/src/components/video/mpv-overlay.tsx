import { IconStatusMonitorPlay, IconMediaStop } from "@/components/ui/icons";
import { Button } from "@/components/ui/button"

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
                    <span className="text-xs font-medium text-brand-accent-readable">
                        Reproduciendo en mpv
                    </span>
                    <h2 className="font-display text-label-1 text-2xl font-medium tracking-tight truncate max-w-full">
                        {episodeLabel || title || "Reproducción en mpv"}
                    </h2>
                    <p className="text-label-2 text-sm">
                        El progreso se sigue guardando automáticamente.
                    </p>
                </div>
                <Button
                    intent="primary"
                    size="lg"
                    onClick={onStop}
                    leftIcon={<IconMediaStop className="w-4 h-4" />}
                    iconSpacing="0.5rem"
                >
                    Detener y cerrar
                </Button>
            </div>
        </div>
    )
}
