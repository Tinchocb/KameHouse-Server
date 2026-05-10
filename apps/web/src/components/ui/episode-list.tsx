import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { SagaTabs } from "./season-selector"
import { EpisodeCardContent } from "./episode-card"

export interface Episode {
    id: string | number
    number: number
    title: string
    synopsis?: string
    durationMin?: number
    thumbnailUrl?: string
    airDate?: string
    watched?: boolean
    isEpic?: boolean
    isFiller?: boolean
    hasLocalFile?: boolean
    mediaId?: number
}

export interface Saga {
    id: string | number
    title: string
    episodes: Episode[]
}

export interface EpisodeListProps {
    sagas: Saga[]
    defaultSagaId?: string | number
    onPlayEpisode?: (episode: Episode, saga: Saga) => void
    className?: string
}

interface EpisodeGridProps {
    episodes: Episode[]
    saga: Saga
    onPlay?: (episode: Episode, saga: Saga) => void
}

function EpisodeGrid({ episodes, saga, onPlay }: EpisodeGridProps) {
    const listRef = React.useRef<HTMLUListElement>(null)

    const [scrollMargin, setScrollMargin] = React.useState(0)

    React.useLayoutEffect(() => {
        if (listRef.current) {
            setScrollMargin(listRef.current.offsetTop)
        }
    }, [])

    const virtualizer = useWindowVirtualizer({
        count: episodes.length,
        estimateSize: () => 148,
        overscan: 5,
        scrollMargin,
    })

    const items = virtualizer.getVirtualItems()

    return (
        <ul
            ref={listRef}
            role="list"
            aria-label={`Episodios de ${saga.title}`}
            style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: "relative",
                width: "100%",
            }}
        >
            {items.map((virtualRow) => {
                const episode = episodes[virtualRow.index]
                if (!episode) return null

                return (
                    <li
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${
                                virtualRow.start - virtualizer.options.scrollMargin
                            }px)`,
                            contentVisibility: "auto",
                            containIntrinsicSize: "auto 148px",
                            paddingBottom: "4px"
                        }}
                    >
                        <EpisodeCardContent
                            episode={episode}
                            saga={saga}
                            onPlay={onPlay}
                        />
                    </li>
                )
            })}
        </ul>
    )
}

export function EpisodeList({
    sagas,
    defaultSagaId,
    onPlayEpisode,
    className,
}: EpisodeListProps) {
    const [activeSagaId, setActiveSagaId] = React.useState<string | number>(
        defaultSagaId ?? sagas[0]?.id ?? "",
    )

    const activeSaga = sagas.find((s) => s.id === activeSagaId) ?? sagas[0]

    if (!sagas.length) {
        return (
            <div className={cn("flex items-center justify-center py-16 text-zinc-600 text-sm", className)}>
                No hay episodios disponibles.
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {sagas.length > 1 && (
                <SagaTabs
                    sagas={sagas}
                    activeSagaId={activeSagaId}
                    onSelect={(id) => {
                        window.scrollTo({ top: 0, behavior: "instant" })
                        setActiveSagaId(id)
                    }}
                />
            )}

            <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                    {activeSaga?.title}
                </h2>
                <span className="text-zinc-600 text-xs font-medium">
                    {activeSaga?.episodes.length ?? 0} episodios
                </span>
            </div>

            {activeSaga && (
                <EpisodeGrid
                    key={activeSaga.id}
                    episodes={activeSaga.episodes}
                    saga={activeSaga}
                    onPlay={onPlayEpisode}
                />
            )}
        </div>
    )
}
