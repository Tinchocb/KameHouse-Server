import { errorText } from "@/api/client/error-messages"
import React, { useState } from "react"
import { useGetUnlinkedFiles } from "@/api/hooks/unlinked.hooks"
import {
    useResolveUnlinkedFile,
    useTMDBAssign,
    useTMDBSearch,
    type TMDBSearchResult,
} from "@/api/hooks/tmdb-search.hooks"
import { SectionBar } from "@/components/ui/sectionbar"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/button/icon-button"
import { InputAnatomy } from "@/components/ui/input/input-parts"
import { IconUiLink, IconNavigationSearch, IconUiSpinner, IconUiClose } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { toast } from "sonner"
import { MATCH_PRESELECT_KEY } from "@/lib/match-preselect"

function posterUrl(path?: string) {
    if (!path) return null
    if (path.startsWith("http")) return path
    return `https://image.tmdb.org/t/p/w342${path}`
}

export function TmdbMatchManual() {
    const searchRef = React.useRef<HTMLInputElement>(null)
    const [isOpen, setIsOpen] = useState(() => {
        try {
            return !!window.sessionStorage.getItem(MATCH_PRESELECT_KEY)
        } catch {
            return false
        }
    })
    const { data: unlinked, isLoading: isLoadingUnlinked, refetch } = useGetUnlinkedFiles({ enabled: isOpen })
    const [selectedPath, setSelectedPath] = useState<string | null>(null)
    const [pendingPreselect, setPendingPreselect] = useState<string | null>(() => {
        try {
            const pending = window.sessionStorage.getItem(MATCH_PRESELECT_KEY)
            if (pending) window.sessionStorage.removeItem(MATCH_PRESELECT_KEY)
            return pending
        } catch {
            return null
        }
    })
    const files = React.useMemo(() => unlinked ?? [], [unlinked])

    if (isOpen && !selectedPath && pendingPreselect && files.some((f) => f.path === pendingPreselect)) {
        setSelectedPath(pendingPreselect)
        setPendingPreselect(null)
    }
    const [query, setQuery] = useState("")
    const [searchType, setSearchType] = useState("multi")
    const [results, setResults] = useState<TMDBSearchResult[]>([])

    const { mutate: search, isPending: isSearching } = useTMDBSearch()
    const { mutate: assign, isPending: isAssigning } = useTMDBAssign()
    const { mutate: resolve, isPending: isResolving } = useResolveUnlinkedFile()

    const handleSearch = () => {
        const q = query.trim()
        if (!q) {
            toast.error("Escribe un título para buscar")
            return
        }
        search(
            { query: q, searchType, bearerToken: "" },
            {
                onSuccess: (data) => setResults(data ?? []),
                onError: (err) => toast.error(errorText(err, "No se pudo completar la búsqueda")),
            }
        )
    }

    const handleAssign = (r: TMDBSearchResult) => {
        if (!selectedPath) {
            toast.error("Primero elige un archivo sin vincular")
            return
        }
        const mediaType = r.media_type === "movie" ? "movie" : "tv"
        assign({ paths: [selectedPath], tmdbId: r.id, externalId: r.id, provider: r.provider ?? (r.is_jikan ? "jikan" : "tmdb"), mediaType })
    }

    const handleResolve = (r: TMDBSearchResult) => {
        if (!selectedPath) {
            toast.error("Primero elige un archivo sin vincular")
            return
        }
        resolve({ path: selectedPath, targetMediaId: r.id + (r.media_type === "movie" && !r.is_jikan && r.provider !== "jikan" ? 1_000_000 : 0) })
    }

    return (
        <SectionBar
            variant="content"
            id="match-manual"
            label="Coincidencia manual"
            description="Busca en TMDB y asigna títulos a archivos sin vincular."
            icon={IconUiLink}
            badge={
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent-readable border border-brand-accent/25">
                    {files.length === 1 ? "1 pendiente" : `${files.length} pendientes`}
                </span>
            }
            collapsible
            isOpen={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open)
                if (open) refetch()
            }}
        >
            {isOpen ? (
                <div className="p-5 space-y-4">
                    {isLoadingUnlinked ? (
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                            <IconUiSpinner className="w-4 h-4 animate-spin" />
                            Cargando archivos sin vincular…
                        </div>
                    ) : files.length === 0 ? (
                        <p className="text-xs text-on-surface-variant">No hay archivos pendientes: todo está vinculado.</p>
                    ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                            {files.map((f) => (
                                <button
                                    key={f.id || f.path}
                                    type="button"
                                    onClick={() => setSelectedPath(f.path)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl border border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] outline-none focus-visible:ring-2 focus-visible:ring-brand-accent transition-[background-color,border-color,box-shadow,transform] duration-fast ease-out-strong motion-safe:active:scale-[0.97] cursor-pointer text-xs",
                                        selectedPath === f.path
                                            ? "border-brand-accent bg-brand-accent/10 text-label-1"
                                            : "border-[var(--neutral-separator)] bg-[var(--neutral-elev-2)] text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                    )}
                                >
                                    <p className="font-bold truncate">{f.originalTitle || f.path}</p>
                                    <p className="text-xs font-mono text-label-2 truncate mt-0.5">{f.path}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1 min-w-0">
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSearch()
                                }}
                                placeholder="Buscar título en TMDB…"
                                aria-label="Título para buscar en TMDB"
                                className={cn(InputAnatomy.root(), "pr-12")}
                            />
                            {query && (
                                <IconButton
                                    type="button"
                                    intent="ghost"
                                    size="sm"
                                    aria-label="Limpiar búsqueda"
                                    className="absolute right-0 top-1/2 -translate-y-1/2"
                                    icon={<IconUiClose className="size-4" />}
                                    onClick={() => {
                                        setQuery("")
                                        searchRef.current?.focus()
                                    }}
                                />
                            )}
                        </div>
                        <select
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value)}
                            aria-label="Tipo de contenido"
                            className={cn(InputAnatomy.root(), "w-auto shrink-0 cursor-pointer")}
                        >
                            <option value="multi">Todo</option>
                            <option value="tv">Series</option>
                            <option value="movie">Películas</option>
                        </select>
                        <Button
                            intent="primary"
                            size="md"
                            onClick={handleSearch}
                            loading={isSearching}
                            leftIcon={!isSearching ? <IconNavigationSearch className="w-3.5 h-3.5" /> : undefined}
                            iconSpacing="0.375rem"
                        >
                            Buscar
                        </Button>
                    </div>

                    {results.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {results.map((r) => {
                                const img = posterUrl(r.poster_path)
                                return (
                                    <div key={`${r.media_type}-${r.id}`} className="p-3 rounded-xl border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] bg-[var(--neutral-elev-2)] flex gap-3">
                                        {img ? (
                                            <img src={img} alt="" width={44} height={64} className="w-11 h-16 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
                                        ) : (
                                            <div className="w-11 h-16 rounded-lg bg-[var(--neutral-elev-3)] shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-label-1 truncate">{r.title || r.name || `#${r.id}`}</p>
                                            <p className="text-xs text-label-2 mt-0.5">
                                                {r.media_type === "movie" ? "Película" : "Serie"} · {r.vote_average ?? "—"}
                                                {r.is_jikan ? " · Jikan" : ""}
                                            </p>
                                            <div className="flex gap-1.5 mt-2">
                                                <Button
                                                    intent="primary"
                                                    size="xs"
                                                    onClick={() => handleAssign(r)}
                                                    disabled={isAssigning || !selectedPath}
                                                >
                                                    Asignar
                                                </Button>
                                                <Button
                                                    intent="secondary"
                                                    size="xs"
                                                    onClick={() => handleResolve(r)}
                                                    disabled={isResolving || !selectedPath}
                                                    title="Solo guarda el vínculo para el próximo escaneo"
                                                >
                                                    Vincular
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : null}
        </SectionBar>
    )
}
