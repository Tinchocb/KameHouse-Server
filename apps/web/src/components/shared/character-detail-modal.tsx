import * as React from "react"
import { AnimatePresence, m } from "framer-motion"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
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
    const modalSpring = useSpringPreset("tabContent")
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
                <div className="fixed inset-0 z-modal flex items-center justify-center p-2.5 sm:p-4">
                    <m.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-overlay-xl"
                    />

                    <m.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={charInfo.name}
                        initial={{ opacity: 0, scale: 0.94, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 16 }}
                        transition={modalSpring}
                        className="relative w-full max-w-3xl max-h-[90dvh] bg-zinc-950/85 backdrop-blur-overlay-2xl border border-white/20 border-t-white/40 border-b-white/10 rounded-3xl overflow-y-auto shadow-[shadow:var(--glass-highlight-lg),0_24px_48px_rgba(0,0,0,0.9)] flex flex-col md:flex-row z-10 scrollbar-hide no-scrollbar transform-gpu"
                    >
                        <button 
                            onClick={onClose}
                            aria-label="Cerrar detalles del personaje"
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-white/20 border-t-white/40 text-white transition-[background-color,border-color,transform] duration-200 active:scale-95 cursor-pointer shadow-glass-highlight-lg"
                        >
                            <IconUiClose className="w-4 h-4" />
                        </button>

                    {/* Left Column: Avatar & Quick Info */}
                    <div className="w-full md:w-1/3 p-4 sm:p-6 flex flex-col items-center border-b md:border-b-0 md:border-r border-white/10 shrink-0 bg-white/[0.02]">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-white/30 shadow-[0_0_24px_rgba(255,255,255,0.15)] mb-3 sm:mb-4 shrink-0 bg-zinc-950">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={charInfo.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-zinc-500 font-bold uppercase">DB</div>
                            )}
                        </div>

                        <h3 className="text-lg sm:text-xl font-black text-center text-white tracking-wide uppercase font-display">{charInfo.name}</h3>
                        {charInfo.alias && charInfo.alias.length > 0 && (
                            <p className="text-xs text-zinc-400 text-center mt-1">Alias: {charInfo.alias.join(", ")}</p>
                        )}

                        {/* Scouter Ki Level HUD */}
                        <div className="w-full mt-3 p-2.5 rounded-2xl bg-zinc-950/60 border border-white/15 border-t-white/30 shadow-glass-highlight-md flex items-center justify-between text-caption font-mono text-emerald-400">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                <span className="font-bold tracking-wider uppercase text-caption">SCOUTER KI:</span>
                            </div>
                            <span className="font-black text-emerald-400 tracking-widest text-xs">
                                {getScouterKi(charInfo.name, charInfo.ki)}
                            </span>
                        </div>

                        <div className="w-full mt-3 sm:mt-4 space-y-2 sm:space-y-3 font-mono text-label-sm text-zinc-400">
                            <div className="flex justify-between border-b border-white/10 pb-1">
                                <span>Raza</span>
                                <span className="font-bold text-white uppercase">{charInfo.race || "N/A"}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-1">
                                <span>Origen</span>
                                <span className="font-bold text-white uppercase">{charInfo.origin || "N/A"}</span>
                            </div>
                            {charInfo.height_cm && (
                                <div className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Altura</span>
                                    <span className="font-bold text-white">{charInfo.height_cm} cm</span>
                                </div>
                            )}
                            {charInfo.weight_kg && (
                                <div className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Peso</span>
                                    <span className="font-bold text-white">{charInfo.weight_kg} kg</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Bio, Techniques & Transformations */}
                    <div className="flex-grow p-4 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto max-h-[85dvh] no-scrollbar">
                        <div>
                            <span className="text-label-sm font-black text-white uppercase tracking-ultra mb-2 block">Biografía</span>
                            <p className="text-zinc-300 text-sm leading-relaxed">{charInfo.biography}</p>
                        </div>

                        {charInfo.personality && (
                            <div>
                                <span className="text-label-sm font-black text-white uppercase tracking-ultra mb-2 block">Personalidad</span>
                                <p className="text-zinc-400 text-xs leading-relaxed">{charInfo.personality}</p>
                            </div>
                        )}

                        {charInfo.techniques && charInfo.techniques.length > 0 && (
                            <div>
                                <span className="text-label-sm font-black text-white uppercase tracking-ultra mb-2 block">Técnicas</span>
                                <div className="flex flex-wrap gap-2">
                                    {charInfo.techniques.map((tech: string, i: number) => (
                                        <span key={`${tech}-${i}`} className="px-3 py-1 bg-zinc-900/60 border border-white/15 border-t-white/30 text-white text-label-sm rounded-full font-bold shadow-glass-highlight-sm">
                                            {tech}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {charInfo.transformations && charInfo.transformations.length > 0 && (
                            <div>
                                <span className="text-label-sm font-black text-white uppercase tracking-ultra mb-3 block">Transformaciones / Estados</span>
                                <div className="space-y-3">
                                    {charInfo.transformations.map((trans, i) => (
                                        <div key={`${trans.name}-${i}`} className="p-3.5 bg-zinc-900/50 border border-white/15 border-t-white/35 rounded-2xl flex flex-col gap-1.5 hover:border-white/30 transition-colors duration-200 shadow-glass-highlight-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="font-bold text-xs text-white uppercase flex items-center gap-1.5">
                                                    <IconStatusSparkles className="w-3.5 h-3.5 text-white" /> {trans.name}
                                                </span>
                                                {trans.multiplier && (
                                                    <span className="font-mono text-3xs font-black text-white px-2.5 py-0.5 bg-white/10 border border-white/20 rounded-full">
                                                        {trans.multiplier}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-zinc-400 text-xs leading-relaxed">{trans.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </m.div>
            </div>
            )}
        </AnimatePresence>
    )
}
