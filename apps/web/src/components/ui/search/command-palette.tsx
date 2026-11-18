import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useGlobalSearch, type GlobalSearchResultItem } from "@/hooks/use-global-search"
import { useNavigate } from "@tanstack/react-router"
import { IconNavigationFilm, IconStatusSparkles } from "@/components/ui/icons"
import { ThinkingOrb } from "@/components/ui/thinking-orb"
import { Button } from "@/components/ui/button"
import React, { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then((m) => ({ default: m.VideoPlayer }))
)
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { useQueueStore } from "@/lib/store"
import { getFormatLabel } from "@/lib/helpers/media"
import { getMediumResImage, localImage } from "@/lib/helpers/images"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import { useBackupDatabase, useDownloadDatabaseBackup } from "@/api/hooks/system.hooks"
import { useEnqueuePreTranscode } from "@/api/hooks/pretranscode.hooks"
import { useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { buildApiQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { MATCH_PRESELECT_KEY } from "@/lib/match-preselect"

type PaletteCommand = {
    id: string
    label: string
    hint: string
    run: () => void
}

/** Las vibes llegan del motor de inteligencia en inglés y en mayúsculas: se muestran en español. */
const VIBE_LABELS: Record<string, string> = {
    CHILL: "Tranquilo",
    EPIC: "Épico",
    HYPED: "Intenso",
    TENSE: "Tenso",
    DARK: "Oscuro",
    EMOTIONAL: "Emotivo",
    FUNNY: "Divertido",
    NOSTALGIC: "Nostálgico",
}
/** Etiquetas que llegan en mayúsculas del motor de búsqueda: "PERSONAJE" → "Personaje". */
const sentenceCase = (label: string) => (label ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : label)
const vibeLabel = (vibe: string) => VIBE_LABELS[vibe.toUpperCase()] ?? sentenceCase(vibe)

const KBD_CLASS =
    "inline-block min-w-[1.5rem] px-1.5 py-0.5 rounded-md border border-[var(--neutral-separator)] bg-[var(--neutral-elev-1)] text-center font-sans text-xs font-medium text-on-surface"

// El estilo de los encabezados va solo en `cmdk-group-heading`: si va en el grupo, lo heredan
// los títulos de las filas (mayúsculas y tracking ancho).
const GROUP_CLASS =
    "px-2 pt-1 pb-3 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-on-surface-variant"

function ActionButton({ label, title, onClick, disabled }: { label: string; title: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
    return (
        <Button
            intent="secondary"
            size="xs"
            title={title}
            disabled={disabled}
            // Los atajos de fila quedan fuera del orden de tabulación y del árbol de accesibilidad
            // (un botón dentro de un listbox no es válido); con teclado se usan con Ctrl+↵.
            tabIndex={-1}
            data-row-action=""
            onClick={(e) => {
                e.stopPropagation()
                onClick(e)
            }}
            className="shrink-0"
        >
            {label}
        </Button>
    )
}

/**
 * Puerta de entrada de la paleta. El cuerpo (≈8 hooks de datos/mutaciones, router,
 * búsqueda) se monta recién al primer uso: montado desde el arranque se
 * re-renderizaba en CADA navegación (≈20 ms dentro del render síncrono del router,
 * medido con perfil) sin que el usuario la hubiera abierto nunca.
 */
export function CommandPalette() {
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        if (mounted) return
        const down = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null
            const isInput = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable
            if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isInput)) {
                e.preventDefault()
                setMounted(true)
            }
        }
        const handleOpen = () => setMounted(true)
        document.addEventListener("keydown", down)
        window.addEventListener("open-command-palette", handleOpen)
        return () => {
            document.removeEventListener("keydown", down)
            window.removeEventListener("open-command-palette", handleOpen)
        }
    }, [mounted])
    return mounted ? <CommandPaletteBody /> : null
}

function CommandPaletteBody() {
    // Nace abierta: el disparo que la montó (atajo o evento) ya se consumió en el portero.
    const [open, setOpen] = useState(true)
    const hideAudienceScore = useHideAudienceScore()
    const navigate = useNavigate()
    const { query, setQuery, results, isLoading, isSearchActive, isChronoMode } = useGlobalSearch(open)
    const [playTarget, setPlayTarget] = useState<{ path: string; title: string } | null>(null)

    const { mutate: scanLibrary } = useScanLocalFiles()
    const { mutate: backupDb } = useBackupDatabase()
    const { download: downloadBackup } = useDownloadDatabaseBackup()
    const { mutate: enqueuePreTranscode, isPending: isEnqueueingPreTranscode } = useEnqueuePreTranscode()
    const { mutate: updateProgress } = useUpdateAnimeEntryProgress(undefined, false)
    const addToQueue = useQueueStore((s) => s.addToQueue)

    // Devolver el foco al cerrar: al elemento que lo tenía antes de abrir, o al
    // botón "Buscar" si se abrió con Ctrl+K desde el body (si no, el foco cae a
    // <body> y con teclado/control remoto hay que reiniciar el recorrido).
    const openerRef = useRef<HTMLElement | null>(null)
    const wasOpenRef = useRef(false)
    useEffect(() => {
        if (open) {
            wasOpenRef.current = true
            const active = document.activeElement
            openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null
            return
        }
        if (!wasOpenRef.current) return
        wasOpenRef.current = false
        const opener = openerRef.current
        openerRef.current = null
        const findSearchTrigger = () =>
            Array.from(document.querySelectorAll<HTMLElement>('button[aria-label^="Buscar"]')).find(
                (b) => (typeof b.checkVisibility === "function" ? b.checkVisibility() : b.offsetParent !== null)
            ) ?? null
        const timer = window.setTimeout(() => {
            const active = document.activeElement
            if (active && active !== document.body) return
            const target = opener?.isConnected ? opener : findSearchTrigger()
            target?.focus({ preventScroll: true })
        }, 0)
        return () => window.clearTimeout(timer)
    }, [open])

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            const isInput =
                document.activeElement?.tagName === "INPUT" ||
                document.activeElement?.tagName === "TEXTAREA" ||
                (document.activeElement as HTMLElement)?.isContentEditable
            if (
                (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
                (e.key === "/" && !isInput)
            ) {
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
        toast.loading("Limpiando la caché del sistema…", { id: "palette-cache" })
        try {
            await buildApiQuery({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.ClearSystemCache.endpoint,
                method: "POST",
            })
            toast.success("Caché limpiada", { id: "palette-cache" })
        } catch {
            toast.error("No se pudo limpiar la caché", { id: "palette-cache" })
        }
    }

    const runWarmThumbnails = async () => {
        setOpen(false)
        toast.loading("Generando miniaturas…", { id: "palette-warm" })
        try {
            const res = await buildApiQuery<{ status: string; totalFiles?: number }>({
                endpoint: API_ENDPOINTS.CACHE_HANDLERS.WarmThumbnailCache.endpoint,
                method: "POST",
            })
            if (res?.status === "already_running") {
                toast.info("Las miniaturas ya se están generando", { id: "palette-warm" })
            } else {
                toast.success(`Generando miniaturas de ${res?.totalFiles ?? 0} ${res?.totalFiles === 1 ? "video" : "videos"}`, { id: "palette-warm" })
            }
        } catch {
            toast.error("No se pudo iniciar la generación de miniaturas", { id: "palette-warm" })
        }
    }

    const runBackup = () => {
        setOpen(false)
        backupDb(undefined, {
            onSuccess: () => {
                toast.success("Respaldo creado")
                void downloadBackup()
            },
            onError: () => {
                toast.error("No se pudo crear el respaldo")
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
        { id: "backup", label: "Crear respaldo y descargarlo", hint: ">backup", run: runBackup },
        { id: "cache", label: "Limpiar caché del sistema", hint: ">cache", run: runClearCache },
        { id: "warm", label: "Generar miniaturas", hint: ">warm", run: runWarmThumbnails },
    ].filter((c) => !commandFilter || c.label.toLowerCase().includes(commandFilter) || c.id.includes(commandFilter))

    const queueUnlinked = (result: Extract<GlobalSearchResultItem, { isUnlinked: true }>, title: string) => {
        if (!result.path) {
            toast.error("Este archivo no tiene una ruta reproducible")
            return
        }
        addToQueue({
            id: result.mediaId,
            title,
            subtitle: "Sin vincular",
            playableUrl: result.path,
            thumbnail: result.media?.posterImage || "",
            // 0 desactiva tracking/progreso/resume (guards por truthiness);
            // -1 los corrompía (heartbeat y continuity con mediaId inválido).
            mediaId: 0,
            episodeNumber: 1,
            malId: null,
            mediaFormat: "TV",
        })
        toast.success("Añadido a Mi Lista")
        setOpen(false)
    }

    const preTranscodeUnlinked = (result: Extract<GlobalSearchResultItem, { isUnlinked: true }>) => {
        if (!result.path) {
            toast.error("Este archivo no tiene una ruta para convertir")
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
            onSuccess: () => toast.success(`«${title}» marcado como visto`),
            onError: () => toast.error(`No se pudo marcar «${title}» como visto`),
        })
    }

    // Navegación de la opción seleccionada (Enter o click).
    const navigateToResult = (result: GlobalSearchResultItem): boolean => {
        if ("isUnlinked" in result && result.isUnlinked) return false
        if ("isChronology" in result && result.isChronology) {
            navigate({ to: "/chronology", search: { highlight: result.volumeId } })
            return true
        }
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

    // Ctrl/⌘+↵ dispara la acción rápida de la fila resaltada (Mi Lista / Visto), que no es
    // alcanzable con Tab porque vive fuera del árbol del listbox.
    const runRowAction = (e: React.KeyboardEvent) => {
        if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return
        const selected = e.currentTarget.querySelector('[cmdk-item][aria-selected="true"]')
        const action = selected?.parentElement?.querySelector<HTMLButtonElement>("button[data-row-action]")
        if (!action) return
        e.preventDefault()
        action.click()
    }

    return (
        <>
            <CommandDialog 
                open={open} 
                onOpenChange={setOpen} 
                contentClass="sm:max-w-2xl surface-content max-h-[min(85dvh,640px)] flex flex-col overflow-hidden"
                commandProps={{
                    label: "Buscar en KameHouse",
                    className: "bg-transparent border-none overflow-hidden",
                    onKeyDown: runRowAction,
                }}
            >
                <div className="p-3 border-b border-[var(--neutral-separator)]">
                    {/* pr-12: la X de cierre del Modal (absolute right-4, 36-44 px) cae sobre esta fila; sin esto tapa el final del input. */}
                    <div className="flex items-center gap-3 pl-2 pr-12">
                        <CommandInput
                            inputContainerClass="flex-1 min-w-0"
                            placeholder="Buscar series, películas… (> comandos, @ cronología)"
                            className="h-12 sm:h-14 font-display !text-[1rem] sm:!text-[1.125rem] tracking-normal placeholder:text-on-surface-variant bg-transparent border-none outline-none ![backdrop-filter:none] shadow-none !ring-0 focus-visible:outline-none text-on-surface"
                            value={query}
                            onValueChange={setQuery}
                        />
                    </div>
                </div>
                <CommandList className="flex-1 min-h-0 max-h-[min(60dvh,500px)] p-4 custom-scrollbar">
                    {isCommandMode ? (
                        <>
                            <CommandEmpty className="py-10 text-center">
                                <p className="font-display text-xl text-on-surface text-balance">Ningún comando coincide</p>
                            </CommandEmpty>
                            <CommandGroup heading="Comandos" className={GROUP_CLASS}>
                                <div className="grid grid-cols-[minmax(0,1fr)] gap-2 mt-2">
                                    {commands.map((cmd) => (
                                        <CommandItem
                                            key={cmd.id}
                                            value={cmd.id}
                                            onSelect={() => cmd.run()}
                                            className="rounded-2xl border border-[var(--neutral-separator)] bg-[var(--neutral-elev-1)] aria-selected:bg-[var(--neutral-elev-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent motion-safe:active:scale-[0.99] transition-[transform,background-color] duration-quick ease-out-strong p-0 overflow-hidden cursor-pointer"
                                        >
                                            <div className="flex w-full items-center justify-between gap-5 p-3">
                                                <span className="text-sm font-bold text-on-surface">{cmd.label}</span>
                                                <span className="text-xs text-label-2 shrink-0">{cmd.hint}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </div>
                            </CommandGroup>
                        </>
                    ) : isLoading ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-6 animate-in fade-in duration-slow">
                            <ThinkingOrb state="searching" size={64} aria-label="Buscando…" />
                            <span className="font-display text-lg text-on-surface-variant">Buscando…</span>
                        </div>
                    ) : (
                        <>
                            <CommandEmpty className="py-16 text-center flex flex-col items-center gap-3 animate-in fade-in duration-quick">
                                {isChronoMode && !isSearchActive ? (
                                    <>
                                        <p className="font-display text-2xl text-on-surface text-balance">Buscar en la cronología</p>
                                        <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
                                            Escribe un personaje, una saga, las esferas o el nombre de un lapso. Por ejemplo: «@vegeta» o «@cell».
                                        </p>
                                    </>
                                ) : isChronoMode ? (
                                    <>
                                        <p className="font-display text-2xl text-on-surface text-balance">Ningún lapso coincide</p>
                                        <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
                                            No hay lapsos con «{query.slice(1).trim()}». Prueba con un personaje, una saga o una esfera.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-display text-2xl text-on-surface text-balance">Sin coincidencias</p>
                                        <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
                                            Revisa la ortografía o prueba con otros términos.
                                        </p>
                                    </>
                                )}
                                {query && (
                                    <Button intent="secondary" size="sm" className="mt-2" onClick={() => setQuery("")}>
                                        Limpiar búsqueda
                                    </Button>
                                )}
                            </CommandEmpty>
                            <CommandGroup 
                                heading={
                                    <div className="flex items-center gap-2">
                                        <span>{isChronoMode ? "Cronología" : isSearchActive ? "Resultados" : "Tendencias globales"}</span>
                                        {results && results.length > 0 && (
                                            <span className="animate-number-pop-in px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--neutral-elev-2)] text-on-surface-variant">
                                                {results.length}
                                            </span>
                                        )}
                                    </div>
                                }
                                className={GROUP_CLASS}
                            >
                                <div className="grid grid-cols-[minmax(0,1fr)] gap-2 mt-2">
                                    {results?.filter(res => res != null).map((res, index) => {
                                        const result = res as GlobalSearchResultItem
                                        if (!result) return null
                                        const media = result?.media
                                        const title = media?.titleRomaji || media?.titleEnglish || `Desconocido (${result?.mediaId ?? index})`
                                        const numericMediaId = typeof result.mediaId === "number" ? result.mediaId : Number(result.mediaId)
                                        const totalEps = media?.totalEpisodes ?? 0
                                        
                                        const isUnlinked = "isUnlinked" in result && result.isUnlinked
                                        const isPlain = !isUnlinked && !("isChronology" in result && result.isChronology) && !("isSemantic" in result && result.isSemantic)
                                        const canMarkWatched = isPlain && Number.isInteger(numericMediaId) && numericMediaId > 0 && totalEps > 0
                                        const hasActions = isUnlinked || canMarkWatched

                                        // Las acciones secundarias van como hermanas de la opción (no dentro):
                                        // un control interactivo dentro de un role="option" es un anidado inválido.
                                        return (
                                            <div key={String(result?.mediaId ?? `idx-${index}`)} className="relative min-w-0">
                                            <CommandItem
                                                value={`${title}-${result?.mediaId ?? index}`}
                                                onSelect={() => {
                                                    setOpen(false)
                                                    if ("isUnlinked" in result && result.isUnlinked) {
                                                        setPlayTarget({ path: result.path, title })
                                                    } else {
                                                        navigateToResult(result)
                                                    }
                                                }}
                                                className={`rounded-2xl border border-[var(--neutral-separator)] bg-[var(--neutral-elev-1)] aria-selected:bg-[var(--neutral-elev-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent active:scale-[0.99] transition-[transform,background-color] duration-quick ease-out-strong p-0 overflow-hidden group cursor-pointer ${hasActions ? "pr-[5.5rem]" : ""}`}
                                            >
                                                {"isUnlinked" in result && result.isUnlinked ? (
                                                    <div className="flex w-full items-center gap-4 p-3 text-left">
                                                        <div className="flex flex-1 items-center gap-4 min-w-0 text-left">
                                                            <div className="h-20 w-14 flex-shrink-0 rounded-lg shadow-elevation-1 border border-outline-variant/50 bg-brand-accent/10 flex items-center justify-center overflow-hidden relative">
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-brand-accent/20 to-transparent opacity-0 transition-opacity duration-quick group-aria-selected:opacity-100" />
                                                                <IconNavigationFilm className="h-7 w-7 text-brand-accent transition-colors duration-base z-10" />
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                                <span className="truncate text-lg font-bold text-on-surface group-aria-selected:text-brand-accent-readable leading-tight" title={title}>
                                                                    {title}
                                                                </span>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <span className="text-label-sm font-semibold text-on-surface bg-[var(--neutral-elev-3)] px-2 py-0.5 rounded-md shrink-0">
                                                                        Sin vincular
                                                                    </span>
                                                                    <span className="text-label-sm font-medium text-on-surface-variant truncate">
                                                                        {result.path}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : "isChronology" in result && result.isChronology ? (
                                                    <div className="flex w-full items-center gap-4 p-3">
                                                        <div className="h-20 w-14 flex-shrink-0 rounded-lg shadow-elevation-1 border border-status-warning/30 bg-status-warning/10 flex items-center justify-center overflow-hidden relative">
                                                            <div className="absolute inset-0 bg-gradient-to-tr from-status-warning/20 to-transparent opacity-0 transition-opacity duration-quick group-aria-selected:opacity-100" />
                                                            {media?.posterImage ? (
                                                                <img
                                                                    src={localImage(getMediumResImage(media.posterImage))}
                                                                    alt={title}
                                                                    width={56}
                                                                    height={80}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    className="w-full h-full object-cover relative z-10"
                                                                />
                                                            ) : (
                                                                <IconStatusSparkles className="h-7 w-7 text-status-warning transition-colors duration-base z-10" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                            <span className="truncate text-lg font-bold text-on-surface group-aria-selected:text-status-warning leading-tight" title={title}>
                                                                    {title}
                                                            </span>
                                                            <p className="text-label-sm text-on-surface-variant truncate mt-1" title={result.matchSnippet}>
                                                                {result.matchLabel ? (
                                                                    <>
                                                                        <span className="font-semibold text-on-surface">{result.matchLabel}:</span> {result.matchSnippet}
                                                                    </>
                                                                ) : (
                                                                    result.media?.description || result.media?.titleEnglish
                                                                )}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <span className="text-label-sm font-semibold text-on-surface bg-[var(--neutral-elev-3)] px-2 py-0.5 rounded-md">
                                                                    Cronología
                                                                </span>
                                                                {media?.titleOriginal && (
                                                                    <span className="text-label-sm font-semibold text-on-surface-variant">
                                                                        {media.titleOriginal}
                                                                    </span>
                                                                )}
                                                                {media?.year && (
                                                                    <span className="text-label-sm font-semibold text-on-surface-variant">
                                                                        {media.year}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : "isSemantic" in result && result.isSemantic ? (() => {
                                                    const sem = result.semanticData

                                                    return (
                                                        <div className="flex w-full items-center gap-4 p-3">
                                                            <div className="h-20 w-14 flex-shrink-0 rounded-lg shadow-elevation-1 border border-brand-accent/30 bg-brand-accent/10 flex items-center justify-center overflow-hidden relative">
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-brand-accent/20 to-transparent opacity-0 transition-opacity duration-quick group-aria-selected:opacity-100" />
                                                                <IconStatusSparkles className="h-7 w-7 text-brand-accent transition-colors duration-base z-10" />
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                                <span className="truncate text-lg font-bold text-on-surface group-aria-selected:text-brand-accent-readable leading-tight" title={title}>
                                                                    {title}
                                                                </span>
                                                                <p className="text-label-sm text-on-surface-variant truncate mt-1">{sem.description}</p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <span className="text-label-sm font-semibold text-on-surface bg-[var(--neutral-elev-3)] px-2 py-0.5 rounded-md">
                                                                        {sentenceCase(result.badgeLabel)}
                                                                    </span>
                                                                    {sem.episodes && (
                                                                        <span className="text-label-sm font-semibold text-on-surface-variant truncate">
                                                                            {sem.episodes}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })() : (() => {
                                                        return (
                                                            <div className="flex w-full items-center gap-4 p-3">
                                                                <div className="flex flex-1 items-center gap-4 min-w-0">
                                                                    <div
                                                                        className="h-20 w-14 flex-shrink-0 rounded-lg shadow-elevation-1 border border-outline-variant/50 bg-surface-variant flex items-center justify-center overflow-hidden relative"
                                                                    >
                                                                        {media?.posterImage ? (
                                                                            <img
                                                                                src={localImage(getMediumResImage(media.posterImage))}
                                                                                alt=""
                                                                                width={56}
                                                                                height={80}
                                                                                loading="lazy"
                                                                                decoding="async"
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-xs font-semibold text-label-2 text-center px-1">Sin portada</span>
                                                                        )}
                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-quick group-aria-selected:opacity-100" />
                                                                    </div>
                                                                    <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                                        <span className="truncate text-lg font-bold text-on-surface group-aria-selected:text-brand-accent-readable leading-tight" title={title}>
                                                                            {title}
                                                                        </span>
                                                                        <div className="flex items-center gap-3 mt-2">
                                                                            <span className="text-label-sm font-semibold text-on-surface-variant">
                                                                                {media?.year || "Sin año"}
                                                                            </span>
                                                                            <div className="w-1 h-1 rounded-full bg-outline-variant/50" />
                                                                            <span className="text-label-sm font-semibold text-on-surface-variant">
                                                                                {getFormatLabel(media?.format, "Local")}
                                                                            </span>
                                                                            {media && !hideAudienceScore && "score" in media && media.score !== undefined && media.score > 0 && (
                                                                                <>
                                                                                    <div className="w-1 h-1 rounded-full bg-outline-variant/50" />
                                                                                    <span className="text-label-sm font-bold text-brand-accent-readable">
                                                                                        ★ {(media.score > 10 ? media.score / 10 : media.score).toFixed(1)}
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                            {"vibes" in result && result.vibes?.map((vibe) => (
                                                                                <span key={vibe} className="text-label-sm font-semibold px-1.5 py-0.5 rounded-md border border-outline-variant/50 bg-surface-variant text-on-surface-variant group-aria-selected:text-on-surface">
                                                                                    {vibeLabel(vibe)}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })()}
                                            </CommandItem>
                                            {isUnlinked && "path" in result && (
                                                <div aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
                                                    <ActionButton label="Mi Lista" title="Añadir a Mi Lista" onClick={() => queueUnlinked(result, title)} />
                                                    <ActionButton label="Convertir" title="Convertir el video para reproducirlo mejor" disabled={isEnqueueingPreTranscode} onClick={() => preTranscodeUnlinked(result)} />
                                                    <ActionButton label="Vincular" title="Vincular con TMDB en Ajustes › Biblioteca" onClick={() => matchUnlinked(result.path)} />
                                                </div>
                                            )}
                                            {canMarkWatched && (
                                                <div aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <ActionButton label="Visto" title="Marcar como visto" onClick={() => markWatched(numericMediaId, totalEps, title)} />
                                                </div>
                                            )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </CommandGroup>
                        </>
                    )}
                </CommandList>
                <div className="px-4 py-2.5 border-t border-[var(--neutral-separator)] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                    <span><kbd className={KBD_CLASS}>↵</kbd> abrir</span>
                    <span><kbd className={KBD_CLASS}>&gt;</kbd> comandos</span>
                    <span><kbd className={KBD_CLASS}>@</kbd> cronología</span>
                    <span><kbd className={KBD_CLASS}>esc</kbd> cerrar</span>
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
