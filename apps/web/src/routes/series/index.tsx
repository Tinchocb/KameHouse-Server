import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useGetLibraryCollection, fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { SeriesCard, getVhsColor } from './-SeriesCard';
import { getLargeResImage } from '@/lib/helpers/images';
import { useIntelligenceStore } from '@/hooks/use-home-intelligence';
import { useSound } from '@/hooks/use-sound';

export const Route = createFileRoute('/series/')({
    loader: ({ context }) => {
        const qc = context.queryClient
        qc.prefetchQuery({
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

const getSeriesIdFromMedia = (media: any) => {
    if (!media) return ""
    const tmdbId = media.tmdbId || 0
    const title = (media.titleRomaji || media.titleEnglish || media.titleOriginal || "").toLowerCase().replace(/\s+/g, "")
    
    if (tmdbId === 12971 || title.includes("dragonballz") || title === "dbz") return "dragon_ball_z"
    if (tmdbId === 12697 || title.includes("dragonballgt")) return "dragon_ball_gt"
    if (tmdbId === 62715 || title.includes("dragonballsuper")) return "dragon_ball_super"
    if (tmdbId === 236994 || title.includes("dragonballdaima")) return "dragon_ball_daima"
    if (tmdbId === 12609 || title === "dragonball") return "dragon_ball"
    return ""
}

const getSeriesYear = (title: string, mediaYear?: number, startDate?: string): number | string => {
    const titleLower = title.toLowerCase();

    // Mapeos explícitos
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

    if (startDate) {
        const match = startDate.match(/^(\d{4})/);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && parsed > 1900) {
                return parsed;
            }
        }
    }

    if (mediaYear && mediaYear > 0) {
        return mediaYear;
    }

    return 'N/A';
};

function SeriesFullscreenIndex() {
    const navigate = useNavigate();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl);

    const { data: collection, isLoading } = useGetLibraryCollection();
    const { playSound } = useSound();

    const handleSound = useCallback(() => {
        playSound("series", 0.4);
    }, [playSound]);

    useEffect(() => {
        setBackdropUrl("/casa-kame-de-dragon-ball-3963.webp");
        return () => {
            setBackdropUrl(null);
        };
    }, [setBackdropUrl]);

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
                img: getLargeResImage(media?.bannerImage || media?.posterImage || ''),
                poster: getLargeResImage(media?.posterImage || media?.bannerImage || ''),
                desc: media?.description?.replace(/<[^>]*>?/gm, '') || 'Sin descripción',
                seriesId: getSeriesIdFromMedia(media),
            };
        });

        // Orden cronológico
        return mapped.sort((a, b) => a.yearNum - b.yearNum);
    }, [collection]);

    const activeSelectedId = selectedId;

    const selectedIndex = useMemo(() => {
        return seriesList.findIndex(item => item.id === activeSelectedId);
    }, [seriesList, activeSelectedId]);
    const selectedItem = seriesList[selectedIndex] ?? null;

    return (
        <div className="w-full h-full flex flex-col bg-transparent text-white font-sans overflow-hidden relative p-4 md:p-6 md:pl-[110px]">
            {/* Resplandor ambiental de fondo */}
            {selectedItem && (
                <div
                    className="absolute top-1/2 left-0 w-[800px] h-[800px] pointer-events-none z-0"
                    style={{
                        opacity: 0.15,
                        background: `radial-gradient(circle, ${getVhsColor(selectedItem.id)} 0%, transparent 70%)`,
                        transform: `translate3d(calc(${(selectedIndex / Math.max(seriesList.length - 1, 1)) * 80 + 10}% - 400px), -50%, 0)`,
                        transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background 700ms ease-out',
                    }}
                />
            )}

            {/* Estante principal */}
            <div 
                className="flex-1 min-h-0 rounded-[32px] border border-stone-800 shadow-[inset_0_24px_50px_rgba(0,0,0,0.9),inset_0_-24px_50px_rgba(0,0,0,0.9),0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative z-10 flex flex-col"
                style={{
                    background: 'linear-gradient(to right, #140b07 0%, #25130b 50%, #140b07 100%)',
                }}
            >
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(0deg,transparent_50%,rgba(255,255,255,0.1)_50%)] bg-[length:100%_4px] z-10" />
                
                <main className="w-full h-full flex bg-transparent overflow-x-auto overflow-y-hidden no-scrollbar relative z-10 pb-6">
                    {selectedItem && (
                        <div
                            className="absolute top-1/2 left-0 w-[600px] h-[600px] pointer-events-none z-0"
                            style={{
                                opacity: 0.20,
                                background: `radial-gradient(circle, ${getVhsColor(selectedItem.id)} 0%, transparent 60%)`,
                                transform: `translate3d(calc(${(selectedIndex / Math.max(seriesList.length - 1, 1)) * 80 + 10}% - 300px), -50%, 0)`,
                                transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background 700ms ease-out',
                            }}
                        />
                    )}
                    
                    {isLoading && seriesList.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center relative z-10">
                            <span className="text-white/50 tracking-widest uppercase text-sm font-black animate-pulse">
                                Cargando colección...
                            </span>
                        </div>
                    ) : seriesList.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center relative z-10">
                            <span className="text-white/50 tracking-widest uppercase text-sm font-black">
                                No hay series en tu colección
                            </span>
                        </div>
                    ) : (
                        seriesList.map((item) => (
                            <SeriesCard
                                key={item.id}
                                item={item}
                                isSelected={item.id === activeSelectedId}
                                onNavigate={handleNavigate}
                                onSelect={setSelectedId}
                                onSound={handleSound}
                            />
                        ))
                    )}
                </main>
                
                {/* Base del estante */}
                <div 
                    className="absolute bottom-0 left-0 right-0 h-6 z-30 pointer-events-none border-t border-amber-950/20" 
                    style={{
                        background: 'linear-gradient(to bottom, #502e1b, #321c10 40%, #1a0f08 100%)',
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.6), inset 0 2px 2px rgba(255,255,255,0.06)'
                    }}
                />
            </div>
        </div>
    );
}