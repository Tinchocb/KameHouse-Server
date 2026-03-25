import React, { useState } from "react"
import { Modal } from "@/components/ui/modal/modal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useTMDBSearch } from "@/api/hooks/tmdb.hooks"
import { Search, Info, Check, Loader2 } from "lucide-react"
import { SearchResult } from "@/api/generated/types"
import { useServerMutation } from "@/api/client/requests"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { cn } from "@/components/ui/core/styling"

interface MatchDialogProps {
    isOpen: boolean
    onClose: () => void
    initialQuery?: string
    paths: string[]
}

export function MatchDialog({ isOpen, onClose, initialQuery, paths }: MatchDialogProps) {
    const [query, setQuery] = useState(initialQuery || "")
    const queryClient = useQueryClient()
    
    const { mutate: search, data: results, isPending: isSearching } = useTMDBSearch()
    
    const { mutate: assign, isPending: isAssigning } = useServerMutation<any, any>({
        endpoint: "/api/v1/library/local-files/tmdb-assign",
        method: "POST",
        onSuccess: () => {
            toast.success("Media asignado correctamente")
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
            onClose()
        }
    })

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            search({ query, bearerToken: "" })
        }
    }

    const handleAssign = (result: SearchResult | any) => {
        assign({
            tmdbId: result.id,
            paths,
            mediaType: result.media_type === "movie" ? "movie" : "tv"
        })
    }

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title="Asignar Media Manualmente"
            description={
                <div className="space-y-1">
                    <p>Busca el título en TMDB para asociarlo a estos archivos.</p>
                    <div className="text-[10px] font-mono text-zinc-500 truncate bg-white/5 p-1 rounded">
                        {paths.length === 1 ? paths[0] : `${paths.length} archivos seleccionados`}
                    </div>
                </div>
            }
            contentClass="max-w-2xl"
        >
            <div className="space-y-6 mt-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Nombre de la película o serie..."
                            className={cn("pl-10", isAssigning && "opacity-50 cursor-not-allowed")}
                            autoFocus
                            disabled={isAssigning}
                        />
                    </div>
                    <Button type="submit" disabled={isSearching || isAssigning} aria-label="Buscar en TMDB" className={cn((isSearching || isAssigning) && "opacity-50 cursor-not-allowed")}>
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "BUSCAR"}
                    </Button>
                </form>

                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {isSearching && (
                        <div className="flex flex-col items-center py-10 gap-3 text-zinc-500">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="font-bebas tracking-widest animate-pulse">Consultando TMDB...</p>
                        </div>
                    )}

                    {!isSearching && results?.length === 0 && (
                        <div className="py-10 text-center text-zinc-500 border border-dashed border-white/5 rounded-xl">
                            No se encontraron resultados para "{query}"
                        </div>
                    )}

                    {results?.map((result: any) => (
                        <div 
                            key={result.id}
                            className="group relative flex gap-4 p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl transition-all duration-300"
                        >
                            {result.poster_path && (
                                <img 
                                    src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} 
                                    alt={result.name || result.title}
                                    className="w-16 h-24 object-cover rounded-lg shadow-lg"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-lg truncate text-white group-hover:text-primary transition-colors">
                                    {result.name || result.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded uppercase font-black tracking-tighter">
                                        {result.media_type === "tv" ? "SERIE TV" : "PELÍCULA"}
                                    </span>
                                    {result.first_air_date && (
                                        <span className="text-xs text-zinc-500">
                                            {new Date(result.first_air_date).getFullYear()}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-zinc-500 mt-2 line-clamp-2 leading-relaxed italic">
                                    {result.overview}
                                </p>
                            </div>
                            <div className="flex items-center">
                                <Button 
                                    size="sm" 
                                    onClick={() => handleAssign(result)}
                                    disabled={isAssigning || isSearching}
                                    aria-label={`Asignar ${result.name || result.title}`}
                                    className={cn(
                                        "group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-300",
                                        (isAssigning || isSearching) && "opacity-50 cursor-not-allowed pointer-events-none"
                                    )}
                                >
                                    {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : "ASIGNAR"}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    )
}
