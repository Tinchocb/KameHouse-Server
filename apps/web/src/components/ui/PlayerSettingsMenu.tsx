import * as React from "react"
import { createPortal } from "react-dom"
import { m, AnimatePresence } from "framer-motion"
import { IconMediaVolume2, IconMediaSubtitles, IconNavigationLayers, IconStatusMonitor, IconMediaForward, IconUiCheck, IconUiSettings, IconUiSpinner } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { Vaul, VaulContent } from "@/components/vaul"

import type { PlayerSettingsMenuProps } from "./track-types"
import { SettingsLayout, MenuButton } from "./player-settings/SettingsLayout"
import { AudioSettings } from "./player-settings/AudioSettings"
import { SubtitleSettings } from "./player-settings/SubtitleSettings"
import { QualitySettings } from "./player-settings/QualitySettings"
import { PlaybackSettings } from "./player-settings/PlaybackSettings"
import { PLAYER_ICON_BTN, PLAYER_ICON_BTN_ACTIVE } from "@/components/video/player-theme"

type SettingsView = "main" | "audio" | "subtitles" | "quality" | "playback" | "image"

const DESKTOP_QUERY = "(min-width: 768px)"

/** true en escritorio (breakpoint md de Tailwind). Decide si se usa el panel flotante
 * o la hoja de Vaul: Vaul se monta en un portal a <body>, así que ocultarlo con
 * `md:hidden` no alcanza — abierto igual pone un overlay a pantalla completa y
 * `pointer-events: none` en el body, lo que bloqueaba todos los clics del panel. */
function useIsDesktop() {
    return React.useSyncExternalStore(
        (onChange) => {
            const mql = window.matchMedia(DESKTOP_QUERY)
            mql.addEventListener("change", onChange)
            return () => mql.removeEventListener("change", onChange)
        },
        () => window.matchMedia(DESKTOP_QUERY).matches,
        () => true
    )
}

const ASPECT_RATIO_LABELS: Record<string, string> = {
    contain: "Ajustado",
    cover: "Recortar",
    fill: "Estirar",
    "16/9": "16:9 Panorámico",
    "21/9": "21:9 Ultrawide",
}

export function PlayerSettingsMenu({
    panelContainer,
    audioTracks,
    activeAudioIndex,
    onSelectAudio,
    subtitleTracks,
    activeSubtitleIndex,
    onSelectSubtitle,
    sources = [],
    currentSourceUrl,
    currentSourceType,
    onSourceChange,
    isLoadingSubtitle = false,
    className,
    open,
    onOpenChange,
    playbackRate = 1,
    onPlaybackRateChange,
    autoSkipIntro = false,
    onAutoSkipIntroChange,
    autoSkipOutro = false,
    onAutoSkipOutroChange,
    autoSkipFiller = false,
    onAutoSkipFillerChange,
    skipStepSeconds = 85,
    onSkipStepSecondsChange,
    showHeatmap = true,
    onShowHeatmapChange,
    hlsLevels = [],
    activeHlsLevel = -1,
    onHlsLevelChange,
    aspectRatio = "contain",
    onAspectRatioChange,
    subtitleSize = 100,
    onSubtitleSizeChange,
    loopEnabled = false,
    onLoopEnabledChange,
    autoDisableSubtitlesWhenDubbed = true,
    onAutoDisableSubtitlesWhenDubbedChange,
    tvMode = false,
    onTvModeChange,
    marathonMode = false,
    onMarathonModeChange,
    mediaId,
    mediaFormat,
    ambientModeEnabled = true,
    onAmbientModeEnabledChange,
}: PlayerSettingsMenuProps) {
    const isDesktop = useIsDesktop()
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
    }, [isControlled, onOpenChange])

    React.useEffect(() => {
        if (!isOpen) {
            const t = setTimeout(() => setView("main"), 200)
            return () => clearTimeout(t)
        }
    }, [isOpen])

    const panelRef = React.useRef<HTMLDivElement>(null)
    const buttonRef = React.useRef<HTMLButtonElement>(null)

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

    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                e.stopImmediatePropagation()
                setIsOpen(false)
            }
        }
        document.addEventListener("keydown", onKey, { capture: true })
        return () => document.removeEventListener("keydown", onKey, { capture: true })
    }, [isOpen, setIsOpen])

    const getFriendlyLanguage = (lang: string) => {
        if (!lang) return "Desconocido"
        const lower = lang.trim().toLowerCase()
        if (lower === "und" || lower === "unknown") return "Desconocido"

        const codeMap: Record<string, string> = {
            spa: "es", jpn: "ja", eng: "en", fra: "fr", fre: "fr",
            ger: "de", deu: "de", ita: "it", por: "pt", rus: "ru",
            chi: "zh", zho: "zh", kor: "ko", cat: "ca", eus: "eu", glg: "gl"
        }
        const normalized = codeMap[lower] || lower

        try {
            if (typeof Intl !== "undefined" && Intl.DisplayNames) {
                const dn = new Intl.DisplayNames(["es"], { type: "language", fallback: "none" })
                const name = dn.of(normalized)
                if (name) {
                    return name.charAt(0).toUpperCase() + name.slice(1)
                }
            }
        } catch {
            // fallback if code is invalid
        }

        return lang.toUpperCase()
    }

    const langLabel = (lang: string) => getFriendlyLanguage(lang)

    const activeAudio = audioTracks.find(t => t.index === activeAudioIndex)
    const activeSubtitle = activeSubtitleIndex !== null
        ? subtitleTracks.find(t => t.index === activeSubtitleIndex)
        : null

    const autoSkipLabel = [
        autoSkipIntro ? "Intro" : null,
        autoSkipOutro ? "Outro" : null,
    ].filter(Boolean).join("+") || "Apagado"

    const hasQualityOptions = hlsLevels.length > 0 || sources.length > 0
    const qualityValue = hlsLevels.length > 0
        ? (activeHlsLevel === -1 ? "Auto" : (hlsLevels.find(l => l.index === activeHlsLevel)?.label ?? "Auto"))
        : (currentSourceType === "transcode" ? "Transcodificado" : "Direct Play")

    const renderContent = () => (
        <>
            {/* ── MAIN MENU ───────────────────────────────── */}
            {view === "main" && (
                <SettingsLayout title="Configuración" onClose={() => setIsOpen(false)}>
                    <MenuButton
                        icon={<IconMediaVolume2 className="w-4 h-4" />}
                        label="Audio"
                        value={activeAudio ? (activeAudio.title || langLabel(activeAudio.language)) : "Predeterminado"}
                        onClick={() => setView("audio")}
                    />
                    <MenuButton
                        icon={<IconMediaSubtitles className="w-4 h-4" />}
                        label="Subtítulos"
                        value={activeSubtitle ? (activeSubtitle.title || langLabel(activeSubtitle.language)) : "Desactivado"}
                        onClick={() => setView("subtitles")}
                    />

                    {hasQualityOptions && (
                        <MenuButton
                            icon={<IconNavigationLayers className="w-4 h-4" />}
                            label="Calidad / Fuente"
                            value={qualityValue}
                            onClick={() => setView("quality")}
                        />
                    )}

                    <MenuButton
                        icon={<IconStatusMonitor className="w-4 h-4" />}
                        label="Imagen"
                        value={ASPECT_RATIO_LABELS[aspectRatio] || "Ajustado"}
                        onClick={() => setView("image")}
                    />
                    <MenuButton
                        icon={<IconMediaForward className="w-4 h-4" />}
                        label="Reproducción"
                        value={autoSkipLabel === "Apagado" ? "Normal" : `Salto auto: ${autoSkipLabel}`}
                        onClick={() => setView("playback")}
                    />
                </SettingsLayout>
            )}

            {/* ── AUDIO ──────────────────────────────────── */}
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
                        getFriendlyLanguage={getFriendlyLanguage}
                    />
                </SettingsLayout>
            )}

            {/* ── SUBTÍTULOS ─────────────────────────────── */}
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
                        subtitleSize={subtitleSize}
                        onSubtitleSizeChange={onSubtitleSizeChange}
                        getFriendlyLanguage={getFriendlyLanguage}
                    />
                </SettingsLayout>
            )}

            {/* ── CALIDAD / FUENTE ───────────────────────── */}
            {view === "quality" && (
                <SettingsLayout
                    title="Calidad / Fuente"
                    onBack={() => setView("main")}
                    onClose={() => setIsOpen(false)}
                >
                    {hlsLevels.length > 0 && (
                        <div className="flex flex-col border-b border-white/5 pb-2 mb-2">
                            <div className="px-3 pt-2 pb-1 text-2xs font-semibold uppercase tracking-widest text-on-surface-variant">Resolución HLS</div>
                            <button
                                onClick={() => { onHlsLevelChange?.(-1); setIsOpen(false) }}
                                className={cn(
                                    "flex items-center justify-between w-full min-h-10 py-2 px-3 rounded-full transition-colors duration-200",
                                    activeHlsLevel === -1 ? "bg-white/10 text-white" : "text-on-surface-variant hover:bg-white/10 hover:text-white"
                                )}
                            >
                                <span className="text-xs font-bold">Auto</span>
                                {activeHlsLevel === -1 && <IconUiCheck className="w-3.5 h-3.5" />}
                            </button>
                            {hlsLevels.map((level) => (
                                <button
                                    key={level.index}
                                    onClick={() => { onHlsLevelChange?.(level.index); setIsOpen(false) }}
                                    className={cn(
                                        "flex items-center justify-between w-full min-h-10 py-2 px-3 rounded-full transition-colors duration-200",
                                        activeHlsLevel === level.index ? "bg-white/10 text-white" : "text-on-surface-variant hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    <span className="text-xs font-bold">{level.label}</span>
                                    {activeHlsLevel === level.index && <IconUiCheck className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {sources.length > 0 && (
                        <>
                            {hlsLevels.length > 0 && <div className="px-3 pt-2 pb-1 text-2xs font-semibold uppercase tracking-widest text-on-surface-variant">Fuentes</div>}
                            <QualitySettings
                                sources={sources}
                                currentSourceUrl={currentSourceUrl}
                                currentSourceType={currentSourceType}
                                onSourceChange={(source) => {
                                    onSourceChange?.(source)
                                    setIsOpen(false)
                                }}
                            />
                        </>
                    )}
                </SettingsLayout>
            )}

            {/* ── IMAGEN ─────────────────────────────────── */}
            {view === "image" && (
                <SettingsLayout
                    title="Imagen"
                    onBack={() => setView("main")}
                    onClose={() => setIsOpen(false)}
                >
                    <div className="px-3 pt-2 pb-1 text-2xs font-semibold uppercase tracking-widest text-on-surface-variant">Relación de aspecto</div>
                    {(["contain", "cover", "fill", "16/9", "21/9"] as const).map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => onAspectRatioChange?.(ratio)}
                            className={cn(
                                "flex items-center justify-between w-full min-h-10 py-2 px-3 rounded-full transition-colors duration-200",
                                aspectRatio === ratio ? "bg-white/10 text-white" : "text-on-surface-variant hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <div className="flex flex-col items-start">
                                <span className="text-xs font-bold">{ASPECT_RATIO_LABELS[ratio]}</span>
                                <span className="text-label-sm text-zinc-600 mt-0.5">
                                    {ratio === "contain" && "Barras negras · conserva proporción"}
                                    {ratio === "cover" && "Rellena y recorta bordes"}
                                    {ratio === "fill" && "Estira la imagen sin recortar"}
                                    {ratio === "16/9" && "Fuerza relación 16:9 panorámica"}
                                    {ratio === "21/9" && "Ultrawide cinemático para monitores 21:9"}
                                </span>
                            </div>
                            {aspectRatio === ratio && <IconUiCheck className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                    ))}
                </SettingsLayout>
            )}

            {/* ── REPRODUCCIÓN ───────────────────────────── */}
            {view === "playback" && (
                <SettingsLayout
                    title="Reproducción"
                    onBack={() => setView("main")}
                    onClose={() => setIsOpen(false)}
                >
                    <PlaybackSettings
                        playbackRate={playbackRate}
                        onPlaybackRateChange={onPlaybackRateChange ?? (() => {})}
                        autoSkipIntro={autoSkipIntro}
                        onAutoSkipIntroChange={onAutoSkipIntroChange ?? (() => {})}
                        autoSkipOutro={autoSkipOutro}
                        onAutoSkipOutroChange={onAutoSkipOutroChange ?? (() => {})}
                        autoSkipFiller={autoSkipFiller}
                        onAutoSkipFillerChange={onAutoSkipFillerChange}
                        skipStepSeconds={skipStepSeconds}
                        onSkipStepSecondsChange={onSkipStepSecondsChange ?? (() => {})}
                        showHeatmap={showHeatmap}
                        onShowHeatmapChange={onShowHeatmapChange ?? (() => {})}
                        loopEnabled={loopEnabled}
                        onLoopEnabledChange={onLoopEnabledChange ?? (() => {})}
                        autoDisableSubtitlesWhenDubbed={autoDisableSubtitlesWhenDubbed}
                        onAutoDisableSubtitlesWhenDubbedChange={onAutoDisableSubtitlesWhenDubbedChange ?? (() => {})}
                        tvMode={tvMode}
                        onTvModeChange={onTvModeChange}
                        ambientModeEnabled={ambientModeEnabled}
                        onAmbientModeEnabledChange={onAmbientModeEnabledChange ?? (() => {})}
                        marathonMode={marathonMode}
                        onMarathonModeChange={onMarathonModeChange}
                        showSeparator={false}
                        mediaFormat={mediaFormat}
                        mediaId={mediaId}
                    />
                </SettingsLayout>
            )}
        </>
    )

    return (
        <div className={cn("relative", className)}>
            <button
                ref={buttonRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
                aria-label="Configuración [O]"
                title="Configuración [O]"
                className={cn(
                    "relative",
                    PLAYER_ICON_BTN,
                    isOpen && PLAYER_ICON_BTN_ACTIVE
                )}
            >
                <IconUiSettings className={cn("w-4 h-4 transition-transform duration-base", isOpen && "rotate-45")} />
                {isLoadingSubtitle && (
                    <span className="absolute -top-0.5 -right-0.5">
                        <IconUiSpinner className="w-3 h-3 text-white animate-spin" />
                    </span>
                )}
            </button>

            {/* Desktop panel — se monta en panelContainer (fuera de la cápsula de vidrio) */}
            {isDesktop && (() => {
                const panel = (
                    <div
                        ref={panelRef}
                        className={cn(
                            "absolute right-0 pointer-events-auto",
                            panelContainer ? "bottom-0" : "bottom-[calc(100%+14px)] z-player-settings"
                        )}
                    >
                        <AnimatePresence>
                            {isOpen && (
                                <m.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                >
                                    {renderContent()}
                                </m.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
                return panelContainer ? createPortal(panel, panelContainer) : panel
            })()}

            {/* Mobile bottom-sheet — solo se monta en móvil (ver useIsDesktop) */}
            {!isDesktop && (
                <Vaul open={isOpen} onOpenChange={setIsOpen}>
                    <VaulContent className="bg-zinc-950 border-t border-white/10 p-3 pb-8 focus:outline-none max-h-[85vh] overflow-y-auto">
                        {renderContent()}
                    </VaulContent>
                </Vaul>
            )}
        </div>
    )
}
