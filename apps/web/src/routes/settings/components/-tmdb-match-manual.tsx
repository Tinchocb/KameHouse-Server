import React, { useState } from "react"
import { useGetUnlinkedFiles } from "@/api/hooks/unlinked.hooks"
import {
    useResolveUnlinkedFile,
    useTMDBAssign,
    useTMDBSearch,
    type TMDBSearchResult,
} from "@/api/hooks/tmdb-search.hooks"
import { SectionBar } from "@/components/ui/sectionbar"
import { IconUiLink, IconNavigationSearch, IconUiSpinner } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { toast } from "sonner"
export { MATCH_PRESELECT_KEY } from "@/lib/match-preselect"
import { MATCH_PRESELECT_KEY } from "@/lib/match-preselect"

function posterUrl(path?: string) {
    if (!path) return null
    if (path.startsWith("http")) return path
    return `https://image.tmdb.org/t/p/w342${path}`
}

export function TmdbMatchManual() {
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
                onError: (err) => toast.error(err instanceof Error ? err.message : "Búsqueda fallida"),
            }
        )
    }

    const handleAssign = (r: TMDBSearchResult) => {
        if (!selectedPath) {
            toast.error("Selecciona primero un archivo no vinculado")
            return
        }
        const mediaType = r.media_type === "movie" ? "movie" : "tv"
        assign({ paths: [selectedPath], tmdbId: r.id, mediaType })
    }

    const handleResolve = (r: TMDBSearchResult) => {
        if (!selectedPath) {
            toast.error("Selecciona primero un archivo no vinculado")
            return
        }
        resolve({ path: selectedPath, targetMediaId: r.id })
    }

    return (
        <SectionBar
            id="match-manual"
            label="Match Manual / No Vinculados"
            description="Busca en TMDB y asigna títulos a archivos sin vincular."
            icon={IconUiLink}
            badge={
                <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent border border-brand-accent/25">
                    {files.length} pendientes
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
                            Cargando no vinculados...
                        </div>
                    ) : files.length === 0 ? (
                        <p className="text-xs text-on-surface-variant">Sin archivos pendientes. Todo vinculado.</p>
                    ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                            {files.map((f) => (
                                <button
                                    key={f.id || f.path}
                                    type="button"
                                    onClick={() => setSelectedPath(f.path)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl border transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out text-xs",
                                        selectedPath === f.path
                                            ? "border-brand-accent bg-brand-accent/10 text-white"
                                            : "border-white/10 bg-white/[0.02] text-on-surface hover:border-white/25"
                                    )}
                                >
                                    <p className="font-bold truncate">{f.originalTitle || f.path}</p>
                                    <p className="text-3xs font-mono text-on-surface-variant/70 truncate mt-0.5">{f.path}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSearch()
                            }}
                            placeholder="Buscar título en TMDB..."
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-brand-accent/60 min-h-[40px]"
                        />
                        <select
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value)}
                            className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white min-h-[40px]"
                        >
                            <option value="multi">Todo</option>
                            <option value="tv">Series</option>
                            <option value="movie">Películas</option>
                        </select>
                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="px-4 py-2.5 rounded-xl bg-brand-accent text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 min-h-[40px]"
                        >
                            {isSearching ? <IconUiSpinner className="w-3.5 h-3.5 animate-spin" /> : <IconNavigationSearch className="w-3.5 h-3.5" />}
                            Buscar
                        </button>
                    </div>

                    {results.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {results.map((r) => {
                                const img = posterUrl(r.poster_path)
                                return (
                                    <div key={`${r.media_type}-${r.id}`} className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex gap-3">
                                        {img ? (
                                            <img src={img} alt="" className="w-11 h-16 rounded-lg object-cover shrink-0" loading="lazy" />
                                        ) : (
                                            <div className="w-11 h-16 rounded-lg bg-white/5 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{r.title || r.name || `#${r.id}`}</p>
                                            <p className="text-3xs font-mono text-on-surface-variant/70 mt-0.5">
                                                {r.media_type?.toUpperCase() || "TV"} · {r.vote_average ?? "—"}
                                                {r.is_jikan ? " · JIKAN" : ""}
                                            </p>
                                            <div className="flex gap-1.5 mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAssign(r)}
                                                    disabled={isAssigning || !selectedPath}
                                                    className="px-2.5 py-1.5 rounded-lg bg-brand-accent text-on-primary text-3xs font-bold active:scale-95 disabled:opacity-50"
                                                >
                                                    Asignar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleResolve(r)}
                                                    disabled={isResolving || !selectedPath}
                                                    title="Solo guarda el vínculo para el próximo escaneo"
                                                    className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-3xs font-bold text-on-surface-variant hover:text-white active:scale-95 disabled:opacity-50"
                                                >
                                                    Vincular
                                                </button>
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
