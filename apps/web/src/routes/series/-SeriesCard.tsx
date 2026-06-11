import { memo } from 'react';
import { Play } from 'lucide-react';
import { DeferredImage } from '@/components/shared/deferred-image';
import { cn } from '@/components/ui/core/styling';
import { useSound } from '@/hooks/use-sound';
import { useResponsive } from '@/hooks/use-responsive';

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
    const { isMobile, isTablet } = useResponsive();
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
                flex: isSelected
                    ? (isMobile ? '1 0 82%' : (isTablet ? '1 0 60%' : '4 0 25%'))
                    : (isMobile ? '0 0 52px' : (isTablet ? '0 0 80px' : '1 0 160px')),
                transition: 'flex 550ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: "flex-grow",
                '--tape-color': getVhsColor(item.id)
            } as React.CSSProperties}
            className="h-full flex flex-col cursor-pointer overflow-hidden relative group/card border-r border-zinc-950/40"
        >
            <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0a0d16] group">
                <DeferredImage
                    src={item.img || item.poster}
                    alt={item.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-out transform-gpu ${isSelected
                        ? 'scale-[1.06]'
                        : 'scale-100'
                        }`}
                />

                {/* Highly GPU-accelerated backdrop mask overlay to replace filter: brightness */}
                <div
                    className={cn(
                        "absolute inset-0 bg-black transition-opacity duration-1000 ease-out pointer-events-none z-[1]",
                        isSelected ? "opacity-10" : "opacity-60 group-hover:opacity-45"
                    )}
                />

                {/* Cover art glossy shine wrapper */}
                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/[0.02] via-transparent to-transparent pointer-events-none z-[2]" />

                <div
                    className={`absolute inset-0 z-[1] bg-gradient-to-t from-black via-black/35 to-transparent transition-opacity duration-700 ${isSelected ? 'opacity-90' : 'opacity-60'
                        }`}
                />


                {/* Expanded details panel (Cinematic slide up) */}
                <div
                    className={cn(
                        "absolute inset-0 p-6 md:p-12 z-20 flex flex-col justify-end h-full w-full bg-gradient-to-t from-black/90 via-black/45 to-transparent transition-opacity duration-500 ease-out transform-gpu",
                        isSelected ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                >
                    <div className={cn(
                        "bg-black/70 backdrop-blur-md border border-white/[0.08] p-5 md:p-6 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] max-w-lg transition-[opacity,transform] duration-500 ease-out transform-gpu delay-75",
                        isSelected ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
                    )}>
                        {/* Category Tag & Year */}
                        <div className={cn(
                            "flex items-center gap-3 mb-3 select-none transition-[opacity,transform] duration-500 transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-150" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            <span className="px-2 py-0.5 bg-brand-orange/20 text-brand-orange border border-brand-orange/30 rounded text-[9px] font-black tracking-widest uppercase shadow-[0_0_15px_rgba(255,110,58,0.15)]">
                                Serie
                            </span>
                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                                {item.year} • {item.eps} EPS
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className={cn(
                            "text-xl md:text-2xl font-black text-white mb-3 leading-tight tracking-tight drop-shadow-md line-clamp-2 transition-[opacity,transform] duration-500 transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-200" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            {item.title}
                        </h3>

                        {/* Description */}
                        <p className={cn(
                            "text-white/60 text-xs leading-relaxed mb-4 font-medium line-clamp-3 transition-[opacity,transform] duration-500 transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-250" : "opacity-0 translate-y-4 delay-0"
                        )}>
                            {item.desc}
                        </p>

                        {/* Progress Bar */}
                        <div className={cn(
                            "flex flex-col mb-4 w-full transition-[opacity,transform] duration-500 transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-300" : "opacity-0 translate-y-4 delay-0"
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
                            "flex gap-4 transition-[opacity,transform] duration-500 transform-gpu",
                            isSelected ? "opacity-100 translate-y-0 delay-350" : "opacity-0 translate-y-4 delay-0"
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

            {/* VHS Spine bottom bar */}
            <div 
                className={cn(
                    "relative shrink-0 bg-[#0d0d0d] flex items-center justify-between px-4 z-20 h-[110px] w-full min-w-0 select-none overflow-hidden transition-all duration-500 ease-out transform-gpu vhs-spine-glow",
                    "border-t border-[#ff6e3a]/40"
                )}
                style={{
                    boxShadow: isSelected
                        ? `0 -8px 30px ${getVhsColor(item.id)}22, inset 0 3px 5px rgba(255,255,255,0.06), inset 0 -3px 5px rgba(0,0,0,0.8)`
                        : '0 -6px 20px rgba(0,0,0,0.65), inset 0 3px 5px rgba(255,255,255,0.04), inset 0 -3px 5px rgba(0,0,0,0.8)',
                    borderImage: isSelected ? `linear-gradient(90deg, ${getVhsColor(item.id)}80, #ff6e3a60, ${getVhsColor(item.id)}80) 1` : undefined,
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
                    <div className="hidden lg:flex items-center gap-4">
                        {/* Carrete Izquierdo Animado */}
                        <div className="relative w-14 h-14 rounded-full bg-black/90 border border-zinc-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] flex items-center justify-center shrink-0">
                            <div className="w-full h-full animate-spin-slow flex items-center justify-center">
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
                        <div className="flex flex-col select-none justify-center">
                            <span className="font-mono text-xs font-black tracking-widest text-[#ff6e3a]" style={{ fontFamily: "'Space Mono', monospace" }}>
                                KAME - VHS
                            </span>
                            <span className="font-mono text-[9px] font-bold text-zinc-600 tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>
                                HG · T-128
                            </span>
                        </div>
                    </div>

                    {/* Separador Izquierdo */}
                    <div className="hidden lg:block h-12 w-[1px] bg-zinc-800/80 mx-2" />

                    {/* --- CENTRO: Label Card en Crema --- */}
                    <div className="flex-1 max-w-xl mx-1 md:mx-4 bg-[#fbf9f1] text-[#1c1917] h-[98px] rounded shadow-[0_4px_15px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(255,255,255,0.9)] border border-amber-950/10 p-3.5 flex justify-between items-center relative overflow-hidden">
                        {/* Textura de papel crema mate */}
                        <div className="absolute inset-0 opacity-[0.06] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply pointer-events-none" />
                        
                        {/* Metadatos y Título */}
                        <div className="flex flex-col justify-between h-full flex-1 min-w-0 pr-4">
                            <div 
                                className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] flex items-center gap-6"
                                style={{ fontFamily: "'Space Mono', monospace" }}
                            >
                                <span>LIBRARY COLLECTION</span>
                                <span>NO. {String(item.id % 100).padStart(2, '0')}</span>
                            </div>
                            <h2 
                                className="text-xl md:text-2xl font-light text-zinc-900 italic tracking-wide leading-tight truncate w-full"
                                style={{ fontFamily: "'Cormorant Garamond', serif" }}
                            >
                                {item.title}
                            </h2>
                        </div>

                        {/* Código de Barras y Año */}
                        <div className="flex flex-col items-end justify-between h-full shrink-0 pl-4 border-l border-zinc-200/80">
                            {/* Código de Barras SVG */}
                            <svg className="hidden md:block w-16 h-8 text-zinc-950" viewBox="0 0 100 40" fill="currentColor">
                                <rect x="0" y="0" width="3" height="40" />
                                <rect x="5" y="0" width="1" height="40" />
                                <rect x="8" y="0" width="4" height="40" />
                                <rect x="14" y="0" width="2" height="40" />
                                <rect x="18" y="0" width="1" height="40" />
                                <rect x="21" y="0" width="3" height="40" />
                                <rect x="26" y="0" width="2" height="40" />
                                <rect x="30" y="0" width="1" height="40" />
                                <rect x="33" y="0" width="5" height="40" />
                                <rect x="40" y="0" width="1" height="40" />
                                <rect x="43" y="0" width="2" height="40" />
                                <rect x="47" y="0" width="3" height="40" />
                                <rect x="52" y="0" width="1" height="40" />
                                <rect x="55" y="0" width="4" height="40" />
                                <rect x="61" y="0" width="2" height="40" />
                                <rect x="65" y="0" width="1" height="40" />
                                <rect x="68" y="0" width="3" height="40" />
                                <rect x="73" y="0" width="2" height="40" />
                                <rect x="77" y="0" width="5" height="40" />
                                <rect x="84" y="0" width="1" height="40" />
                                <rect x="87" y="0" width="3" height="40" />
                                <rect x="92" y="0" width="2" height="40" />
                                <rect x="96" y="0" width="4" height="40" />
                            </svg>
                            {/* Año Boxed */}
                            <div 
                                className="border border-zinc-300 rounded px-1.5 py-0.2 text-[9px] font-bold text-zinc-500 tracking-wider bg-white/50"
                                style={{ fontFamily: "'Space Mono', monospace" }}
                            >
                                {item.year}
                            </div>
                        </div>
                    </div>

                    {/* Separador Derecho */}
                    <div className="hidden lg:block h-12 w-[1px] bg-zinc-800/80 mx-2" />

                    {/* --- LADO DERECHO: Badges y Carrete Derecho --- */}
                    <div className="hidden lg:flex items-center gap-4">
                        {/* Badges tipo Píldora stacked */}
                        <div className="flex flex-col gap-1.5 justify-center items-end">
                            <div className="bg-[#bc0054] text-white text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest text-center shadow-sm select-none" style={{ fontFamily: "'Space Mono', monospace" }}>
                                BE KIND - REWIND
                            </div>
                            <div className="bg-[#d4af37] text-zinc-950 text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest text-center shadow-sm select-none" style={{ fontFamily: "'Space Mono', monospace" }}>
                                RENTAL ONLY
                            </div>
                        </div>

                        {/* Carrete Derecho Animado */}
                        <div className="relative w-14 h-14 rounded-full bg-black/90 border border-zinc-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] flex items-center justify-center shrink-0">
                            <div className="w-full h-full animate-spin-slow flex items-center justify-center">
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
                    {(isMobile || isTablet) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center relative select-none">
                            {/* Un sticker vertical muy minimalista con el número de la cinta */}
                            <div className="h-[90px] w-5 rounded bg-[#fbf9f1] border border-black/10 flex flex-col items-center justify-between py-2 shadow-inner">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getVhsColor(item.id) }} />
                                <span 
                                    className="font-mono text-[8px] font-black text-zinc-850 rotate-90 leading-none my-auto"
                                    style={{ fontFamily: "'Space Mono', monospace" }}
                                >
                                    {String(item.id % 100).padStart(2, '0')}
                                </span>
                                <div className="w-1.5 h-0.5 bg-zinc-400/50 rounded-xs" />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Tornillos laterales colapsados en los bordes */}
                            <div className="absolute left-[-7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-zinc-650 via-zinc-750 to-zinc-900 border border-zinc-950 shadow-[0_1px_4px_rgba(0,0,0,0.6)] flex items-center justify-center opacity-60 shrink-0 z-20">
                                <div className="absolute w-2.5 h-[1.5px] bg-zinc-950 rotate-[35deg]" />
                            </div>

                            <div
                                className={cn(
                                    "h-[90px] relative flex flex-col rounded shadow-[0_4px_12px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.4)] overflow-hidden transition-all duration-400 ease-out shrink-0",
                                    "w-[calc(100%-12px)] mx-auto bg-[#faf8f5] border border-black/20"
                                )}
                            >
                                {/* Retro Brand Accent Strip (TDK / Maxell style horizontal color stripes) */}
                                <div className="h-2 w-full flex shrink-0">
                                    <div className="flex-1 h-full bg-[#e63946]" />
                                    <div className="flex-1 h-full bg-[#f4a261]" />
                                    <div className="flex-1 h-full bg-[#e9c46a]" />
                                    <div className="flex-1 h-full bg-[#2a9d8f]" />
                                    <div className="flex-1 h-full bg-[#264653]" />
                                </div>

                                {/* Sticker Body */}
                                <div className="flex-1 p-2 flex flex-col justify-between relative bg-[#faf8f5] text-zinc-900">
                                    {/* Textura de papel mate granulado sobre el sticker */}
                                    <div className="absolute inset-0 opacity-[0.06] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply pointer-events-none" />
                                    
                                    {/* Top Header metadata */}
                                    <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-wider text-zinc-500 font-mono">
                                        <span>VHS T-120</span>
                                        <span className="text-zinc-400">NO. {String(item.id % 100).padStart(2, '0')}</span>
                                        <span>SP MODE</span>
                                    </div>

                                    {/* Título en tipografía monoespaciada tipo máquina de escribir */}
                                    <div className="flex-1 flex items-center justify-center py-1">
                                        <span 
                                            className="font-mono text-zinc-900 font-bold tracking-tight text-center truncate max-w-full px-1 uppercase text-[10px]"
                                            style={{ 
                                                fontFamily: "'Courier New', Courier, monospace",
                                            }}
                                        >
                                            {item.title}
                                        </span>
                                    </div>

                                    {/* Barcode y Año en la parte inferior */}
                                    <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 gap-1">
                                        {/* Barcode SVG miniaturizado */}
                                        <svg className="w-10 h-3.5 text-zinc-900 shrink-0 opacity-80" viewBox="0 0 100 40" fill="currentColor">
                                            <rect x="0" y="0" width="3" height="40" />
                                            <rect x="8" y="0" width="4" height="40" />
                                            <rect x="18" y="0" width="2" height="40" />
                                            <rect x="28" y="0" width="1" height="40" />
                                            <rect x="34" y="0" width="5" height="40" />
                                            <rect x="46" y="0" width="2" height="40" />
                                            <rect x="54" y="0" width="3" height="40" />
                                            <rect x="64" y="0" width="1" height="40" />
                                            <rect x="72" y="0" width="4" height="40" />
                                            <rect x="82" y="0" width="2" height="40" />
                                            <rect x="90" y="0" width="5" height="40" />
                                        </svg>
                                        
                                        {/* Sello de año tipo alquiler */}
                                        <div 
                                            className="border border-[#e63946]/30 text-[#e63946] rounded px-1.5 py-0.2 text-[8px] font-black tracking-widest bg-white/50 leading-none shrink-0"
                                            style={{ fontFamily: "'Space Mono', monospace" }}
                                        >
                                            {item.year}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tornillo derecho colapsado */}
                            <div className="absolute right-[-7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-zinc-650 via-zinc-750 to-zinc-900 border border-zinc-950 shadow-[0_1px_4px_rgba(0,0,0,0.6)] flex items-center justify-center opacity-60 shrink-0 z-20">
                                <div className="absolute w-2.5 h-[1.5px] bg-zinc-950 rotate-[-20deg]" />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});
