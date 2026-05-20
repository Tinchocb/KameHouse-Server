import { memo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

export interface VhsCollectionItem {
    id: number
    title: string
    episodesCount: number
    watchedCount: number
    genres: string[]
    year?: number
    status: string
    isNew: boolean
    posterUrl: string
    bannerUrl: string
}

interface VhsCollectionProps {
    items: VhsCollectionItem[]
    onItemClick: (item: VhsCollectionItem) => void
}

// Paletas de colores retro vibrantes inspiradas directamente en tu imagen de Dragon Ball
const RETRO_PALETTES = [
    { bg: "bg-sky-500 text-sky-950 border-sky-400/40", text: "text-sky-950", accent: "bg-sky-600/20" },
    { bg: "bg-orange-500 text-orange-950 border-orange-400/40", text: "text-orange-950", accent: "bg-orange-600/20" },
    { bg: "bg-blue-900 text-blue-50 border-blue-800/40", text: "text-blue-50", accent: "bg-blue-950/40" },
    { bg: "bg-red-800 text-red-50 border-red-700/40", text: "text-red-50", accent: "bg-red-950/40" },
    { bg: "bg-indigo-300 text-indigo-950 border-indigo-200/40", text: "text-indigo-950", accent: "bg-indigo-400/20" },
    { bg: "bg-purple-500 text-purple-950 border-purple-400/40", text: "text-purple-950", accent: "bg-purple-600/20" },
    { bg: "bg-yellow-400 text-yellow-950 border-yellow-300/40", text: "text-yellow-950", accent: "bg-yellow-500/20" },
]

const VhsTape = memo(({ item, index, onClick }: { item: VhsCollectionItem; index: number; onClick: () => void }) => {
    // Asigna un color consistente basado en el índice
    const palette = RETRO_PALETTES[index % RETRO_PALETTES.length]

    return (
        <motion.div
            onClick={onClick}
            className={cn(
                "relative flex flex-col justify-between w-[85px] sm:w-[105px] h-[360px] sm:h-[440px] cursor-pointer rounded-t border-t border-x shadow-[4px_0_10px_rgba(0,0,0,0.6)] overflow-hidden select-none transform-gpu shrink-0",
                palette.bg
            )}
            variants={{
                idle: { y: 0, scale: 1, zIndex: 10 },
                hover: { 
                    y: -18, 
                    scale: 1.03, 
                    zIndex: 30,
                    boxShadow: "12px 15px 30px rgba(0,0,0,0.7)",
                    transition: { type: "spring", stiffness: 220, damping: 16 }
                }
            }}
            initial="idle"
            whileHover="hover"
        >
            {/* Brillo reflectante vertical tipo plástico protector */}
            <div className="absolute inset-y-0 left-0 w-1 bg-white/25 pointer-events-none z-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-black/15 pointer-events-none z-20" />

            {/* ── 1. SECCIÓN SUPERIOR: Indicador "NEW" o Año ── */}
            <div className="pt-2 px-1 text-center font-mono font-black text-[8px] sm:text-[10px] tracking-widest uppercase border-b border-black/10 bg-black/5">
                {item.isNew ? (
                    <span className="text-yellow-300 bg-black/50 px-1 py-0.5 rounded text-[7px] sm:text-[9px] border border-yellow-400/20 tracking-normal inline-block transform -rotate-2">
                        NEW
                    </span>
                ) : (
                    <span className="opacity-80 font-bold">{item.year || "RETRO"}</span>
                )}
            </div>

            {/* ── 2. MINIATURA DE ILUSTRACIÓN (Cuadrada) ── */}
            <div className="p-1 sm:p-1.5">
                <div className="aspect-square w-full border border-black/20 rounded bg-black/30 relative overflow-hidden shadow-inner">
                    <img 
                        src={item.posterUrl || item.bannerUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover grayscale-[15%] contrast-[1.15]"
                        loading="lazy"
                    />
                </div>
            </div>

            {/* ── 3. TÍTULO VERTICAL ROTADO (Estilo Logo de lomo) ── */}
            <div className="flex-1 flex items-center justify-center overflow-hidden relative py-4">
                <div className="absolute w-[200px] sm:w-[260px] text-center transform -rotate-90 pointer-events-none flex items-center justify-center">
                    <h3 className={cn(
                        "font-black tracking-wide text-[13px] sm:text-[16px] uppercase line-clamp-1 select-none font-display",
                        palette.text,
                        "drop-shadow-[1px_2px_0px_rgba(0,0,0,0.2)]"
                    )}>
                        {item.title}
                    </h3>
                </div>
            </div>

            {/* ── 4. DETALLES TÉCNICOS Y SINOPSIS DE LOMO ── */}
            <div className={cn("px-1.5 py-2 font-mono text-[7px] sm:text-[9px] leading-tight border-t border-black/10 bg-black/5 flex flex-col gap-0.5", palette.text)}>
                <div className="font-black truncate opacity-80 text-center uppercase tracking-tight text-[6px] sm:text-[8px]">
                    {item.genres[0] || "ANIME COLLECTION"}
                </div>
                <hr className="border-black/10 my-0.5" />
                <div className="flex justify-between font-bold">
                    <span className="opacity-60">EPISODIOS:</span>
                    <span>{item.episodesCount || "??"}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span className="opacity-60">VISTOS:</span>
                    <span>{item.watchedCount}</span>
                </div>
            </div>

            {/* ── 5. BRANDING RETRO & INSIGNIA VHS ── */}
            <div className="pt-1 pb-1.5 px-1 flex flex-col items-center justify-center gap-1 border-t border-black/10 bg-black/10">
                <span className="font-mono font-bold text-[5px] sm:text-[6.5px] opacity-40 tracking-widest text-center uppercase whitespace-nowrap">
                    KAMEHOUSE VIDEO
                </span>
                
                {/* Cuadro de Logo VHS Clásico */}
                <div className={cn(
                    "border border-current px-1 py-0.5 rounded font-mono font-black text-[8px] sm:text-[10px] tracking-tighter leading-none bg-black/5 select-none",
                    palette.text
                )}>
                    VHS
                </div>
            </div>

            {/* ── 6. BLOQUE INFERIOR DE PLÁSTICO NEGRO (Carátula/Casete base) ── */}
            <div className="h-7 sm:h-9 bg-zinc-900 border-t-2 border-black flex flex-col justify-center items-center relative overflow-hidden shrink-0">
                {/* Estrías/Rendijas de agarre texturizadas de plástico */}
                <div className="absolute inset-x-0 top-1 bottom-1 flex justify-center gap-[3px] opacity-15">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="w-[1.5px] h-full bg-white" />
                    ))}
                </div>
                {/* Código de serial falso */}
                <span className="text-[5px] sm:text-[6px] font-mono font-bold text-zinc-600 relative z-10 tracking-tighter">
                    SHA-{item.id.toString().slice(-4)}
                </span>
            </div>
        </motion.div>
    )
})

VhsTape.displayName = "VhsTape"

export const VhsCollection = memo(({ items, onItemClick }: VhsCollectionProps) => {
    return (
        <div className="w-full py-10 px-4 md:px-8 rounded-3xl bg-gradient-to-b from-[#0f1322] to-[#05070d] border border-white/5 relative shadow-inner overflow-x-auto no-scrollbar">
            
            {/* ESTRUCTURA DEL ESTANTE MODULAR (Base metálica/madera detrás de las cintas) */}
            {/* Línea de madera superior del estante inferior */}
            <div className="absolute inset-x-0 bottom-[44px] sm:bottom-[50px] h-4 bg-gradient-to-b from-zinc-800 via-zinc-700 to-zinc-950 border-t border-white/10 shadow-xl z-0" />
            {/* Sombra proyectada debajo del estante */}
            <div className="absolute inset-x-0 bottom-[32px] sm:bottom-[36px] h-3 bg-black/80 blur-[2px] z-0" />

            {/* Contenedor horizontal que alinea las cintas de VHS perfectamente en el estante */}
            <div className="flex items-end justify-start gap-1 sm:gap-1.5 relative z-10 px-2 min-w-max h-[400px] sm:h-[480px]">
                {items.map((item, idx) => (
                    <VhsTape 
                        key={item.id} 
                        item={item} 
                        index={idx} 
                        onClick={() => onItemClick(item)} 
                    />
                ))}
            </div>
        </div>
    )
})

VhsCollection.displayName = "VhsCollection"