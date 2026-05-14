import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useGlobalSearch } from "@/hooks/use-global-search"
import { Link } from "@tanstack/react-router"
import { Loader2, FileVideo } from "lucide-react"
import { useEffect, useState } from "react"
import { VideoPlayer } from "@/components/video/player"

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const { query, setQuery, results, isLoading, isSearchActive } = useGlobalSearch()
    const [playTarget, setPlayTarget] = useState<{ path: string; title: string } | null>(null)

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    return (
        <>
            <CommandDialog 
                open={open} 
                onOpenChange={setOpen} 
                commandProps={{ 
                    label: "Search Command Palette",
                    className: "glass-panel-premium border-white/5 shadow-[0_32px_128px_rgba(0,0,0,0.8)]"
                }}
            >
                <div className="p-2 border-b border-white/[0.02] bg-white/[0.01]">
                    <CommandInput
                        placeholder="DESCUBRE TU PRÓXIMA SERIE..."
                        className="h-14 font-bebas text-2xl tracking-widest placeholder:text-zinc-700 bg-transparent border-none focus:ring-0"
                        value={query}
                        onValueChange={setQuery}
                    />
                </div>
                <CommandList className="max-h-[60vh] md:max-h-[450px] p-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex h-48 flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                            <div className="relative">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <div className="absolute inset-0 h-10 w-10 blur-xl bg-primary/20" />
                            </div>
                            <span className="font-bebas text-sm tracking-[0.3em] text-zinc-600">Sincronizando Archivos</span>
                        </div>
                    ) : (
                        <>
                            <CommandEmpty className="py-12 text-center">
                                <p className="font-bebas text-xl tracking-widest text-zinc-600">SIN RESULTADOS EN LA BÓVEDA</p>
                                <p className="text-[10px] font-black uppercase tracking-tighter text-zinc-800 mt-2">Intenta con otros términos técnicos</p>
                            </CommandEmpty>
                            <CommandGroup 
                                heading={isSearchActive ? "RESULTADOS DE BÚSQUEDA" : "TENDENCIAS ACTUALES"}
                                className="text-[10px] font-black tracking-[0.2em] text-zinc-600 px-2 pt-4 pb-2"
                            >
                                <div className="grid gap-2 mt-2">
                                    {results?.map((result: any) => {
                                        const media = result.media
                                        const title = media?.titleRomaji || media?.titleEnglish || `Desconocido (${result.mediaId})`
                                        
                                        return (
                                            <CommandItem 
                                                key={String(result.mediaId)} 
                                                value={title} 
                                                onSelect={() => {
                                                    setOpen(false)
                                                    if (result.isUnlinked) {
                                                        setPlayTarget({ path: result.path, title })
                                                    }
                                                }}
                                                className="rounded-xl border border-transparent hover:border-white/5 hover:bg-white/[0.03] transition-all duration-300 p-0 overflow-hidden group"
                                            >
                                                {result.isUnlinked ? (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setOpen(false)
                                                            setPlayTarget({ path: result.path, title })
                                                        }}
                                                        className="flex w-full items-center gap-4 p-2 text-left"
                                                    >
                                                        <div className="h-16 w-12 flex-shrink-0 rounded-lg shadow-lg border border-white/5 group-hover:scale-105 transition-transform bg-brand-orange/10 flex items-center justify-center overflow-hidden">
                                                            <FileVideo className="h-6 w-6 text-brand-orange" />
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden text-left py-1 min-w-0">
                                                            <span className="truncate text-[15px] font-bold text-zinc-200 group-hover:text-brand-orange transition-colors" title={title}>
                                                                {title}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-black uppercase tracking-tighter text-brand-orange shrink-0">
                                                                    ARCHIVO HUÉRFANO
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-zinc-800 shrink-0" />
                                                                <span className="text-[10px] font-bold text-zinc-600 uppercase truncate">
                                                                    {result.path}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <Link to="/series/$seriesId" params={{ seriesId: result.mediaId.toString() }} className="flex w-full items-center gap-4 p-2">
                                                        <div
                                                            className="h-16 w-12 flex-shrink-0 rounded-lg bg-cover bg-center shadow-lg border border-white/5 group-hover:scale-105 transition-transform bg-zinc-900 flex items-center justify-center overflow-hidden"
                                                            style={media?.posterImage ? { backgroundImage: `url(${media.posterImage})` } : {}}
                                                        >
                                                            {!media?.posterImage && <span className="text-[8px] font-black opacity-20 uppercase">NO COVER</span>}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden text-left py-1">
                                                            <span className="truncate text-[15px] font-bold text-zinc-200 group-hover:text-primary transition-colors" title={title}>
                                                                {title}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-500">
                                                                    {media?.year || "N/A"}
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                                <span className="text-[10px] font-bold text-zinc-600 uppercase">
                                                                    {media?.format || "LOCAL"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )}
                                            </CommandItem>
                                        )
                                    })}
                                </div>
                            </CommandGroup>
                        </>
                    )}
                </CommandList>
            </CommandDialog>

            {playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.path.toLowerCase().endsWith(".mp4") ? "direct" : "transcode"}
                    episodeLabel={playTarget.title}
                    onClose={() => setPlayTarget(null)}
                />
            )}
        </>
    )
}

