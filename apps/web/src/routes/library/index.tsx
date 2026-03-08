import { createFileRoute } from "@tanstack/react-router"
import React from "react"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetLocalFiles } from "@/api/hooks/localfiles.hooks"
import { MediaCard } from "@/components/ui/media-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs/tabs"
import { Anime_LocalFile, Models_LibraryMedia, Anime_LibraryCollectionEntry } from "@/api/generated/types"

export const Route = createFileRoute("/library/")({
    component: LibraryPage,
})

function getTitle(media: Models_LibraryMedia | null | undefined): string {
    return media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Desconocido"
}

function LibraryPage() {
    const { data: libraryData, isLoading: libLoading } = useGetLibraryCollection()
    const { data: localData, isLoading: locLoading } = useGetLocalFiles()

    const lists = libraryData?.lists || []
    const currentlyWatching = lists.find(l => l.status === "CURRENT")?.entries || []
    const planned = lists.find(l => l.status === "PLANNING")?.entries || []
    const completed = lists.find(l => l.status === "COMPLETED")?.entries || []

    const renderGrid = (entries: Anime_LibraryCollectionEntry[], emptyMessage: string) => {
        if (!entries || entries.length === 0) {
            return <div className="text-zinc-600 font-medium py-10 text-center">{emptyMessage}</div>
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 pt-4">
                {entries.map((entry, idx) => {
                    const media = entry.media
                    if (!media) return null

                    // Progress calc if currently watching
                    let progress = 0
                    if (entry.listData?.progress && media.totalEpisodes && media.totalEpisodes > 0) {
                        progress = (entry.listData.progress / media.totalEpisodes) * 100
                    }

                    return (
                        <MediaCard
                            key={media.id || idx}
                            title={getTitle(media)}
                            artwork={media.posterImage || media.bannerImage || "https://placehold.co/220x330/1A1A1A/FFFFFF?text=Sin+Poster"}
                            badge={media.format || undefined}
                            aspect="poster"
                            progress={progress > 0 ? progress : undefined}
                            className="w-full"
                            onClick={() => window.location.href = `/series/${media.id}`}
                        />
                    )
                })}
            </div>
        )
    }

    return (
        <div className="flex-1 w-full flex flex-col p-8 bg-[#0B0B0F] text-white overflow-y-auto">
            <h1 className="text-4xl font-black mb-8 tracking-tight">MI <span className="text-orange-500">BIBLIOTECA</span></h1>

            <Tabs defaultValue="current" className="w-full">
                <TabsList className="flex w-full justify-start items-center gap-6 border-b border-[#1C1C28] pb-0 mb-6 bg-transparent p-0 h-auto">
                    <TabsTrigger
                        value="current"
                        className="text-lg font-bold pb-3 px-0 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 rounded-none bg-transparent m-0 data-[state=active]:bg-transparent hover:text-white transition-colors"
                    >
                        Viendo actualmente
                    </TabsTrigger>
                    <TabsTrigger
                        value="planned"
                        className="text-lg font-bold pb-3 px-0 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 rounded-none bg-transparent m-0 data-[state=active]:bg-transparent hover:text-white transition-colors"
                    >
                        Planeado
                    </TabsTrigger>
                    <TabsTrigger
                        value="completed"
                        className="text-lg font-bold pb-3 px-0 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 rounded-none bg-transparent m-0 data-[state=active]:bg-transparent hover:text-white transition-colors"
                    >
                        Completados
                    </TabsTrigger>
                    <TabsTrigger
                        value="local"
                        className="text-lg font-bold pb-3 px-0 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 rounded-none bg-transparent m-0 data-[state=active]:bg-transparent hover:text-white transition-colors"
                    >
                        Archivos Locales
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="current">
                    {libLoading ? <div className="py-20 text-center animate-pulse text-orange-500 font-semibold text-lg">Cargando biblioteca...</div> : renderGrid(currentlyWatching, "No estás viendo ninguna serie ahora mismo.")}
                </TabsContent>

                <TabsContent value="planned">
                    {libLoading ? <div className="py-20 text-center animate-pulse text-orange-500 font-semibold text-lg">Cargando biblioteca...</div> : renderGrid(planned, "No tienes series planeadas para ver.")}
                </TabsContent>

                <TabsContent value="completed">
                    {libLoading ? <div className="py-20 text-center animate-pulse text-orange-500 font-semibold text-lg">Cargando biblioteca...</div> : renderGrid(completed, "Aún no has completado ninguna serie.")}
                </TabsContent>

                <TabsContent value="local">
                    {locLoading ? (
                        <div className="py-20 text-center animate-pulse text-orange-500 font-semibold text-lg uppercase tracking-widest">Escaneando archivos locales...</div>
                    ) : (!localData || localData.length === 0) ? (
                        <div className="text-zinc-500 font-medium py-10 text-center">No tienes archivos indexados localmente todavía.</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 pt-4">
                            {localData.map((file: Anime_LocalFile, idx: number) => {
                                const parseData: any = file.parsedInfo || (file as any).Parsed || (file as any).parsedData || {}
                                return (
                                    <MediaCard
                                        key={file.path || `local-${idx}`}
                                        title={parseData.title || parseData.Title || (file as any).name || "Archivo genérico"}
                                        artwork="https://placehold.co/220x330/1A1A1A/FFFFFF?text=Archivo+Local"
                                        badge={parseData.resolution || parseData.Resolution || "LOCAL"}
                                        aspect="poster"
                                        className="w-full"
                                    />
                                )
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

