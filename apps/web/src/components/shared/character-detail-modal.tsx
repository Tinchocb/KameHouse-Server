import * as React from "react"
import { AnimatePresence, m, useIsPresent } from "framer-motion"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { IconUiClose, IconStatusSparkles } from "@/components/ui/icons";
import { getScouterKi } from "@/lib/config/dragonball-lore.config"
import { useFocusTrap } from "@/hooks/use-focus-trap"

interface LoreTransformation {
    name: string
    multiplier?: string
    description?: string
}

interface LoreWikiCharacter {
    name: string
    alias?: string[]
    race?: string
    origin?: string
    height_cm?: number
    weight_kg?: number
    biography?: string
    personality?: string
    techniques?: string[]
    transformations?: LoreTransformation[]
    ki?: string
}

interface CharacterEdge {
    node?: {
        name?: { full?: string } | null
        image?: { large?: string } | null
    } | null
}

/** Forma del JSON servido por /api/v1/lore/dragonball (solo la parte que consume la UI). */
export interface DragonBallLoreData {
    characters_wiki?: LoreWikiCharacter[]
}

interface CharacterDetailModalProps {
    characterName: string | null
    entry: { media?: { characters?: { edges?: CharacterEdge[] | null } | null } | null } | null | undefined
    loreData: DragonBallLoreData | null | undefined
    onClose: () => void
}

// Cerrar es más corto que abrir: --duration-quick (150 ms) con --ease-in.
const EXIT_TRANSITION = { duration: 0.15, ease: [0.4, 0, 1, 1] } as const

/**
 * Capa fija del modal. AnimatePresence la deja montada mientras corre la salida:
 * sin `pointer-events-none` el `fixed inset-0` seguía capturando los clics de la
 * página hasta que terminaba el fundido.
 */
function ModalLayer({ children }: { children: React.ReactNode }) {
    const isPresent = useIsPresent()
    return (
        <div inert={!isPresent} aria-hidden={!isPresent || undefined} className={cn("fixed inset-0 z-modal flex items-center justify-center p-2.5 sm:p-4", !isPresent && "pointer-events-none")}>
            {children}
        </div>
    )
}

export function CharacterDetailModal({
    characterName,
    entry,
    loreData, 
    onClose 
}: CharacterDetailModalProps) {
    // Find the character info in local lore data if characterName is present
    const charInfo = React.useMemo(() => {
        if (!characterName || !loreData?.characters_wiki) return null
        const q = characterName.toLowerCase()
        return loreData.characters_wiki.find(c => {
            const cName = c?.name?.toLowerCase()
            return cName ? (cName.includes(q) || q.includes(cName)) : false
        })
    }, [characterName, loreData])

    // Resolve avatar image from entry characters list
    const avatarUrl = React.useMemo(() => {
        if (!characterName || !entry?.media?.characters?.edges) return ""
        const q = characterName.toLowerCase()
        const charEdge = entry.media.characters.edges.find(e => {
            const fullName = e.node?.name?.full?.toLowerCase()
            if (!fullName) return false
            return fullName.includes(q) || q.includes(fullName)
        })
        return charEdge?.node?.image?.large || ""
    }, [characterName, entry])

    const isOpen = Boolean(characterName && charInfo)
    const reduceMotion = useReducedMotion()
    const dialogRef = React.useRef<HTMLDivElement>(null)
    useFocusTrap(dialogRef, isOpen)

    React.useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    return (
        <AnimatePresence>
            {isOpen && charInfo && (
                <ModalLayer>
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: EXIT_TRANSITION }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/65"
                    />

                    <m.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={charInfo.name}
                        data-liquid-surface="panel"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98, y: 0, transition: EXIT_TRANSITION }}
                        transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="character-detail-modal glass-frosted relative w-full max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col md:flex-row z-10 border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)]"
                    >
                        <IconButton
                            intent="glass"
                            size="md"
                            onClick={onClose}
                            aria-label="Cerrar detalles del personaje"
                            icon={<IconUiClose className="w-4 h-4" />}
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rounded-full"
                        />

                    {/* Left Column: Avatar & Quick Info */}
                    <div className="w-full md:w-1/3 p-4 sm:p-6 flex flex-col items-center border-b md:border-b-0 md:border-r border-[var(--neutral-separator)] shrink-0 bg-white/[0.02]">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-white/30 shadow-[0_0_24px_color-mix(in_srgb,var(--on-surface)_15%,transparent)] mb-3 sm:mb-4 shrink-0 bg-surface-container-high">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={charInfo.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-surface-container-high flex items-center justify-center text-on-surface-variant/60 font-bold uppercase">DB</div>
                            )}
                        </div>

                        <h3 className="text-lg sm:text-xl font-black text-center text-on-surface tracking-wide font-display text-balance">{charInfo.name}</h3>
                        {charInfo.alias && charInfo.alias.length > 0 && (
                            <p className="text-xs text-on-surface-variant text-center mt-1">Alias: {charInfo.alias.join(", ")}</p>
                        )}

                        {/* Scouter Ki Level HUD */}
                        <div className="character-scouter-hud w-full mt-3 p-2.5 rounded-2xl bg-surface-container-lowest/60 border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-glass-highlight-md flex items-center justify-between text-xs text-status-success">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success" />
                                </span>
                                <span className="font-semibold text-xs">Nivel de ki (Scouter)</span>
                            </div>
                            <span className="font-black font-mono tabular-nums text-status-success text-xs">
                                {getScouterKi(charInfo.name, charInfo.ki)}
                            </span>
                        </div>

                        <div className="w-full mt-3 sm:mt-4 space-y-2 sm:space-y-3 text-label-sm tabular-nums text-on-surface-variant">
                            <div className="character-stat-row flex justify-between border-b border-[var(--neutral-separator)] pb-1">
                                <span>Raza</span>
                                <span className="font-bold text-on-surface">{charInfo.race || "Sin datos"}</span>
                            </div>
                            <div className="character-stat-row flex justify-between border-b border-[var(--neutral-separator)] pb-1">
                                <span>Origen</span>
                                <span className="font-bold text-on-surface">{charInfo.origin || "Sin datos"}</span>
                            </div>
                            {charInfo.height_cm && (
                                <div className="character-stat-row flex justify-between border-b border-[var(--neutral-separator)] pb-1">
                                    <span>Altura</span>
                                    <span className="font-bold text-on-surface">{charInfo.height_cm} cm</span>
                                </div>
                            )}
                            {charInfo.weight_kg && (
                                <div className="character-stat-row flex justify-between border-b border-[var(--neutral-separator)] pb-1">
                                    <span>Peso</span>
                                    <span className="font-bold text-on-surface">{charInfo.weight_kg} kg</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Bio, Techniques & Transformations */}
                    <div className="flex-grow p-4 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto max-h-[85vh] no-scrollbar">
                        <div>
                            <span className="text-xs font-bold text-on-surface mb-2 block">Biografía</span>
                            <p className="text-on-surface-variant text-sm leading-relaxed text-pretty">{charInfo.biography}</p>
                        </div>

                        {charInfo.personality && (
                            <div>
                                <span className="text-xs font-bold text-on-surface mb-2 block">Personalidad</span>
                                <p className="text-on-surface-variant text-xs leading-relaxed text-pretty">{charInfo.personality}</p>
                            </div>
                        )}

                        {charInfo.techniques && charInfo.techniques.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-on-surface mb-2 block">Técnicas</span>
                                <div className="flex flex-wrap gap-2">
                                    {charInfo.techniques.map((tech: string, i: number) => (
                                        <span key={`${tech}-${i}`} className="character-tech-badge px-3 py-1 bg-surface-container-high/60 border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] text-on-surface text-label-sm rounded-full font-bold shadow-glass-highlight-sm">
                                            {tech}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {charInfo.transformations && charInfo.transformations.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-on-surface mb-3 block">Transformaciones y estados</span>
                                <div className="space-y-3">
                                    {charInfo.transformations.map((trans, i) => (
                                        <div key={`${trans.name}-${i}`} className="character-transform-card p-3.5 bg-surface-container-high/50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high/70 border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] rounded-2xl flex flex-col gap-1.5 transition-[background-color,border-color] duration-fast ease-smooth-out shadow-[shadow:var(--double-bezel-ring)]">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                                                    <IconStatusSparkles className="w-3.5 h-3.5 text-on-surface" /> {trans.name}
                                                </span>
                                                {trans.multiplier && (
                                                    <span className="font-mono text-xs font-bold text-on-surface px-2.5 py-0.5 bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] rounded-full">
                                                        {trans.multiplier}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-on-surface-variant text-xs leading-relaxed text-pretty">{trans.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </m.div>
            </ModalLayer>
            )}
        </AnimatePresence>
    )
}
