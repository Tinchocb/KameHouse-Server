import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaSearch, FaPlay, FaListOl, FaLayerGroup } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetMediaCollections } from "@/api/hooks/collections.hooks"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { HeroSection } from "@/components/shared/hero-section"

export const Route = createFileRoute("/collections/")({
    component: CollectionsPage,
})

const SPINE_W = 52
const CASSETTE_W = 220
const CASSETTE_H = 330
const OVERLAP = 80

function CollectionsPage() {
    const [search, setSearch] = useState("")
    const navigate = useNavigate()
    const { data: collections = [], isLoading } = useGetMediaCollections()

    const filtered = useMemo(() => {
        return collections.filter(c => {
            const matchesSearch = search
                ? c.name.toLowerCase().includes(search.toLowerCase()) ||
                  (c.overview || "").toLowerCase().includes(search.toLowerCase())
                : true
            return matchesSearch
        })
    }, [collections, search])

    const handleNavigate = (id: number) => {
        navigate({ to: "/collections/$id", params: { id: String(id) } })
    }

    return (
        <div className="flex-1 w-full min-h-screen bg-[#09090b] text-white overflow-hidden font-sans selection:bg-primary/30">
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
            <div className="sticky top-0 z-30 bg-[#09090b]/80 border-b border-white/[0.04] backdrop-blur-2xl">
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
                {isLoading ? (
                    <ShelfSkeleton />
                ) : filtered.length === 0 ? (
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
                        {filtered.map((coll, idx) => (
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
    }
    idx: number
    onNavigate: (id: number) => void
}

const CollectionCassette = memo(function CollectionCassette({
    coll, idx, onNavigate
}: CollectionCassetteProps) {
    const count = coll.memberIds?.length || 0

    return (
        <div
            className={cn(
                "group/item relative shrink-0 transition-all duration-500 ease-out hover:z-[9999]"
            )}
            style={{
                marginLeft: idx !== 0 ? -OVERLAP : 0,
                zIndex: idx,
            }}
        >
            {/* 3D wrapper */}
            <div
                className="relative transition-all duration-500 ease-out [transform-style:preserve-3d]"
                style={{
                    width: CASSETTE_W + SPINE_W,
                    height: CASSETTE_H,
                    transform: "rotateY(35deg)",
                }}
                onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = "rotateY(0deg) translateZ(80px) translateY(-30px)"
                    el.style.transitionDuration = "400ms"
                }}
                onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = "rotateY(35deg)"
                    el.style.transitionDuration = "500ms"
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
                    <div className="absolute left-0 inset-y-0 w-1 bg-yellow-500" />
                    
                    {/* Size badge */}
                    <div className="mt-4 ml-4 flex items-center gap-1">
                        <FaLayerGroup className="text-[8px] text-yellow-500" />
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
                        src={coll.posterPath || ""}
                        alt={coll.name}
                        className="w-full h-full object-cover grayscale group-hover/item:grayscale-0 transition-all duration-500"
                    />

                    {/* Dark gradient base */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                    {/* Hover info overlay */}
                    <div className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 group-hover/item:opacity-100 transition-all duration-400 bg-black/95">
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

                        {/* Count */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 bg-white text-black">
                                <FaListOl className="text-[8px]" /> {count} PELÍCULAS
                            </span>
                        </div>

                        {/* Description */}
                        {coll.overview && (
                            <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-4 font-medium">
                                {coll.overview}
                            </p>
                        )}
                    </div>

                    {/* Always visible bottom title strip */}
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-3 group-hover/item:opacity-0 transition-opacity duration-300">
                        <p className="text-[11px] font-black text-white uppercase tracking-wider line-clamp-1">
                            {coll.name}
                        </p>
                    </div>
                </div>

                {/* Drop shadow beneath cassette */}
                <div
                    className="absolute -bottom-6 left-4 right-4 h-6 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 blur-xl bg-white/10"
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
