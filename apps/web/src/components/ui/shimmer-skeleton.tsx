import { HERO_STAGE_CLASS } from "@/lib/config/hero-stage"
import { Skeleton } from "@/components/ui/skeleton/skeleton"
import { cn } from "@/components/ui/core/styling"
import { useEraRailReservation } from "@/components/ui/era-rail"

// Renders a cinematic detail skeleton that mirrors MediaHero (series/movies):
// black surface + white-tone border, same heights so there's no layout shift.
export function BentoDetailsSkeleton({ className, isMovie = false }: { className?: string; isMovie?: boolean }) {
    if (isMovie) {
        // Misma geometría que DetailHero (fichas de película): contenedor, póster y columna de texto con las
        // mismas clases, así al llegar los datos nada se mueve (el póster compartido aterriza en su sitio).
        return (
            <div role="status" aria-label="Cargando película" className={cn("relative min-h-screen text-on-surface overflow-x-hidden", className)}>
                <section className="relative isolate w-full min-h-screen flex items-end bg-bg-primary overflow-hidden">
                    <div className="relative z-hero-content page-container pt-28 pb-16 md:pb-20 w-full flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8 md:gap-10 lg:gap-14">
                        {/* Póster */}
                        <Skeleton className="shrink-0 w-36 sm:w-44 md:w-52 lg:w-60 aspect-[2/3] h-auto rounded-2xl" />
                        <div className="flex-1 min-w-0 flex max-w-[720px] w-full flex-col items-start gap-4 md:gap-5">
                            <Skeleton className="h-5 w-28 rounded-full" />
                            <Skeleton className="h-14 md:h-20 w-3/4 max-w-lg rounded-xl" />
                            <Skeleton className="h-5 w-64 max-w-full rounded-lg" />
                            <Skeleton className="h-16 w-full max-w-xl rounded-xl" />
                            <div className="flex w-full flex-wrap items-center gap-3 pt-1">
                                <Skeleton className="h-12 w-40 rounded-full" />
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <Skeleton className="h-12 w-12 rounded-full" />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )
    }

    return (
        <div role="status" aria-label="Cargando contenido" className={cn("relative min-h-screen text-on-surface overflow-x-hidden", className)}>
            <div className="relative z-10 flex flex-col page-container pt-nav pb-8 space-y-4">
                {/* Hero cinematográfico — espeja MediaHero min-h-[70svh] */}
                <div className="relative w-full min-h-[70svh] lg:min-h-[80svh] rounded-3xl overflow-hidden border border-white/[0.13] bg-bg-primary shadow-glass-highlight-sm flex flex-col justify-end p-6 sm:p-8 md:p-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 md:gap-10">
                        {/* Póster */}
                        <Skeleton className="w-24 sm:w-32 md:w-36 lg:w-44 shrink-0 aspect-[2/3] h-auto rounded-2xl" />
                        <div className="flex-1 flex flex-col gap-4 w-full">
                            <Skeleton className="h-6 w-28 rounded-full" />
                            <Skeleton className="h-10 sm:h-12 w-3/4 max-w-lg rounded-xl" />
                            <Skeleton className="h-6 w-64 max-w-full rounded-lg" />
                            <Skeleton className="h-14 w-full max-w-xl rounded-xl" />
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                                <Skeleton className="h-10 w-36 rounded-full" />
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <Skeleton className="h-10 w-10 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lower hub — espeja SeriesEpisodesTab: segmented + grid */}
                <Skeleton className="h-12 w-full rounded-full" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex flex-col gap-2.5">
                    <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
/**
 * HomeSkeleton — espeja la caja de MediaSpotlight (section.pt-nav) y su hub por defecto (Sagas):
 *   - Reserva el mismo margen del selector de eras que el contenido real (html[data-era-rail]),
 *     así el hero no cambia de x ni de y al llegar los datos.
 *   - Hero con HERO_STAGE_CLASS; hub con cabecera, selector Sagas/Películas y rejilla 16:9.
 *
 * Usar durante la carga inicial de la ruta Home para evitar layout shift.
 */
export function HomeSkeleton({ className }: { className?: string }) {
    useEraRailReservation()
    return (
        <div role="status" aria-label="Cargando contenido" className={cn("relative min-h-screen text-on-surface overflow-x-hidden", className)}>
            <div className="relative pt-nav pb-8 w-full max-w-content-desktop mx-auto flex flex-col justify-start space-y-4 px-4 sm:px-6 md:px-8 lg:px-10">
                {/* Hero cinematográfico — espeja HERO_STAGE_CLASS. El hero real recibe mt-4 del space-y de su caja */}
                <Skeleton className={cn("relative z-10 mt-4 w-full rounded-3xl", HERO_STAGE_CLASS)} />

                {/* Hub inferior (SpotlightLowerHub): cabecera de sección, selector Sagas/Películas y rejilla */}
                <div className="relative z-10 w-full pt-4 md:pt-6">
                    <div className="relative z-10 text-left space-y-4 pt-1 w-full">
                        <div className="flex items-center justify-between gap-3 h-[51px] md:h-[55px]">
                            <Skeleton className="h-5 w-44 rounded-md" />
                            <Skeleton className="h-6 w-28 rounded-full" />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 pt-1">
                            <Skeleton className="h-[54px] w-[351px] max-w-full rounded-full" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1 pb-4 w-full">
                            {/* En móvil (1 columna) cada celda ocupa 209 px con su hueco: se pintan 7 arcos, como la era DB
                                en DRAGON_BALL_SAGAS. La 8.ª celda aparece desde sm, donde 7 u 8 celdas ocupan las mismas filas. */}
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <Skeleton key={idx} className={cn("aspect-[16/9] h-auto w-full rounded-2xl", idx === 7 && "hidden sm:block")} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
