import React, { useState } from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
    LucideLink, LucideSearch, LucideAlertTriangle,
    LucideCheck, LucideChevronDown, LucideChevronUp,
    LucideLoader2, LucideFileVideo,
} from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { useGetUnlinkedFiles, useResolveUnlinkedFile } from "@/api/hooks/unlinked.hooks"
import { useTMDBSearch, TMDBResult } from "@/api/hooks/tmdb.hooks"

interface GhostFile {
    id: number
    path: string
    originalTitle: string
    algorithmScore: number
    targetMediaId: number
    userResolved: boolean
    ghostMatchCount: number
}

function useUnlinkedFilesData() {
    const query = useGetUnlinkedFiles()
    return {
        ...query,
        data: query.data as GhostFile[] | undefined,
    }
}

function useResolveUnlinkedFileAction() {
    const mutation = useResolveUnlinkedFile()
    return {
        ...mutation,
        mutate: (variables: { path: string; targetMediaId: number }) => {
            mutation.mutate(variables, {
                onSuccess: () => {
                    toast.success("Archivo vinculado correctamente. Se aplicará en el próximo escaneo.")
                },
                onError: () => {
                    toast.error("Error al vincular el archivo")
                },
            })
        },
    }
}

// ── Components ────────────────────────────────────────────────────────────────

function FileCard({ file }: { file: GhostFile }) {
    const [expanded, setExpanded] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const debounceRef = React.useRef<ReturnType<typeof setTimeout>>()
    const { data: results = [], isFetching } = useTMDBSearch(debouncedQuery)
    const resolve = useResolveUnlinkedFileAction()

    const filename = file.path.split(/[\\/]/).pop() ?? file.path
    const confidence = Math.round(file.algorithmScore * 100)

    const handleSearch = (v: string) => {
        setSearchQuery(v)
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => setDebouncedQuery(v), 450)
    }

    const handleLink = (result: TMDBResult) => {
        resolve.mutate({ path: file.path, targetMediaId: result.id })
        setExpanded(false)
    }

    if (file.userResolved) return null

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="border border-white/10 rounded-none overflow-hidden bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300"
        >
            {/* ─── Header row ─── */}
            <button
                type="button"
                onClick={() => {
                    setExpanded(e => !e)
                    if (!expanded && !debouncedQuery) {
                        // Seed the search with the detected title
                        const base = filename.replace(/\.[^.]+$/, "").split(/\s+\(?\d{4}\)?/)[0]
                        setSearchQuery(base)
                        setDebouncedQuery(base)
                    }
                }}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
            >
                <LucideFileVideo size={18} className="text-zinc-500 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{filename}</p>
                    <p className="text-xs text-zinc-600 truncate">{file.path}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className={cn(
                        "text-xs font-black px-2 py-0.5 border",
                        confidence >= 70 ? "border-white/20 text-white" : "border-zinc-700 text-zinc-500"
                    )}>
                        {confidence}%
                    </span>
                    {expanded ? <LucideChevronUp size={14} className="text-zinc-500" /> : <LucideChevronDown size={14} className="text-zinc-500" />}
                </div>
            </button>

            {/* ─── Expanded search ─── */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-white/[0.05]"
                    >
                        <div className="p-4 space-y-3">
                            {/* Search input */}
                            <div className="relative">
                                <LucideSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="Buscar en TMDB..."
                                    className="w-full bg-white/[0.05] border border-white/10 rounded-none pl-9 pr-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/40 focus:bg-white/[0.08]"
                                />
                                {isFetching && (
                                    <LucideLoader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
                                )}
                            </div>

                            {/* Results */}
                            {results.length > 0 && (
                                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                    {results.slice(0, 8).map(r => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            disabled={resolve.isPending}
                                            onClick={() => handleLink(r)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-none bg-white/[0.03] hover:bg-white/10 border border-transparent hover:border-white/20 transition-all text-left group"
                                        >
                                            {r.poster_path ? (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w92${r.poster_path}`}
                                                    alt=""
                                                    className="w-8 h-12 rounded-none object-cover shrink-0"
                                                />
                                            ) : (
                                                <div className="w-8 h-12 rounded bg-white/[0.05] shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white">
                                                    {r.title ?? r.name}
                                                </p>
                                                <p className="text-xs text-zinc-600">
                                                    {r.media_type === "movie" ? "🎬 Película" : "📺 Serie"} · {(r.release_date ?? r.first_air_date ?? "").slice(0, 4)} · ID: {r.id}
                                                </p>
                                            </div>
                                            <LucideLink size={14} className="text-zinc-600 group-hover:text-white shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {debouncedQuery && !isFetching && results.length === 0 && (
                                <p className="text-xs text-zinc-600 text-center py-3">No se encontraron resultados</p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function UnlinkedFilesPanel() {
    const { data: files = [], isLoading, refetch } = useUnlinkedFilesData()
    const unresolved = files.filter(f => !f.userResolved)

    if (isLoading) return null

    if (unresolved.length === 0) return (
        <div className="flex items-center gap-3 px-5 py-4 rounded-none bg-white/5 border border-white/10">
            <LucideCheck size={16} className="text-white shrink-0" />
            <p className="text-sm text-zinc-300 font-medium">Todos los archivos han sido identificados correctamente.</p>
        </div>
    )

    return (
        <div className="space-y-4">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-none bg-white/5 border border-white/10">
                        <LucideAlertTriangle size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-zinc-200">Archivos sin identificar</p>
                        <p className="text-xs text-zinc-600">{unresolved.length} archivo{unresolved.length !== 1 ? "s" : ""} requieren vinculación manual</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
                >
                    Actualizar
                </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
                Abrí cada archivo, buscá en TMDB y tocá el resultado correcto para vincularlo. El vínculo se aplicará en el próximo escaneo.
            </p>

            {/* ─── File list ─── */}
            <AnimatePresence mode="popLayout">
                {unresolved.map(f => <FileCard key={f.path} file={f} />)}
            </AnimatePresence>
        </div>
    )
}
