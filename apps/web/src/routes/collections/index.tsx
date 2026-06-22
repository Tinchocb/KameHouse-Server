import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaSearch, FaPlay, FaListOl, FaLayerGroup } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetMediaCollections, fetchMediaCollections } from "@/api/hooks/collections.hooks"
import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { HeroSection } from "@/components/shared/hero-section"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { getMediumResImage } from "@/lib/helpers/images"

export const Route = createFileRoute("/collections/")({
    loader: ({ context }) => {
        const qc = context.queryClient
        Promise.all([
            qc.prefetchQuery({
                queryKey: ["collections-list"],
                queryFn: fetchMediaCollections,
            }),
            qc.prefetchQuery({
                queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
                queryFn: fetchLibraryCollection,
            })
        ])
        return { dehydrateState: dehydrate(qc) }
    },
    component: CollectionsPageWrapper,
})

function CollectionsPageWrapper() {
    const { dehydrateState } = Route.useLoaderData()
    return (
        <HydrationBoundary state={dehydrateState}>
            <CollectionsPage />
        </HydrationBoundary>
    )
}

const SPINE_W = 52
const CASSETTE_W = 220
const CASSETTE_H = 330
const OVERLAP = 80

function CollectionsPage() {
    const [search, setSearch] = useState("")
    const navigate = useNavigate()
    const { data: collections = [], isLoading } = useGetMediaCollections()
    const { data: library } = useGetLibraryCollection()

    const libraryEntries = useMemo(() => {
        if (!library?.lists) return []
        return library.lists.flatMap(list => list.entries || [])
    }, [library])

    const filtered = useMemo(() => {
        return collections.filter(c => {
            const matchesSearch = search
                ? c.name.toLowerCase().includes(search.toLowerCase()) ||
                  (c.overview || "").toLowerCase().includes(search.toLowerCase())
                : true
            return matchesSearch
        })
    }, [collections, search])

    const enrichedCollections = useMemo(() => {
        if (!filtered.length) return []
        
        // Build a fast lookup map of mediaId to its library stats
        const libraryMap = new Map<number, { isLocal: boolean; isWatched: boolean }>()
        libraryEntries.forEach(entry => {
            if (entry.mediaId) {
                const isLocal = (entry.libraryData?.mainFileCount || 0) > 0
                const isWatched = !!(entry.media?.watched || (entry.listData?.progress || 0) >= (entry.media?.totalEpisodes || 0))
                libraryMap.set(entry.mediaId, { isLocal, isWatched })
            }
        })

        return filtered.map(c => {
            const memberIds = c.memberIds || []
            const totalMembers = memberIds.length
            let localMembers = 0
            let watchedMembers = 0
            
            memberIds.forEach(mId => {
                const stats = libraryMap.get(mId)
                if (stats) {
                    if (stats.isLocal) localMembers++
                    if (stats.isWatched) watchedMembers++
                }
            })

            return {
                ...c,
                totalMembers,
                localMembers,
                watchedMembers,
            }
        })
    }, [filtered, libraryEntries])

    const handleNavigate = (id: number) => {
        navigate({ to: "/collections/$id", params: { id: String(id) } })
    }

    return (
        <div className="flex-1 w-full min-h-screen bg-transparent text-white overflow-hidden font-sans selection:bg-primary/30">
            {/* Page Header */}
            <HeroSection
                title={<>SAGAS<br /><span className="text-transparent stroke-text opacity-20">UNIFICADAS</span></>}
                subtitle="Universos cinematográficos y cronologías completas unificadas en un solo archivo."
                decorationTag="Cronologías Maestras"
                verticalTag="UNIVERSOS · SAGAS · CRONOLOGÍAS"
                count={isLoading ? "..." : collections.length}
                countLabel="Sagas"
            />

            {/* Controls */}
            <div className="sticky top-0 z-30 bg-[#0b0f19]/80 border-b border-white/[0.04] backdrop-blur-2xl">
                <div className="px-8 md:px-16 py-3 flex flex-wrap gap-4 items-center justify-between">
                    {/* Search */}
                    <div className="relative group">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors text-xs" />
                        <input
                            className="pl-10 pr-4 py-2 bg-black hover:bg-zinc-900 border border-white/10 focus:border-white rounded-none text-sm outline-none transition-all duration-200 placeholder:text-zinc-700 w-64"
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="BUSCAR FRANQUICIAS..."
                        />
                    </div>
                </div>
            </div>

            {/* Cassette Shelf */}
            <div className="relative w-full overflow-hidden min-h-[450px] flex items-center justify-center">
                {isLoading && collections.length === 0 ? (
                    <ShelfSkeleton />
                ) : enrichedCollections.length === 0 ? (
                    <div className="px-16 py-24 w-full">
                        <EmptyState
                            title="No hay colecciones"
                            message={search ? "No hemos encontrado colecciones que coincidan con tu búsqueda." : "Aún no se han descubierto colecciones cinematográficas. Escanea películas en tu biblioteca para poblarlas."}
                            illustration={<FaLayerGroup className="w-20 h-20 text-zinc-800" />}
                        />
                    </div>
                ) : (
                    <div
                        className="flex flex-nowrap items-end overflow-x-auto no-scrollbar py-20 px-16 w-full justify-start md:justify-center"
                        style={{ perspective: "2400px" }}
                    >
                        {enrichedCollections.map((coll, idx) => (
                            <CollectionCassette
                                key={coll.id}
                                coll={coll}
                                idx={idx}
                                onNavigate={handleNavigate}
                            />
                        ))}
                        {/* Spacer to allow scrolling */}
                        <div className="shrink-0 w-32" />
                    </div>
                )}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    )
}

interface CollectionCassetteProps {
    coll: {
        id: number
        tmdbCollectionId: number
        name: string
        overview?: string
        posterPath?: string
        backdropPath?: string
        memberIds?: number[]
        totalMembers: number
        localMembers: number
        watchedMembers: number
    }
    idx: number
    onNavigate: (id: number) => void
}

const CollectionCassette = memo(function CollectionCassette({
    coll, idx, onNavigate
}: CollectionCassetteProps) {
    const count = coll.memberIds?.length || 0
    const { totalMembers, localMembers, watchedMembers } = coll

    const isFullyWatched = totalMembers > 0 && watchedMembers === totalMembers
    const isFullyLocal = totalMembers > 0 && localMembers === totalMembers

    const accentStripeClass = cn(
        "absolute left-0 inset-y-0 w-1 transition-[background-color,box-shadow] duration-300",
        isFullyWatched 
            ? "bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]" 
            : isFullyLocal 
                ? "bg-brand-orange shadow-[0_0_8px_rgba(255,107,0,0.6)]" 
                : "bg-yellow-500"
    )

    const stateColorClass = isFullyWatched 
        ? "text-[#10b981]" 
        : isFullyLocal 
            ? "text-brand-orange" 
            : "text-yellow-500"

    return (
        <div
            className={cn(
                "group/item relative shrink-0 hover:z-[9999]"
            )}
            style={{
                marginLeft: idx !== 0 ? -OVERLAP : 0,
                zIndex: idx,
            }}
        >
            {/* 3D wrapper */}
            <div
                className="relative [transform-style:preserve-3d] [transform:rotateY(35deg)] group-hover/item:[transform:rotateY(0deg)_translateZ(80px)_translateY(-30px)]"
                style={{
                    width: CASSETTE_W + SPINE_W,
                    height: CASSETTE_H,
                    willChange: "transform",
                    transition: "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            >
                {/* Spine */}
                <div
                    className="absolute inset-y-0 left-0 flex flex-col justify-between overflow-hidden border border-white/20 bg-black"
                    style={{
                        width: SPINE_W,
                    }}
                >
                    {/* Accent stripe */}
                    <div className={accentStripeClass} />
                    
                    {/* Size badge */}
                    <div className="mt-4 ml-4 flex items-center gap-1">
                        <FaLayerGroup className={cn("text-[8px] transition-colors", stateColorClass)} />
                        <span className="text-[9px] font-black tabular-nums text-zinc-400">{count} PARTES</span>
                    </div>

                    {/* Title rotated */}
                    <span
                        className="flex-1 text-[10px] font-black text-zinc-300 tracking-widest whitespace-nowrap px-2 py-4 uppercase"
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", textOverflow: "ellipsis", overflow: "hidden" }}
                    >
                        {coll.name}
                    </span>

                    {/* Footer decoration */}
                    <div className="mb-3 ml-3 flex items-center justify-center">
                        <span className="text-[8px] font-black text-zinc-700 tracking-wider">SAGA</span>
                    </div>
                </div>

                {/* Cover */}
                <div
                    className="absolute inset-y-0 right-0 overflow-hidden border border-white/20 cursor-pointer bg-black"
                    style={{ left: SPINE_W }}
                    onClick={() => onNavigate(coll.tmdbCollectionId)}
                >
                    {/* Poster */}
                    <DeferredImage
                        src={getMediumResImage(coll.posterPath || "")}
                        alt={coll.name}
                        className="w-full h-full object-cover grayscale group-hover/item:grayscale-0"
                        style={{
                            transition: "filter 600ms cubic-bezier(0.16, 1, 0.3, 1)",
                            willChange: "filter",
                        }}
                    />

                    {/* Dark gradient base */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                    {/* Hover info overlay */}
                    <div 
                        className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 group-hover/item:opacity-100 bg-black/95"
                        style={{
                            transition: "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                            willChange: "opacity",
                        }}
                    >
                        
                        {/* Sello Retro SAGA COMPLETADA */}
                        {isFullyWatched && (
                            <div className="absolute top-5 right-5 z-20 pointer-events-none select-none transition-all duration-500 rotate-[-12deg] scale-100">
                                <span className="block px-2 py-1 border border-[#10b981]/50 text-[#10b981] text-[8px] font-black uppercase tracking-widest rounded bg-[#10b981]/5 backdrop-blur-sm shadow-[0_4px_10px_rgba(16,185,129,0.15)]">
                                    COMPLETADA
                                </span>
                            </div>
                        )}

                        {/* Play CTA */}
                        <button
                            onClick={() => onNavigate(coll.tmdbCollectionId)}
                            className="mb-6 w-full flex items-center justify-center gap-2 py-3 font-black text-[11px] uppercase tracking-[0.2em] text-black bg-yellow-500 hover:bg-yellow-400 transition-all duration-200"
                        >
                            <FaPlay className="text-[10px]" />
                            Explorar saga
                        </button>

                        {/* Title */}
                        <h3 className="text-[16px] font-black text-white leading-tight mb-3 uppercase tracking-tight line-clamp-2">
                            {coll.name}
                        </h3>

                        {/* Library Stats */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            <span className="flex items-center gap-1 text-[8px] font-black px-2 py-1 bg-zinc-800 text-zinc-300 uppercase tracking-widest border border-white/5">
                                <FaListOl className="text-[7px]" /> {count} PARTES
                            </span>
                            {localMembers > 0 && (
                                <span className={cn(
                                    "flex items-center gap-1 text-[8px] font-black px-2 py-1 uppercase tracking-widest border transition-all duration-300",
                                    isFullyLocal
                                        ? "bg-[#ff6b00]/10 text-brand-orange border-brand-orange/30 shadow-[0_0_8px_rgba(255,107,0,0.15)]"
                                        : "bg-zinc-800/40 text-zinc-400 border-white/5"
                                )}>
                                    {localMembers}/{totalMembers} LOCAL
                                </span>
                            )}
                            {watchedMembers > 0 && (
                                <span className={cn(
                                    "flex items-center gap-1 text-[8px] font-black px-2 py-1 uppercase tracking-widest border transition-all duration-300",
                                    isFullyWatched
                                        ? "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                                        : "bg-zinc-800/40 text-zinc-400 border-white/5"
                                )}>
                                    {watchedMembers}/{totalMembers} VISTAS
                                </span>
                            )}
                        </div>

                        {/* Description */}
                        {coll.overview && (
                            <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-4 font-medium">
                                {coll.overview}
                            </p>
                        )}
                    </div>

                    {/* Always visible bottom title strip */}
                    <div 
                        className="absolute bottom-0 left-0 right-0 px-3 py-3 group-hover/item:opacity-0"
                        style={{
                            transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                    >
                        <p className="text-[11px] font-black text-white uppercase tracking-wider line-clamp-1">
                            {coll.name}
                        </p>
                    </div>
                </div>

                {/* Drop shadow beneath cassette */}
                <div
                    className="absolute -bottom-6 left-4 right-4 h-6 opacity-0 group-hover/item:opacity-100 blur-xl bg-white/10"
                    style={{
                        transition: "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                />
            </div>
        </div>
    )
})

function ShelfSkeleton() {
    return (
        <div className="flex flex-nowrap items-end py-20 px-16 gap-0 overflow-hidden w-full justify-center">
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="shrink-0 rounded-none animate-pulse bg-white/[0.03] border border-white/5"
                    style={{
                        width: CASSETTE_W,
                        height: CASSETTE_H + ((i * 7) % 21),
                        marginLeft: i !== 0 ? -OVERLAP : 0,
                    }}
                />
            ))}
        </div>
    )
}
