import { memo } from 'react';
import { Play } from 'lucide-react';
import { DeferredImage } from '@/components/shared/deferred-image';
import { cn } from '@/components/ui/core/styling';
import { useSound } from '@/hooks/use-sound';

export interface SeriesItem {
    id: number
    title: string
    eps: number
    year: string | number
    progress: number
    img: string
    poster: string
    desc: string
}

export const getVhsColor = (id: number) => {
    const colors = ['#d96c14', '#b51f1f', '#2980b9', '#1a5c2e', '#1a4a8a', '#8e44ad', '#0e6655'];
    return colors[id % colors.length];
};

export const SeriesCard = memo(function SeriesCard({
    item,
    isSelected,
    onNavigate,
    onSelect,
}: {
    item: SeriesItem
    isSelected: boolean
    onNavigate: (id: string) => void
    onSelect: (id: number) => void
}) {
    const { playSound } = useSound();
    return (
        <div
            onClick={() => {
                if (isSelected) {
                    onNavigate(item?.id?.toString() || "");
                } else {
                    onSelect(item.id);
                    playSound("series", 0.4);
                }
            }}
            onDoubleClick={() => {
                onNavigate(item?.id?.toString() || "");
            }}
            style={{
                flex: isSelected ? '4 0 450px' : '1 0 160px',
                transition: 'flex 600ms cubic-bezier(0.2, 1, 0.2, 1)',
                willChange: "flex-grow",
                '--tape-color': getVhsColor(item.id)
            } as React.CSSProperties}
            className="h-full flex flex-col cursor-pointer overflow-hidden relative group/card border-r border-zinc-950/40"
        >
            <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0a0d16] group">
                <DeferredImage
                    src={item.img || item.poster}
                    alt={item.title}
                    className={cn(
                        "absolute inset-0 w-full h-full object-cover transition-all duration-[800ms] cubic-bezier(0.2, 1, 0.2, 1) transform-gpu",
                        isSelected
                            ? 'scale-[1.06] brightness-100 blur-0'
                            : 'scale-100 brightness-[0.85] blur-[8px] group-hover/card:scale-[1.03] group-hover/card:brightness-[0.95] group-hover/card:blur-[3px]'
                    )}
                />

                {/* Cover art glossy shine wrapper */}
                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/[0.02] via-transparent to-transparent pointer-events-none z-[2]" />

                <div
                    className={`absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/25 to-transparent transition-opacity duration-700 ${isSelected ? 'opacity-85' : 'opacity-40'
                        }`}
                />


                {/* Expanded details panel (Cinematic slide up) */}
                <div
                    className={cn(
                        "absolute inset-0 p-6 md:p-12 z-20 flex flex-col justify-end h-full w-full bg-gradient-to-t from-black/90 via-black/45 to-transparent transition-opacity duration-400 ease-out transform-gpu",
                        isSelected ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                >
                    <div className={cn(
                        "glass-panel-strong border border-white/10 p-5 md:p-6 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] bg-slate-950/75 max-w-lg transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform-gpu delay-75",
                        isSelected ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
                    )}>
                        {/* Category Tag */}
                        <div className={cn(
                            "flex items-center gap-3 mb-3 select-none transition-all duration-400 ease-out transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-[120ms]" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            <span className="px-2 py-0.5 bg-brand-orange/20 text-brand-orange border border-brand-orange/30 rounded text-[9px] font-black tracking-widest uppercase shadow-[0_0_15px_rgba(255,110,58,0.15)]">
                                Serie
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className={cn(
                            "text-xl md:text-2xl font-black text-white mb-3 leading-tight tracking-tight drop-shadow-md line-clamp-2 transition-all duration-400 ease-out transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-[160ms]" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            {item.title}
                        </h3>

                        {/* Description */}
                        <p className={cn(
                            "text-white/60 text-xs leading-relaxed mb-4 font-medium line-clamp-3 transition-all duration-400 ease-out transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-[200ms]" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            {item.desc}
                        </p>

                        {/* Progress Bar */}
                        <div className={cn(
                            "flex flex-col mb-4 w-full transition-all duration-400 ease-out transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-[240ms]" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            <div className="flex justify-between items-end mb-1.5">
                                <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40">
                                    Progreso de visualización
                                </span>
                                <span className="text-[10px] font-black text-brand-orange">{item.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-brand-orange to-[#ff9d5c] rounded-full shadow-[0_0_10px_rgba(255,110,58,0.5)] transition-all duration-1000 ease-out origin-left"
                                    style={{ width: isSelected ? `${item.progress}%` : '0%' }}
                                />
                            </div>
                        </div>

                        {/* Play Button */}
                        <div className={cn(
                            "flex gap-4 transition-all duration-400 ease-out transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-[280ms]" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate(item?.id?.toString() || "");
                                }}
                                className="flex-1 bg-brand-orange hover:bg-[#ff8559] active:scale-[0.98] text-white rounded-xl text-xs font-black tracking-widest uppercase py-2.5 transition-all duration-300 hover:-translate-y-0.5 flex justify-center items-center gap-3 shadow-[0_8px_20px_rgba(255,110,58,0.35)] hover:shadow-[0_12px_28px_rgba(255,110,58,0.5)] relative overflow-hidden group/btn"
                            >
                                <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                                <Play className="w-5 h-5 fill-current" />
                                Reproducir
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lomo del casete VHS (3D Tactile Container) */}
            <div
                className={cn(
                    "relative shrink-0 bg-[#0d0d0d] flex items-center justify-between px-4 shadow-[0_-12px_25px_rgba(0,0,0,0.85),inset_0_3px_5px_rgba(255,255,255,0.06),inset_0_-3px_5px_rgba(0,0,0,0.8)] z-20 h-[130px] w-full min-w-0 select-none overflow-hidden transition-all duration-500 ease-out transform-gpu vhs-spine-glow",
                    "border-t-2 border-[#ff6e3a]"
                )}
                style={{
                    boxShadow: !isSelected ? '0 -10px 25px rgba(0,0,0,0.65), inset 0 3px 5px rgba(255,255,255,0.06), inset 0 -3px 5px rgba(0,0,0,0.8)' : undefined
                }}
            >
                {/* Textura rugosa de plástico de la carcasa */}
                <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:3px_3px] opacity-35 pointer-events-none" />

                {/* Brillo reflectivo de la carcasa plástica */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none skew-x-12 transform-gpu" />

                {/* --- ESTADO EXPANDIDO (VHS Spine) --- */}
                <div
                    className={cn(
                        "absolute inset-0 px-4 flex items-center justify-between py-2 z-10 transition-all duration-300 ease-out transform-gpu",
                        isSelected ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                    )}
                >
                    {/* --- LADO IZQUIERDO: Carrete e Identificación VHS --- */}
                    <div className="flex items-center gap-4">
                        {/* Carrete Izquierdo Animado */}
                        <div className="relative w-14 h-14 rounded-full bg-black/90 border border-zinc-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] flex items-center justify-center shrink-0">
                            <div
                                className="w-full h-full animate-spin-slow flex items-center justify-center"
                                style={{ animationDuration: isSelected ? '4s' : '15s' }}
                            >
                                <svg className="w-12 h-12 text-zinc-700/60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2.5" />
                                    <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="1.5" />
                                    <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                    <line x1="50" y1="22" x2="50" y2="40" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                    <line x1="50" y1="50" x2="25.75" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                    <line x1="50" y1="50" x2="74.25" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>

                        {/* Textos de la Identidad KAME-VHS */}
                        <div className="flex flex-col select-none justify-center shrink-0">
                            <span className="font-mono text-xs font-black tracking-widest text-[#ff6e3a]" style={{ fontFamily: "'Space Mono', monospace" }}>
                                KAME - VHS
                            </span>
                        </div>
                    </div>

                    {/* --- LADO DERECHO: Carrete Derecho --- */}
                    <div className="flex items-center gap-4 shrink-0">

                        {/* Carrete Derecho Animado */}
                        <div className="relative w-14 h-14 rounded-full bg-black/90 border border-zinc-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] flex items-center justify-center shrink-0">
                            <div
                                className="w-full h-full animate-spin-slow flex items-center justify-center"
                                style={{ animationDuration: isSelected ? '4s' : '15s' }}
                            >
                                <svg className="w-12 h-12 text-zinc-700/60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2.5" />
                                    <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="1.5" />
                                    <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                    <line x1="50" y1="22" x2="50" y2="40" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                    <line x1="50" y1="50" x2="25.75" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                    <line x1="50" y1="50" x2="74.25" y2="64" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- ESTADO COLAPSADO (VHS Spine) --- */}
                <div
                    className={cn(
                        "absolute inset-0 px-4 flex items-center justify-between py-2 z-10 transition-all duration-300 ease-out transform-gpu",
                        !isSelected ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                    )}
                >
                    {/* Tornillos laterales colapsados en los bordes */}
                    <div className="absolute left-[-7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-900 border border-zinc-950 shadow-inner flex items-center justify-center opacity-40 shrink-0 z-20">
                        <div className="absolute w-2.5 h-[1.5px] bg-zinc-950 rotate-[35deg]" />
                    </div>

                    <div
                        className={cn(
                            "h-[114px] relative flex flex-col rounded shadow-[3px_5px_12px_rgba(0,0,0,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.3)] overflow-hidden transition-all duration-400 ease-out shrink-0",
                            "w-[calc(100%-10px)] mx-auto bg-[#fbf9f1] border border-black/10"
                        )}
                    >
                        {/* Textura de papel mate granulado sobre el color crema */}
                        <div className="absolute inset-0 opacity-[0.06] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply pointer-events-none" />
                        {/* Brillo 3D sutil arriba */}
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />

                        {/* Cabecera del Sticker Oscura */}
                        <div className="relative z-10 bg-[#0d0d0d] flex items-center justify-between px-1.5 py-1 select-none border-b border-black/20">
                            <span className="font-extrabold text-[#ff6e3a] text-[8px] uppercase tracking-wider leading-none" style={{ fontFamily: "'Space Mono', monospace" }}>
                                KAME-VHS
                            </span>
                        </div>

                        {/* Bloque Crema de la etiqueta (mismo formato que expandido) */}
                        <div className="relative flex-1 text-[#1c1917] p-1.5 flex flex-col justify-between overflow-hidden">

                            {/* Título en Cormorant Garamond italic, horizontal y centrado */}
                            <div className="flex-1 flex items-center justify-center min-w-0 py-0.5">
                                <span
                                    className="font-serif italic text-zinc-900 leading-tight text-center font-light break-words w-full"
                                    style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: item.title.length > 15 ? '10px' : '11px'
                                    }}
                                >
                                    {item.title}
                                </span>
                            </div>

                            {/* Barcode y Año en la parte inferior (eliminados por requerimiento) */}
                        </div>
                    </div>

                    {/* Tornillo derecho colapsado */}
                    <div className="absolute right-[-7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-900 border border-zinc-950 shadow-inner flex items-center justify-center opacity-40 shrink-0 z-20">
                        <div className="absolute w-2.5 h-[1.5px] bg-zinc-950 rotate-[-20deg]" />
                    </div>
                </div>
            </div>
        </div>
    );
});
