"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Info, Sparkles, Star, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { SwimlaneItem } from "./swimlane"

interface MediaSpotlightProps {
    items: SwimlaneItem[]
    onNavigate: (item: SwimlaneItem) => void
    className?: string
}

// Definition of the 5 canonical Dragon Ball eras in chronological order
const ERAS = [
    { id: "db", title: "Dragon Ball", subtitle: "Dragon Ball (Original)", year: 1986 },
    { id: "dbz", title: "Dragon Ball Z", subtitle: "Dragon Ball Z", year: 1989 },
    { id: "dbgt", title: "Dragon Ball GT", subtitle: "Dragon Ball GT", year: 1996 },
    { id: "dbs", title: "Dragon Ball Super", subtitle: "Dragon Ball Super", year: 2015 },
    { id: "dbdaima", title: "Dragon Ball Daima", subtitle: "Dragon Ball Daima", year: 2024 },
] as const

type EraId = typeof ERAS[number]["id"]

const MEDIA_ID_TO_ERA: Record<number, EraId> = {
    // DB
    12609: "db",
    1033499: "db",
    1033500: "db",
    1033513: "db",
    1039148: "db",

    // DBZ
    12971: "dbz",
    61709: "dbz", // Dragon Ball Z Kai
    1015448: "dbz",
    1015449: "dbz",
    1015450: "dbz",
    1015451: "dbz",
    1015452: "dbz",
    1015453: "dbz",
    1015454: "dbz",
    1015455: "dbz",
    1015456: "dbz",
    1015457: "dbz",
    1015458: "dbz",
    1012704: "dbz",
    1015459: "dbz",
    1015460: "dbz",
    1126963: "dbz", // La batalla de los dioses
    1303857: "dbz", // La resurrección de F

    // GT
    12697: "dbgt",
    1039149: "dbgt",

    // Super
    62715: "dbs",

    1503314: "dbs", // Broly
    1610150: "dbs", // Super Hero

    // Daima
    236994: "dbdaima",
    240411: "dbdaima",
}

// Helper to classify media into an era based on title matching
function getEraFromTitle(title: string): EraId | null {
    const t = title.toLowerCase()

    if (t.includes("daima")) return "dbdaima"

    // If it's explicitly a DBZ movie / series or has standard DBZ title identifiers,
    // group it under DBZ, EXCEPT for the two DBS transitional movies.
    if (
        t.includes(" z") ||
        t.includes("dbz") ||
        t.includes("kai") ||
        t.includes("zet") ||
        t.includes("garlick") ||
        t.includes("más fuerte del mundo") ||
        t.includes("mas fuerte del mundo") ||
        t.includes("súper batalla") ||
        t.includes("super batalla") ||
        t.includes("súper guerrero") ||
        t.includes("super guerrero") ||
        t.includes("mejores rivales") ||
        t.includes("fuerza ilimitada") ||
        t.includes("tres grandes super") ||
        t.includes("estalla el duelo") ||
        t.includes("guerreros de plata") ||
        t.includes("el regreso de broly") ||
        t.includes("combate definitivo") ||
        t.includes("fusión") ||
        t.includes("fusion") ||
        t.includes("ataque del dragón") ||
        t.includes("ataque del dragon") ||
        t.includes("poder invencible") ||
        t.includes("padre de goku") ||
        t.includes("dos guerreros del futuro") ||
        t.includes("la batalla de los dioses") ||
        t.includes("batalla de los dioses") ||
        t.includes("resurrección de f") ||
        t.includes("resurreccion de f")
    ) {

        return "dbz"
    }

    if (
        t.includes("super") ||
        t.includes("broly") ||
        t.includes("la batalla de los dioses") ||
        t.includes("batalla de los dioses") ||
        t.includes("resurrección de f") ||
        t.includes("resurreccion de f")
    ) {
        // Exclude DBZ Broly movies
        if (
            t.includes("estalla el duelo") ||
            t.includes("segunda venida") ||
            t.includes("combate definitivo") ||
            t.includes("regreso de broly") ||
            t.includes("poder invencible")
        ) {
            return "dbz"
        }
        return "dbs"
    }

    if (t.includes("gt") || t.includes("100 años después") || t.includes("100 anos despues")) {
        return "dbgt"
    }

    if (
        t.includes("dragon ball") ||
        t.includes("bola de drag") ||
        t.includes("shenlong") ||
        t.includes("princesa durmiente") ||
        t.includes("aventura mística") ||
        t.includes("aventura mistica") ||
        t.includes("camino hacia el poder") ||
        t.includes("camino al poder")
    ) {
        return "db"
    }

    return null
}

function getEraFromItem(item: SwimlaneItem): EraId | null {
    // 1. Try mapping by ID
    const mediaId = Number(item.id.replace(/^(media|cw)-/, ""))
    if (!isNaN(mediaId) && mediaId in MEDIA_ID_TO_ERA) {
        return MEDIA_ID_TO_ERA[mediaId]
    }

    // 2. Fallback to title matching
    return getEraFromTitle(item.title)
}

export function MediaSpotlight({ items, onNavigate, className }: MediaSpotlightProps) {
    const [activeEraId, setActiveEraId] = React.useState<EraId>("db")
    const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)

    // Classify all library items into eras
    const categorizedData = React.useMemo(() => {
        const result: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }> = {
            db: { series: null, movies: [] },
            dbz: { series: null, movies: [] },
            dbgt: { series: null, movies: [] },
            dbs: { series: null, movies: [] },
            dbdaima: { series: null, movies: [] },
        }

        items.forEach(item => {
            const era = getEraFromItem(item)
            if (era) {
                const isTV = item.badge === "TV"
                if (isTV) {
                    result[era].series = item
                } else {
                    result[era].movies.push(item)
                }
            }
        })

        // Sort movies by release year ascending
        ERAS.forEach(era => {
            const data = result[era.id]
            data.movies.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0))

            // If there's no main TV series in library, fallback to the first movie
            if (!data.series && data.movies.length > 0) {
                data.series = data.movies[0]
                data.movies = data.movies.slice(1)
            }
        })

        return result
    }, [items])

    // Find the currently active item to showcase (series or selected movie)
    const activeItem = React.useMemo(() => {
        const eraData = categorizedData[activeEraId]
        if (!eraData) return null

        if (selectedItemId) {
            const movie = eraData.movies.find(m => m.id === selectedItemId)
            if (movie) return movie
            if (eraData.series?.id === selectedItemId) return eraData.series
        }

        return eraData.series
    }, [categorizedData, activeEraId, selectedItemId])

    // Update active items when switching eras
    const handleEraSelect = React.useCallback((eraId: EraId) => {
        setActiveEraId(eraId)
        const eraData = categorizedData[eraId]
        setSelectedItemId(eraData?.series?.id || null)
    }, [categorizedData])

    // Initialize selected item on first load
    React.useEffect(() => {
        if (!selectedItemId && categorizedData[activeEraId]?.series) {
            setSelectedItemId(categorizedData[activeEraId].series!.id)
        }
    }, [categorizedData, activeEraId, selectedItemId])

    const activeEraName = React.useMemo(() => {
        return ERAS.find(era => era.id === activeEraId)?.title || ""
    }, [activeEraId])

    const activeEraMovies = React.useMemo(() => {
        return categorizedData[activeEraId]?.movies || []
    }, [categorizedData, activeEraId])

    if (!activeItem) {
        return null
    }

    return (
        <section className={cn("relative pt-16 md:pt-24 pb-12 w-full select-none overflow-hidden", className)}>

            {/* Ambient Background Glow (Blurry, Low Opacity) */}
            <div className="absolute inset-x-0 top-0 h-[660px] md:h-[690px] lg:h-[720px] overflow-hidden pointer-events-none z-0">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeItem.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.15, scale: 1.05 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="w-full h-full"
                    >
                        <DeferredImage
                            src={getHighResImage(activeItem.backdropUrl || activeItem.image)}
                            alt={activeItem.title}
                            className="h-full w-full object-cover blur-[80px] saturate-150"
                        />
                    </motion.div>
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-[#090b13] via-[#090b13]/40 to-transparent z-10" />
            </div>

            {/* Main content grid: Left Column (Portada/Cover Card) & Right Column (Synopsis + Eras List) */}
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch z-10 w-full px-6 md:pl-32 md:pr-12 lg:pl-44 lg:pr-20 xl:pl-48 xl:pr-24">

                {/* ─── LADO IZQUIERDO: Portada Principal Widescreen (Sharp Cover Card) ─── */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-center">
                    <div className="relative w-full aspect-video lg:h-[460px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.65)] bg-zinc-950">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeItem.id}
                                initial={{ opacity: 0, scale: 1.02 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.02 }}
                                transition={{ duration: 0.5 }}
                                className="w-full h-full"
                            >
                                <DeferredImage
                                    src={getHighResImage(activeItem.backdropUrl || activeItem.image)}
                                    alt={activeItem.title}
                                    className="h-full w-full object-cover object-center"
                                />
                            </motion.div>
                        </AnimatePresence>
                        {/* Widescreen shadow overlays */}
                        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent z-10" />
                        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent z-10" />
                    </div>
                </div>

                {/* ─── LADO DERECHO: Sinopsis (Top) + Lista de Eras Vertical (Bottom) ─── */}
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between space-y-6 min-h-[460px]">
                    {/* Detalles del Item Activo (Sinopsis) */}
                    <div className="space-y-4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeItem.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-3"
                            >
                                {/* Metadata badges */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="bg-gradient-to-r from-brand-orange to-amber-600 text-white text-[9px] font-black tracking-[0.25em] px-3 py-1.5 rounded-full uppercase flex items-center gap-1.5 shadow-[0_2px_10px_rgba(255,110,58,0.3)] border border-brand-orange/20 select-none">
                                        <Sparkles size={10} className="animate-pulse" />
                                        Destacado
                                    </span>
                                    {activeItem.badge && (
                                        <span className="bg-white/5 backdrop-blur-md text-zinc-300 text-[9px] font-black tracking-[0.25em] px-3 py-1.5 rounded-full border border-white/10 uppercase select-none">
                                            {activeItem.badge}
                                        </span>
                                    )}
                                    {activeItem.year && (
                                        <span className="bg-white/5 backdrop-blur-md text-zinc-300 text-[9px] font-black tracking-[0.25em] px-3 py-1.5 rounded-full border border-white/10 uppercase select-none">
                                            {activeItem.year}
                                        </span>
                                    )}
                                    {activeItem.rating && (
                                        <span className="bg-emerald-500/10 backdrop-blur-md text-emerald-400 text-[9px] font-black tracking-[0.25em] px-3 py-1.5 rounded-full border border-emerald-500/20 uppercase flex items-center gap-1.5 shadow-sm select-none">
                                            <Star size={10} fill="currentColor" />
                                            {activeItem.rating.toFixed(1)} Ki
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className="text-3xl md:text-4xl lg:text-4xl xl:text-5xl font-bebas tracking-wide leading-none text-white uppercase select-none drop-shadow-md">
                                    {activeItem.title}
                                </h3>

                                {/* Description / Synopsis */}
                                {activeItem.description && (
                                    <p className="text-zinc-400 text-xs md:text-sm leading-relaxed line-clamp-3 xl:line-clamp-4 font-medium select-none">
                                        {activeItem.description.replace(/<[^>]*>/g, '')}
                                    </p>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                            <button
                                onClick={() => onNavigate(activeItem)}
                                className="flex items-center gap-2 bg-gradient-to-r from-brand-orange to-orange-500 text-white font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] px-5 py-2.5 rounded-full hover:from-brand-orange hover:to-orange-400 hover:scale-105 hover:shadow-[0_0_25px_rgba(255,110,58,0.55)] active:scale-95 transition-all duration-300 shadow-[0_4px_20px_rgba(255,110,58,0.35)]"
                            >
                                <Play size={12} fill="currentColor" />
                                Reproducir Ahora
                            </button>

                            <button
                                onClick={() => onNavigate(activeItem)}
                                className="flex items-center gap-2 border border-white/10 bg-zinc-900/60 backdrop-blur-md text-zinc-300 hover:text-white hover:bg-zinc-800/80 hover:border-white/20 hover:scale-105 active:scale-95 font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] px-5 py-2.5 rounded-full transition-all duration-300"
                            >
                                <Info size={12} />
                                Ver Detalles
                            </button>
                        </div>
                    </div>

                    {/* Selector de Eras Vertical */}
                    <div className="space-y-3">
                        <h4 className="font-bebas text-[11px] tracking-[0.25em] text-zinc-500 uppercase font-bold">
                            Seleccionar Saga / Era
                        </h4>
                        <div className="flex flex-col gap-2">
                            {ERAS.map((era) => {
                                const eraData = categorizedData[era.id]
                                const isEraActive = era.id === activeEraId
                                const displayTitle = eraData?.series?.title || era.title
                                const displayYear = eraData?.series?.year || era.year

                                return (
                                    <button
                                        key={era.id}
                                        onClick={() => handleEraSelect(era.id)}
                                        className={cn(
                                            "group flex items-center justify-between px-4 py-2.5 rounded-2xl border text-left transition-all duration-300 w-full",
                                            isEraActive
                                                ? "bg-gradient-to-r from-brand-orange/15 to-orange-500/5 border-brand-orange/30 text-white shadow-[0_4px_20px_rgba(255,110,58,0.08)]"
                                                : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/10"
                                        )}
                                    >
                                        <div className="flex items-baseline gap-2">
                                            <span className={cn(
                                                "font-bebas text-lg tracking-wider uppercase transition-colors",
                                                isEraActive ? "text-brand-orange" : "text-zinc-300 group-hover:text-brand-orange"
                                            )}>
                                                {displayTitle}
                                            </span>
                                            <span className="text-[9px] font-bold text-zinc-500 select-none">({displayYear})</span>
                                        </div>
                                        <ChevronRight size={14} className={cn(
                                            "transition-all duration-300",
                                            isEraActive ? "text-brand-orange translate-x-0" : "text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1"
                                        )} />
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── PARTE INFERIOR DE TODO: Películas Disponibles en Fila Horizontal ───── */}
            <AnimatePresence mode="wait">
                {activeEraMovies.length > 0 && (
                    <motion.div
                        key={activeEraId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                        className="relative z-10 mt-12 text-left space-y-4 px-6 md:pl-32 md:pr-12 lg:pl-44 lg:pr-20 xl:pl-48 xl:pr-24"
                    >
                        <h4 className="font-bebas text-2xl tracking-wider text-zinc-300 uppercase flex items-center gap-2">
                            <span>Películas disponibles de</span>
                            <span className="text-brand-orange">{activeEraName}</span>
                            <span className="text-xs text-zinc-500 font-sans font-bold tracking-normal lowercase">({activeEraMovies.length} películas)</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-2">
                            {activeEraMovies.map((movie) => {
                                const isMovieSelected = selectedItemId === movie.id
                                return (
                                    <div
                                        key={movie.id}
                                        onClick={() => setSelectedItemId(movie.id)}
                                        className={cn(
                                            "group relative w-full h-36 rounded-2xl overflow-hidden cursor-pointer border select-none transition-all duration-500",
                                            isMovieSelected
                                                ? "border-brand-orange shadow-[0_0_20px_rgba(255,110,58,0.3)] scale-[1.03]"
                                                : "border-white/5 hover:border-white/20 hover:scale-[1.01]"
                                        )}
                                    >
                                        {/* Cover image */}
                                        <DeferredImage
                                            src={getHighResImage(movie.image)}
                                            alt={movie.title}
                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />

                                        {/* Fade overlay on movie cover */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent z-10" />

                                        {/* Play icon overlay on hover */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                            <div className="p-3 rounded-full bg-brand-orange text-white transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-lg">
                                                <Play size={16} fill="currentColor" />
                                            </div>
                                        </div>

                                        {/* Active wash */}
                                        {isMovieSelected && (
                                            <div className="absolute inset-0 bg-brand-orange/5 z-10 pointer-events-none" />
                                        )}

                                        {/* Title overlay */}
                                        <div className="absolute bottom-3 left-4 right-4 z-20 text-left">
                                            <h5 className={cn(
                                                "font-bebas text-lg leading-none tracking-wider uppercase truncate drop-shadow",
                                                isMovieSelected ? "text-brand-orange" : "text-white"
                                            )}>
                                                {movie.title}
                                            </h5>
                                            <div className="flex items-center gap-2 mt-1 text-[9px] font-bold text-zinc-400 drop-shadow">
                                                <span>{movie.year || "Movie"}</span>
                                                {movie.rating && (
                                                    <span className="text-emerald-400">{movie.rating.toFixed(1)} Ki</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    )
}
