"use client"

import { AnimatePresence, m } from "framer-motion"
import React from "react"

export function AppLoadingScreen() {
    return (
        <AnimatePresence mode="sync" initial={false}>
            <m.div
                key="app-loading-screen"
                role="status"
                aria-live="polite"
                aria-label="Cargando aplicación"
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="fixed inset-0 bg-zinc-950 z-[9997] flex flex-col items-center justify-center"
                style={{ willChange: "opacity", opacity: 1 }}
            >
                {/* Spinner - 3 Dragon Ball dots */}
                <m.div
                    initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 1.1, opacity: 0, rotate: 15 }}
                    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    className="relative flex items-center gap-4"
                >
                    <span className="w-6 h-6 dragonball-orb animate-bounce [animation-delay:-0.32s]" />
                    <span className="w-6 h-6 dragonball-orb animate-bounce [animation-delay:-0.16s]" />
                    <span className="w-6 h-6 dragonball-orb animate-bounce" />
                </m.div>

                <m.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                    className="mt-10 flex flex-col items-center gap-3 text-center"
                >
                    <m.h1
                        initial={{ opacity: 0, letterSpacing: "0.5em" }}
                        animate={{ opacity: 1, letterSpacing: "0.15em" }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.3, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                        className="text-white text-3xl sm:text-4xl font-extrabold tracking-cinema-md uppercase leading-none drop-shadow-[0_0_28px_rgba(245,158,11,0.25)] pl-[0.3em]"
                    >
                        KAMEHOUSE
                    </m.h1>

                    <m.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "120px", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ delay: 0.4, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                        className="relative h-1 bg-zinc-800 rounded-full overflow-hidden"
                    >
                        <m.div
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            exit={{ x: "100%" }}
                            transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
                            className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-600"
                        />
                    </m.div>

                    <m.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.6, duration: 0.4 }}
                        className="text-zinc-500 text-xs uppercase tracking-widest font-medium font-mono"
                    >
                        Cargando interfaz...
                    </m.p>
                </m.div>

                <m.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: 0.4, duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 text-zinc-600 text-xs uppercase tracking-wider"
                >
                    <span className="relative flex h-4 w-4">
                        <m.span
                            className="absolute inset-0 bg-amber-500/30 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                        />
                        <m.span
                            className="absolute inset-0 bg-amber-500/30 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                        />
                        <m.span
                            className="absolute inset-0 bg-amber-500/30 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: 0.8 }}
                        />
                    </span>
                    <span>Conectando con el servidor</span>
                </m.div>
            </m.div>
        </AnimatePresence>
    )
}