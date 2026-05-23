import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';
import { useGetLibraryCollection, fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { DeferredImage } from '@/components/shared/deferred-image';
 
export const Route = createFileRoute('/series/')({
    loader: async ({ context }) => {
        const qc = context.queryClient
        await qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        })
        return { dehydrateState: dehydrate(qc) }
    },
    component: SeriesFullscreenPage,
});

function SeriesFullscreenPage() {
    const { dehydrateState } = Route.useLoaderData()
    return (
        <HydrationBoundary state={dehydrateState}>
            <SeriesFullscreenIndex />
        </HydrationBoundary>
    )
}

interface SeriesItem {
    id: number
    title: string
    eps: number
    year: string | number
    progress: number
    img: string
    poster: string
    desc: string
}

const getVhsColor = (id: number) => {
    const colors = ['#d96c14', '#b51f1f', '#2980b9', '#1a5c2e', '#1a4a8a', '#8e44ad', '#0e6655'];
    return colors[id % colors.length];
};

const SeriesCard = memo(function SeriesCard({
    item,
    isSelected,
    onNavigate,
    onSelect,
}: {
    item: SeriesItem
    isSelected: boolean
    onNavigate: (id: string) => void
    onSelect: (id: number) => void
}) {
    return (
        <motion.div
            onClick={() => {
                if (isSelected) {
                    onNavigate(item?.id?.toString() || "");
                } else {
                    onSelect(item.id);
                }
            }}
            initial={false}
            layout
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            style={{
                flex: isSelected ? '4 0 25%' : '1 0 80px',
                willChange: 'transform',
            }}
            className="h-full flex flex-col cursor-pointer overflow-hidden relative"
        >
            <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0d0f14] group">
                <DeferredImage
                    src={item.img || item.poster}
                    alt={item.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-[filter,transform] duration-700 ${isSelected
                        ? 'brightness-100 scale-105'
                        : 'brightness-[0.35] group-hover:brightness-50'
                        }`}
                />

                <div
                    className={`absolute inset-0 z-[1] bg-gradient-to-t from-[#050608] via-[#050608]/70 to-transparent transition-opacity duration-500 ${isSelected ? 'opacity-[0.95]' : 'opacity-60'
                        }`}
                />

                <AnimatePresence>
                    {!isSelected ? (
                        <motion.div
                            key="collapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 flex items-center justify-center z-10 px-2"
                        >
                            <span
                                className="text-2xl font-black tracking-[0.3em] text-white/90 uppercase drop-shadow-[0_0_15px_rgba(0,0,0,1)] whitespace-nowrap select-none"
                                style={{
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'mixed',
                                    transform: 'rotate(180deg)',
                                }}
                            >
                                {item.title}
                            </span>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.15, ease: "easeOut" } }}
                            exit={{ opacity: 0, y: 15, transition: { duration: 0.15, ease: "easeIn" } }}
                            className="absolute inset-x-0 bottom-0 p-8 md:p-16 z-20 flex flex-col justify-end h-full max-w-4xl"
                        >
                            <div className="flex items-center gap-3 mb-6 select-none">
                                <span className="px-3 py-1 bg-brand-orange/20 text-brand-orange border border-brand-orange/30 rounded text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(255,110,58,0.2)]">
                                    Serie
                                </span>
                                <span className="text-sm font-bold text-white/70 uppercase tracking-widest">
                                    {item.year} • {item.eps} EPS
                                </span>
                            </div>

                            <h3 className="text-5xl md:text-7xl font-black text-white mb-6 leading-none tracking-tighter drop-shadow-2xl line-clamp-2">
                                {item.title}
                            </h3>

                            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-2xl font-medium line-clamp-3">
                                {item.desc}
                            </p>

                            <div className="flex flex-col mb-10 w-full max-w-xl">
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-xs font-black tracking-[0.2em] uppercase text-white/50">
                                        Progreso de visualización
                                    </span>
                                    <span className="text-sm font-black text-brand-orange">{item.progress}%</span>
                                </div>
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.progress}%` }}
                                        transition={{ duration: 1, delay: 0.4 }}
                                        className="h-full bg-gradient-to-r from-brand-orange to-[#ff9d5c] rounded-full shadow-[0_0_10px_rgba(255,110,58,0.5)]"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 max-w-xl">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigate(item?.id?.toString() || "");
                                    }}
                                    className="flex-1 bg-brand-orange hover:bg-[#ff8559] text-white rounded-xl text-base font-black tracking-widest uppercase py-5 transition-transform hover:-translate-y-1 flex justify-center items-center gap-3 shadow-[0_10px_30px_rgba(255,110,58,0.4)]"
                                >
                                    <Play className="w-6 h-6 fill-current" />
                                    Reproducir
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Lomo del casete VHS */}
            <div className="relative shrink-0 bg-[#121212] border-t-2 border-black/40 flex items-center justify-center shadow-[0_-15px_30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] z-20 h-[120px] w-full min-w-0 select-none overflow-hidden">
                {/* Textura rugosa de plástico de la carcasa */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e1e1e_1px,transparent_1px)] [background-size:3px_3px] opacity-25 pointer-events-none" />
                
                {/* Detalles mecánicos de la carcasa de plástico en los extremos (solo si está expandido) */}
                <AnimatePresence>
                    {isSelected && (
                        <>
                            {/* Extremo Izquierdo: Tornillo y estrías */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="absolute left-6 top-0 bottom-0 w-12 flex flex-col justify-between items-center py-4 pointer-events-none"
                            >
                                {/* Tornillo de ensamblaje retro */}
                                <div className="relative w-4 h-4 rounded-full bg-zinc-700 border border-zinc-800 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.6)] flex items-center justify-center">
                                    <div className="absolute w-2.5 h-[1px] bg-zinc-950 rotate-45" />
                                    <div className="absolute w-2.5 h-[1px] bg-zinc-950 -rotate-45" />
                                </div>
                                {/* Estrías de agarre de plástico */}
                                <div className="flex gap-[3px] h-6 items-stretch opacity-60">
                                    <div className="w-[3px] bg-black rounded shadow-[1px_0_0_rgba(255,255,255,0.05)]" />
                                    <div className="w-[3px] bg-black rounded shadow-[1px_0_0_rgba(255,255,255,0.05)]" />
                                    <div className="w-[3px] bg-black rounded shadow-[1px_0_0_rgba(255,255,255,0.05)]" />
                                </div>
                                <div className="text-[7px] font-mono text-zinc-600 tracking-tighter uppercase">
                                    A-SIDE
                                </div>
                            </motion.div>

                            {/* Extremo Derecho: Tornillo y estrías */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="absolute right-6 top-0 bottom-0 w-12 flex flex-col justify-between items-center py-4 pointer-events-none"
                            >
                                {/* Tornillo de ensamblaje retro */}
                                <div className="relative w-4 h-4 rounded-full bg-zinc-700 border border-zinc-800 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.6)] flex items-center justify-center">
                                    <div className="absolute w-2.5 h-[1px] bg-zinc-950 rotate-12" />
                                    <div className="absolute w-2.5 h-[1px] bg-zinc-950 -rotate-78" />
                                </div>
                                {/* Estrías de agarre de plástico */}
                                <div className="flex gap-[3px] h-6 items-stretch opacity-60">
                                    <div className="w-[3px] bg-black rounded shadow-[1px_0_0_rgba(255,255,255,0.05)]" />
                                    <div className="w-[3px] bg-black rounded shadow-[1px_0_0_rgba(255,255,255,0.05)]" />
                                    <div className="w-[3px] bg-black rounded shadow-[1px_0_0_rgba(255,255,255,0.05)]" />
                                </div>
                                <div className="text-[7px] font-mono text-zinc-600 tracking-tighter uppercase">
                                    NTSC
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Etiqueta adhesiva del casete (Sticker) */}
                <div
                    className={`h-[104px] relative flex flex-col gap-1 p-2 rounded shadow-[2px_4px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] overflow-hidden transition-all duration-300 ${
                        isSelected 
                            ? 'w-full max-w-[290px] mx-auto z-10 scale-102 border-l border-r border-t border-black/20' 
                            : 'w-[calc(100%-12px)]'
                    }`}
                    style={{ backgroundColor: getVhsColor(item.id) }}
                >
                    {/* Textura de papel mate granulado sobre el color */}
                    <div className="absolute inset-0 opacity-[0.12] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply pointer-events-none" />
                    {/* Brillo 3D sutil arriba */}
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                    
                    {/* Cabecera del Sticker */}
                    <div className="relative z-10 flex items-center justify-between min-w-0 px-1">
                        <span className={`font-black text-white/95 uppercase tracking-wider drop-shadow-sm select-none text-[8px]`}>
                            KAME-VHS
                        </span>
                        <div className="flex items-center gap-1">
                            <span className="text-[7px] font-mono font-bold text-white/80 tracking-widest uppercase">
                                HG
                            </span>
                            <span className="text-[7px] font-mono font-bold px-1 py-0.2 bg-black/35 text-white/90 rounded text-[6px]">
                                T-120
                            </span>
                        </div>
                    </div>

                    {/* Bloque Blanco de Escritura Auténtico */}
                    <div className="relative flex-1 bg-[#fdfcf7] text-zinc-800 shadow-[inset_1px_2px_4px_rgba(0,0,0,0.18),0_1px_0_rgba(255,255,255,0.7)] rounded border border-amber-900/10 px-2.5 py-1.5 flex flex-col justify-between overflow-hidden">
                        {/* Renglones de Cuaderno */}
                        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(#000_1px,transparent_1px)] bg-[size:100%_18px] pointer-events-none" />
                        <div className="absolute left-6 top-0 bottom-0 w-[1px] bg-red-400/20 pointer-events-none" /> {/* Margen izquierdo rojo clásico */}

                        {/* Fila superior de escritura (Solo si está seleccionado) */}
                        {isSelected && (
                            <div className="relative z-10 flex justify-between items-center text-[7px] text-zinc-500/80 font-bold uppercase tracking-wider select-none mb-0.5 border-b border-zinc-200/50 pb-0.5">
                                <span>LIBRARY COLLECTION</span>
                                <span className="text-zinc-600/80">NO. {String(item.id % 100).padStart(2, '0')}</span>
                            </div>
                        )}

                        {/* Nombre de la serie escrito a mano */}
                        <div className="relative z-10 flex-1 flex items-center min-w-0">
                            <span className={`font-marker text-zinc-900 tracking-wide select-none truncate w-full ${
                                isSelected 
                                    ? 'text-lg md:text-xl font-bold text-blue-900 rotate-[-0.8deg] pl-1' 
                                    : 'text-sm font-semibold text-zinc-800 text-center mx-auto'
                            }`}
                            style={{
                                filter: 'drop-shadow(0.5px 0.5px 0.5px rgba(30,58,138,0.2))'
                            }}>
                                {item.title}
                            </span>
                        </div>

                        {/* Detalles de Fábrica Inferiores (Solo si está seleccionado) */}
                        {isSelected && (
                            <div className="relative z-10 flex items-end justify-between gap-2 border-t border-zinc-200/60 pt-1 mt-0.5">
                                {/* Código de barras no deformable */}
                                <div className="flex flex-col gap-0.5 shrink-0 opacity-85 hover:opacity-100 transition-opacity">
                                    <div className="flex gap-[1px] h-3 w-16 bg-white p-0.5 rounded shadow-[0_1px_1px_rgba(0,0,0,0.1)] items-stretch">
                                        <div className="w-[1px] bg-black" />
                                        <div className="w-[2px] bg-black" />
                                        <div className="w-[1px] bg-black" />
                                        <div className="w-[1px] bg-black" />
                                        <div className="w-[3px] bg-black" />
                                        <div className="w-[1px] bg-black" />
                                        <div className="w-[2px] bg-black" />
                                        <div className="w-[1px] bg-black" />
                                        <div className="w-[4px] bg-black" />
                                        <div className="w-[1px] bg-black" />
                                    </div>
                                    <span className="text-[5px] font-mono text-zinc-500 text-center tracking-widest leading-none">
                                        {item.id}09948
                                    </span>
                                </div>

                                {/* Sello vintage de videoclub con el año */}
                                <div className="border border-red-500/80 text-red-500/80 rounded-full px-1.5 py-0.2 text-[8px] font-mono font-black uppercase rotate-[-7deg] shadow-[0_1px_2px_rgba(239,68,68,0.15)] leading-tight select-none bg-red-500/[0.02]">
                                    {item.year}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
});
const getSeriesYear = (title: string, mediaYear?: number, startDate?: string): number | string => {
    const titleLower = title.toLowerCase();

    // 1. Explicit mappings for Dragon Ball franchise to guarantee correct sorting in all circumstances
    if (titleLower.includes('daima')) return 2024;
    if (titleLower.includes('super')) return 2015;
    if (titleLower.includes('gt')) return 1996;
    if (titleLower.includes('kai') || titleLower.includes('seldion')) return 2009;
    if (titleLower.includes('dbz') || (titleLower.includes('dragon ball') && titleLower.match(/\bz\b/))) return 1989;
    if (titleLower.includes('dragon ball') || titleLower.includes('original')) {
        if (!titleLower.includes('daima') && !titleLower.includes('super') && !titleLower.includes('gt') && !titleLower.includes('kai') && !titleLower.match(/\bz\b/)) {
            return 1986;
        }
    }

    // 2. Try parsing year from startDate (e.g. ISO string "2024-10-11T00:00:00Z")
    if (startDate) {
        const match = startDate.match(/^(\d{4})/);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && parsed > 1900) {
                return parsed;
            }
        }
    }

    // 3. Fallback to mediaYear
    if (mediaYear && mediaYear > 0) {
        return mediaYear;
    }

    return 'N/A';
};

function SeriesFullscreenIndex() {
    const navigate = useNavigate();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const { data: collection, isLoading } = useGetLibraryCollection();

    const handleNavigate = useCallback((id: string) => {
        navigate({ to: '/series/$seriesId', params: { seriesId: id } });
    }, [navigate]);

    const seriesList = useMemo(() => {
        if (!collection?.lists) return [];
        const raw = collection.lists
            .flatMap(list => list.entries || [])
            .filter(entry => entry.media?.format !== "MOVIE");

        const unique = new Map<number, NonNullable<typeof raw[0]>>();
        raw.forEach(s => { if (s.mediaId) unique.set(s.mediaId, s); });
        const filtered = Array.from(unique.values());

        const mapped = filtered.map((s) => {
            const media = s.media;
            const title = media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Sin título";
            const totalEps = media?.totalEpisodes || 1;
            const progress = s.listData?.progress || 0;
            const progressPercent = Math.min(100, Math.round((progress / (totalEps > 0 ? totalEps : 1)) * 100));
            const yearVal = getSeriesYear(title, media?.year, media?.startDate);

            return {
                id: s.mediaId as number,
                title,
                eps: media?.totalEpisodes || 0,
                year: yearVal,
                yearNum: yearVal === 'N/A' ? 9999 : Number(yearVal),
                progress: progressPercent,
                img: media?.bannerImage || media?.posterImage || '',
                poster: media?.posterImage || media?.bannerImage || '',
                desc: media?.description?.replace(/<[^>]*>?/gm, '') || 'Sin descripción',
            };
        });

        // Sort chronologically by release year (ascending)
        return mapped.sort((a, b) => a.yearNum - b.yearNum);
    }, [collection]);

    useEffect(() => {
        if (seriesList.length > 0) {
            setSelectedId(prev => prev ?? seriesList[0].id);
        }
    }, [seriesList]);

    return (
        <div className="w-full h-full flex flex-col bg-[#06080d] text-white font-sans overflow-hidden">
            <main className="flex-1 min-h-0 flex bg-[#0d0f14] overflow-x-auto overflow-y-hidden no-scrollbar">
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/50 tracking-widest uppercase text-sm font-black">
                            Cargando colección...
                        </span>
                    </div>
                ) : seriesList.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/50 tracking-widest uppercase text-sm font-black">
                            No hay series en tu colección
                        </span>
                    </div>
                ) : (
                    seriesList.map((item) => (
                        <SeriesCard
                            key={item.id}
                            item={item}
                            isSelected={item.id === selectedId}
                            onNavigate={handleNavigate}
                            onSelect={setSelectedId}
                        />
                    ))
                )}
            </main>

            <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
        </div>
    );
}