import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Play, Trash2, Film } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"

export const GlobalQueueSidebar = () => {
    const {
        playlistQueue,
        currentQueueIndex,
        globalQueueOpen,
        setGlobalQueueOpen,
        removeFromQueue,
        clearQueue,
        setCurrentQueueIndex,
    } = useAppStore(useShallow(state => ({
        playlistQueue: state.playlistQueue,
        currentQueueIndex: state.currentQueueIndex,
        globalQueueOpen: state.globalQueueOpen,
        setGlobalQueueOpen: state.setGlobalQueueOpen,
        removeFromQueue: state.removeFromQueue,
        clearQueue: state.clearQueue,
        setCurrentQueueIndex: state.setCurrentQueueIndex,
    })))

    return (
        <AnimatePresence>
            {globalQueueOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setGlobalQueueOpen(false)}
                        className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm pointer-events-auto"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-[9995] bg-zinc-950/90 backdrop-blur-3xl border-l border-white/10 flex flex-col shadow-2xl pointer-events-auto select-none"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
                            <h3 className="text-sm font-black tracking-[0.25em] text-white uppercase flex items-center gap-2.5">
                                <div className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
                                Cola de Reproducción ({playlistQueue.length})
                            </h3>
                            <button
                                onClick={() => setGlobalQueueOpen(false)}
                                className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all duration-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Queue Items List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                            {playlistQueue.slice(0, Math.max(50, currentQueueIndex + 10)).map((item, idx) => {
                                const isCurrent = idx === currentQueueIndex
                                const isHistory = idx < currentQueueIndex

                                return (
                                    <div
                                        key={`${item.id}_${idx}`}
                                        className={cn(
                                            "w-full text-left flex gap-4 p-3 rounded-2xl border transition-all duration-300 group relative",
                                            isCurrent
                                                ? "bg-brand-orange/10 border-brand-orange/30 text-white shadow-[0_8px_20px_-6px_rgba(255,110,58,0.15)]"
                                                : isHistory
                                                    ? "bg-white/[0.01] border-white/5 opacity-50 hover:opacity-80"
                                                    : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.04] hover:border-white/10"
                                        )}
                                    >
                                        {/* Clickable Area to play */}
                                        <div
                                            onClick={() => {
                                                setCurrentQueueIndex(idx)
                                            }}
                                            className="flex-1 flex gap-4 cursor-pointer min-w-0"
                                        >
                                            {/* Thumbnail */}
                                            <div className="relative w-28 aspect-video bg-zinc-900 border border-white/5 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                                {item.thumbnail ? (
                                                    <DeferredImage
                                                        src={item.thumbnail}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        showSkeleton={false}
                                                    />
                                                ) : (
                                                    <span className="text-[10px] font-black text-zinc-700">SIN IMAGEN</span>
                                                )}

                                                {/* Play overlay */}
                                                <div className={cn(
                                                    "absolute inset-0 flex items-center justify-center transition-all duration-300",
                                                    isCurrent 
                                                        ? "opacity-100 bg-brand-orange/10" 
                                                        : "opacity-0 group-hover:opacity-100 bg-black/50"
                                                )}>
                                                    {isCurrent ? (
                                                        <div className="flex gap-1 items-end h-4">
                                                            <div className="w-1 bg-brand-orange h-3 animate-[pulse_0.8s_infinite_alternate]" />
                                                            <div className="w-1 bg-brand-orange h-4 animate-[pulse_0.6s_infinite_alternate_0.2s]" />
                                                            <div className="w-1 bg-brand-orange h-2.5 animate-[pulse_1s_infinite_alternate_0.1s]" />
                                                        </div>
                                                    ) : (
                                                        <Play className="w-5 h-5 text-white fill-current" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Meta content */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                {item.subtitle && (
                                                    <span className={cn(
                                                        "text-[9px] font-black tracking-widest mb-0.5",
                                                        isCurrent ? "text-brand-orange" : "text-zinc-500"
                                                    )}>
                                                        {item.subtitle.toUpperCase()}
                                                    </span>
                                                )}
                                                <h4 className={cn(
                                                    "text-[12px] font-bold tracking-wide truncate leading-tight transition-colors",
                                                    isCurrent ? "text-white" : "text-zinc-300 group-hover:text-white"
                                                )}>
                                                    {item.title}
                                                </h4>
                                            </div>
                                        </div>

                                        {/* Remove button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                removeFromQueue(idx)
                                            }}
                                            className="p-2 text-zinc-500 hover:text-red-400 self-center hover:bg-white/5 rounded-xl transition-all duration-200 z-10"
                                            title="Eliminar de la cola"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )
                            })}

                            {playlistQueue.length === 0 && (
                                <div className="py-24 flex flex-col items-center justify-center text-center gap-4">
                                    <div className="p-4 rounded-full bg-white/[0.02] border border-white/5 text-zinc-600 animate-pulse">
                                        <Film className="w-8 h-8" />
                                    </div>
                                    <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-black">
                                        La cola está vacía
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {playlistQueue.length > 0 && (
                            <div className="p-6 border-t border-white/5 shrink-0 flex justify-between gap-4">
                                <button
                                    onClick={() => {
                                        clearQueue()
                                        setGlobalQueueOpen(false)
                                    }}
                                    className="w-full py-3.5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all duration-300"
                                >
                                    Vaciar Cola
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
