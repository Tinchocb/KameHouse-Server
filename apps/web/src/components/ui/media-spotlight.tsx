"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Info, Sparkles, Star, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage, getMediumResImage, getLowResImage } from "@/lib/helpers/images"
import { DeferredImage } from "@/components/shared/deferred-image"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useSound } from "@/hooks/use-sound"
import type { SwimlaneItem } from "./swimlane"
import { HorizontalDraggableScroll } from "@/components/ui/horizontal-draggable-scroll/horizontal-draggable-scroll"

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
    // DB (Dragon Ball Original)
    12609: "db",
    1033499: "db",
    1033500: "db",
    1033513: "db",
    
    // DB Movies
    116776: "db",   // Una aventura mística
    1116776: "db",
    39145: "db",    // La princesa durmiente del castillo embrujado
    1039145: "db",
    39144: "db",    // La leyenda de Shen Long
    1039144: "db",
    39148: "db",    // El camino hacia el poder
    1039148: "db",

    // DB Local Database IDs
    4: "db",
    6: "db",
    311: "db",
    320: "db",
    333: "db",

    // DBZ (Dragon Ball Z)
    12971: "dbz",
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
    
    // DBZ Movies & Specials (TMDB IDs with and without 1,000,000 offset)
    28609: "dbz",   // ¡Devuélvanme a mi Gohan!
    1028609: "dbz",
    39100: "dbz",   // El hombre más fuerte de este mundo
    1039100: "dbz",
    39101: "dbz",   // La batalla más grande de este mundo está por comenzar
    1039101: "dbz",
    39102: "dbz",   // Goku es un Super Saiyajin
    1039102: "dbz",
    24752: "dbz",   // Los rivales más poderosos
    1024752: "dbz",
    39103: "dbz",   // Los guerreros más poderosos
    1039103: "dbz",
    39104: "dbz",   // La pelea de los tres Saiyajin
    1039104: "dbz",
    34433: "dbz",   // El poder invencible
    1034433: "dbz",
    39105: "dbz",   // La galaxia corre peligro
    1039105: "dbz",
    44251: "dbz",   // El regreso del guerrero legendario
    1044251: "dbz",
    39106: "dbz",   // El combate final
    1039106: "dbz",
    39107: "dbz",   // La fusión de Goku y Vegeta
    1039107: "dbz",
    39108: "dbz",   // El ataque del dragón
    1039108: "dbz",
    126963: "dbz",  // La batalla de los dioses
    1126963: "dbz",
    303857: "dbz",  // La resurrección de Freezer / F
    1303857: "dbz",
    39323: "dbz",   // La batalla de Freezer contra el padre de Goku
    1039323: "dbz",
    39324: "dbz",   // Los dos guerreros del futuro: Gohan y Trunks
    1039324: "dbz",
    38594: "dbz",   // Goku y sus amigos regresan
    1038594: "dbz",
    120475: "dbz",  // Bardock el legendario Super Saiyajin
    1120475: "dbz",

    // DBZ Local Database IDs
    2: "dbz",
    7: "dbz",
    8: "dbz",
    307: "dbz",
    308: "dbz",
    309: "dbz",
    313: "dbz",
    318: "dbz",
    319: "dbz",
    321: "dbz",
    322: "dbz",
    325: "dbz",
    328: "dbz",
    329: "dbz",
    331: "dbz",
    332: "dbz",
    335: "dbz",
    1440: "dbz",
    2000: "dbz",
    2123: "dbz",

    // GT (Dragon Ball GT)
    12697: "dbgt",
    1039149: "dbgt",
    18095: "dbgt",  // La legendaria esfera de cuatro estrellas
    1018095: "dbgt",

    // GT Local Database IDs
    187: "dbgt",
    324: "dbgt",

    // Super (Dragon Ball Super)
    62715: "dbs",
    1503314: "dbs", // Broly
    1610150: "dbs", // Super Hero

    // Super Local Database IDs
    17: "dbs",
    18: "dbs",
    24: "dbs",

    // Daima (Dragon Ball Daima)
    236994: "dbdaima",

    // Daima Local Database IDs
    236: "dbdaima",
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

export const MediaSpotlight = React.memo(function MediaSpotlight({ items, onNavigate, className }: MediaSpotlightProps) {
    const { playSound } = useSound()
    const { setBackdropUrl } = useIntelligenceStore()
    const [activeEraId, setActiveEraId] = React.useState<EraId>("db")
    const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)



    const playHoverSound = () => {
        playSound("hover")
    }

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

    // Update global home page backdrop (always use the main series/era image, not the selected movie)
    React.useEffect(() => {
        const mainSeries = categorizedData[activeEraId]?.series
        if (mainSeries) {
            setBackdropUrl(mainSeries.backdropUrl || mainSeries.image)
        }
        return () => {
            setBackdropUrl(null)
        }
    }, [activeEraId, categorizedData, setBackdropUrl])

    const activeEraName = React.useMemo(() => {
        return ERAS.find(era => era.id === activeEraId)?.title || ""
    }, [activeEraId])

    const activeEraMovies = React.useMemo(() => {
        return categorizedData[activeEraId]?.movies || []
    }, [categorizedData, activeEraId])

    if (!activeItem) {
        return null
    }

    const hasMovies = activeEraMovies.length > 0

    return (
        <section className={cn("relative pt-16 md:pt-24 pb-12 w-full select-none overflow-hidden lg:min-h-[720px]", className)}>

            {/* Main content grid: Left Column (Portada/Cover Card) & Right Column (Synopsis + Eras List) */}
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-start z-10 w-full px-6 md:pl-32 md:pr-12 lg:pl-44 lg:pr-20 xl:pl-48 xl:pr-24">
                {/* ─── LADO IZQUIERDO: Portada Principal Widescreen (Sharp Cover Card con Sinopsis Superpuesta) ─── */}
                <div className="lg:col-span-8 w-full">
                    <div className="relative w-full h-[260px] sm:h-[340px] md:h-[420px] lg:h-[480px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.65)] bg-zinc-950">
                        {/* Widescreen shadow overlays positioned at z-20 to cover both incoming and outgoing images */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-20 pointer-events-none" />
                        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent z-20 pointer-events-none" />

                        <AnimatePresence mode="popLayout">
                            <motion.div
                                key={activeItem.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute inset-0 w-full h-full z-10"
                            >
                                {activeItem.backdropUrl ? (
                                    <DeferredImage
                                        src={getHighResImage(activeItem.backdropUrl)}
                                        alt={activeItem.title}
                                        priority={true}
                                        className="h-full w-full object-cover object-top"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950">
                                        <div className="absolute inset-0 opacity-20">
                                            <DeferredImage
                                                src={getHighResImage(activeItem.image)}
                                                alt=""
                                                priority={true}
                                                className="h-full w-full object-cover object-center blur-2xl saturate-150 scale-110"
                                            />
                                        </div>
                                        <DeferredImage
                                            src={getHighResImage(activeItem.image)}
                                            alt={activeItem.title}
                                            priority={true}
                                            className="relative z-10 h-full w-auto max-w-[50%] object-contain drop-shadow-2xl"
                                        />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Detalles del Item Activo Superpuestos (Sinopsis y Metadata) */}
                        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end p-4 sm:p-6 md:p-8 space-y-3 max-w-[95%] md:max-w-[90%] select-none">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeItem.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    className="space-y-2"
                                >
                                    {/* Metadata badges */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="bg-gradient-to-r from-brand-orange to-amber-600 text-white text-[9px] font-black tracking-[0.25em] px-2.5 py-1.5 rounded-full uppercase flex items-center gap-1.5 shadow-[0_2px_10px_rgba(255,110,58,0.3)] border border-brand-orange/20 select-none">
                                            <Sparkles size={10} className="animate-pulse" />
                                            Destacado
                                        </span>
                                        {activeItem.badge && (
                                            <span className="bg-white/15 backdrop-blur-md text-zinc-100 text-[9px] font-black tracking-[0.25em] px-2.5 py-1.5 rounded-full border border-white/10 uppercase select-none">
                                                {activeItem.badge}
                                            </span>
                                        )}
                                        {activeItem.year && (
                                            <span className="bg-white/15 backdrop-blur-md text-zinc-100 text-[9px] font-black tracking-[0.25em] px-2.5 py-1.5 rounded-full border border-white/10 uppercase select-none">
                                                {activeItem.year}
                                            </span>
                                        )}
                                        {activeItem.rating && (
                                            <span className="bg-emerald-500/20 backdrop-blur-md text-emerald-300 text-[9px] font-black tracking-[0.25em] px-2.5 py-1.5 rounded-full border border-emerald-500/25 uppercase flex items-center gap-1.5 shadow-sm select-none">
                                                <Star size={10} fill="currentColor" />
                                                {activeItem.rating.toFixed(1)} Ki
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bebas tracking-wide leading-none text-white uppercase select-none drop-shadow-md">
                                        {activeItem.title}
                                    </h3>

                                    {/* Description / Synopsis */}
                                    {activeItem.description && (
                                        <p className="text-zinc-200 text-xs md:text-sm leading-relaxed line-clamp-2 md:line-clamp-3 font-medium select-none drop-shadow-sm">
                                            {activeItem.description.replace(/<[^>]*>/g, '')}
                                        </p>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Botones de acción debajo de la imagen */}
                    <div className="flex flex-wrap items-center gap-3 mt-4">
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

                {/* ─── LADO DERECHO: Selector de Eras Vertical ─── */}
                <div className="flex flex-col justify-end space-y-3 lg:col-span-4 h-full lg:h-[480px]">
                    <h4 className="font-bebas text-[11px] tracking-[0.25em] text-zinc-500 uppercase font-bold">
                        Seleccionar Saga / Era
                    </h4>
                    <motion.div layout className="flex flex-col gap-2 relative">
                        <AnimatePresence initial={false}>
                            {ERAS.map((era) => {
                                const eraData = categorizedData[era.id]
                                const isEraActive = era.id === activeEraId
                                const displayTitle = eraData?.series?.title || era.title
                                const displayYear = eraData?.series?.year || era.year

                                return (
                                    <button
                                        key={era.id}
                                        onClick={() => handleEraSelect(era.id)}
                                        onMouseEnter={playHoverSound}
                                        className={cn(
                                            "group relative flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all duration-500 w-full overflow-hidden",
                                            isEraActive
                                                ? "border-brand-orange/30 text-white shadow-[0_4px_20px_rgba(255,110,58,0.1)] scale-[1.02]"
                                                : "bg-white/[0.01] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.03] hover:border-white/10 hover:scale-[1.01]"
                                        )}
                                        style={{
                                            transition: "border 400ms, color 300ms, transform 400ms cubic-bezier(0.16, 1, 0.3, 1)"
                                        }}
                                    >
                                        {isEraActive && (
                                            <motion.div
                                                layoutId="activeEraBackground"
                                                className="absolute inset-0 bg-gradient-to-r from-brand-orange/20 to-orange-500/5 -z-10"
                                                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                                            />
                                        )}
                                        
                                        <div className="flex items-baseline gap-2 relative z-10">
                                            <span className={cn(
                                                "font-bebas text-lg tracking-wider uppercase transition-colors duration-300",
                                                isEraActive ? "text-brand-orange" : "text-zinc-300 group-hover:text-brand-orange"
                                            )}>
                                                {displayTitle}
                                            </span>
                                            <span className="text-[9px] font-bold text-zinc-500 select-none">({displayYear})</span>
                                        </div>
                                        
                                        <ChevronRight size={14} className={cn(
                                            "transition-all duration-300 relative z-10",
                                            isEraActive ? "text-brand-orange translate-x-0" : "text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1"
                                        )} />
                                    </button>
                                )
                            })}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>

            {/* ─── PARTE INFERIOR DE TODO: Películas Disponibles en Fila Horizontal ───── */}
            <AnimatePresence mode="wait">
                {hasMovies && (
                    <motion.div
                        key={activeEraId}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="relative z-10 text-left space-y-4 mt-12 px-6 md:pl-32 md:pr-12 lg:pl-44 lg:pr-20 xl:pl-48 xl:pr-24 w-full"
                    >
                        <h4 className="font-bebas text-2xl tracking-wider text-zinc-300 uppercase flex items-center gap-2">
                            <span>Películas disponibles de</span>
                            <span className="text-brand-orange">{activeEraName}</span>
                            <span className="text-xs text-zinc-500 font-sans font-bold tracking-normal lowercase">({activeEraMovies.length} películas)</span>
                        </h4>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4 pt-2 pb-4 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
                            {activeEraMovies.map((movie) => {
                                const isMovieSelected = selectedItemId === movie.id
                                const hasSelection = selectedItemId !== null && activeEraMovies.some(m => m.id === selectedItemId)

                                return (
                                    <div
                                        key={movie.id}
                                        onClick={() => setSelectedItemId(movie.id)}
                                        onMouseEnter={playHoverSound}
                                        className={cn(
                                            "group relative w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer border select-none transition-all duration-500 shrink-0",
                                            isMovieSelected
                                                ? "border-brand-orange shadow-[0_0_25px_rgba(255,110,58,0.45)] scale-[1.04] z-10 opacity-100"
                                                : hasSelection
                                                    ? "border-white/5 opacity-40 blur-[1px] grayscale-[30%] hover:opacity-85 hover:blur-0 hover:grayscale-0 hover:scale-[1.01]"
                                                    : "border-white/5 opacity-100 hover:border-white/20 hover:scale-[1.01]"
                                        )}
                                        style={{
                                            transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)"
                                        }}
                                    >
                                        {/* Cover image */}
                                        <DeferredImage
                                            src={getMediumResImage(movie.image)}
                                            alt={movie.title}
                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />

                                        {/* Fade overlay on movie cover */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent z-10" />

                                        {/* Play icon overlay on hover */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                            <div className="p-3 rounded-full bg-brand-orange text-white transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-lg">
                                                <Play size={16} fill="currentColor" />
                                            </div>
                                        </div>

                                        {/* Active wash */}
                                        {isMovieSelected && (
                                            <div className="absolute inset-0 bg-brand-orange/[0.08] z-10 pointer-events-none" />
                                        )}

                                        {/* Title overlay */}
                                        <div className="absolute bottom-3 left-4 right-4 z-20 text-left">
                                            <h5 className={cn(
                                                "font-bebas text-lg leading-none tracking-wider uppercase truncate drop-shadow transition-colors duration-300",
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
})
