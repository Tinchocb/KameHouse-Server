import React from "react"
import { flushSync } from "react-dom"
import { m, AnimatePresence, useIsPresent, type Transition } from "framer-motion"
import { useNavigate } from "@tanstack/react-router"
import { IconMediaQueue, IconUiClose, IconMediaPlay, IconNavigationChevronUp, IconNavigationChevronDown, IconUiTrash, IconMediaSkipPrevious, IconMediaShuffle, IconMediaRepeat } from "@/components/ui/icons";
import { useQueueStore, useUIStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/components/ui/core/styling"
import { Button, IconButton } from "@/components/ui/button"
import { DeferredImage } from "@/components/shared/deferred-image"
import { ElasticCounter, HoldConfirm } from "@/components/ui/kinetics"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { useVirtualizer } from "@tanstack/react-virtual"

// Velo y panel siguen montados hasta que el panel termina de salir (framer desmonta el
// fragmento entero). Mientras salen (useIsPresent en false) dejan pasar los clics a la
// página en lugar de tragárselos, como el velo de Mi Lista del reproductor.

function QueueBackdrop({ onClose }: { onClose: () => void }) {
    const isPresent = useIsPresent()
    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn(
                "fixed inset-0 z-overlay bg-black/45 backdrop-blur-overlay-sm",
                isPresent ? "pointer-events-auto" : "pointer-events-none"
            )}
        />
    )
}

const QueuePanel = React.forwardRef<HTMLDivElement, { transition: Transition; children: React.ReactNode }>(
    ({ transition, children }, ref) => {
        const isPresent = useIsPresent()
        return (
            <m.div
                ref={ref}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={transition}
                role="dialog"
                aria-modal="true"
                aria-label="Mi Lista"
                className={cn(
                    "fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-modal flex flex-col select-none scroll-mt-28 [background:var(--glass-frosted-bg)] backdrop-blur-overlay-md border-l border-white/15 shadow-elevation-4",
                    isPresent ? "pointer-events-auto" : "pointer-events-none"
                )}
                style={{
                    // 24 px (estándar de sidebars, DESIGN-GUIDE §2). En plano, `backdrop-filter: none !important` de blur.css gana.
                    backdropFilter: "blur(var(--blur-overlay-md)) saturate(var(--glass-saturate-frosted))",
                    WebkitBackdropFilter: "blur(var(--blur-overlay-md)) saturate(var(--glass-saturate-frosted))",
                }}
            >
                {children}
            </m.div>
        )
    }
)
QueuePanel.displayName = "QueuePanel"

// Estimación de alto de fila antes de medirla (el virtualizador la corrige al montar). Separación
// entre filas y padding de la lista: los mismos valores que antes daba gap-3 y py-5.
const QUEUE_ROW_ESTIMATE_PX = 104
const QUEUE_ROW_GAP_PX = 12
const QUEUE_LIST_PADDING_PX = 20
// Tiempo de la salida de una fila (quitarla o vaciar la cola): la animación dura 180 ms, con margen.
const SALIDA_FILA_MS = 400

// Salida de una fila. Solo corre cuando el usuario la quita o se vacía la cola (ver quitarFila): las filas que el
// scroll saca de la ventana se desmontan sin salida, porque con salida se acumulaban en el DOM y el scroll se trababa.
export function salidaDeFila(saliendo: boolean, reducirMovimiento: boolean) {
    if (!saliendo) return undefined
    return reducirMovimiento ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.18 } }
}

// Cascada de entrada de una fila. Solo escalona la primera vez que la fila aparece en esta apertura del panel
// (hasta la fila 8, ~0,42 s). La lista virtualizada desmonta las filas que salen del scroll y las vuelve a montar
// al volver: una fila que ya estuvo entra visible, sin animar ni esperar. `mostradas` guarda las claves ya mostradas.
export function entradaFilaCola(mostradas: ReadonlySet<string>, clave: string, idx: number) {
    if (mostradas.has(clave)) return { animar: false, retraso: 0 }
    return { animar: true, retraso: idx < 8 ? idx * 0.06 : 0 }
}

export const GlobalQueueSidebar = () => {
    const navigate = useNavigate()
    const prefersReducedMotion = useReducedMotion()
    const entranceSpring = useSpringPreset("entrance")
    const tabContentSpring = useSpringPreset("tabContent")
    const {
        playlistQueue,
        currentQueueIndex,
        removeFromQueue,
        clearQueue,
        setCurrentQueueIndex,
        shuffleQueue,
        playPrevious,
        queueRepeatMode,
        setQueueRepeatMode,
        moveQueueItem,
    } = useQueueStore(useShallow(state => ({
        playlistQueue: state.playlistQueue,
        currentQueueIndex: state.currentQueueIndex,
        removeFromQueue: state.removeFromQueue,
        clearQueue: state.clearQueue,
        setCurrentQueueIndex: state.setCurrentQueueIndex,
        shuffleQueue: state.shuffleQueue,
        playPrevious: state.playPrevious,
        queueRepeatMode: state.queueRepeatMode,
        setQueueRepeatMode: state.setQueueRepeatMode,
        moveQueueItem: state.moveQueueItem,
    })))
    const {
        globalQueueOpen,
        setGlobalQueueOpen,
    } = useUIStore(useShallow(state => ({
        globalQueueOpen: state.globalQueueOpen,
        setGlobalQueueOpen: state.setGlobalQueueOpen,
    })))

    const panelRef = React.useRef<HTMLDivElement>(null)
    useFocusTrap(panelRef, globalQueueOpen)

    // Cola completa virtualizada: se montan solo las filas visibles (+ overscan) y el resto al hacer
    // scroll. Sin tope de ítems: lo que cuenta la cabecera es lo que se puede reproducir, reordenar y quitar.
    const scrollRef = React.useRef<HTMLDivElement>(null)
    // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer devuelve funciones no memoizables por diseño; React Compiler lo omite a proposito.
    const virtualizer = useVirtualizer({
        count: playlistQueue.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => QUEUE_ROW_ESTIMATE_PX,
        // Misma clave que usaba el map de filas: las alturas medidas siguen al ítem al reordenar.
        getItemKey: (index) => {
            const item = playlistQueue[index]
            return item ? `${String(item.id)}_${String(item.episodeNumber ?? '')}_${String(item.mediaId)}_${item.playableUrl}` : index
        },
        // Overscan 3 (medido en Chrome headless): con 6 el scroll monta el doble de filas y la mediana de frame sube;
        // con 2 no se ven huecos, pero queda menos margen si el render se atrasa en un equipo lento.
        overscan: 3,
        gap: QUEUE_ROW_GAP_PX,
        paddingStart: QUEUE_LIST_PADDING_PX,
        paddingEnd: QUEUE_LIST_PADDING_PX,
        initialRect: { width: 0, height: typeof window !== "undefined" ? window.innerHeight : 800 },
    })

    // Filas ya mostradas en esta apertura del panel, por clave de ítem. La lista virtualizada desmonta una fila al
    // salir del scroll y la vuelve a montar al volver: sin este registro, cada remontaje repetía la cascada.
    // Cada apertura del panel monta la lista de nuevo (clave por apertura): así la cascada de entrada corre en cada
    // apertura, también la primera. Se ajusta durante el render, el patrón de React para estado que depende de una prop.
    const [aperturaId, setAperturaId] = React.useState(0)
    const [abiertaAntes, setAbiertaAntes] = React.useState(globalQueueOpen)
    if (globalQueueOpen !== abiertaAntes) {
        setAbiertaAntes(globalQueueOpen)
        if (globalQueueOpen) setAperturaId((id) => id + 1)
    }
    const filasMostradasRef = React.useRef<Set<string>>(new Set())
    // Las filas de este render. El efecto las lee de acá y no de virtualizer.getVirtualItems(): al medir, el
    // virtualizador achica la ventana después del render, y una fila que el primer render montó (con la altura
    // estimada) y la medición sacó enseguida no quedaba registrada: al volver a aparecer se animaba de nuevo.
    const filasVirtuales = virtualizer.getVirtualItems()
    React.useEffect(() => {
        // GlobalQueueSidebar sigue montado entre aperturas (vive en __root): al cerrar el panel se olvidan las filas,
        // así la siguiente apertura vuelve a escalonar.
        if (!globalQueueOpen) {
            filasMostradasRef.current.clear()
            return
        }
        for (const fila of filasVirtuales) filasMostradasRef.current.add(String(fila.key))
    })

    // Al vaciar con HoldConfirm, el botón se desmonta con el pie y el foco cae a <body>.
    // Se marca acá y el CTA del estado vacío lo recibe cuando termina de entrar.
    const focusEmptyCtaRef = React.useRef(false)
    const emptyCtaRef = React.useRef<HTMLButtonElement>(null)
    // Filas con salida: solo las que el usuario quita, o todas al vaciar. flushSync: la salida tiene que estar en el
    // render de antes de quitar el ítem, porque AnimatePresence usa las props de la última vez que la fila se pintó.
    const [filasSaliendo, setFilasSaliendo] = React.useState<ReadonlySet<string>>(new Set())
    const [vaciando, setVaciando] = React.useState(false)
    const exitTimerRef = React.useRef<number | null>(null)
    const clearTimerRef = React.useRef<number | null>(null)

    React.useEffect(() => {
        return () => {
            if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
            if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
        }
    }, [])

    const quitarFila = (idx: number, clave: string) => {
        flushSync(() => setFilasSaliendo(new Set([clave])))
        removeFromQueue(idx)
        if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = window.setTimeout(() => setFilasSaliendo(new Set()), SALIDA_FILA_MS)
    }
    const handleClearQueue = () => {
        focusEmptyCtaRef.current = true
        flushSync(() => setVaciando(true))
        clearQueue()
        if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
        clearTimerRef.current = window.setTimeout(() => setVaciando(false), SALIDA_FILA_MS)
    }
    const focusEmptyCta = () => {
        if (!focusEmptyCtaRef.current) return
        focusEmptyCtaRef.current = false
        // Solo si el foco sigue perdido: si el usuario ya lo llevó a otro lado (Tab, un campo
        // de texto, otro diálogo), no se lo quitamos.
        const active = document.activeElement
        if (active && active !== document.body) return
        emptyCtaRef.current?.focus({ preventScroll: true })
    }

    // Cerrar con Escape
    React.useEffect(() => {
        if (!globalQueueOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setGlobalQueueOpen(false)
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [globalQueueOpen, setGlobalQueueOpen])

    const isRepeating = queueRepeatMode !== "off"

    return (
        <AnimatePresence>
            {globalQueueOpen && (
                <>
                    {/* Backdrop (z-overlay: 1000) — scrim equilibrado que permite ver la luz de fondo */}
                    <QueueBackdrop onClose={() => setGlobalQueueOpen(false)} />

                    {/* Panel lateral — shell estructurado con desenfoque cinematográfico */}
                    <QueuePanel ref={panelRef} transition={entranceSpring}>
                        {/* Header — patrón .sectionbar-header (Home + Ajustes) */}
                        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--neutral-separator)] shrink-0">
                            <div className="sectionbar-header flex-1 min-w-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="sectionbar-header-icon">
                                        <IconMediaQueue className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="type-headline text-on-surface truncate">
                                                Mi Lista
                                            </h3>
                                            <span className="sectionbar-header-badge">
                                                <span className="text-2xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[var(--neutral-elev-2)] text-on-surface-variant shrink-0 inline-flex items-center justify-center">
                                                    <ElasticCounter value={playlistQueue.length} />
                                                </span>
                                            </span>
                                        </div>
                                        <p className="sectionbar-header-desc">
                                            Reproduce en secuencia sin interrupciones
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <IconButton
                                intent="ghost"
                                onClick={() => setGlobalQueueOpen(false)}
                                aria-label="Cerrar Mi Lista"
                                icon={<IconUiClose className="w-5 h-5" />}
                                className="shrink-0"
                            />
                        </div>

                        {/* Queue Items List — filas sólidas (--neutral-elev-*), sin blur: el panel aporta el único blur */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 sm:px-5">
                            {/* Lista siempre montada, aunque quede vacía: al quitar la última fila o vaciar, la fila
                                sale con su exit. Las filas van absolutas en su posición del virtualizador (top) y el
                                contenedor mide la cola entera. Se monta de nuevo en cada apertura (aperturaId): ahí corre la cascada. */}
                            <div key={aperturaId} className="relative" style={{ height: playlistQueue.length > 0 ? `${virtualizer.getTotalSize()}px` : 0 }}>
                                <AnimatePresence>
                                    {filasVirtuales.map((virtualRow) => {
                                        const idx = virtualRow.index
                                        const item = playlistQueue[idx]
                                        if (!item) return null
                                        const isCurrent = idx === currentQueueIndex
                                        const isHistory = idx < currentQueueIndex
                                        // Cascada solo la primera vez que la fila aparece en esta apertura (ver filasMostradasRef).
                                        const entrada = entradaFilaCola(filasMostradasRef.current, String(virtualRow.key), idx)

                                        return (
                                            <m.div
                                                key={virtualRow.key}
                                                ref={virtualizer.measureElement}
                                                data-index={idx}
                                                initial={entrada.animar ? (prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }) : false}
                                                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                                exit={salidaDeFila(vaciando || filasSaliendo.has(String(virtualRow.key)), prefersReducedMotion === true)}
                                                layout={prefersReducedMotion ? false : "position"}
                                                // Solo se vuelve a medir cuando cambia la cola; sin esto framer mide cada fila en cada render.
                                                layoutDependency={playlistQueue}
                                                // Escalonado solo en la primera aparición de las primeras filas: al remontarse no esperan.
                                                transition={{ ...tabContentSpring, delay: entrada.retraso, layout: tabContentSpring }}
                                                className={cn(
                                                    "absolute left-0 top-0 w-full text-left flex gap-3 p-3 rounded-2xl border transition-[background-color,border-color,color] duration-fast ease-out-strong group items-center",
                                                    "border-[var(--neutral-separator)] bg-[var(--neutral-elev-2)]",
                                                    isCurrent
                                                        ? "bg-[var(--neutral-elev-3)] border-[var(--sectionbar-border-strong)] text-on-surface"
                                                        : isHistory
                                                            ? "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [&_img]:opacity-60 [&_img]:hover:opacity-100"
                                                            : "text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                                )}
                                                style={{
                                                    top: virtualRow.start,
                                                    ...(isCurrent ? { boxShadow: "var(--sectionbar-shadow)", borderTopColor: "var(--sectionbar-border-top-strong)" } : { borderTopColor: "var(--sectionbar-border-top)" }),
                                                }}
                                            >
                                                {/* Clickable Area to play */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCurrentQueueIndex(idx)
                                                        setGlobalQueueOpen(false)
                                                    }}
                                                    aria-label={`Reproducir ${item.title}`}
                                                    aria-current={isCurrent ? "true" : undefined}
                                                    className="flex-1 flex gap-3 cursor-pointer min-w-0 items-center text-left rounded-xl min-h-[44px] active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                                                >
                                                    {/* Thumbnail — aspect-video reservado (anti layout-shift en colapsables) */}
                                                    <div className="relative w-20 sm:w-28 aspect-video bg-surface-container border border-[var(--neutral-separator)] rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                                        {item.thumbnail ? (
                                                            <DeferredImage
                                                                src={item.thumbnail}
                                                                alt={item.title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
                                                                showSkeleton={false}
                                                            />
                                                        ) : (
                                                            <span className="text-2xs font-semibold text-on-surface-variant">Sin imagen</span>
                                                        )}

                                                        {/* Play overlay */}
                                                        <div className={cn(
                                                            "absolute inset-0 flex items-center justify-center transition-[opacity,background-color] duration-fast ease-out-strong",
                                                            isCurrent
                                                                ? "opacity-100 bg-brand-accent/10"
                                                                : "opacity-0 group-hover:opacity-100 bg-black/60"
                                                        )}>
                                                            {isCurrent ? (
                                                                <div className="flex gap-1 items-end h-4" aria-hidden="true">
                                                                    <div className="w-1 bg-brand-accent h-3 animate-[pulse_0.8s_infinite_alternate]" />
                                                                    <div className="w-1 bg-brand-accent h-4 animate-[pulse_0.6s_infinite_alternate_0.2s]" />
                                                                    <div className="w-1 bg-brand-accent h-2.5 animate-[pulse_1s_infinite_alternate_0.1s]" />
                                                                </div>
                                                            ) : (
                                                                <IconMediaPlay className="w-4 h-4 sm:w-5 sm:h-5 text-on-surface fill-current" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Meta content */}
                                                    <span className="flex-1 min-w-0 flex flex-col justify-center">
                                                        {item.subtitle && (
                                                            <span className={cn(
                                                                "text-2xs sm:text-xs font-semibold mb-0.5 truncate",
                                                                isCurrent ? "text-brand-accent-readable" : "text-on-surface-variant"
                                                            )}>
                                                                {item.subtitle}
                                                            </span>
                                                        )}
                                                        <span title={item.title} className={cn(
                                                            "text-xs sm:text-sm font-bold line-clamp-2 leading-tight transition-colors block",
                                                            isCurrent ? "text-on-surface" : "text-label-2 group-hover:text-on-surface"
                                                        )}>
                                                            {item.title}
                                                        </span>
                                                    </span>
                                                </button>

                                                {/* Reorder buttons — patrón SettingsSection (w-7 rounded-lg) */}
                                                <div className="flex flex-col gap-0.5 shrink-0 z-10">
                                                    <IconButton
                                                        intent="ghost"
                                                        size="xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (idx > 0) moveQueueItem(idx, idx - 1)
                                                        }}
                                                        disabled={idx === 0}
                                                        aria-label="Mover arriba"
                                                        title="Mover arriba"
                                                        icon={<IconNavigationChevronUp className="w-3.5 h-3.5" />}
                                                    />
                                                    <IconButton
                                                        intent="ghost"
                                                        size="xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (idx < playlistQueue.length - 1) moveQueueItem(idx, idx + 1)
                                                        }}
                                                        disabled={idx === playlistQueue.length - 1}
                                                        aria-label="Mover abajo"
                                                        title="Mover abajo"
                                                        icon={<IconNavigationChevronDown className="w-3.5 h-3.5" />}
                                                    />
                                                </div>
                                                {/* Remove button — 44px touch */}
                                                <IconButton
                                                    intent="ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        quitarFila(idx, String(virtualRow.key))
                                                    }}
                                                    className="text-on-surface-variant hover:text-status-error self-center shrink-0 z-10"
                                                    aria-label={`Quitar ${item.title} de Mi Lista`}
                                                    title="Quitar de Mi Lista"
                                                    icon={<IconUiTrash className="w-4 h-4" />}
                                                />
                                            </m.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                            {playlistQueue.length === 0 && (
                                /* Empty — patrón oro Home (glass-card rounded-3xl + CTA brand-accent pill) */
                                <m.div
                                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
                                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                                    transition={entranceSpring}
                                    onAnimationComplete={focusEmptyCta}
                                    className="w-full glass-card rounded-3xl p-8 border border-[var(--glass-border-side)] text-center flex flex-col items-center gap-5 mt-9 mb-5"
                                >
                                    <div className="w-20 h-20 rounded-2xl bg-[var(--neutral-elev-2)] flex items-center justify-center text-on-surface-variant">
                                        <IconMediaQueue className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-display text-lg text-on-surface font-semibold">
                                            Mi Lista está vacía
                                        </p>
                                        <p className="text-sm text-on-surface-variant max-w-[30ch] leading-relaxed mx-auto">
                                            Añade series o películas con el botón «Añadir a Mi Lista» y se reproducirán en orden.
                                        </p>
                                    </div>
                                    <Button
                                        ref={emptyCtaRef}
                                        intent="primary"
                                        size="lg"
                                        onClick={() => {
                                            setGlobalQueueOpen(false)
                                            navigate({ to: "/home" })
                                        }}
                                        // Si el foco llega mientras sigue apretada la tecla con la que se vació
                                        // (Enter o Espacio), la repetición no dispara el CTA.
                                        onKeyDown={(e) => {
                                            if (e.repeat) e.preventDefault()
                                        }}
                                    >
                                        Explorar catálogo
                                    </Button>
                                </m.div>
                            )}
                        </div>

                        {/* Footer — Segmented Control canónico (layoutId + spring 480/34) */}
                        {playlistQueue.length > 0 && (
                            <div className="p-4 sm:p-5 border-t border-[var(--neutral-separator)] shrink-0 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        intent="glass"
                                        size="sm"
                                        onClick={() => playPrevious()}
                                        disabled={currentQueueIndex <= 0 && queueRepeatMode !== "all"}
                                        leftIcon={<IconMediaSkipPrevious className="w-3.5 h-3.5" />}
                                        iconSpacing="0.25rem"
                                        aria-label="Anterior"
                                        title="Anterior"
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        intent="glass"
                                        size="sm"
                                        onClick={() => shuffleQueue()}
                                        leftIcon={<IconMediaShuffle className="w-3.5 h-3.5" />}
                                        iconSpacing="0.25rem"
                                        title="Mezclar Mi Lista"
                                    >
                                        Mezclar
                                    </Button>
                                    <Button
                                        intent={isRepeating ? "primary" : "glass"}
                                        size="sm"
                                        onClick={() => {
                                             const next = queueRepeatMode === "off" ? "all" : queueRepeatMode === "all" ? "one" : "off"
                                             setQueueRepeatMode(next as "off" | "all" | "one")
                                         }}
                                         aria-pressed={isRepeating}
                                         leftIcon={<IconMediaRepeat className="w-3.5 h-3.5" />}
                                         iconSpacing="0.25rem"
                                         title={queueRepeatMode === "off" ? "Repetir: desactivado" : queueRepeatMode === "all" ? "Repetir: toda la lista" : "Repetir: un elemento"}
                                     >
                                         {queueRepeatMode === "off" ? "Repetir" : queueRepeatMode === "all" ? "Repetir todo" : "Repetir uno"}
                                     </Button>
                                 </div>
                                 {/* Vaciar pide mantener pulsado (como en el reproductor) y no cierra el panel:
                                     las filas salen y el estado vacío que entra confirma la acción. */}
                                 <HoldConfirm
                                     holdDurationMs={800}
                                     label="Mantén pulsado para vaciar Mi Lista"
                                     variant="destructive"
                                     onConfirm={handleClearQueue}
                                     className="w-full h-12 text-sm"
                                 />
                            </div>
                        )}
                    </QueuePanel>
                </>
            )}
        </AnimatePresence>
    )
}
