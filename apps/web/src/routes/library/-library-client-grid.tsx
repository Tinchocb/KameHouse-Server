"use client"

import React, { useMemo, useState, memo } from "react"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetLocalFilesInfinite } from "@/api/hooks/localfiles.hooks"
import { MediaCard } from "@/components/ui/media-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs/tabs"
import { Anime_LocalFile, Models_LibraryMedia, Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { VirtualizedMediaGrid } from "@/components/shared/virtualized-media-grid"
import { MediaGridSkeleton } from "@/components/shared/media-grid-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Search, Filter, Loader2, FileVideo, ChevronRight, Zap } from "lucide-react"
import { cn } from "@/components/ui/core/styling"

function getTitle(media: Models_LibraryMedia | null | undefined): string {
    return media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Desconocido"
}

// ─── Speed lines SVG ────────────────────────────────────

function SpeedLines({ opacity = 0.04 }: { opacity?: number }) {
    return (
        <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ opacity }}
            viewBox="0 0 900 320"
            preserveAspectRatio="xMidYMid slice"
        >
            {Array.from({ length: 32 }).map((_, i) => {
                const angle = (i / 32) * 360
                const rad = (angle * Math.PI) / 180
                return (
                    <line
                        key={i}
                        x1="450" y1="160"
                        x2={450 + Math.cos(rad) * 1400}
                        y2={160 + Math.sin(rad) * 1400}
                        stroke="white"
                        strokeWidth={i % 4 === 0 ? "1.5" : "0.6"}
                    />
                )
            })}
        </svg>
    )
}

// ─── Halftone dot pattern ─────────────────────────────────────────────────────

function HalftoneDots() {
    return (
        <svg
            aria-hidden
            className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
        >
            <defs>
                <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="6" cy="6" r="1.5" fill="white" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LibraryClientGrid() {
    const [searchQuery, setSearchQuery] = useState("")

    const {
        data: libraryData,
        isLoading: libLoading,
        isError: libError,
        error: libErrorData,
        refetch: libRefetch,
    } = useGetLibraryCollection()

    const {
        data: localInfiniteData,
        isLoading: locLoading,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useGetLocalFilesInfinite()

    const localData = useMemo(() => {
        const items = localInfiniteData?.pages.flatMap(p => p.items) || []
        if (!searchQuery) return items
        return items.filter(f => {
            const parseData: any = f.parsedInfo || (f as any).Parsed || (f as any).parsedData || {}
            const title = parseData.title || parseData.Title || (f as any).name || ""
            return title.toLowerCase().includes(searchQuery.toLowerCase())
        })
    }, [localInfiniteData, searchQuery])

    const lists = libraryData?.lists || []

    const currentlyWatching = useMemo(() => {
        const entries = lists.find(l => l.status === "CURRENT")?.entries || []
        if (!searchQuery) return entries
        return entries.filter(e => getTitle(e.media).toLowerCase().includes(searchQuery.toLowerCase()))
    }, [lists, searchQuery])

    const planned = useMemo(() => {
        const entries = lists.find(l => l.status === "PLANNING")?.entries || []
        if (!searchQuery) return entries
        return entries.filter(e => getTitle(e.media).toLowerCase().includes(searchQuery.toLowerCase()))
    }, [lists, searchQuery])

    const completed = useMemo(() => {
        const entries = lists.find(l => l.status === "COMPLETED")?.entries || []
        if (!searchQuery) return entries
        return entries.filter(e => getTitle(e.media).toLowerCase().includes(searchQuery.toLowerCase()))
    }, [lists, searchQuery])

    const renderGrid = (entries: Anime_LibraryCollectionEntry[], emptyMessage: string) => (
        <VirtualizedMediaGrid entries={entries} emptyMessage={emptyMessage} />
    )

    if (libError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center animate-in fade-in duration-700 px-6">
                <div className="text-6xl font-black text-primary opacity-20">!</div>
                <div className="space-y-2">
                    <h2 className="font-bebas text-3xl tracking-widest text-primary">CONEXIÓN INTERRUMPIDA</h2>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto uppercase tracking-tighter">
                        {(libErrorData as any)?.message || "No se pudo sincronizar la colección con el núcleo central."}
                    </p>
                </div>
                <button 
                    className="px-8 py-2.5 rounded-full border border-primary text-primary font-bebas tracking-[0.2em] text-sm hover:bg-primary hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.15)] active:scale-95"
                    onClick={() => libRefetch()}
                >
                    REINTENTAR ACCESO
                </button>
            </div>
        )
    }

    return (
        <div className="flex-1 w-full min-h-screen bg-background text-zinc-200 font-sans selection:bg-primary/30 pb-32">
            <Tabs defaultValue="current">
                {/* ── Hero ── */}
                <div className="relative overflow-hidden pt-20 pb-16 px-6 md:px-14 border-b border-white/[0.03]">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-rose-600/[0.02] pointer-events-none" />
                    <SpeedLines opacity={0.03} />
                    <HalftoneDots />

                    <div className="relative z-10 max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-10">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-700">
                                <div className="h-[2px] w-10 bg-primary shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/90">Gestión de Archivos</span>
                            </div>
                            
                            <h1 className="font-bebas text-7xl md:text-9xl leading-[0.8] tracking-[0.02em] text-white animate-in fade-in slide-in-from-left-8 duration-1000">
                                MI<br />
                                <span className="text-transparent stroke-text opacity-30">BIBLIO</span>TECA
                            </h1>

                            <div className="flex flex-wrap items-center gap-10 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                                <StatItem count={currentlyWatching.length} label="Viendo" active />
                                <div className="hidden sm:block w-[1px] h-10 bg-white/5" />
                                <StatItem count={planned.length} label="Planeado" />
                                <div className="hidden sm:block w-[1px] h-10 bg-white/5" />
                                <StatItem count={completed.length} label="Completado" />
                            </div>
                        </div>

                        {/* Search Wrapper */}
                        <div className="relative w-full md:w-80 group animate-in fade-in slide-in-from-right-4 duration-1000 delay-500">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                            <input
                                className="w-full pl-12 pr-5 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.06] border border-white/5 focus:border-primary/40 rounded-xl text-sm font-bold tracking-wide outline-none transition-all duration-300 placeholder:text-zinc-700"
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="LOCALIZAR TÍTULO..."
                            />
                            {/* Japanese Accent decoration */}
                            <div className="absolute -bottom-1 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                        </div>
                    </div>

                    {/* Vertical JP decoration */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] font-black text-[10px] tracking-[0.5em] text-zinc-800 uppercase pointer-events-none select-none">
                        BIBLIOTECA · COLECCIÓN · ARCHIVOS
                    </div>
                </div>

                {/* ── Tab Navigation ── */}
                <div className="sticky top-0 z-40 glass-panel-premium border-b border-white/[0.03] backdrop-blur-3xl">
                    <div className="max-w-[1400px] mx-auto px-6 md:px-14">
                        <TabsList className="bg-transparent h-auto p-0 rounded-none w-full justify-start overflow-x-auto no-scrollbar scroll-smooth">
                            <TabTrigger value="current" label="VIENDO" count={currentlyWatching.length} />
                            <TabTrigger value="planned" label="PLANEADO" count={planned.length} />
                            <TabTrigger value="completed" label="COMPLETADO" count={completed.length} />
                            <TabTrigger value="local" label="LOCALES" />
                        </TabsList>
                    </div>
                </div>

                {/* ── Content Area ── */}
                <div className="max-w-[1400px] mx-auto px-6 md:px-14 mt-10">
                    <TabsContent value="current" className="m-0 focus-visible:outline-none">
                        {libLoading ? <LoadingGrid /> : renderGrid(currentlyWatching, "No estás viendo nada en este momento.")}
                    </TabsContent>

                    <TabsContent value="planned" className="m-0 focus-visible:outline-none">
                        {libLoading ? <LoadingGrid /> : renderGrid(planned, "Tu lista de deseos está vacía.")}
                    </TabsContent>

                    <TabsContent value="completed" className="m-0 focus-visible:outline-none">
                        {libLoading ? <LoadingGrid /> : renderGrid(completed, "Aún no has terminado ninguna serie.")}
                    </TabsContent>

                    <TabsContent value="local" className="m-0 focus-visible:outline-none">
                        {locLoading ? (
                            <LoadingGrid />
                        ) : !localData.length ? (
                            <EmptyState
                                title="Bóveda vacía"
                                message="No se han detectado archivos de video locales. Verifica tus carpetas de escaneo."
                                illustration={<FileVideo className="w-16 h-16 text-zinc-800" />}
                            />
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
                                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-6 gap-y-10">
                                    {localData.map((file, idx) => (
                                        <LocalFileCard key={file.path || idx} file={file} />
                                    ))}
                                </div>
                                
                                {hasNextPage && (
                                    <div className="flex justify-center mt-20 mb-10">
                                        <button
                                            className="group relative px-10 py-3 bg-white/[0.03] hover:bg-primary border border-white/5 hover:border-primary rounded-xl overflow-hidden transition-all duration-300"
                                            onClick={() => fetchNextPage()}
                                            disabled={isFetchingNextPage}
                                        >
                                            <div className="relative z-10 flex items-center gap-3">
                                                {isFetchingNextPage ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Zap className="w-4 h-4" />
                                                )}
                                                <span className="font-bebas text-lg tracking-widest text-zinc-400 group-hover:text-white transition-colors">
                                                    {isFetchingNextPage ? "Sincronizando..." : "Cargar más fragmentos"}
                                                </span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>

            <style>{`
                .stroke-text {
                    -webkit-text-stroke: 1.5px white;
                }
            `}</style>
        </div>
    )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatItem = memo(function StatItem({ count, label, active }: { count: number; label: string; active?: boolean }) {
    return (
        <div className="flex flex-col">
            <span className={cn(
                "font-bebas text-4xl leading-none",
                active ? "text-primary drop-shadow-[0_0_12px_rgba(249,115,22,0.4)]" : "text-white"
            )}>
                {count.toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mt-1">{label}</span>
        </div>
    )
})

const TabTrigger = memo(function TabTrigger({ value, label, count }: { value: string; label: string; count?: number }) {
    return (
        <TabsTrigger 
            value={value} 
            className="group relative h-16 px-8 rounded-none border-none bg-transparent data-[state=active]:bg-transparent transition-all duration-500"
        >
            <div className="flex items-center gap-3">
                <span className="font-bebas text-lg tracking-[0.15em] text-zinc-500 group-hover:text-zinc-300 group-data-[state=active]:text-white transition-colors">
                    {label}
                </span>
                {count !== undefined && (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 text-[10px] font-black text-zinc-600 group-data-[state=active]:bg-primary/10 group-data-[state=active]:border-primary/20 group-data-[state=active]:text-primary transition-all duration-300 tabular-nums">
                        {count}
                    </span>
                )}
            </div>
            {/* Active Indicator Line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary scale-x-0 group-data-[state=active]:scale-x-100 origin-center transition-transform duration-500 ease-out-expo shadow-[0_-4px_12px_rgba(249,115,22,0.4)]" />
        </TabsTrigger>
    )
})

const LoadingGrid = () => (
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-6 gap-y-10">
        {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="space-y-3 animate-pulse">
                <div className="aspect-[2/3] w-full bg-white/[0.03] rounded-lg border border-white/5" />
                <div className="h-4 w-3/4 bg-white/[0.02] rounded" />
                <div className="h-3 w-1/2 bg-white/[0.01] rounded" />
            </div>
        ))}
    </div>
)

const LocalFileCard = memo(function LocalFileCard({ file }: { file: Anime_LocalFile }) {
    const parseData: any = file.parsedInfo || (file as any).Parsed || (file as any).parsedData || {}
    const title = parseData.title || parseData.Title || (file as any).name || "Archivo genérico"
    
    return (
        <div className="flex flex-col gap-3 group">
            <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden glass-panel border border-white/5 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 group-hover:scale-[1.03] transition-transform duration-500 shadow-xl">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:scale-110 group-hover:border-primary/30 transition-all duration-500">
                        <FileVideo className="w-8 h-8 text-zinc-700 group-hover:text-primary transition-colors" />
                    </div>
                    <span className="font-bebas text-lg tracking-[0.2em] text-zinc-800 group-hover:text-zinc-700 transition-colors">LOCAL FILE</span>
                </div>
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 border border-white/5 backdrop-blur-md text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                    {file.path?.split('.').pop()?.toUpperCase() || "RAW"}
                </div>
            </div>
            <div className="px-1 space-y-1">
                <h3 className="text-[12px] font-bold text-zinc-400 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                    {title}
                </h3>
                <div className="flex items-center gap-2 opacity-50">
                    <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500">
                        {file.path?.split('.').pop()?.toUpperCase() || "MP4"}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                    <span className="text-[9px] font-bold text-zinc-600 truncate max-w-[80px]">{file.path?.split(/[\\/]/).pop()}</span>
                </div>
            </div>
        </div>
    )
})