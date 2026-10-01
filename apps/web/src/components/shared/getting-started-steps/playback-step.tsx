import { cn } from "@/components/ui/core/styling"
import { m } from "framer-motion"
import React from "react"
import { IconMediaPlay, IconMediaSkipNext, IconTimeClock, IconNavigationLibrary } from "@/components/ui/icons"
import { containerVariants, itemVariants } from "./variants"

/* ---------------- STEP 3: REPRODUCCIÓN ---------------- */
export function PlaybackStep({
    features,
    setFeatures,
}: {
    features: {
        autoDetectSkipTimes: boolean
        autoPlayNextEpisode: boolean
        enableWatchContinuity: boolean
        autoScan: boolean
    }
    setFeatures: React.Dispatch<React.SetStateAction<{
        autoDetectSkipTimes: boolean
        autoPlayNextEpisode: boolean
        enableWatchContinuity: boolean
        autoScan: boolean
    }>>
}) {
    const list = [
        {
            key: "autoDetectSkipTimes" as const,
            title: "Salto Automático de Openings/Endings",
            description: "Detección inteligente de intros, rellenos y endings para saltearlos con un clic o automáticamente.",
            icon: IconMediaSkipNext,
            color: "from-amber-500 to-orange-500",
        },
        {
            key: "autoPlayNextEpisode" as const,
            title: "Reproducción Continua (Maratón)",
            description: "Inicia el siguiente capítulo al terminar el actual sin tener que volver al menú.",
            icon: IconMediaPlay,
            color: "from-purple-500 to-pink-500",
        },
        {
            key: "enableWatchContinuity" as const,
            title: "Continuidad de Reproducción",
            description: "Recuerda el segundo exacto donde dejaste cada episodio para reanudar al instante.",
            icon: IconTimeClock,
            color: "from-blue-500 to-cyan-500",
        },
        {
            key: "autoScan" as const,
            title: "Auto-Escaneo en Segundo Plano",
            description: "Detecta automáticamente nuevos capítulos añadidos a tus carpetas sin escanear a mano.",
            icon: IconNavigationLibrary,
            color: "from-emerald-500 to-teal-500",
        },
    ]

    return (
        <m.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4 max-w-2xl mx-auto"
        >
            <m.div variants={itemVariants} className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-display tracking-wide text-on-surface uppercase">
                    3. Automatizaciones de Reproducción
                </h2>
                <p className="text-on-surface-variant text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                    Activa las funciones inteligentes para maratonear y disfrutar sin interrupciones ni adelantos manuales.
                </p>
            </m.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {list.map(item => {
                    const isEnabled = features[item.key]
                    return (
                        <m.div
                            key={item.key}
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={isEnabled}
                            aria-label={item.title}
                            whileHover={{ scale: 1.015, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFeatures(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                            onKeyDown={e => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setFeatures(prev => ({ ...prev, [item.key]: !prev[item.key] }))
                                }
                            }}
                            className={cn(
                                "cursor-pointer p-4 rounded-xl border transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out text-left flex items-start space-x-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                isEnabled
                                    ? "bg-surface border-brand-accent/50 shadow-md shadow-brand-accent/10"
                                    : "bg-glass-bg border-border-subtle [@media(hover:hover)_and_(pointer:fine)]:hover:border-border-strong opacity-70 [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-100"
                            )}
                        >
                            <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br transition-[opacity,transform] duration-fast ease-smooth-out shadow-md",
                                item.color,
                                isEnabled ? "opacity-100 scale-100" : "opacity-40 scale-95"
                            )}>
                                <item.icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-semibold text-xs sm:text-sm text-on-surface truncate">
                                        {item.title}
                                    </h4>
                                    <div
                                        className={cn(
                                            "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-3xs transition-[background-color,border-color,color] duration-fast ease-smooth-out",
                                            isEnabled ? "bg-brand-accent border-brand-accent text-on-primary" : "border-border-subtle"
                                        )}
                                    >
                                        {isEnabled && "✓"}
                                    </div>
                                </div>
                                <p className="text-2xs text-on-surface-variant mt-1 leading-snug">
                                    {item.description}
                                </p>
                            </div>
                        </m.div>
                    )
                })}
            </div>
        </m.div>
    )
}
