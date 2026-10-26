import * as React from "react"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { IconNavigationSearch, IconUiClose, IconArrowDownUp, IconNavigationChevronDown } from "@/components/ui/icons";
import { Button } from "@/components/ui/button"
import { Popover } from "@/components/ui/popover/popover"
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control"
import { cn } from "@/components/ui/core/styling"
import { SortOption, SORT_OPTIONS, MOVIE_STATUS_OPTIONS, formatDecade, type MovieStatus } from "./movies-utils"

interface MoviesFilterBarProps {
    searchQuery: string
    setSearchQuery: (query: string) => void
    sortBy: SortOption
    setSortBy: (sort: SortOption) => void
    status: MovieStatus
    setStatus: (status: MovieStatus) => void
    /** Cuántas películas hay por estado (con la era y la década elegidas): los chips lo muestran. */
    statusCounts: Record<MovieStatus, number>
    /** Década elegida (1990) o null = todas. */
    decade: number | null
    setDecade: (decade: number | null) => void
    /** Décadas que existen en la biblioteca; con una sola no se muestra el menú. */
    decades: number[]
    filteredCount: number
    totalCount: number
    hasActiveFilters: boolean
    onResetFilters: () => void
}

/** Menú desplegable de una sola elección (Orden, Década): comparte cierre por clic fuera y Esc. */
function ChoiceMenu<T extends string | number>({
    label,
    icon,
    current,
    shortLabel,
    options,
    onChange,
    active,
    align = "left",
}: {
    label: string
    icon?: React.ReactNode
    current: T
    shortLabel: string
    options: { value: T; label: string }[]
    onChange: (value: T) => void
    /** true = hay una elección distinta de la de fábrica: el botón lo marca. */
    active?: boolean
    /** Lado del botón al que se alinea el menú (en móvil el botón de Orden queda a la izquierda). */
    align?: "left" | "right"
}) {
    const [open, setOpen] = React.useState(false)
    const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([])
    const reduceMotion = useReducedMotion()
    const currentLabel = options.find((o) => o.value === current)?.label ?? shortLabel

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            modal={false}
            align={align === "left" ? "start" : "end"}
            sideOffset={6}
            className="w-48 rounded-2xl p-1"
            aria-label={label}
            onOpenAutoFocus={(event) => {
                event.preventDefault()
                const selectedIndex = options.findIndex((option) => option.value === current)
                optionRefs.current[Math.max(0, selectedIndex)]?.focus()
            }}
            onKeyDown={(event) => {
                const index = optionRefs.current.findIndex((option) => option === document.activeElement)
                let next: number
                if (event.key === "ArrowDown") next = (index + 1) % options.length
                else if (event.key === "ArrowUp") next = (index - 1 + options.length) % options.length
                else if (event.key === "Home") next = 0
                else if (event.key === "End") next = options.length - 1
                else return
                event.preventDefault()
                optionRefs.current[next]?.focus()
            }}
            trigger={
                <Button
                    intent="glass"
                    aria-label={`${label}: ${currentLabel}`}
                    iconSpacing="0.375rem"
                    leftIcon={icon}
                    rightIcon={
                        <m.span animate={{ rotate: open ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}>
                            <IconNavigationChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
                        </m.span>
                    }
                    className={cn(active && "ring-1 ring-inset ring-[var(--neutral-separator)]")}
                >
                    <span className="hidden md:inline">{currentLabel}</span>
                    <span className="md:hidden">{shortLabel}</span>
                </Button>

            }
        >
            <div role="group" aria-label={label}>
                {options.map((opt, index) => (
                    <button
                        key={String(opt.value)}
                        ref={(node) => { optionRefs.current[index] = node }}
                        type="button"
                        aria-pressed={current === opt.value}
                        onClick={() => {
                            onChange(opt.value)
                            setOpen(false)
                        }}
                        className={cn(
                            "w-full flex min-h-11 items-center justify-between gap-2 px-3 rounded-xl type-label text-left outline-none transition-[background-color,color] duration-fast ease-out-strong cursor-pointer",
                            "focus-visible:ring-2 focus-visible:ring-brand-accent",
                            current === opt.value
                                ? "bg-[var(--selected-bg)] text-[var(--selected-fg)]"
                                : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                        )}
                    >
                        <span>{opt.label}</span>
                        {current === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-[var(--selected-fg)]" />}
                    </button>
                ))}
            </div>
        </Popover>
    )
}

const ALL_DECADES = -1

export const MoviesFilterBar = React.memo(function MoviesFilterBar({
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    status,
    setStatus,
    statusCounts,
    decade,
    setDecade,
    decades,
    filteredCount,
    totalCount,
    hasActiveFilters,
    onResetFilters,
}: MoviesFilterBarProps) {
    const searchInputRef = React.useRef<HTMLInputElement>(null)

    // Atajo '/' para enfocar el buscador instantáneamente
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                e.preventDefault()
                // Captura + stopPropagation: la paleta global también escucha '/' (en document) y,
                // al correr antes en la fase de burbuja, abría el diálogo en vez de enfocar este campo.
                e.stopPropagation()
                searchInputRef.current?.focus()
            }
        }
        window.addEventListener("keydown", handleKeyDown, true)
        return () => window.removeEventListener("keydown", handleKeyDown, true)
    }, [])

    const reduceMotion = useReducedMotion()
    // El atajo "/" solo se anuncia donde hay teclado y puntero fino.
    const hasKeyboard = React.useMemo(() => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches, [])
    // Estados de visionado como opciones del SegmentedControl: cada una lleva su conteo y su nombre accesible con el número.
    const statusSegments = React.useMemo<ReadonlyArray<SegmentedOption<MovieStatus>>>(
        () => MOVIE_STATUS_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
            count: statusCounts[opt.value],
            ariaLabel: `${opt.label}: ${statusCounts[opt.value]}`,
        })),
        [statusCounts],
    )
    const decadeOptions = React.useMemo(
        () => [{ value: ALL_DECADES, label: "Todas las décadas" }, ...decades.map((d) => ({ value: d, label: formatDecade(d) }))],
        [decades],
    )

    return (
        <div className="w-full flex flex-col gap-3 select-none pb-4">
            <div className="flex flex-wrap items-center gap-2.5 w-full">
                {/* Campo de búsqueda */}
                <div className="relative basis-full sm:basis-auto sm:w-64">
                    <IconNavigationSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-on-surface-variant/70 pointer-events-none" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={hasKeyboard ? "Buscar película… (/)" : "Buscar película…"}
                        aria-label="Buscar película"
                        className="glass-frosted-pill w-full min-h-11 py-1.5 pl-10 pr-9 text-xs font-medium text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-brand-accent/40 transition-[border-color,box-shadow] duration-base ease-smooth-out"
                    />
                    <AnimatePresence>
                        {searchQuery && (
                            // Wrapper animado centrado con flex: un transform inline de framer pisaría el -translate-y-1/2 de Tailwind y el botón quedaba bajo el campo.
                            <m.div
                                key="clear-search"
                                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                                className="absolute right-1 inset-y-0 flex items-center z-10"
                            >
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    aria-label="Limpiar búsqueda"
                                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface active:scale-95 transition-[color,transform] duration-fast ease-smooth-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                                >
                                    <IconUiClose className="w-3.5 h-3.5" />
                                </button>
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>

                {decades.length > 1 && (
                    <ChoiceMenu<number>
                        label="Década"
                        current={decade ?? ALL_DECADES}
                        shortLabel={decade ? String(decade) : "Década"}
                        options={decadeOptions}
                        onChange={(v) => setDecade(v === ALL_DECADES ? null : v)}
                        active={decade != null}
                        align="right"
                    />
                )}

                <ChoiceMenu<SortOption>
                    label="Ordenar por"
                    icon={<IconArrowDownUp className="w-3.5 h-3.5 text-on-surface-variant" />}
                    current={sortBy}
                    shortLabel="Orden"
                    options={SORT_OPTIONS}
                    onChange={setSortBy}
                />
            </div>

            {/* Estado de visionado: segmented control con conteo; el activo se lee de un vistazo */}
            <div className="flex items-center gap-2 -mx-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SegmentedControl<MovieStatus>
                    options={statusSegments}
                    value={status}
                    onChange={setStatus}
                    layoutId="movies-status-indicator"
                    aria-label="Filtrar por estado"
                    tone="accent"
                    surface="glass"
                    labelStyle="sentence"
                    className="shrink-0"
                />
                {hasActiveFilters && (
                    <Button size="sm" intent="ghost" onClick={onResetFilters} className="shrink-0 text-label-2">
                        Limpiar filtros
                    </Button>
                )}
            </div>

            {/* Resultado del filtro para lectores de pantalla (el contador visible va en la cabecera) */}
            <p className="sr-only" role="status" aria-live="polite">
                {filteredCount === totalCount
                    ? `${totalCount} ${totalCount === 1 ? "película" : "películas"}`
                    : `${filteredCount} de ${totalCount} películas`}
            </p>
        </div>
    )
})
