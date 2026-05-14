import { Modal } from "@/components/ui/modal"
import { useTMDBSearch } from "@/api/hooks/tmdb.hooks"
import { useAnimeEntryManualMatch } from "@/api/hooks/anime_entries.hooks"
import { useState, useMemo } from "react"
import { Loader2, Film, Tv, Search } from "lucide-react"
import { useDebounce } from "react-use"

interface ManualMatchModalProps {
    isOpen: boolean
    onClose: () => void
    directoryPath?: string
    currentMediaId?: number
}

export function ManualMatchModal({ isOpen, onClose, directoryPath, currentMediaId }: ManualMatchModalProps) {
    const [query, setQuery] = useState("")
    const [searchType, setSearchType] = useState<"multi" | "tv" | "movie">("multi")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    
    useDebounce(() => setDebouncedQuery(query), 500, [query])
    
    const { data: results, isLoading } = useTMDBSearch(debouncedQuery, searchType)
    const { mutateAsync: manualMatch, isPending } = useAnimeEntryManualMatch()
    const [selectedId, setSelectedId] = useState<number | null>(null)

    const handleMatch = async (mediaId: number, mediaType: string) => {
        if (!directoryPath) return
        setSelectedId(mediaId)
        try {
            await manualMatch({
                paths: [directoryPath],
                mediaId,
                mediaType,
            } as any)
            onClose()
        } catch (error) {
            console.error("Failed to match", error)
        } finally {
            setSelectedId(null)
        }
    }

    const isSearchActive = debouncedQuery.length >= 2

    return (
        <Modal 
            open={isOpen} 
            onOpenChange={onClose} 
            title="Fix Match" 
            description="Search for the correct series or movie to link it to your local files."
            contentClass="max-w-2xl bg-[#0B0B0F] text-white border-white/10"
        >
            <div className="mt-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                        type="text"
                        placeholder="Buscar metadatos en TMDB..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-black border border-white/5 pl-12 pr-4 py-4 text-sm focus:border-brand-orange/50 focus:outline-none focus:ring-0 transition-all placeholder:text-zinc-700 font-bold uppercase tracking-widest"
                    />
                </div>

                <div className="flex gap-2 pb-2 border-b border-white/5">
                    {[
                        { id: "multi", label: "TODO", icon: Search },
                        { id: "tv", label: "SERIES", icon: Tv },
                        { id: "movie", label: "PELÍCULAS", icon: Film }
                    ].map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setSearchType(type.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-[0.1em] transition-all border ${
                                searchType === type.id 
                                ? "bg-white text-black border-white" 
                                : "bg-transparent text-zinc-500 border-white/5 hover:border-white/20"
                            }`}
                        >
                            <type.icon className="w-3 h-3" />
                            {type.label}
                        </button>
                    ))}
                </div>

                    <div className="max-h-96 flex flex-col gap-2 overflow-y-auto px-1 py-1">
                        {isLoading ? (
                            <div className="flex h-32 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                            </div>
                        ) : isSearchActive && (!results || results.length === 0) ? (
                            <div className="flex h-32 items-center justify-center text-white/50">
                                No se encontraron resultados.
                            </div>
                        ) : (
                            results?.map((result) => (
                                <div
                                    key={`${result.media_type}-${result.id}`}
                                    className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-6 p-5 bg-zinc-900/30 border border-white/5 hover:border-brand-orange/20 transition-all duration-300"
                                >
                                    {/* Thumbnail */}
                                    <div className="w-24 h-36 shrink-0 bg-black overflow-hidden border border-white/10 group-hover:border-brand-orange/30 transition-colors shadow-2xl">
                                        {result.poster_path ? (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w185${result.poster_path}`}
                                                alt={result.title || result.name}
                                                className="h-full w-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-110"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center opacity-20">
                                                <Search className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Info */}
                                    <div className="flex-1 flex flex-col min-w-0 py-1">
                                        <div className="flex items-center flex-wrap gap-3 mb-2">
                                            <h4 className="text-sm font-black text-white uppercase tracking-widest truncate max-w-[300px]">
                                                {result.title || result.name}
                                            </h4>
                                            {result.vote_average !== undefined && result.vote_average > 0 && (
                                                <div className="px-1.5 py-0.5 bg-brand-orange text-black text-[9px] font-black rounded-[2px] flex items-center gap-1">
                                                    <span className="text-[11px] leading-none">★</span>
                                                    {result.vote_average.toFixed(1)}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
                                            <span className="text-zinc-400">
                                                {result.release_date?.split("-")[0] || result.first_air_date?.split("-")[0] || "????"}
                                            </span>
                                            <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                                            <div className="flex items-center gap-2">
                                                {result.media_type === "movie" ? <Film className="w-3 h-3 text-brand-orange" /> : <Tv className="w-3 h-3 text-brand-orange" />}
                                                <span className="text-zinc-400">
                                                    {result.media_type === "movie" ? "Película" : "Serie"}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed font-medium italic opacity-80 group-hover:opacity-100 transition-opacity">
                                            {result.overview || "No synopsis available for this title."}
                                        </p>
                                    </div>

                                    {/* Action */}
                                    <button
                                        onClick={() => handleMatch(result.id, result.media_type || "multi")}
                                        disabled={isPending || !directoryPath}
                                        className="w-full sm:w-auto mt-4 sm:mt-0 bg-white px-8 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-brand-orange hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                                    >
                                        {isPending && selectedId === result.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "VINCULAR"
                                        )}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
        </Modal>
    )
}
