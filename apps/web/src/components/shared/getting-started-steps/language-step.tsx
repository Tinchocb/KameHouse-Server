import { cn } from "@/components/ui/core/styling"
import { m } from "framer-motion"
import React from "react"
import { SpringSwitch } from "@/components/ui/switch/spring-switch"
import { containerVariants, itemVariants } from "./variants"
import { StepCard } from "./step-chrome"

/* ---------------- STEP 3: IDIOMA Y METADATOS ---------------- */
export function LanguageStep({
    selectedLanguage,
    setSelectedLanguage,
    flexibleMatching,
    setFlexibleMatching,
}: {
    selectedLanguage: string
    setSelectedLanguage: (lang: string) => void
    flexibleMatching: boolean
    setFlexibleMatching: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const languages = [
        {
            code: "es-MX",
            label: "Español Latino",
            region: "Latinoamérica (Recomendado)",
            flag: "🇲🇽",
        },
        {
            code: "es-ES",
            label: "Español Castellano",
            region: "España",
            flag: "🇪🇸",
        },
        {
            code: "ja-JP",
            label: "Japonés Original",
            region: "Nombres y títulos oficiales en Japonés",
            flag: "🇯🇵",
        },
        {
            code: "en-US",
            label: "Inglés",
            region: "English Titles & Overviews",
            flag: "🇺🇸",
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
                    4. Idioma y Metadatos
                </h2>
                <p className="text-on-surface-variant text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                    Configura el idioma preferido para los títulos de episodios, carteleras, sinopsis y reconocimiento de archivos.
                </p>
            </m.div>

            <StepCard>
                <div className="space-y-3">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                        Idioma de Sinopsis y Títulos de Capítulos
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Idioma de Sinopsis y Títulos">
                        {languages.map(lang => {
                            const isSelected = selectedLanguage === lang.code
                            return (
                                <m.div
                                    key={lang.code}
                                    role="radio"
                                    tabIndex={0}
                                    aria-checked={isSelected}
                                    aria-label={lang.label}
                                    whileHover={{ scale: 1.015 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setSelectedLanguage(lang.code)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            setSelectedLanguage(lang.code)
                                        }
                                    }}
                                    className={cn(
                                        "cursor-pointer p-3 rounded-xl border transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out flex items-center justify-between select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                        isSelected
                                            ? "bg-brand-accent/20 border-brand-accent text-on-surface shadow-md shadow-brand-accent/15"
                                            : "bg-glass-bg border-border-subtle [@media(hover:hover)_and_(pointer:fine)]:hover:border-border-strong text-on-surface-variant"
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xl shrink-0">{lang.flag}</span>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-xs sm:text-sm truncate">{lang.label}</p>
                                            <p className="text-3xs text-on-surface-variant/70 truncate">{lang.region}</p>
                                        </div>
                                    </div>
                                    <div
                                        className={cn(
                                            "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-3xs ml-2",
                                            isSelected ? "bg-brand-accent border-brand-accent text-on-primary" : "border-border-subtle"
                                        )}
                                    >
                                        {isSelected && "✓"}
                                    </div>
                                </m.div>
                            )
                        })}
                    </div>
                </div>

                <div className="h-[1px] bg-border-subtle my-4" />

                {/* Reconocimiento flexible de archivos de fansub */}
                <m.div
                    role="switch"
                    tabIndex={0}
                    aria-checked={flexibleMatching}
                    aria-label="Detección Flexible de Fansubs"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFlexibleMatching(prev => !prev)}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setFlexibleMatching(prev => !prev)
                        }
                    }}
                    className={cn(
                        "cursor-pointer p-3.5 rounded-xl border transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out flex items-center justify-between select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                        flexibleMatching
                            ? "bg-surface border-brand-accent/40"
                            : "bg-glass-bg border-border-subtle opacity-75"
                    )}
                >
                    <div className="space-y-0.5 pr-2">
                        <p className="text-xs font-semibold text-on-surface">
                            Detección Flexible de Fansubs
                        </p>
                        <p className="text-2xs text-on-surface-variant">
                            Reconoce nombres complejos como <span className="text-on-surface-variant font-mono text-3xs">[Fansub] DBZ - 001 [1080p].mkv</span> sin obligarte a renombrar archivos.
                        </p>
                    </div>
                    <SpringSwitch
                        checked={flexibleMatching}
                        size="sm"
                        ariaHidden={true}
                        className="pointer-events-none shrink-0 ml-3"
                    />
                </m.div>
            </StepCard>
        </m.div>
    )
}
