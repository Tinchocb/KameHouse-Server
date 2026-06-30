import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useGetLibraryCollection, fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { SeriesCard, getVhsColor } from './-SeriesCard';
import { getLargeResImage } from '@/lib/helpers/images';
import { useIntelligenceStore } from '@/hooks/use-home-intelligence';
import { getSeriesIdFromMedia, getSeriesYear } from '@/lib/helpers/series';

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

function SeriesFullscreenIndex() {
    const navigate = useNavigate();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl);

    const { data: collection, isLoading } = useGetLibraryCollection();

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

        return mapped.sort((a, b) => a.yearNum - b.yearNum);
    }, [collection]);

    const [prevSeriesList, setPrevSeriesList] = useState(seriesList);
    useEffect(() => {
        if (seriesList !== prevSeriesList) {
            setPrevSeriesList(seriesList);
            if (seriesList.length > 0) {
                setSelectedId(prev => prev ?? seriesList[0].id);
            }
        }
    }, [seriesList, prevSeriesList]);

    const selectedIndex = useMemo(() => {
        return seriesList.findIndex(item => item.id === selectedId);
    }, [seriesList, selectedId]);
    const selectedItem = seriesList[selectedIndex] ?? null;

    return (
        <div className="w-full h-full flex flex-col bg-transparent text-on-surface font-sans overflow-hidden relative p-4 md:p-6">
            {/* Ambient Background Glow */}
            {selectedItem && (
                <div
                    className="absolute top-1/2 left-0 w-[700px] h-[700px] pointer-events-none blur-[100px] z-0"
                    style={{
                        opacity: 0.06,
                        background: `radial-gradient(circle, ${getVhsColor(selectedItem.id)} 0%, transparent 70%)`,
                        transform: `translate3d(calc(${(selectedIndex / Math.max(seriesList.length - 1, 1)) * 80 + 10}% - 350px), -50%, 0)`,
                        transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background 700ms ease-out',
                    }}
                />
            )}

            {/* CRT scanlines */}
            <div className="absolute inset-0 pointer-events-none z-[49] opacity-[0.015] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />

            {/* Main Shelf Container */}
            <div className="flex-1 min-h-0 bg-surface/90 backdrop-blur-[var(--blur-overlay-xl)] rounded-[var(--radius-corner-lg)] border border-outline-variant/50 shadow-elevation-3 overflow-hidden relative z-10 flex flex-col">
                <main className="w-full h-full flex bg-transparent overflow-x-auto overflow-y-hidden no-scrollbar relative z-10 scroll-smooth" style={{ scrollSnapType: 'x proximity', scrollPadding: '0 16px' }}>
                    {/* Backlight Glow inside shelf */}
                    {selectedItem && (
                        <div
                            className="absolute top-1/2 left-0 w-[500px] h-[500px] pointer-events-none blur-[80px] z-0"
                            style={{
                                opacity: 0.12,
                                background: `radial-gradient(circle, ${getVhsColor(selectedItem.id)} 0%, transparent 60%)`,
                                transform: `translate3d(calc(${(selectedIndex / Math.max(seriesList.length - 1, 1)) * 80 + 10}% - 250px), -50%, 0)`,
                                transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background 700ms ease-out',
                            }}
                        />
                    )}

                    {isLoading && seriesList.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center relative z-10">
                            <span className="text-on-surface-variant tracking-widest uppercase text-sm font-black animate-pulse">
                                Cargando colección...
                            </span>
                        </div>
                    ) : seriesList.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center relative z-10">
                            <span className="text-on-surface-variant tracking-widest uppercase text-sm font-black">
                                No hay series en tu colección
                            </span>
                        </div>
                    ) : (
                        seriesList.map((item) => (
                            <SeriesCard
                                key={item.id}
                                item={item}
                                isSelected={item.id === selectedId}
                                onNavigate={() => handleNavigate(item.id.toString())}
                                onSelect={setSelectedId}
                            />
                        ))
                    )}
                </main>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}