import React from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useNavigate } from "@tanstack/react-router"
import { IconMediaQueue, IconUiClose, IconMediaPlay, IconNavigationChevronUp, IconNavigationChevronDown, IconUiTrash, IconMediaSkipPrevious, IconMediaShuffle, IconMediaRepeat } from "@/components/ui/icons";
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"

export const GlobalQueueSidebar = () => {
    const navigate = useNavigate()
    const prefersReducedMotion = useReducedMotion()
    const {
        playlistQueue,
        currentQueueIndex,
        globalQueueOpen,
        setGlobalQueueOpen,
        removeFromQueue,
        clearQueue,
        setCurrentQueueIndex,
        shuffleQueue,
        playPrevious,
        queueRepeatMode,
        setQueueRepeatMode,
        moveQueueItem,
    } = useAppStore(useShallow(state => ({
        playlistQueue: state.playlistQueue,
        currentQueueIndex: state.currentQueueIndex,
        globalQueueOpen: state.globalQueueOpen,
        setGlobalQueueOpen: state.setGlobalQueueOpen,
        removeFromQueue: state.removeFromQueue,
        clearQueue: state.clearQueue,
        setCurrentQueueIndex: state.setCurrentQueueIndex,
        shuffleQueue: state.shuffleQueue,
        playPrevious: state.playPrevious,
        queueRepeatMode: state.queueRepeatMode,
        setQueueRepeatMode: state.setQueueRepeatMode,
        moveQueueItem: state.moveQueueItem,
    })))

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

    return (
        <AnimatePresence>
            {globalQueueOpen && (
                <>
                    {/* Backdrop (z-overlay: 1000) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setGlobalQueueOpen(false)}
                        className="fixed inset-0 z-overlay bg-black/70 backdrop-blur-overlay-sm pointer-events-auto"
                    />

                    {/* Sidebar Panel (z-modal: 1100, encima del backdrop) — SettingsCard tokens */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={prefersReducedMotion
                            ? { type: "tween", duration: 0.15 }
                            : { type: "spring", stiffness: 380, damping: 30, mass: 0.8 }
                        }
                        role="dialog"
                        aria-modal="true"
                        aria-label="Mi lista / Cola de reproducción"
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-modal bg-zinc-950/40 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border-l border-white/20 border-t-white/40 shadow-elevation-3 flex flex-col pointer-events-auto select-none"
                    >
                        {/* Header — patrón SettingsSection (sin blur propio: el panel ya aporta la única capa) */}
                        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-white/10 shrink-0 bg-zinc-950/30">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center text-brand-accent shrink-0 shadow-[0_0_12px_hsl(var(--brand-accent)/0.15)]">
                                    <IconMediaQueue className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-on-surface font-mono truncate">
                                            Mi Lista / Cola
                                        </h3>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant border border-white/10 shrink-0">
                                            {playlistQueue.length}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium mt-0.5">
                                        Reproduce en secuencia sin interrupciones
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setGlobalQueueOpen(false)}
                                aria-label="Cerrar lista de reproducción"
                                className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-base cursor-pointer active:scale-95 shrink-0"
                            >
                                <IconUiClose className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Queue Items List */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-3 no-scrollbar">
                            {playlistQueue.slice(0, Math.max(50, currentQueueIndex + 10)).map((item, idx) => {
                                const isCurrent = idx === currentQueueIndex
                                const isHistory = idx < currentQueueIndex

                                return (
                                    <motion.div
                                        key={`${String(item.id)}_${String(item.episodeNumber ?? '')}_${String(item.mediaId)}_${item.playableUrl}`}
                                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, filter: "blur(8px)" }}
                                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                                        transition={{ type: "spring", stiffness: 280, damping: 28, delay: Math.min(idx, 8) * 0.06 }}
                                        whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
                                        className={cn(
                                            "w-full text-left flex gap-3 p-3 rounded-2xl border transition-colors duration-base group relative items-center",
                                            "border-white/20 border-t-white/40 bg-white/[0.03]",
                                            isCurrent
                                                ? "bg-white/[0.08] border-white/30 text-on-surface shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2),0_12px_36px_-6px_rgba(0,0,0,0.75)]"
                                                : isHistory
                                                    ? "opacity-40 hover:opacity-75 text-on-surface-variant"
                                                    : "text-on-surface-variant hover:bg-white/[0.04]"
                                        )}
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
                                            className="flex-1 flex gap-3 cursor-pointer min-w-0 items-center text-left rounded-xl min-h-[44px] active:scale-95 transition-transform"
                                        >
                                            {/* Thumbnail */}
                                            <div className="relative w-20 sm:w-28 aspect-video bg-surface-container border border-white/10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                                {item.thumbnail ? (
                                                    <DeferredImage
                                                        src={item.thumbnail}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
                                                        showSkeleton={false}
                                                    />
                                                ) : (
                                                    <span className="text-[10px] font-mono font-black uppercase tracking-widest text-on-surface-variant/50">Sin imagen</span>
                                                )}

                                                {/* Play overlay */}
                                                <div className={cn(
                                                    "absolute inset-0 flex items-center justify-center transition-all duration-base",
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
                                                        "text-[10px] sm:text-xs font-black tracking-widest mb-0.5 truncate",
                                                        isCurrent ? "text-brand-accent" : "text-on-surface-variant"
                                                    )}>
                                                        {item.subtitle.toUpperCase()}
                                                    </span>
                                                )}
                                                <span className={cn(
                                                    "text-xs sm:text-sm font-bold tracking-tight truncate leading-tight transition-colors block",
                                                    isCurrent ? "text-on-surface" : "text-on-surface-variant group-hover:text-on-surface"
                                                )}>
                                                    {item.title}
                                                </span>
                                            </span>
                                        </button>

                                        {/* Reorder buttons */}
                                        <div className="flex flex-col gap-1 shrink-0 z-10">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (idx > 0) moveQueueItem(idx, idx - 1)
                                                }}
                                                disabled={idx === 0}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.08] disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95"
                                                aria-label="Mover arriba"
                                                title="Mover arriba"
                                            >
                                                <IconNavigationChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (idx < playlistQueue.length - 1) moveQueueItem(idx, idx + 1)
                                                }}
                                                disabled={idx === playlistQueue.length - 1}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.08] disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95"
                                                aria-label="Mover abajo"
                                                title="Mover abajo"
                                            >
                                                <IconNavigationChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        {/* Remove button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                removeFromQueue(idx)
                                            }}
                                            className="w-11 h-11 rounded-xl flex items-center justify-center text-on-surface-variant/70 hover:text-red-400 self-center hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all duration-base shrink-0 z-10 cursor-pointer active:scale-95"
                                            aria-label={`Eliminar ${item.title} de la cola`}
                                            title="Eliminar de la lista"
                                        >
                                            <IconUiTrash className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                )
                            })}

                            {playlistQueue.length === 0 && (
                                <motion.div
                                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, filter: "blur(8px)" }}
                                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                                    transition={{ type: "spring", stiffness: 280, damping: 28 }}
                                    className="py-16 flex flex-col items-center justify-center text-center gap-5 px-6"
                                >
                                    <div className="w-20 h-20 rounded-2xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center text-brand-accent shadow-[0_0_24px_hsl(var(--brand-accent)/0.2)]">
                                        <IconMediaQueue className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-display text-sm text-on-surface uppercase tracking-widest font-black">
                                            Tu lista está vacía
                                        </p>
                                        <p className="text-xs text-on-surface-variant/70 max-w-[28ch] leading-relaxed mx-auto">
                                            Añade series o películas desde su ficha con el botón “Añadir a la cola” para reproducirlas en secuencia.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setGlobalQueueOpen(false)
                                            navigate({ to: "/home" })
                                        }}
                                        className="px-8 py-3 rounded-full bg-brand-accent text-on-primary font-display tracking-widest text-xs uppercase active:scale-95 hover:brightness-110 transition-all shadow-[var(--shadow-brand-primary)] min-h-[44px] cursor-pointer"
                                    >
                                        Explorar catálogo
                                    </button>
                                </motion.div>
                            )}
                        </div>

                        {/* Footer */}
                        {playlistQueue.length > 0 && (
                            <div className="p-4 sm:p-5 border-t border-white/10 shrink-0 bg-zinc-950/30 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => playPrevious()}
                                        disabled={currentQueueIndex <= 0 && queueRepeatMode !== "all"}
                                        className="py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1"
                                        aria-label="Anterior"
                                        title="Anterior"
                                    >
                                        <IconMediaSkipPrevious className="w-3.5 h-3.5" />
                                        Prev
                                    </button>
                                    <button
                                        onClick={() => shuffleQueue()}
                                        className="py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.1] font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1"
                                        aria-label="Aleatorio"
                                        title="Mezclar cola"
                                    >
                                        <IconMediaShuffle className="w-3.5 h-3.5" />
                                        Mix
                                    </button>
                                    <button
                                        onClick={() => {
                                            const next = queueRepeatMode === "off" ? "all" : queueRepeatMode === "all" ? "one" : "off"
                                            setQueueRepeatMode(next as "off" | "all" | "one")
                                        }}
                                        className={cn(
                                            "py-2.5 rounded-full border font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1",
                                            queueRepeatMode !== "off"
                                                ? "bg-brand-accent/20 border-brand-accent/40 text-brand-accent"
                                                : "bg-white/[0.06] border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.1]"
                                        )}
                                        aria-label="Repetir"
                                        title={`Repetir: ${queueRepeatMode}`}
                                    >
                                        <IconMediaRepeat className="w-3.5 h-3.5" />
                                        {queueRepeatMode === "off" ? "Off" : queueRepeatMode === "all" ? "All" : "One"}
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        clearQueue()
                                        setGlobalQueueOpen(false)
                                    }}
                                    className="w-full py-3 min-h-[44px] border border-white/15 hover:border-red-500/40 hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 font-bold text-xs uppercase tracking-widest rounded-full transition-all duration-base cursor-pointer active:scale-95"
                                >
                                    Vaciar Lista
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
