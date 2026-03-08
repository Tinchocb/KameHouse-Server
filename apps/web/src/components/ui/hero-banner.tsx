import { cn } from "@/components/ui/core/styling"
import { Info, Play } from "lucide-react"
import * as React from "react"

export interface HeroBannerItem {
    id: string
    title: string
    synopsis: string
    backdropUrl: string
    posterUrl?: string
    logoUrl?: string
    year?: string | number
    format?: string
    episodeCount?: number
    progress?: number
    onPlay: () => void
    onMoreInfo: () => void
}

export interface HeroBannerProps {
    items: HeroBannerItem[]
    initialIndex?: number
    autoRotateMs?: number
    className?: string
}

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

    React.useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setPrefersReducedMotion(mediaQuery.matches)

        update()
        mediaQuery.addEventListener("change", update)
        return () => mediaQuery.removeEventListener("change", update)
    }, [])

    return prefersReducedMotion
}

export function HeroBanner({
    items,
    initialIndex = 0,
    autoRotateMs = 8000,
    className,
}: HeroBannerProps) {
    const prefersReducedMotion = usePrefersReducedMotion()
    const [activeIndex, setActiveIndex] = React.useState(initialIndex)

    React.useEffect(() => {
        setActiveIndex(initialIndex)
    }, [initialIndex])

    React.useEffect(() => {
        if (prefersReducedMotion || items.length <= 1) {
            return
        }

        const intervalId = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % items.length)
        }, autoRotateMs)

        return () => window.clearInterval(intervalId)
    }, [autoRotateMs, items.length, prefersReducedMotion])

    if (items.length === 0) {
        return null
    }

    const activeItem = items[activeIndex] ?? items[0]

    return (
        <section
            aria-label="Contenido destacado"
            className={cn(
                "relative flex min-h-[720px] w-full items-end overflow-hidden bg-black",
                "h-[100dvh] max-h-[1100px]",
                className,
            )}
        >
            <div className="absolute inset-0">
                {items.map((item, index) => {
                    const isActive = index === activeIndex

                    return (
                        <img
                            key={item.id}
                            src={item.backdropUrl}
                            alt=""
                            aria-hidden="true"
                            className={cn(
                                "absolute inset-0 h-full w-full object-cover object-center",
                                "transition-opacity duration-700 ease-out motion-reduce:transition-none",
                                isActive ? "opacity-100" : "opacity-0",
                            )}
                        />
                    )
                })}
            </div>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_38%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/85 to-transparent" />

            <div className="relative z-10 mx-auto flex w-full max-w-[1680px] flex-col justify-end gap-6 px-6 pb-16 pt-36 md:px-10 lg:px-14 lg:pb-20 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                    <div className="mb-6 flex flex-wrap items-center gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                        {activeItem.format && <span>{activeItem.format}</span>}
                        {activeItem.year !== undefined && <span>{activeItem.year}</span>}
                        {activeItem.episodeCount !== undefined && <span>{activeItem.episodeCount} episodios</span>}
                    </div>

                    {activeItem.logoUrl ? (
                        <img
                            src={activeItem.logoUrl}
                            alt={activeItem.title}
                            className="mb-6 max-h-28 max-w-[min(32rem,80vw)] object-contain object-left"
                        />
                    ) : (
                        <h1 className="mb-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.05em] text-white md:text-7xl xl:text-[5.5rem]">
                            {activeItem.title}
                        </h1>
                    )}

                    <p className="max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
                        {activeItem.synopsis || "Sinopsis no disponible."}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={activeItem.onPlay}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black",
                                "transition-colors duration-200 hover:bg-zinc-200 motion-reduce:transition-none",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                            )}
                        >
                            <Play className="h-4 w-4 fill-current" />
                            Reproducir
                        </button>
                        <button
                            type="button"
                            onClick={activeItem.onMoreInfo}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/8 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md",
                                "transition-colors duration-200 hover:bg-white/14 motion-reduce:transition-none",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                            )}
                        >
                            <Info className="h-4 w-4" />
                            Mas info
                        </button>
                    </div>
                </div>

                <div className="hidden w-full max-w-sm xl:block">
                    <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/6 p-4 backdrop-blur-xl">
                        {activeItem.posterUrl ? (
                            <img
                                src={activeItem.posterUrl}
                                alt={activeItem.title}
                                className="aspect-[2/3] w-full rounded-[1.5rem] object-cover shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                            />
                        ) : (
                            <div className="aspect-[2/3] w-full rounded-[1.5rem] bg-zinc-900" />
                        )}

                        {activeItem.progress !== undefined && (
                            <div className="mt-4">
                                <div className="mb-2 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.18em] text-zinc-400">
                                    <span>Continuar viendo</span>
                                    <span>{Math.round(activeItem.progress)}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full rounded-full bg-white"
                                        style={{ width: `${Math.min(100, Math.max(0, activeItem.progress))}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-6 z-10 flex items-center gap-2 md:left-10 lg:left-14">
                {items.map((item, index) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-label={`Mostrar ${item.title}`}
                        aria-pressed={index === activeIndex}
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                            "h-1.5 rounded-full bg-white/20 transition-all duration-300 motion-reduce:transition-none",
                            index === activeIndex ? "w-10 bg-white" : "w-4 hover:bg-white/50",
                        )}
                    />
                ))}
            </div>
        </section>
    )
}
