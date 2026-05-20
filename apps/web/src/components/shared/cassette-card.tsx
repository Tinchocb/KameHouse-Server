import { useState, memo } from "react"
import { motion } from "framer-motion"
import { Play } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface VhsTapeItem {
    id: string | number
    title: string
    episodesCount?: number
    watchedCount?: number
    genres?: string[]
    year?: string | number
    status?: "Completado" | "En progreso" | "Sin comenzar"
    isNew?: boolean
    color?: string
    posterUrl?: string
    bannerUrl?: string
    description?: string
}

interface VhsShelfAccordionProps {
    items: VhsTapeItem[]
    onItemClick: (item: VhsTapeItem) => void
    type?: "series" | "movies"
    className?: string
}

// ─── Helpers de Diseño Retro Coherentes ───────────────────────────────────────

const stringToColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360)
    return `hsl(${h}, 50%, 28%)`
}

const getRetroColor = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('super')) return '#143a6c' // Azul Super
    if (t.includes('kai')) return '#0f3f1e' // Verde Kai
    if (t.includes('gt')) return '#113f61' // Azul GT
    if (t.includes('daima')) return '#084236' // Esmeralda Daima
    if (t.includes('dragon ball z') || t === 'dbz') return '#851414' // Rojo Z
    if (t.includes('dragon ball')) return '#a34b07' // Naranja clásico
    return stringToColor(title)
}

// Configuración de resortes rápidos y líquidos para máxima fluidez de carátulas
const liquidSpring = {
    type: "spring",
    stiffness: 240,
    damping: 28,
    mass: 0.9,
} as const

// ─── Componente Principal de Estantería Gigante ───────────────────────────────

export const VhsShelfAccordion = memo(({
    items,
    onItemClick,
    type = "series",
    className
}: VhsShelfAccordionProps) => {
    // Inicializa abierto en la primera cinta para una presentación de alto impacto
    const [selectedId, setSelectedId] = useState<string | number | null>(items[0]?.id || null)

    return (
        <div className={cn(
            "w-full py-6 px-4 md:px-8 rounded-[32px] bg-gradient-to-b from-[#0b0e17] to-[#030509] border border-white/5 relative shadow-2xl overflow-x-auto no-scrollbar select-none transform-gpu",
            className
        )}>
            {/* ── MUEBLE 3D DEL ESTANTE (BASE DE APOYO REALISTA) ── */}
            {/* Superficie superior metálica/madera oscura */}
            <div className="absolute inset-x-0 bottom-[44px] md:bottom-[52px] h-5 bg-gradient-to-b from-zinc-800 via-zinc-700 to-zinc-950 border-t border-white/10 shadow-2xl z-0" />
            {/* Sombra de oclusión ambiental profunda en el piso inferior */}
            <div className="absolute inset-x-0 bottom-[24px] md:bottom-[28px] h-6 bg-black/95 blur-[5px] z-0" />

            {/* CONTENEDOR DE CINTAS: Usa porcentajes de pantalla para ocupar gran parte de ella */}
            <div className={cn("flex items-end justify-start gap-2 md:gap-3 relative z-10 px-2 min-w-max h-[150vh] min-h-[640px] max-h-[1200px]")}>
                {items.map((item, idx) => {
                    const isSelected = selectedId === item.id
                    const baseColor = item.color || getRetroColor(item.title)
                    const progress = item.episodesCount ? (item.watchedCount || 0) / item.episodesCount * 100 : 0

                    return (
                        <motion.div
                            key={item.id}
                            layout // Anima de forma nativa e instantánea el estiramiento horizontal
                            transition={liquidSpring}
                            onClick={() => {
                                if (isSelected) {
                                    onItemClick(item) // Click en la cinta expandida navega directamente
                                } else {
                                    setSelectedId(item.id)
                                }
                            }}
                            className={cn(
                                "relative flex flex-col justify-between cursor-pointer rounded-t border-t border-x border-black/40 overflow-hidden text-white transform-gpu shrink-0",
                                // TAMAÑOS MAXIMIZADOS: Lomo más imponente y cuerpo expandido súper ancho
                                isSelected
                                    ? "w-[90vw] sm:w-[580px] md:w-[780px] h-full z-20 shadow-[20px_0_40px_rgba(0,0,0,0.85)]"
                                    : "w-[90px] md:w-[120px] h-[92%] hover:h-[96%] z-10 hover:-translate-y-2 shadow-[6px_0_14px_rgba(0,0,0,0.65)] transition-[transform] duration-200"
                            )}
                            style={{ backgroundColor: baseColor }}
                        >
                            {/* Reflejo brillante vertical estilo plástico protector de videoclub */}
                            <div className="absolute inset-y-0 left-0 w-[3px] bg-white/15 pointer-events-none z-30" />
                            <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-black/30 pointer-events-none z-20" />

                            {/* ── CUERPO INTERNO CON DOS CAPAS CONFIGURADAS POR OPACIDAD ── */}
                            <div className="flex-1 flex flex-col relative overflow-hidden min-h-0 w-full">

                                {/* A. VISTA DE CARÁTULA EXTENDIDA (Solo visible si está seleccionado) */}
                                <motion.div
                                    initial={false}
                                    animate={{ opacity: isSelected ? 1 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn(
                                        "absolute inset-0 flex flex-col justify-end p-6 md:p-8 z-10 pointer-events-none",
                                        isSelected ? "pointer-events-auto" : "pointer-events-none"
                                    )}
                                >
                                    {/* Fondo de póster panorámico difuminado retro */}
                                    <div className="absolute inset-0 z-0 bg-zinc-950">
                                        <DeferredImage
                                            src={item.posterUrl || item.bannerUrl || ""}
                                            alt=""
                                            className="w-full h-full object-cover opacity-25 brightness-[0.7] contrast-[1.2]"
                                            showSkeleton={false}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" />
                                    </div>

                                    {/* Badge superior de año y novedad */}
                                    <div className="relative z-10 mb-auto flex justify-between items-center w-full">
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] md:text-xs font-mono font-bold tracking-wider text-white/80">
                                            {item.year || "RETRO"}
                                        </span>
                                        {item.isNew && (
                                            <span className="bg-yellow-400 text-black px-2.5 py-0.5 rounded text-[10px] md:text-xs font-black tracking-tighter shadow-md uppercase transform -rotate-1">
                                                NEW
                                            </span>
                                        )}
                                    </div>

                                    {/* Textos Informativos de la Serie */}
                                    <div className="relative z-10">
                                        <h3 className="text-[22px] sm:text-[28px] md:text-[36px] font-black leading-[1.1] uppercase font-display line-clamp-2 drop-shadow-2xl mb-2">
                                            {item.title}
                                        </h3>
                                        <p className="text-[10px] md:text-xs text-white/50 font-mono uppercase tracking-widest mb-5">
                                            {item.genres?.[0] || "ANIME COLLECTION"} • {item.episodesCount || 0} EPISODIOS EN TOTAL
                                        </p>

                                        {/* Barra de progreso estilizada */}
                                        <div className="flex flex-col mb-5 bg-black/40 p-3 rounded-xl border border-white/5 max-w-sm">
                                            <div className="flex justify-between items-center mb-1 text-[10px] font-mono font-bold text-white/40">
                                                <span>REPRODUCCIÓN DE CINTA</span>
                                                <span className="text-brand-orange">{Math.round(progress)}% VISTO</span>
                                            </div>
                                            <div className="relative h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                                                <div
                                                    className="h-full bg-gradient-to-r from-brand-orange to-orange-400 rounded-full shadow-[0_0_8px_rgba(255,110,58,0.4)]"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Botón de reproducción extendido */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                                            className="w-full max-w-sm bg-brand-orange hover:bg-brand-orange-hover text-white rounded-xl text-xs font-black tracking-widest uppercase py-3.5 transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(255,110,58,0.35)] active:scale-[0.97]"
                                        >
                                            <Play className="w-4 h-4 fill-current" />
                                            Reproducir VHS
                                        </button>
                                    </div>
                                </motion.div>

                                {/* B. VISTA DEL LOMO VERTICAL (Solo visible si no está seleccionado) */}
                                <motion.div
                                    initial={false}
                                    animate={{ opacity: isSelected ? 0 : 1 }}
                                    transition={{ duration: 0.15 }}
                                    className={cn(
                                        "absolute inset-0 flex flex-col justify-between",
                                        isSelected ? "pointer-events-none" : "pointer-events-auto"
                                    )}
                                >
                                    {/* Cabecera del lomo */}
                                    <div className="pt-2 px-1 text-center font-mono font-black text-[8px] md:text-[10px] opacity-50 tracking-widest uppercase border-b border-black/10 bg-black/10">
                                        {item.year || "VHS"}
                                    </div>

                                    {/* Mini Portada cuadrada como etiqueta de videoclub */}
                                    <div className="p-1 md:p-1.5 shrink-0">
                                        <div className="aspect-square w-full border border-black/20 rounded bg-zinc-950 relative overflow-hidden shadow-inner">
                                            <DeferredImage
                                                src={item.posterUrl || item.bannerUrl || ""}
                                                alt=""
                                                className="w-full h-full object-cover contrast-[1.1] brightness-[0.85]"
                                                showSkeleton={false}
                                            />
                                        </div>
                                    </div>

                                    {/* Título Rotado a 90 grados perfecto en el eje central */}
                                    <div className="flex-1 flex items-center justify-center overflow-hidden relative py-2">
                                        <div className="absolute w-[220px] md:w-[280px] text-center transform rotate-90 flex items-center justify-center">
                                            <span className="font-black tracking-wide text-[12px] md:text-[15px] uppercase line-clamp-1 font-display drop-shadow-[1px_2px_1px_rgba(0,0,0,0.4)] whitespace-nowrap">
                                                {item.title}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Conteo de episodios vistos / totales */}
                                    <div className="px-1 py-2 font-mono text-[8px] md:text-[10px] text-center bg-black/20 border-t border-black/10 text-white/90">
                                        <div className="font-bold truncate tracking-tight">
                                            {item.watchedCount || 0}/{item.episodesCount || 0} EP
                                        </div>
                                    </div>

                                    {/* Marca e insignia VHS clásica en la base */}
                                    <div className="pb-3 px-1 flex flex-col items-center justify-center gap-1 bg-black/5">
                                        <div className="border border-white/30 px-1 py-0.5 rounded font-mono font-black text-[7px] md:text-[8px] scale-95 tracking-tighter leading-none text-white/40">
                                            VHS
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            {/* ── BASE INFERIOR DE PLÁSTICO NEGRO (CHASIS MECÁNICO) ── */}
                            <div className="h-9 md:h-11 bg-zinc-900 border-t border-black flex flex-col justify-center items-center relative overflow-hidden shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
                                {/* Estrías texturizadas de agarre de los cartuchos físicos */}
                                <div className="absolute inset-x-0 top-1 bottom-1 flex justify-center gap-[3px] opacity-15 pointer-events-none">
                                    {Array.from({ length: isSelected ? 28 : 6 }).map((_, i) => (
                                        <div key={i} className="w-[1.5px] h-full bg-white" />
                                    ))}
                                </div>
                                {/* Código de serie del videoclub */}
                                <span className="text-[6px] md:text-[7.5px] font-mono font-bold text-zinc-500 relative z-10 tracking-tighter uppercase">
                                    KAME-{typeof item.id === 'number' ? item.id : (idx + 100)}
                                </span>
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
})

VhsShelfAccordion.displayName = "VhsShelfAccordion"