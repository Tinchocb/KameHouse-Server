/**
 * PlayerSettingsMenu.tsx
 *
 * A floating settings panel that renders over the video player.
 * Provides audio track selection and subtitle track selection menus.
 *
 * ─── Rendering Architecture ──────────────────────────────────────────────────
 *
 *  ┌──────────────────────────────── video container (position: relative) ──┐
 *  │   <video>                                                               │
 *  │   <canvas id="jassub-canvas">   ← rendered by useJassub hook           │
 *  │   <PlayerSettingsMenu>          ← this component (absolute overlay)     │
 *  │       └─ Settings gear button (bottom-right of controls bar)            │
 *  │       └─ Floating panel (above the controls bar, anchored bottom-right) │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 * ─── Props vs parent state ───────────────────────────────────────────────────
 * This component is intentionally "dumb" — all track lists and selection
 * callbacks come from the parent (VideoPlayerModal) via props.  This keeps
 * jassub logic in the hook, HLS audio-switch logic in the parent, and this
 * component pure UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { IoSettingsSharp } from "react-icons/io5"
import { FaCheck, FaVolumeUp, FaClosedCaptioning } from "react-icons/fa"
import { MdSubtitles } from "react-icons/md"
import { Loader2, Folder, Zap, Layers } from "lucide-react"
import type { AudioTrack, SubtitleTrack } from "./track-types"
import type { EpisodeSource } from "@/api/types/unified.types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerSettingsMenuProps {
    // ── Audio ──
    /** All audio tracks available for this stream. Empty → section hidden. */
    audioTracks: AudioTrack[]
    /** Index of the currently active audio track. */
    activeAudioIndex: number
    /** Called when the user picks an audio track. */
    onSelectAudio: (track: AudioTrack) => void

    // ── Subtitles ──
    /** All subtitle tracks available for this stream. Empty → section hidden. */
    subtitleTracks: SubtitleTrack[]
    /**
     * Index of the currently active subtitle track, or `null` when
     * subtitles are disabled ("Off").
     */
    activeSubtitleIndex: number | null
    /** Called when the user picks a subtitle track (or "Off"). */
    onSelectSubtitle: (track: SubtitleTrack | null) => void

    // ── Source Switcher ──
    /**
     * All resolved episode sources from `EpisodeSourcesResponse`.
     * When provided, a "Fuente / Calidad" section is rendered.
     */
    sources?: EpisodeSource[]
    /** URL of the currently active source — used to highlight the active row. */
    currentSourceUrl?: string
    /** Called when the user selects a different source. */
    onSourceChange?: (source: EpisodeSource) => void

    // ── Loading indicator ──
    /** True while a subtitle file is being fetched from the backend. */
    isLoadingSubtitle?: boolean

    /** Extra classes for the gear button. */
    className?: string

    /**
     * External control to open the panel — triggered by the subtitle button.
     * When set to `true` the panel opens; when `false` or undefined the internal
     * toggle state is used instead.
     */
    open?: boolean

    /** Called when the panel visibility changes from external control. */
    onOpenChange?: (open: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface SectionProps {
    icon: React.ReactNode
    title: string
    children: React.ReactNode
}

/** Collapsible section header inside the settings panel. */
function Section({ icon, title, children }: SectionProps) {
    return (
        <div>
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
                <span className="text-white">{icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {title}
                </span>
            </div>
            <div className="flex flex-col">{children}</div>
        </div>
    )
}

interface TrackRowProps {
    label: string
    sublabel?: string
    isActive: boolean
    onClick: () => void
}

/** A single selectable track row inside the settings panel. */
function TrackRow({ label, sublabel, isActive, onClick }: TrackRowProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "group flex items-center justify-between gap-3 w-full",
                "px-4 py-2.5 rounded-lg text-left",
                "transition-colors duration-150",
                isActive
                    ? "bg-white/15 text-white"
                    : "text-neutral-300 hover:bg-white/5 hover:text-white",
            )}
        >
            <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold leading-tight truncate">
                    {label}
                </span>
                {sublabel && (
                    <span className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        {sublabel}
                    </span>
                )}
            </div>

            {/* ── Active tick ── */}
            <span
                className={cn(
                    "shrink-0 w-4 h-4 rounded-full flex items-center justify-center",
                    "transition-all duration-150",
                    isActive
                        ? "bg-white text-zinc-950 scale-100"
                        : "bg-white/10 scale-75 opacity-0 group-hover:opacity-40 group-hover:scale-90",
                )}
            >
                <FaCheck className="w-2 h-2" />
            </span>
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PlayerSettingsMenu
 *
 * Renders a gear button; clicking it toggles a floating glassmorphism panel
 * listing audio tracks and subtitle tracks.  Clicking outside closes it.
 */
export function PlayerSettingsMenu({
    audioTracks,
    activeAudioIndex,
    onSelectAudio,
    subtitleTracks,
    activeSubtitleIndex,
    onSelectSubtitle,
    sources = [],
    currentSourceUrl,
    onSourceChange,
    isLoadingSubtitle = false,
    className,
    open,
    onOpenChange,
}: PlayerSettingsMenuProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen

    const setIsOpen = React.useCallback((v: boolean) => {
        if (isControlled) {
            onOpenChange?.(v)
        } else {
            setInternalOpen(v)
        }
    }, [isControlled, onOpenChange])

    const panelRef = React.useRef<HTMLDivElement>(null)
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    // ── Click-outside to close ────────────────────────────────────────────────
    React.useEffect(() => {
        if (!isOpen) return
        const onPointerDown = (e: PointerEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false)
            }
        }
        document.addEventListener("pointerdown", onPointerDown)
        return () => document.removeEventListener("pointerdown", onPointerDown)
    }, [isOpen, setIsOpen])

    // ── Keyboard: close on Escape ─────────────────────────────────────────────
    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { e.stopPropagation(); setIsOpen(false) }
        }
        document.addEventListener("keydown", onKey, { capture: true })
        return () => document.removeEventListener("keydown", onKey, { capture: true })
    }, [isOpen, setIsOpen])

    const hasAudio = audioTracks.length > 0
    const hasSubs = subtitleTracks.length > 0
    const hasSources = sources.length > 0
    const hasAnything = hasAudio || hasSubs || hasSources

    const langLabel = (lang: string) => lang.toUpperCase().slice(0, 3)

    return (
        <div className={cn("relative", className)}>
            {/* ─── Gear button ──────────────────────────────────── */}
            <button
                ref={buttonRef}
                type="button"
                aria-label="Configuración de pistas"
                aria-expanded={isOpen}
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
                className={cn(
                    "relative flex items-center justify-center w-12 h-12",
                    "text-zinc-500 hover:text-white border border-white/10 hover:border-white/40 bg-black",
                    "transition-all duration-200",
                    isOpen && "text-white rotate-90 border-white"
                )}
            >
                <IoSettingsSharp className="w-6 h-6" />

                {/* Spinner badge while subtitle is loading */}
                {isLoadingSubtitle && (
                    <span className="absolute -top-1 -right-1">
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    </span>
                )}
            </button>

            {/* ─── Floating panel ───────────────────────────────── */}
            {isOpen && hasAnything && (
                <div
                    ref={panelRef}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        "absolute bottom-16 right-0 z-50",
                        "w-80 bg-black border border-white shadow-2xl"
                    )}
                    style={{
                        animation: "settingsFadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both",
                    }}
                >
                    {/* Panel header */}
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-zinc-950">
                        <IoSettingsSharp className="w-4 h-4 text-white" />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white">
                            CONFIGURACIÓN
                        </span>
                    </div>

                    <div className="flex flex-col max-h-[60vh] overflow-y-auto
                                    scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">

                        {/* ── Audio tracks ─────────────────────────── */}
                        {hasAudio && (
                            <div className="py-4">
                                <div className="flex items-center gap-2 px-6 mb-3">
                                    <FaVolumeUp className="w-3 h-3 text-zinc-600" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">AUDIO</span>
                                </div>
                                <div className="flex flex-col px-2 gap-1">
                                    {audioTracks.map((track) => (
                                        <button
                                            key={track.index}
                                            onClick={() => onSelectAudio(track)}
                                            className={cn(
                                                "flex flex-col px-4 py-3 text-left transition-all",
                                                track.index === activeAudioIndex
                                                    ? "bg-white text-black"
                                                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            <span className="text-[11px] font-black uppercase tracking-widest leading-none">
                                                {track.title || langLabel(track.language)}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] font-bold mt-1.5 uppercase opacity-60",
                                                track.index === activeAudioIndex ? "text-black" : "text-zinc-500"
                                            )}>
                                                {[track.codec, track.channels ? `${track.channels}ch` : undefined].filter(Boolean).join(" // ")}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {hasAudio && hasSubs && (
                            <div className="mx-6 h-px bg-white/10" />
                        )}

                        {/* ── Subtitle tracks ──────────────────────── */}
                        {hasSubs && (
                            <div className="py-4">
                                <div className="flex items-center gap-2 px-6 mb-3">
                                    <MdSubtitles className="w-3.5 h-3.5 text-zinc-600" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">SUBTÍTULOS</span>
                                </div>
                                <div className="flex flex-col px-2 gap-1">
                                    <button
                                        onClick={() => { onSelectSubtitle(null); setIsOpen(false); }}
                                        className={cn(
                                            "px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest transition-all",
                                            activeSubtitleIndex === null
                                                ? "bg-white text-black"
                                                : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        DESACTIVADO
                                    </button>

                                    {subtitleTracks.map((track) => (
                                        <button
                                            key={track.index}
                                            onClick={() => { onSelectSubtitle(track); setIsOpen(false); }}
                                            className={cn(
                                                "flex flex-col px-4 py-3 text-left transition-all",
                                                track.index === activeSubtitleIndex
                                                    ? "bg-white text-black"
                                                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            <span className="text-[11px] font-black uppercase tracking-widest leading-none">
                                                {track.title || langLabel(track.language)}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] font-bold mt-1.5 uppercase opacity-60",
                                                track.index === activeSubtitleIndex ? "text-black" : "text-zinc-500"
                                            )}>
                                                {[track.codec?.toUpperCase(), track.forced ? "FORZADO" : undefined].filter(Boolean).join(" // ")}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Source / Quality switcher ───────────────────── */}
                        {hasSources && (
                            <div className="py-4">
                                {(hasAudio || hasSubs) && (
                                    <div className="mx-6 h-px bg-white/10 mb-4" />
                                )}
                                <div className="flex items-center gap-2 px-6 mb-3">
                                    <Layers className="w-3.5 h-3.5 text-zinc-600" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">CALIDAD</span>
                                </div>
                                <div className="flex flex-col px-2 gap-1">
                                    {sources.map((src, idx) => {
                                        const isLocal = src.type === "local"
                                        const label = isLocal
                                            ? `LOCAL // ${src.quality && src.quality !== "unknown" ? src.quality : "ORIGINAL"}`
                                            : `STREAM // ${src.quality !== "unknown" ? src.quality : src.title}`
                                        const isActive = currentSourceUrl ? src.url === currentSourceUrl : idx === 0

                                        return (
                                            <button
                                                key={src.url || idx}
                                                onClick={() => { onSourceChange?.(src); setIsOpen(false); }}
                                                className={cn(
                                                    "flex flex-col px-4 py-3 text-left transition-all",
                                                    isActive
                                                        ? "bg-white text-black"
                                                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                )}
                                            >
                                                <span className="text-[11px] font-black uppercase tracking-widest leading-none">
                                                    {label.toUpperCase()}
                                                </span>
                                                <span className={cn(
                                                    "text-[9px] font-bold mt-1.5 uppercase opacity-40 truncate",
                                                    isActive ? "text-black" : "text-zinc-600"
                                                )}>
                                                    {isLocal ? src.path?.split(/[\\/]/).pop() : src.title}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer: status */}
                    {isLoadingSubtitle && (
                        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10 bg-zinc-950 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            CARGANDO SUBTÍTULOS...
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes settingsFadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
