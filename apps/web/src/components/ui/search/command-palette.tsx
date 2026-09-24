import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useGlobalSearch, type GlobalSearchResultItem } from "@/hooks/use-global-search"
import { Link, useNavigate } from "@tanstack/react-router"
import { IconNavigationFilm, IconStatusSparkles } from "@/components/ui/icons"
import { ThinkingOrb } from "@/components/ui/thinking-orb"
import React, { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then((m) => ({ default: m.VideoPlayer }))
)
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { useQueueStore } from "@/lib/store"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import { useBackupDatabase, useDownloadDatabaseBackup } from "@/api/hooks/system.hooks"
import { useEnqueuePreTranscode } from "@/api/hooks/pretranscode.hooks"
import { useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { MATCH_PRESELECT_KEY } from "@/lib/match-preselect"

type PaletteCommand = {
    id: string
    label: string
    hint: string
    run: () => void
}

function ActionButton({ label, title, onClick, disabled }: { label: string; title: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation()
                onClick(e)
            }}
            className="px-2 py-1 rounded-md text-3xs font-mono font-bold uppercase tracking-wider border border-white/15 bg-white/[0.04] text-on-surface-variant hover:text-white hover:border-white/30 active:scale-95 transition-all disabled:opacity-40 shrink-0"
        >
            {label}
        </button>
    )
}

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const hideAudienceScore = useHideAudienceScore()
    const navigate = useNavigate()
    const { query, setQuery, results, isLoading, isSearchActive } = useGlobalSearch(open)
    const [playTarget, setPlayTarget] = useState<{ path: string; title: string } | null>(null)

    const { mutate: scanLibrary } = useScanLocalFiles()
    const { mutate: backupDb } = useBackupDatabase()
    const { download: downloadBackup } = useDownloadDatabaseBackup()
    const { mutate: enqueuePreTranscode, isPending: isEnqueueingPreTranscode } = useEnqueuePreTranscode()
    const { mutate: updateProgress } = useUpdateAnimeEntryProgress(undefined, 0, false)
    const addToQueue = useQueueStore((s) => s.addToQueue)
    // Evita doble navegación: el click en un <Link> interno ya navega;
    // onSelect solo navega cuando el Enter/click no pasó por un Link.
    const linkNavHandledRef = useRef(false)

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        const handleOpen = () => setOpen(true)
        document.addEventListener("keydown", down)
        window.addEventListener("open-command-palette", handleOpen)
        return () => {
            document.removeEventListener("keydown", down)
            window.removeEventListener("open-command-palette", handleOpen)
        }
    }, [])

    const runClearCache = async () => {
        setOpen(false)
        toast.loading("Limpiando caché del sistema...", { id: "palette-cache" })
        try {
            await buildSeaQuery({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.ClearSystemCache.endpoint,
                method: "POST",
            })
            toast.success("Caché liberada correctamente", { id: "palette-cache" })
        } catch {
            toast.error("No se pudo limpiar la caché", { id: "palette-cache" })
        }
    }

    const runWarmThumbnails = async () => {
        setOpen(false)
        toast.loading("Pre-generando miniaturas...", { id: "palette-warm" })
        try {
            const res = await buildSeaQuery<{ status: string; totalFiles?: number }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.endpoint,
                method: "POST",
            })
            if (res?.status === "already_running") {
                toast.info("La pre-generación ya está en curso", { id: "palette-warm" })
            } else {
                toast.success(`Indexando miniaturas (${res?.totalFiles ?? 0} videos)`, { id: "palette-warm" })
            }
        } catch {
            toast.error("No se pudo iniciar la pre-generación", { id: "palette-warm" })
        }
    }

    const runBackup = () => {
        setOpen(false)
        backupDb(undefined, {
            onSuccess: () => {
                toast.success("Respaldo generado con éxito")
                void downloadBackup()
            },
            onError: () => {
                toast.error("Error al generar el respaldo")
            },
        })
    }

    const runScan = () => {
        setOpen(false)
        scanLibrary({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false })
    }

    const isCommandMode = query.startsWith(">")
    const commandFilter = query.slice(1).trim().toLowerCase()
    const commands: PaletteCommand[] = [
        { id: "scan", label: "Escanear biblioteca ahora", hint: ">scan", run: runScan },
        { id: "backup", label: "Backup + descargar", hint: ">backup", run: runBackup },
        { id: "cache", label: "Limpiar caché del sistema", hint: ">cache", run: runClearCache },
        { id: "warm", label: "Pre-generar miniaturas", hint: ">warm", run: runWarmThumbnails },
    ].filter((c) => !commandFilter || c.label.toLowerCase().includes(commandFilter) || c.id.includes(commandFilter))

    const queueUnlinked = (result: Extract<GlobalSearchResultItem, { isUnlinked: true }>, title: string) => {
        if (!result.path) {
            toast.error("Sin ruta reproducible")
            return
        }
        addToQueue({
            id: result.mediaId,
            title,
            subtitle: "Archivo huérfano",
            playableUrl: result.path,
            thumbnail: result.media?.posterImage || "",
            // 0 desactiva tracking/progreso/resume (guards por truthiness);
            // -1 los corrompía (heartbeat y continuity con mediaId inválido).
            mediaId: 0,
            episodeNumber: 1,
            malId: null,
            mediaFormat: "TV",
        })
        toast.success("Añadido a la cola")
        setOpen(false)
    }

    const preTranscodeUnlinked = (result: Extract<GlobalSearchResultItem, { isUnlinked: true }>) => {
        if (!result.path) {
            toast.error("Sin ruta para pre-transcodear")
            return
        }
        setOpen(false)
        enqueuePreTranscode({ path: result.path })
    }

    const matchUnlinked = (path?: string) => {
        setOpen(false)
        try {
            if (path) {
                window.sessionStorage.setItem(MATCH_PRESELECT_KEY, path)
            } else {
                window.sessionStorage.removeItem(MATCH_PRESELECT_KEY)
            }
        } catch {}
        navigate({ to: "/settings", search: { tab: "library" } })
    }

    const markWatched = (mediaId: number, total: number, title: string) => {
        setOpen(false)
        updateProgress({ mediaId, progress: total }, {
            onSuccess: () => toast.success(`"${title}" marcado como visto`),
            onError: () => toast.error(`No se pudo marcar "${title}" como visto`),
        })
    }

    // Navegación programática para Enter/teclado (el click en <Link> ya navega).
    const navigateToResult = (result: GlobalSearchResultItem): boolean => {
        if ("isUnlinked" in result && result.isUnlinked) return false
        if ("isSemantic" in result && result.isSemantic) {
            const sem = result.semanticData
            const isMovie = sem.mediaType === "MOVIE"
            if (isMovie) {
                navigate({ to: "/movies/$movieId", params: { movieId: String(sem.mediaId) } })
            } else {
                navigate({ to: "/series/$seriesId", params: { seriesId: String(sem.mediaId) } })
            }
            return true
        }
        const fmt = result.media?.format
        const isMovie = fmt === "MOVIE" || fmt === "SPECIAL" || fmt === "OVA"
        if (isMovie) {
            navigate({ to: "/movies/$movieId", params: { movieId: String(result.mediaId ?? "0") } })
        } else {
            navigate({ to: "/series/$seriesId", params: { seriesId: String(result.mediaId ?? "0") } })
        }
        return true
    }

    const markLinkNavHandled = () => {
        linkNavHandledRef.current = true
        setOpen(false)
    }

    return (
        <>
            <CommandDialog 
                open={open} 
                onOpenChange={setOpen} 
                commandProps={{ 
                    label: "Search Command Palette",
                    className: "bg-surface/85 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border border-white/20 border-t-white/40 border-b-white/10 rounded-3xl overflow-hidden shadow-[shadow:var(--glass-highlight-lg),0_24px_48px_rgba(0,0,0,0.9)]"
                }}
            >
                <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_var(--glow-primary)] animate-pulse" />
                        <CommandInput
                            placeholder="DESCUBRE TU PRÓXIMA SERIE... (> COMANDOS)"
                            className="h-12 sm:h-14 font-display text-lg sm:text-2xl md:text-3xl tracking-widest placeholder:text-on-surface-variant/60 bg-transparent border-none focus:ring-0 text-on-surface"
                            value={query}
                            onValueChange={setQuery}
                        />
                    </div>
                </div>
                <CommandList className="max-h-[60vh] md:max-h-[500px] p-4 custom-scrollbar">
                    {isCommandMode ? (
                        <>
                            <CommandEmpty className="py-10 text-center">
                                <p className="font-display text-xl tracking-display text-on-surface uppercase">Sin comandos</p>
                            </CommandEmpty>
                            <CommandGroup heading="COMANDOS" className="text-label-sm font-black tracking-cinema-md text-on-surface-variant px-2 pt-2 pb-4 uppercase">
                                <div className="grid gap-3 mt-2">
                                    {commands.map((cmd) => (
                                        <CommandItem
                                            key={cmd.id}
                                            value={cmd.id}
                                            onSelect={() => cmd.run()}
                                            className="rounded-2xl border border-white/10 hover:border-white/25 bg-white/[0.03] hover:bg-white/[0.08] transition-colors p-0 overflow-hidden cursor-pointer"
                                        >
                                            <div className="flex w-full items-center justify-between gap-5 p-3">
                                                <span className="text-sm font-bold text-on-surface">{cmd.label}</span>
                                                <span className="text-3xs font-mono text-on-surface-variant/70 shrink-0">{cmd.hint}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </div>
                            </CommandGroup>
                        </>
                    ) : isLoading ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-6 animate-in fade-in duration-slow">
                            <ThinkingOrb state="searching" size={64} aria-label="Sincronizando bóveda…" />
                            <span className="font-display text-lg tracking-cinema-lg text-on-surface-variant uppercase">Sincronizando Bóveda</span>
                        </div>
                    ) : (
                        <>
                            <CommandEmpty className="py-16 text-center flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                                <p className="font-display text-2xl tracking-display text-on-surface uppercase">Sin coincidencias detectadas</p>
                                <p className="text-label-sm font-medium uppercase tracking-cinema-md text-on-surface-variant max-w-sm leading-relaxed">
                                    Verifica los términos técnicos o expande los criterios de búsqueda
                                </p>
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery("")}
                                        className="mt-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white border border-white/20 active:scale-95 transition-[background-color,transform] cursor-pointer"
                                    >
                                        Limpiar búsqueda
                                    </button>
                                )}
                            </CommandEmpty>
                            <CommandGroup 
                                heading={
                                    <div className="flex items-center gap-2">
                                        <span>{isSearchActive ? "RESULTADOS ENCONTRADOS" : "TENDENCIAS GLOBALES"}</span>
                                        {results && results.length > 0 && (
                                            <span className="animate-number-pop-in px-2 py-0.5 rounded-full text-3xs font-mono font-black bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                                                {results.length}
                                            </span>
                                        )}
                                    </div>
                                }
                                className="text-label-sm font-black tracking-cinema-md text-on-surface-variant px-2 pt-2 pb-4 uppercase"
                            >
                                <div className="grid gap-3 mt-2">
                                    {results?.filter(res => res != null).map((res, index) => {
                                        const result = res as GlobalSearchResultItem
                                        if (!result) return null
                                        const media = result?.media
                                        const title = media?.titleRomaji || media?.titleEnglish || `Desconocido (${result?.mediaId ?? index})`
                                        const numericMediaId = typeof result.mediaId === "number" ? result.mediaId : Number(result.mediaId)
                                        const totalEps = (media as unknown as { totalEpisodes?: number } | undefined)?.totalEpisodes ?? 0
                                        
                                        return (
                                            <CommandItem
                                                key={String(result?.mediaId ?? `idx-${index}`)}
                                                value={`${title}-${result?.mediaId ?? index}`}
                                                onSelect={() => {
                                                    if (linkNavHandledRef.current) {
                                                        linkNavHandledRef.current = false
                                                        return
                                                    }
                                                    setOpen(false)
                                                    if ("isUnlinked" in result && result.isUnlinked) {
                                                        setPlayTarget({ path: result.path, title })
                                                    } else {
                                                        navigateToResult(result)
                                                    }
                                                }}
                                                className="rounded-2xl border border-white/10 hover:border-white/25 border-t-white/20 bg-white/[0.03] hover:bg-white/[0.08] transition-[background-color,border-color,transform] duration-150 p-0 overflow-hidden group cursor-pointer shadow-glass-highlight-sm"
                                            >
                                                {"isUnlinked" in result && result.isUnlinked ? (
                                                    <div className="flex w-full items-center gap-5 p-3 text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setOpen(false)
                                                                setPlayTarget({ path: result.path, title })
                                                            }}
                                                            className="flex flex-1 items-center gap-5 min-w-0 text-left"
                                                        >
                                                            <div className="h-20 w-14 flex-shrink-0 rounded-lg shadow-elevation-1 border border-outline-variant/50 group-hover:scale-105 transition-transform duration-base bg-brand-accent/10 flex items-center justify-center overflow-hidden relative">
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-brand-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                <IconNavigationFilm className="h-7 w-7 text-brand-accent group-hover:scale-110 transition-transform duration-base z-10" />
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                                <span className="truncate text-lg font-bold text-on-surface group-hover:text-brand-accent transition-colors leading-tight" title={title}>
                                                                    {title}
                                                                </span>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <span className="text-label-sm font-black uppercase tracking-ultra text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-md shrink-0">
                                                                        HUÉRFANO
                                                                    </span>
                                                                    <span className="text-label-sm font-medium text-on-surface-variant uppercase truncate tracking-wide">
                                                                        {result.path}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                        <div className="flex flex-col gap-1.5 shrink-0 pr-1">
                                                            <ActionButton label="Cola" title="Añadir a la cola" onClick={() => queueUnlinked(result, title)} />
                                                            <ActionButton label="Pre-TC" title="Pre-transcodear" disabled={isEnqueueingPreTranscode} onClick={() => preTranscodeUnlinked(result)} />
                                                            <ActionButton label="Match" title="Match TMDB en Biblioteca" onClick={() => matchUnlinked(result.path)} />
                                                        </div>
                                                    </div>
                                                ) : "isSemantic" in result && result.isSemantic ? (() => {
                                                    const sem = result.semanticData
                                                    const isMovie = sem.mediaType === "MOVIE"
                                                    const linkProps = isMovie
                                                        ? { to: "/movies/$movieId" as const, params: { movieId: String(sem.mediaId) } }
                                                        : { to: "/series/$seriesId" as const, params: { seriesId: String(sem.mediaId) } }

                                                    return (
                                                        <Link {...linkProps} preload="intent" className="flex w-full items-center gap-5 p-3" onClick={markLinkNavHandled}>
                                                            <div className="h-20 w-14 flex-shrink-0 rounded-lg shadow-elevation-1 border border-brand-accent/30 group-hover:scale-105 transition-transform duration-base bg-brand-accent/10 flex items-center justify-center overflow-hidden relative">
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-brand-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                <IconStatusSparkles className="h-7 w-7 text-brand-accent group-hover:scale-110 transition-transform duration-base z-10" />
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                                <span className="truncate text-lg font-bold text-on-surface group-hover:text-brand-accent transition-colors leading-tight" title={title}>
                                                                    {title}
                                                                </span>
                                                                <p className="text-label-sm text-on-surface-variant truncate mt-1">{sem.description}</p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <span className="text-label-sm font-black uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-md">
                                                                        {result.badgeLabel}
                                                                    </span>
                                                                    {sem.episodes && (
                                                                        <span className="text-label-sm font-black uppercase tracking-widest text-on-surface-variant/80">
                                                                            {sem.episodes}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    )
                                                })() : (() => {
                                                        const isMovie = media?.format === "MOVIE" || media?.format === "SPECIAL" || media?.format === "OVA"
                                                        const linkProps = isMovie 
                                                            ? { to: "/movies/$movieId" as const, params: { movieId: result?.mediaId?.toString() || "0" } }
                                                            : { to: "/series/$seriesId" as const, params: { seriesId: result?.mediaId?.toString() || "0" } }
                                                        const canMarkWatched = Number.isInteger(numericMediaId) && numericMediaId > 0 && totalEps > 0

                                                        return (
                                                            <div className="flex w-full items-center gap-5 p-3">
                                                                <Link {...linkProps} preload="intent" className="flex flex-1 items-center gap-5 min-w-0" onClick={markLinkNavHandled}>
                                                                    <div
                                                                        className="h-20 w-14 flex-shrink-0 rounded-lg bg-cover bg-center shadow-elevation-1 border border-outline-variant/50 group-hover:scale-105 transition-transform duration-base bg-surface-variant flex items-center justify-center overflow-hidden relative"
                                                                        style={media?.posterImage ? { backgroundImage: `url(${media.posterImage})` } : {}}
                                                                    >
                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        {!media?.posterImage && <span className="text-label-sm font-black opacity-20 uppercase tracking-tighter">NO COVER</span>}
                                                                    </div>
                                                                    <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                                        <span className="truncate text-lg font-bold text-on-surface group-hover:text-brand-accent transition-colors leading-tight" title={title}>
                                                                            {title}
                                                                        </span>
                                                                        <div className="flex items-center gap-3 mt-2">
                                                                            <span className="text-label-sm font-black uppercase tracking-widest text-on-surface-variant">
                                                                                {media?.year || "N/A"}
                                                                            </span>
                                                                            <div className="w-1 h-1 rounded-full bg-outline-variant/50" />
                                                                            <span className="text-label-sm font-black uppercase tracking-widest text-on-surface-variant">
                                                                                {media?.format || "LOCAL"}
                                                                            </span>
                                                                            {media && !hideAudienceScore && "score" in media && media.score !== undefined && media.score > 0 && (
                                                                                <>
                                                                                    <div className="w-1 h-1 rounded-full bg-outline-variant/50" />
                                                                                    <span className="text-label-sm font-black text-brand-accent tracking-wider">
                                                                                        ★ {(media.score > 10 ? media.score / 10 : media.score).toFixed(1)}
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                            {"vibes" in result && result.vibes?.map((vibe) => (
                                                                                <span key={vibe} className="text-label-sm font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md border border-outline-variant/50 bg-surface-variant text-on-surface-variant group-hover:text-on-surface transition-colors">
                                                                                    {vibe}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </Link>
                                                                {canMarkWatched && (
                                                                    <div className="shrink-0 pr-1">
                                                                        <ActionButton label="Visto" title="Marcar como visto" onClick={() => markWatched(numericMediaId, totalEps, title)} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })()}
                                            </CommandItem>
                                        )
                                    })}
                                </div>
                            </CommandGroup>
                        </>
                    )}
                </CommandList>
                <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.02] flex items-center gap-4 text-3xs font-mono text-on-surface-variant/60">
                    <span><kbd className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-on-surface-variant">↵</kbd> abrir</span>
                    <span><kbd className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-on-surface-variant">&gt;</kbd> comandos</span>
                    <span><kbd className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-on-surface-variant">esc</kbd> cerrar</span>
                </div>
            </CommandDialog>

            {playTarget && (
                <React.Suspense fallback={null}>
                    <VideoPlayer
                        streamUrl={playTarget.path}
                        streamType="direct"
                        episodeLabel={playTarget.title}
                        onClose={() => setPlayTarget(null)}
                    />
                </React.Suspense>
            )}
        </>
    )
}
