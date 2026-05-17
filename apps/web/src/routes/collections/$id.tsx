import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useGetMediaCollection } from "@/api/hooks/collections.hooks"
import React, { useMemo, useRef } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { FaPlay, FaCalendar, FaTag, FaChevronLeft } from "react-icons/fa"
import { cn } from "@/components/ui/core/styling"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

export const Route = createFileRoute("/collections/$id")({
    component: CollectionDetailPage,
})

function CollectionDetailPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: collection, isLoading, error } = useGetMediaCollection(Number(id))
    const { setBackdropUrl } = useIntelligenceStore()

    const containerRef = useRef<HTMLDivElement>(null)
    const timelineRef = useRef<HTMLDivElement>(null)

    // Set the global background backdrop when the collection loads
    React.useEffect(() => {
        if (collection?.backdropPath) {
            setBackdropUrl(collection.backdropPath)
        }
    }, [collection, setBackdropUrl])

    // Apply high-performance GSAP entrance animations to the timeline cards
    useGSAP(() => {
        if (!isLoading && collection?.parts?.length) {
            // Animate hero content
            gsap.fromTo(
                ".hero-content-anim",
                { opacity: 0, y: 40 },
                { opacity: 1, y: 0, duration: 1, ease: "power4.out", stagger: 0.15 }
            )

            // Animate timeline nodes
            gsap.fromTo(
                ".timeline-node-anim",
                { opacity: 0, scale: 0 },
                { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.7)", stagger: 0.1, delay: 0.5 }
            )

            // Animate timeline cards
            gsap.fromTo(
                ".timeline-card-anim",
                { opacity: 0, x: (i) => (i % 2 === 0 ? -50 : 50) },
                { opacity: 1, x: 0, duration: 0.8, ease: "power3.out", stagger: 0.12, delay: 0.3 }
            )
        }
    }, { scope: containerRef, dependencies: [isLoading, collection] })

    // Sort parts chronologically by release date
    const sortedParts = useMemo(() => {
        if (!collection?.parts) return []
        return [...collection.parts].sort((a, b) => {
            const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0
            const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0
            return dateA - dateB
        })
    }, [collection])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-500">Cargando Cronología...</span>
                </div>
            </div>
        )
    }

    if (error || !collection) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
                <EmptyState
                    title="Saga no encontrada"
                    message="No pudimos localizar los datos de la saga seleccionada. Intenta recargar o vuelve al catálogo de sagas."
                    action={
                        <button
                            onClick={() => navigate({ to: "/collections" })}
                            className="mt-6 flex items-center gap-2 px-6 py-3 bg-white text-black font-black uppercase text-[11px] tracking-[0.2em] hover:bg-zinc-200 transition-colors"
                        >
                            <FaChevronLeft /> Volver a Sagas
                        </button>
                    }
                />
            </div>
        )
    }

    const backdropUrl = collection.backdropPath || ""
    const posterUrl = collection.posterPath || ""
    const partCount = sortedParts.length

    return (
        <div ref={containerRef} className="min-h-screen bg-[#09090b] text-white flex flex-col w-full relative overflow-x-hidden pb-32">
            <DynamicBackdrop />

            {/* Back Button */}
            <button
                onClick={() => navigate({ to: "/collections" })}
                className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/10 backdrop-blur-md hover:border-white text-[10px] font-black uppercase tracking-[0.2em] transition-all"
            >
                <FaChevronLeft /> Volver a Sagas
            </button>

            {/* Cinematic Hero Header */}
            <section className="relative min-h-[65vh] flex flex-col justify-end pt-32 pb-20 px-8 md:px-16 lg:px-24">
                {/* Backdrop with gradient and subtle motion blur */}
                {backdropUrl && (
                    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
                        <img
                            src={backdropUrl}
                            alt={collection.name}
                            className="w-full h-full object-cover object-center opacity-25 grayscale select-none pointer-events-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />
                    </div>
                )}

                <div className="relative z-10 flex flex-col lg:flex-row items-end gap-12 max-w-[1600px] mx-auto w-full">
                    {/* Big poster */}
                    {posterUrl && (
                        <div className="hero-content-anim hidden lg:block shrink-0 w-60 xl:w-72 border border-white/10 bg-black group transition-all duration-500 hover:border-white shadow-2xl">
                            <img
                                src={posterUrl}
                                alt={collection.name}
                                className="w-full aspect-[2/3] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                            />
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="hero-content-anim flex items-center gap-4">
                            <div className="h-[2px] w-12 bg-white" />
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500">Cronología Unificada</span>
                        </div>

                        <h1 className="hero-content-anim font-bebas text-6xl md:text-8xl xl:text-[8.5rem] leading-[0.85] tracking-tight text-white uppercase select-all">
                            {collection.name}
                        </h1>

                        <div className="hero-content-anim flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                            <span>SAGA COMPLETA</span>
                            <span className="w-1.5 h-1.5 bg-white/25 rounded-full" />
                            <span className="text-white">{partCount} ENTREGAS</span>
                        </div>

                        {collection.overview && (
                            <p className="hero-content-anim max-w-4xl text-[14px] text-zinc-400 leading-relaxed font-semibold uppercase tracking-wide">
                                {collection.overview}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="relative z-10 px-8 md:px-16 lg:px-24 max-w-[1400px] mx-auto w-full">
                <div className="space-y-1 border-b border-white/10 pb-8 mb-20 flex items-center justify-between">
                    <div>
                        <h2 className="text-4xl font-bebas tracking-widest text-white uppercase">LINEA TEMPORAL</h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Orden recomendado de visualización (Saga principal)
                        </p>
                    </div>
                </div>

                {/* Timeline Axis */}
                <div ref={timelineRef} className="relative flex flex-col gap-12 md:gap-24">
                    {/* Vertical Connecting Line */}
                    <div className="absolute left-6 md:left-1/2 top-4 bottom-4 w-[2px] bg-zinc-800 -translate-x-1/2 z-0 hidden md:block" />

                    {sortedParts.map((part, index) => {
                        const isEven = index % 2 === 0
                        const formattedDate = part.releaseDate
                            ? new Date(part.releaseDate).toLocaleDateString("es-ES", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                              })
                            : "Fecha Desconocida"

                        return (
                            <div
                                key={part.id}
                                className={cn(
                                    "relative flex flex-col md:flex-row items-stretch md:items-center w-full z-10 gap-8 md:gap-0"
                                )}
                            >
                                {/* Left Side (Even items get the Card, Odd items get Empty spacing) */}
                                <div className={cn("w-full md:w-1/2 flex justify-end md:pr-12", !isEven && "md:order-3 md:justify-start md:pl-12")}>
                                    <div
                                        className={cn(
                                            "timeline-card-anim w-full md:max-w-xl group relative border border-white/10 hover:border-white bg-black/60 hover:bg-black/80 transition-all duration-300 p-6 md:p-8 flex flex-col md:flex-row gap-6 text-left"
                                        )}
                                    >
                                        {/* Entry Poster */}
                                        {part.posterPath && (
                                            <div className="shrink-0 w-28 md:w-32 bg-black border border-white/5 group-hover:border-white/20 overflow-hidden transition-all duration-500 aspect-[2/3]">
                                                <img
                                                    src={part.posterPath}
                                                    alt={part.title}
                                                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-transform duration-500 group-hover:scale-105"
                                                />
                                            </div>
                                        )}

                                        {/* Entry Info */}
                                        <div className="flex-1 flex flex-col justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                                    <span className="flex items-center gap-1.5"><FaCalendar className="text-[8px]" /> {formattedDate}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1.5"><FaTag className="text-[8px]" /> {part.format || "N/A"}</span>
                                                </div>
                                                <h3 className="text-xl md:text-2xl font-black text-white leading-tight uppercase tracking-tight group-hover:text-yellow-500 transition-colors">
                                                    {part.title}
                                                </h3>
                                                {part.overview && (
                                                    <p className="text-[12px] text-zinc-500 group-hover:text-zinc-400 font-bold uppercase tracking-wider leading-relaxed line-clamp-3">
                                                        {part.overview}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            <button
                                                onClick={() => {
                                                    // Navigate to detail page unifingly using seriesId
                                                    navigate({
                                                        to: "/series/$seriesId",
                                                        params: { seriesId: String(part.id) },
                                                    })
                                                }}
                                                className="self-start flex items-center gap-2 py-2.5 px-5 bg-white text-black text-[9px] font-black uppercase tracking-[0.2em] hover:bg-yellow-500 transition-all duration-200"
                                            >
                                                <FaPlay className="text-[8px]" /> VER DETALLES
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Center Node (Dynamic badge/dot) */}
                                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 top-4 md:top-auto z-20 flex items-center justify-center md:order-2">
                                    <div className="timeline-node-anim flex items-center justify-center w-12 h-12 rounded-full bg-black border border-white/20 group-hover:border-white shadow-xl relative">
                                        <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-xs font-black text-white tabular-nums">{index + 1}</span>
                                    </div>
                                </div>

                                {/* Right Side (Empty space spacer) */}
                                <div className={cn("hidden md:block w-1/2 md:order-1", !isEven && "md:order-4")} />
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
