import * as React from "react"
import { createPortal } from "react-dom"
import { m, AnimatePresence } from "framer-motion"
import { IconMediaVolume2, IconMediaSubtitles, IconNavigationLayers, IconStatusMonitor, IconMediaForward, IconUiCheck, IconUiSettings, IconUiMoreHorizontal, IconUiSpinner, IconMediaSkipNext, IconMediaSkipPrevious } from "@/components/ui/icons";
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
    "16/9": "16:9 panorámico",
    "21/9": "21:9 ultrapanorámico",
}

export function PlayerSettingsMenu({
    panelContainer,
    variant = "all",
    onPrevChapter,
    onNextChapter,
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

    // Igual que la lista de episodios: al abrir (o cambiar de vista) el foco entra al panel,
    // así con teclado o control remoto se navega el menú sin buscarlo con Tab.
    React.useEffect(() => {
        if (!isOpen || !isDesktop) return
        const id = window.setTimeout(() => {
            // Solo la vista actual: la que sale sigue en el DOM unos 150 ms (popLayout).
            const first = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(`[data-settings-view="${view}"] button`) ?? [])
                .find((b) => b.getAttribute("aria-label") !== "Cerrar menú")
            first?.focus({ preventScroll: true })
        }, 30)
        return () => window.clearTimeout(id)
    }, [isOpen, isDesktop, view])

    // Al cerrar, si el foco estaba dentro del panel vuelve al botón (si no, cae a <body>).
    React.useEffect(() => {
        if (!isOpen || !isDesktop) return
        const panel = panelRef.current
        const button = buttonRef.current
        return () => {
            if (panel?.contains(document.activeElement)) button?.focus({ preventScroll: true })
        }
    }, [isOpen, isDesktop])

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

    // Resumen de la fila "Reproducción": Maratón fuerza todos los saltos, así que
    // manda; si no, se listan los saltos activos y la velocidad.
    const autoSkipLabel = [
        autoSkipIntro ? "intro" : null,
        autoSkipOutro ? "créditos" : null,
    ].filter(Boolean).join(" y ")
    const isMovieFormat = mediaFormat?.toUpperCase() === "MOVIE"
    const rateLabel = Math.abs(playbackRate - 1) < 0.001 ? null : `${playbackRate}x`
    const playbackSummary = (!isMovieFormat && marathonMode)
        ? ["Maratón", rateLabel].filter(Boolean).join(" · ")
        : [!isMovieFormat && autoSkipLabel ? `Salta ${autoSkipLabel}` : null, rateLabel].filter(Boolean).join(" · ") || "Normal"

    const hasQualityOptions = hlsLevels.length > 0 || sources.length > 0
    const qualityValue = hlsLevels.length > 0
        ? (activeHlsLevel === -1 ? "Automática" : (hlsLevels.find(l => l.index === activeHlsLevel)?.label ?? "Automática"))
        : (currentSourceType === "transcode" ? "Convertido" : "Original")

    const isMedia = variant === "media"
    const isMore = variant === "more"
    const menuTitle = isMedia ? "Audio y subtítulos" : isMore ? "Más opciones" : "Configuración"

    const renderContent = () => (
        <>
            {/* ── AUDIO Y SUBTÍTULOS (un solo panel, sin submenús) ── */}
            {isMedia && (
                <SettingsLayout title={menuTitle} onClose={() => setIsOpen(false)} className="md:w-[34rem]">
                    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-1.5">
                        <section aria-label="Idioma de audio" className="flex flex-col">
                            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-label-2">Audio</div>
                            <AudioSettings
                                audioTracks={audioTracks}
                                activeAudioIndex={activeAudioIndex}
                                onSelectAudio={onSelectAudio}
                                getFriendlyLanguage={getFriendlyLanguage}
                            />
                        </section>
                        <section aria-label="Subtítulos" className="flex flex-col border-t border-[var(--neutral-separator)] mt-1.5 pt-1.5 md:border-t-0 md:mt-0 md:pt-0 md:border-l md:pl-1.5">
                            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-label-2">Subtítulos</div>
                            <SubtitleSettings
                                subtitleTracks={subtitleTracks}
                                activeSubtitleIndex={activeSubtitleIndex}
                                onSelectSubtitle={(track) => onSelectSubtitle(track)}
                                subtitleSize={subtitleSize}
                                onSubtitleSizeChange={onSubtitleSizeChange}
                                getFriendlyLanguage={getFriendlyLanguage}
                            />
                        </section>
                    </div>
                </SettingsLayout>
            )}

            {/* ── MAIN MENU ───────────────────────────────── */}
            {!isMedia && view === "main" && (
                <SettingsLayout title={menuTitle} onClose={() => setIsOpen(false)}>
                    {isMore && (
                        <MenuButton
                            icon={<IconMediaForward className="w-4 h-4" />}
                            label="Velocidad y maratón"
                            value={playbackSummary}
                            onClick={() => setView("playback")}
                        />
                    )}
                    {!isMore && (
                        <>
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
                        </>
                    )}

                    {hasQualityOptions && (
                        <MenuButton
                            icon={<IconNavigationLayers className="w-4 h-4" />}
                            label="Calidad y fuente"
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
                    {!isMore && (
                        <MenuButton
                            icon={<IconMediaForward className="w-4 h-4" />}
                            label="Reproducción"
                            value={playbackSummary}
                            onClick={() => setView("playback")}
                        />
                    )}
                    {(isMore || variant === "all") && (onPrevChapter || onNextChapter) && (
                        <div className="mt-1.5 pt-1.5 border-t border-[var(--neutral-separator)]">
                            {onPrevChapter && (
                                <MenuButton
                                    icon={<IconMediaSkipPrevious className="w-4 h-4 fill-current" />}
                                    label="Capítulo anterior"
                                    onClick={onPrevChapter}
                                    rightElement={<kbd className="text-2xs font-mono text-label-2">[</kbd>}
                                />
                            )}
                            {onNextChapter && (
                                <MenuButton
                                    icon={<IconMediaSkipNext className="w-4 h-4 fill-current" />}
                                    label="Siguiente capítulo"
                                    onClick={onNextChapter}
                                    rightElement={<kbd className="text-2xs font-mono text-label-2">]</kbd>}
                                />
                            )}
                        </div>
                    )}
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
                    title="Calidad y fuente"
                    onBack={() => setView("main")}
                    onClose={() => setIsOpen(false)}
                >
                    {hlsLevels.length > 0 && (
                        <div className="flex flex-col border-b border-[var(--neutral-separator)] pb-2 mb-2">
                            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-label-2">Resolución</div>
                            <button
                                onClick={() => { onHlsLevelChange?.(-1); setIsOpen(false) }}
                                className={cn(
                                    "flex items-center justify-between w-full min-h-[44px] py-2 px-3 rounded-full transition-[background-color,color,transform] duration-fast ease-smooth-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                    activeHlsLevel === -1 ? "bg-[var(--neutral-elev-3)] text-label-1" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                                )}
                            >
                                <span className="text-xs font-bold">Automática</span>
                                {activeHlsLevel === -1 && <IconUiCheck className="w-3.5 h-3.5" />}
                            </button>
                            {hlsLevels.map((level) => (
                                <button
                                    key={level.index}
                                    onClick={() => { onHlsLevelChange?.(level.index); setIsOpen(false) }}
                                    className={cn(
                                        "flex items-center justify-between w-full min-h-[44px] py-2 px-3 rounded-full transition-[background-color,color,transform] duration-fast ease-smooth-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                        activeHlsLevel === level.index ? "bg-[var(--neutral-elev-3)] text-label-1" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
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
                            {hlsLevels.length > 0 && <div className="px-3 pt-2 pb-1 text-xs font-semibold text-label-2">Fuentes</div>}
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
                    <div className="px-3 pt-2 pb-1 text-xs font-semibold text-label-2">Relación de aspecto</div>
                    {(["contain", "cover", "fill", "16/9", "21/9"] as const).map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => onAspectRatioChange?.(ratio)}
                            className={cn(
                                "flex items-center justify-between w-full min-h-[44px] py-2 px-3 rounded-full transition-[background-color,color,transform] duration-fast ease-smooth-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                aspectRatio === ratio ? "bg-[var(--neutral-elev-3)] text-label-1" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                            )}
                        >
                            <div className="flex flex-col items-start">
                                <span className="text-xs font-bold">{ASPECT_RATIO_LABELS[ratio]}</span>
                                <span className="text-label-sm text-label-2 mt-0.5">
                                    {ratio === "contain" && "Conserva la proporción, con barras negras"}
                                    {ratio === "cover" && "Llena la pantalla y recorta los bordes"}
                                    {ratio === "fill" && "Estira la imagen para llenar la pantalla"}
                                    {ratio === "16/9" && "Fuerza la proporción 16:9"}
                                    {ratio === "21/9" && "Para monitores ultrapanorámicos 21:9"}
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
                    title={isMore ? "Velocidad y maratón" : "Reproducción"}
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
                        loopEnabled={loopEnabled}
                        onLoopEnabledChange={onLoopEnabledChange ?? (() => {})}
                        autoDisableSubtitlesWhenDubbed={autoDisableSubtitlesWhenDubbed}
                        onAutoDisableSubtitlesWhenDubbedChange={onAutoDisableSubtitlesWhenDubbedChange ?? (() => {})}
                        tvMode={tvMode}
                        onTvModeChange={onTvModeChange}
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
                aria-label={isMedia ? "Audio y subtítulos" : isMore ? "Más opciones [O]" : "Configuración [O]"}
                title={isMedia ? "Audio y subtítulos" : isMore ? "Más opciones [O]" : "Configuración [O]"}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                className={cn(
                    "relative",
                    PLAYER_ICON_BTN,
                    isOpen && PLAYER_ICON_BTN_ACTIVE
                )}
            >
                {isMedia
                    ? <IconMediaSubtitles className="w-4 h-4" />
                    : isMore
                        ? <IconUiMoreHorizontal className="w-4 h-4" />
                        : <IconUiSettings className={cn("w-4 h-4 transition-transform duration-base", isOpen && "rotate-45")} />}
                {isLoadingSubtitle && (
                    <span className="absolute -top-0.5 -right-0.5">
                        <IconUiSpinner className="w-3 h-3 text-label-1 animate-spin" />
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
                                    role="dialog"
                                    aria-label={menuTitle}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                >
                                    {/* Vistas del menú: la que sale se despega del flujo (popLayout, anclada
                                        abajo a la derecha como el panel) y la nueva llega desde el lado del
                                        gesto: +1 al entrar a un submenú, -1 al volver al principal.
                                        initial={false}: al abrir solo se ve la entrada del panel. */}
                                    <AnimatePresence
                                        mode="popLayout"
                                        initial={false}
                                        custom={view === "main" ? -1 : 1}
                                        anchorX="right"
                                        anchorY="bottom"
                                    >
                                        <div key={view} data-settings-view={view}>
                                            {renderContent()}
                                        </div>
                                    </AnimatePresence>
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
                    <VaulContent surface="solid" className="!z-player-settings p-3 focus:outline-none max-h-[85vh] overflow-y-auto">
                        {renderContent()}
                    </VaulContent>
                </Vaul>
            )}
        </div>
    )
}
