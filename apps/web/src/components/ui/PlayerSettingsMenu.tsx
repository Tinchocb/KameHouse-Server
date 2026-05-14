import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IoSettingsSharp } from "react-icons/io5"
import { FaVolumeUp } from "react-icons/fa"
import { MdSubtitles } from "react-icons/md"
import { Loader2, Zap, Gauge, FastForward, Check } from "lucide-react"
import { cn } from "@/components/ui/core/styling"

import type { PlayerSettingsMenuProps } from "./track-types"
import { SettingsLayout, MenuButton } from "./player-settings/SettingsLayout"
import { AudioSettings } from "./player-settings/AudioSettings"
import { SubtitleSettings } from "./player-settings/SubtitleSettings"
import { QualitySettings } from "./player-settings/QualitySettings"
import { PlaybackSettings } from "./player-settings/PlaybackSettings"

type SettingsView = "main" | "audio" | "subtitles" | "quality" | "playback"

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
    playbackRate = 1,
    onPlaybackRateChange,
    autoSkipIntro = false,
    onAutoSkipIntroChange,
    hlsLevels = [],
    activeHlsLevel = -1,
    onHlsLevelChange,
}: PlayerSettingsMenuProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const [view, setView] = React.useState<SettingsView>("main")
    
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen

    const setIsOpen = React.useCallback((v: boolean) => {
        if (isControlled) {
            onOpenChange?.(v)
        } else {
            setInternalOpen(v)
        }
        if (!v) {
            // Reset view to main when closing
            setTimeout(() => setView("main"), 200)
        }
    }, [isControlled, onOpenChange])

    const panelRef = React.useRef<HTMLDivElement>(null)
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    // Click outside to close
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

    // Keyboard: Escape to close
    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                setIsOpen(false)
            }
        }
        document.addEventListener("keydown", onKey, { capture: true })
        return () => document.removeEventListener("keydown", onKey, { capture: true })
    }, [isOpen, setIsOpen])

    const langLabel = (lang: string) => lang.toUpperCase().slice(0, 3)
    
    const activeAudio = audioTracks.find(t => t.index === activeAudioIndex)
    const activeSubtitle = activeSubtitleIndex !== null 
        ? subtitleTracks.find(t => t.index === activeSubtitleIndex)
        : null
    
    const hlsQuality = activeHlsLevel === -1 
        ? "Auto" 
        : hlsLevels.find(l => l.index === activeHlsLevel)?.label || "Auto"
        
    const activeQuality = hlsLevels.length > 0 
        ? hlsQuality 
        : (sources.find(s => s.url === currentSourceUrl)?.quality || "Original")

    return (
        <div className={cn("relative", className)}>
            <button
                ref={buttonRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
                className={cn(
                    "relative flex items-center justify-center w-12 h-12",
                    "text-zinc-500 hover:text-white border border-white/10 hover:border-white/40 bg-black/40 backdrop-blur-md",
                    "transition-all duration-200 rounded-full",
                    isOpen && "text-white rotate-90 border-white bg-white/10"
                )}
            >
                <IoSettingsSharp className="w-6 h-6" />
                {isLoadingSubtitle && (
                    <span className="absolute -top-1 -right-1">
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div 
                        ref={panelRef}
                        className="absolute bottom-16 right-0 z-50 pointer-events-auto"
                    >
                        {view === "main" && (
                            <SettingsLayout title="Configuración" onClose={() => setIsOpen(false)}>
                                <MenuButton 
                                    icon={<FaVolumeUp className="w-4 h-4" />}
                                    label="Audio"
                                    value={activeAudio ? (activeAudio.title || langLabel(activeAudio.language)) : "Desconocido"}
                                    onClick={() => setView("audio")}
                                />
                                <MenuButton 
                                    icon={<MdSubtitles className="w-4 h-4" />}
                                    label="Subtítulos"
                                    value={activeSubtitle ? (activeSubtitle.title || langLabel(activeSubtitle.language)) : "Desactivado"}
                                    onClick={() => setView("subtitles")}
                                />
                                { (sources.length > 0 || hlsLevels.length > 0) && (
                                    <MenuButton 
                                        icon={<Zap className="w-4 h-4" />}
                                        label="Calidad / Fuente"
                                        value={activeQuality}
                                        onClick={() => setView("quality")}
                                    />
                                )}
                                <MenuButton 
                                    icon={<Gauge className="w-4 h-4" />}
                                    label="Velocidad y Ajustes"
                                    value={`${playbackRate}x`}
                                    onClick={() => setView("playback")}
                                />
                            </SettingsLayout>
                        )}

                        {view === "audio" && (
                            <SettingsLayout 
                                title="Audio" 
                                onBack={() => setView("main")} 
                                onClose={() => setIsOpen(false)}
                            >
                                <AudioSettings 
                                    audioTracks={audioTracks} 
                                    activeAudioIndex={activeAudioIndex} 
                                    onSelectAudio={onSelectAudio} 
                                />
                            </SettingsLayout>
                        )}

                        {view === "subtitles" && (
                            <SettingsLayout 
                                title="Subtítulos" 
                                onBack={() => setView("main")} 
                                onClose={() => setIsOpen(false)}
                            >
                                <SubtitleSettings 
                                    subtitleTracks={subtitleTracks} 
                                    activeSubtitleIndex={activeSubtitleIndex} 
                                    onSelectSubtitle={(track) => {
                                        onSelectSubtitle(track)
                                        setIsOpen(false)
                                    }} 
                                />
                            </SettingsLayout>
                        )}

                        {view === "quality" && (
                            <SettingsLayout 
                                title="Calidad / Fuente" 
                                onBack={() => setView("main")} 
                                onClose={() => setIsOpen(false)}
                            >
                                {hlsLevels.length > 0 && (
                                    <div className="flex flex-col border-b border-white/5 pb-2 mb-2">
                                        <div className="px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Resolución HLS</div>
                                        <button
                                            onClick={() => {
                                                onHlsLevelChange?.(-1)
                                                setIsOpen(false)
                                            }}
                                            className={cn(
                                                "flex items-center justify-between px-4 py-3 transition-all",
                                                activeHlsLevel === -1 ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            <span className="text-xs font-bold">Auto</span>
                                            {activeHlsLevel === -1 && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        {hlsLevels.map((level) => (
                                            <button
                                                key={level.index}
                                                onClick={() => {
                                                    onHlsLevelChange?.(level.index)
                                                    setIsOpen(false)
                                                }}
                                                className={cn(
                                                    "flex items-center justify-between px-4 py-3 transition-all",
                                                    activeHlsLevel === level.index ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                )}
                                            >
                                                <span className="text-xs font-bold">{level.label}</span>
                                                {activeHlsLevel === level.index && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {sources.length > 0 && (
                                    <>
                                        {hlsLevels.length > 0 && <div className="px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Fuentes / Servidores</div>}
                                        <QualitySettings 
                                            sources={sources} 
                                            currentSourceUrl={currentSourceUrl} 
                                            onSourceChange={(source) => {
                                                onSourceChange?.(source)
                                                setIsOpen(false)
                                            }} 
                                        />
                                    </>
                                )}
                            </SettingsLayout>
                        )}

                        {view === "playback" && (
                            <SettingsLayout 
                                title="Velocidad y Ajustes" 
                                onBack={() => setView("main")} 
                                onClose={() => setIsOpen(false)}
                            >
                                <PlaybackSettings
                                    playbackRate={playbackPreference.playbackRate}
                                    onPlaybackRateChange={playbackPreference.onPlaybackRateChange}
                                    autoSkipIntro={playbackPreference.autoSkipIntro}
                                    onAutoSkipIntroChange={playbackPreference.onAutoSkipIntroChange}
                                    showHeatmap={playbackPreference.showHeatmap}
                                    onShowHeatmapChange={playbackPreference.onShowHeatmapChange}
                                    showSeparator={false}
                                />
                            </SettingsLayout>
                        )}
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
