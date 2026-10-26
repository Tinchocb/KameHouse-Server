import React from "react"
import { IconMediaPause, IconMediaPlay } from "@/components/ui/icons"
import { IconSwap } from "@/components/ui/kinetics"
import { cn } from "@/components/ui/core/styling"
import { PLAYER_GLASS_BTN } from "./player-theme"

/** Botón redondo del centro: vidrio grafito (PLAYER_GLASS_BTN) para leerse sobre cualquier imagen. */
const CENTER_BTN = PLAYER_GLASS_BTN

const SKIP_BTN = "w-11 h-11 p-2.5 sm:w-12 sm:h-12 sm:p-2.5 [[data-tv=true]_&]:w-20 [[data-tv=true]_&]:h-20 [[data-tv=true]_&]:p-4 text-white/80 hover:text-white"
const PLAY_BTN = "w-16 h-16 sm:w-18 sm:h-18 [[data-tv=true]_&]:w-28 [[data-tv=true]_&]:h-28 [&_svg]:w-7 [&_svg]:h-7 sm:[&_svg]:w-8 sm:[&_svg]:h-8 [[data-tv=true]_&]:[&_svg]:w-12 [[data-tv=true]_&]:[&_svg]:h-12"

/** Flecha circular con "10" dentro, como los botones de AVKit. */
export function SkipTenIcon({ direction }: { direction: "back" | "forward" }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden className="w-full h-full">
            <g transform={direction === "forward" ? "translate(32 0) scale(-1 1)" : undefined}>
                <path d="M7.5 9.5A11 11 0 1 1 5 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M7.8 3.8v6h6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <text x="16" y="20.2" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">10</text>
        </svg>
    )
}

interface PlayerCenterControlsProps {
    visible: boolean
    isPlaying: boolean
    onTogglePlay: () => void
    onSkip: (amount: number) => void
}

/** Controles grandes del centro (−10 / reproducir / +10). Se ocultan solo con
 * opacidad; ocultos salen del orden de tabulación y no reciben clics. */
export const PlayerCenterControls = React.memo(function PlayerCenterControls({
    visible,
    isPlaying,
    onTogglePlay,
    onSkip,
}: PlayerCenterControlsProps) {
    const tab = visible ? 0 : -1
    return (
        <div
            role="group"
            aria-label="Controles de reproducción"
            aria-hidden={!visible}
            className={cn(
                "player-center-controls absolute inset-0 z-player-ui flex items-center justify-center gap-5 sm:gap-8 [[data-tv=true]_&]:gap-16 pointer-events-none transition-opacity ease-out-strong motion-reduce:transition-none",
                visible ? "opacity-100 duration-fast" : "opacity-0 duration-slow"
            )}
        >
            <button
                type="button"
                tabIndex={tab}
                aria-label="Retroceder 10 segundos"
                onClick={(e) => { e.stopPropagation(); onSkip(-10) }}
                className={cn(CENTER_BTN, SKIP_BTN, visible && "pointer-events-auto")}
            >
                <SkipTenIcon direction="back" />
            </button>

            <button
                type="button"
                tabIndex={tab}
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                onClick={(e) => { e.stopPropagation(); onTogglePlay() }}
                className={cn(CENTER_BTN, PLAY_BTN, visible && "pointer-events-auto")}
            >
                <IconSwap swapKey={isPlaying ? "pause" : "play"}>
                    {isPlaying
                        ? <IconMediaPause className="fill-current" />
                        : <IconMediaPlay className="fill-current ml-1" />}
                </IconSwap>
            </button>

            <button
                type="button"
                tabIndex={tab}
                aria-label="Avanzar 10 segundos"
                onClick={(e) => { e.stopPropagation(); onSkip(10) }}
                className={cn(CENTER_BTN, SKIP_BTN, visible && "pointer-events-auto")}
            >
                <SkipTenIcon direction="forward" />
            </button>
        </div>
    )
})
