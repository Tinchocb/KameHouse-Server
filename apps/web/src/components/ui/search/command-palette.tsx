import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useGlobalSearch, type GlobalSearchResultItem } from "@/hooks/use-global-search"
import { Link } from "@tanstack/react-router"
import { IconUiSpinner, IconNavigationFilm, IconStatusSparkles } from "@/components/ui/icons";
import { useEffect, useState } from "react"
import { VideoPlayer } from "@/components/video/player"

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const { query, setQuery, results, isLoading, isSearchActive } = useGlobalSearch(open)
    const [playTarget, setPlayTarget] = useState<{ path: string; title: string } | null>(null)

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

    return (
        <>
            <CommandDialog 
                open={open} 
                onOpenChange={setOpen} 
                commandProps={{ 
                    label: "Search Command Palette",
                    className: "bg-zinc-950/85 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border border-white/20 border-t-white/40 border-b-white/10 rounded-3xl overflow-hidden shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_24px_48px_rgba(0,0,0,0.9)]"
                }}
            >
                <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_var(--glow-primary)] animate-pulse" />
                        <CommandInput
                            placeholder="DESCUBRE TU PRÓXIMA SERIE..."
                            className="h-12 sm:h-14 font-display text-lg sm:text-2xl md:text-3xl tracking-widest placeholder:text-zinc-500 bg-transparent border-none focus:ring-0 text-white"
                            value={query}
                            onValueChange={setQuery}
                        />
                    </div>
                </div>
                <CommandList className="max-h-[60vh] md:max-h-[500px] p-4 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-6 animate-in fade-in duration-slow">
                            <div className="relative">
                                <IconUiSpinner className="h-12 w-12 animate-spin text-brand-accent opacity-50" />
                                <div className="absolute inset-0 h-12 w-12 blur-2xl bg-brand-accent/20" />
                            </div>
                            <span className="font-display text-lg tracking-cinema-lg text-on-surface-variant uppercase">Sincronizando Bóveda</span>
                        </div>
                    ) : (
                        <>
                            <CommandEmpty className="py-20 text-center animate-in fade-in zoom-in-95 duration-slow">
                                <p className="font-display text-2xl tracking-display text-on-surface uppercase">Sin coincidencias detectadas</p>
                                <p className="text-label-sm font-black uppercase tracking-cinema-md text-on-surface-variant mt-4 px-10 leading-relaxed">Verifica los términos técnicos o expande los criterios de búsqueda</p>
                            </CommandEmpty>
                            <CommandGroup 
heading={isSearchActive ? "RESULTADOS ENCONTRADOS" : "TENDENCIAS GLOBALES"}
                                className="text-label-sm font-black tracking-cinema-md text-on-surface-variant px-2 pt-2 pb-4 uppercase"
                            >
                                <div className="grid gap-3 mt-2">
                                    {results?.map((res) => {
                                        const result = res as GlobalSearchResultItem
                                        const media = result.media
                                        const title = media?.titleRomaji || media?.titleEnglish || `Desconocido (${result.mediaId})`
                                        
                                        return (
                                            <CommandItem
                                                key={String(result.mediaId)}
                                                value={`${title}-${result.mediaId}`}
                                                onSelect={() => {
                                                    setOpen(false)
                                                    if ("isUnlinked" in result && result.isUnlinked) {
                                                        setPlayTarget({ path: result.path, title })
                                                    }
                                                }}
                                                className="rounded-2xl border border-white/10 hover:border-white/25 border-t-white/20 bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-150 p-0 overflow-hidden group cursor-pointer shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08)]"
                                            >
                                                {"isUnlinked" in result && result.isUnlinked ? (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setOpen(false)
                                                            setPlayTarget({ path: result.path, title })
                                                        }}
                                                        className="flex w-full items-center gap-5 p-3 text-left"
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
                                                ) : "isSemantic" in result && result.isSemantic ? (() => {
                                                    const sem = result.semanticData
                                                    const isMovie = sem.mediaType === "MOVIE" || sem.mediaId >= 1000000
                                                    const linkProps = isMovie
                                                        ? { to: "/movies/$movieId" as const, params: { movieId: String(sem.mediaId) } }
                                                        : { to: "/series/$seriesId" as const, params: { seriesId: String(sem.mediaId) } }

                                                    return (
                                                        <Link {...linkProps} preload="intent" className="flex w-full items-center gap-5 p-3" onClick={() => setOpen(false)}>
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
                                                        const isMovie = media?.format === "MOVIE" || media?.format === "SPECIAL" || media?.format === "OVA" || (Number(result.mediaId) >= 1000000)
                                                        const linkProps = isMovie 
                                                            ? { to: "/movies/$movieId" as const, params: { movieId: result?.mediaId?.toString() || "0" } }
                                                            : { to: "/series/$seriesId" as const, params: { seriesId: result?.mediaId?.toString() || "0" } }

                                                        return (
                                                            <Link {...linkProps} preload="intent" className="flex w-full items-center gap-5 p-3" onClick={() => setOpen(false)}>
                                                                <div
                                                                    className="h-20 w-14 flex-shrink-0 rounded-lg bg-cover bg-center shadow-elevation-1 border border-outline-variant/50 group-hover:scale-105 transition-transform duration-base bg-surface-variant flex items-center justify-center overflow-hidden relative"
                                                                    style={media?.posterImage ? { backgroundImage: `url(${media.posterImage})` } : {}}
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    {!media?.posterImage && <span className="text-label-sm font-black opacity-20 uppercase tracking-tighter">NO COVER</span>}
                                                                </div>
                                                                <div className="flex flex-col overflow-hidden text-left py-1">
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
                                                                        {media && "score" in media && media.score !== undefined && media.score > 0 && (
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
            </CommandDialog>

            {playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType="direct"
                    episodeLabel={playTarget.title}
                    onClose={() => setPlayTarget(null)}
                />
            )}
        </>
    )
}

