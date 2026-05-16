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

const FileCard = React.forwardRef<HTMLDivElement, { file: GhostFile }>(function FileCard({ file }, ref) {
    const [expanded, setExpanded] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
    const { data: results = [], isFetching } = useTMDBSearch(debouncedQuery)
    const resolve = useResolveUnlinkedFileAction()

    const filename = file.path.split(/[\\/]/).pop() ?? file.path
    const confidence = Math.round(file.algorithmScore * 100)

    const handleSearch = (v: string) => {
        setSearchQuery(v)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => setDebouncedQuery(v), 450)
    }

    const handleLink = (result: TMDBResult) => {
        resolve.mutate({ path: file.path, targetMediaId: result.id })
        setExpanded(false)
    }

    if (file.userResolved) return null

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="border border-white/5 rounded-none overflow-hidden bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500 group"
        >
            {/* ─── Header row ─── */}
            <button
                type="button"
                onClick={() => {
                    setExpanded(e => !e)
                    if (!expanded && !debouncedQuery) {
                        const base = filename.replace(/\.[^.]+$/, "").split(/\s+\(?\d{4}\)?/)[0]
                        setSearchQuery(base)
                        setDebouncedQuery(base)
                    }
                }}
                className="w-full flex items-center gap-6 px-8 py-6 text-left"
            >
                <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                    <LucideFileVideo size={20} className="text-zinc-500 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-base font-bold text-zinc-200 truncate group-hover:text-white transition-colors">{filename}</p>
                    <p className="text-xs font-mono text-zinc-600 truncate">{file.path}</p>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Confianza</span>
                        <span className={cn(
                            "text-sm font-black px-3 py-1 border font-mono",
                            confidence >= 70 ? "border-primary/40 bg-primary/5 text-primary" : "border-white/10 text-zinc-500"
                        )}>
                            {confidence}%
                        </span>
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition-all">
                        {expanded ? <LucideChevronUp size={18} className="text-zinc-500" /> : <LucideChevronDown size={18} className="text-zinc-500" />}
                    </div>
                </div>
            </button>

            {/* ─── Expanded search ─── */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden border-t border-white/[0.05] bg-black/20"
                    >
                        <div className="p-8 space-y-6">
                            {/* Search input */}
                            <div className="relative">
                                <LucideSearch size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="Buscar en TMDB (Película o Serie)..."
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-none pl-14 pr-6 py-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all"
                                />
                                {isFetching && (
                                    <LucideLoader2 size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
                                )}
                            </div>

                            {/* Results */}
                            {results.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {results.slice(0, 10).map(r => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            disabled={resolve.isPending}
                                            onClick={() => handleLink(r)}
                                            className="w-full flex items-center gap-4 px-4 py-3 rounded-none bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all text-left group/result"
                                        >
                                            <div className="relative shrink-0 overflow-hidden">
                                                {r.poster_path ? (
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w92${r.poster_path}`}
                                                        alt=""
                                                        className="w-12 h-18 rounded-none object-cover transition-transform duration-700 group-hover/result:scale-110"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-18 rounded-none bg-white/5 flex items-center justify-center">
                                                        <LucideFileVideo size={16} className="text-zinc-700" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/result:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <p className="text-sm font-bold text-zinc-200 truncate group-hover/result:text-white">
                                                    {r.title ?? r.name}
                                                </p>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                                    {r.media_type === "movie" ? "🎬 Movie" : "📺 TV Show"} · {(r.release_date ?? r.first_air_date ?? "").slice(0, 4)}
                                                </p>
                                            </div>
                                            <div className="w-8 h-8 rounded-none border border-white/5 flex items-center justify-center opacity-0 group-hover/result:opacity-100 transition-all">
                                                <LucideLink size={14} className="text-white" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {debouncedQuery && !isFetching && results.length === 0 && (
                                <div className="py-12 text-center space-y-3">
                                    <LucideSearch size={32} className="text-zinc-800 mx-auto" />
                                    <p className="text-sm text-zinc-600">No se encontraron resultados para &quot;{debouncedQuery}&quot;</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
})

export function UnlinkedFilesPanel() {
    const { data: files = [], isLoading, refetch } = useUnlinkedFilesData()
    const unresolved = files.filter(f => !f.userResolved)

    if (isLoading) return null

    if (unresolved.length === 0) return (
        <div className="flex items-center gap-6 px-8 py-8 rounded-none bg-white/[0.02] border border-white/5">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                <LucideCheck size={24} />
            </div>
            <div className="space-y-1">
                <p className="text-lg font-bold text-white">Librería Impecable</p>
                <p className="text-sm text-zinc-500 font-medium">Todos los archivos han sido identificados y vinculados correctamente.</p>
            </div>
        </div>
    )

    return (
        <div className="space-y-8">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                        <LucideAlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-white tracking-tighter uppercase font-bebas">FALTA VINCULACIÓN</p>
                        <p className="text-zinc-500 text-sm font-medium">
                            <span className="text-white font-bold">{unresolved.length}</span> archivo{unresolved.length !== 1 ? "s" : ""} requieren atención manual
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white px-6 py-3 transition-all"
                >
                    Refrescar Lista
                </button>
            </div>

            {/* ─── File list ─── */}
            <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                    {unresolved.map(f => <FileCard key={f.path} file={f} />)}
                </AnimatePresence>
            </div>
        </div>
    )
}
